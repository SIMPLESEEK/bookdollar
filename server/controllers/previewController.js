const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const https = require('https');
const axios = require('axios');
const colorPreviewService = require('../services/colorPreviewService');

// 尝试加载各种预览图服务，如果失败则使用颜色预览
let screenshotService;
let mcpScreenshotService;
let imageExtractorService;

// 尝试加载图片提取服务
try {
  imageExtractorService = require('../services/imageExtractorService');
  console.log('图片提取服务加载成功');
} catch (error) {
  console.log('图片提取服务加载失败:', error.message);
  imageExtractorService = null;
}

// 尝试加载Puppeteer截图服务
try {
  screenshotService = require('../services/screenshotService');
} catch (error) {
  console.log('Puppeteer截图服务加载失败，将尝试其他方案');
  screenshotService = null;
}

// 尝试加载MCP截图服务
try {
  mcpScreenshotService = require('../services/mcpScreenshotService');
  console.log('MCP截图服务加载成功');
} catch (error) {
  console.log('MCP截图服务加载失败:', error.message);
  mcpScreenshotService = null;
}

// 确保预览图目录存在
const previewDir = path.join(__dirname, '../../client/public/previews');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

// 生成预览图
exports.generatePreview = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: '缺少URL参数' });
    }

    // 为URL生成唯一的文件名
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const fileName = `${urlHash}.jpg`;
    const filePath = path.join(previewDir, fileName);
    const publicPath = `/previews/${fileName}`;

    // 检查是否已经有缓存的预览图
    if (fs.existsSync(filePath)) {
      // 获取文件的创建时间
      const stats = await promisify(fs.stat)(filePath);
      const fileAge = Date.now() - stats.mtime.getTime();

      // 如果文件不超过7天，直接返回缓存的预览图
      if (fileAge < 7 * 24 * 60 * 60 * 1000) {
        // 尝试获取网页标题
        let pageTitle = '';
        try {
          // 使用简单的HTTP请求获取网页标题
          const titleResponse = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            timeout: 5000,
            httpsAgent: new https.Agent({
              rejectUnauthorized: false
            })
          });

          // 使用正则表达式提取标题
          const titleMatch = titleResponse.data.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            pageTitle = titleMatch[1].trim();
            console.log(`提取到网页标题: ${pageTitle}`);
          }

          // 对于特定网站的特殊处理
          if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
            pageTitle = '夸克';
            console.log(`特殊处理夸克网站，设置标题为: ${pageTitle}`);
          }
        } catch (error) {
          console.error('获取网页标题失败:', error.message);
        }

        return res.json({
          previewImage: publicPath,
          pageTitle: pageTitle || ''
        });
      }
    }

    console.log(`正在为URL生成预览图: ${url}`);

    // 首先尝试使用图片提取服务
    if (imageExtractorService) {
      try {
        console.log('尝试使用图片提取服务获取预览图');
        const extractResult = await imageExtractorService.extractImageFromUrl(url);

        if (extractResult.success) {
          console.log(`图片提取成功: ${extractResult.previewImage}, 标题: ${extractResult.pageTitle || '无标题'}`);
          return res.json({
            previewImage: extractResult.previewImage,
            pageTitle: extractResult.pageTitle || ''
          });
        } else {
          console.log('图片提取失败，尝试其他方法');
        }
      } catch (error) {
        console.error('图片提取失败:', error.message);
      }
    }

    // 如果图片提取服务不可用或失败，尝试使用MCP截图服务
    if (mcpScreenshotService) {
      try {
        console.log('尝试使用MCP截图服务生成预览图');
        const mcpResult = await mcpScreenshotService.generateScreenshot(url, 1200, 630);

        if (mcpResult.success) {
          console.log(`MCP预览图生成成功: ${mcpResult.previewImage}`);
          return res.json({ previewImage: mcpResult.previewImage });
        } else {
          console.log('MCP截图服务生成失败，尝试其他方法');
        }
      } catch (error) {
        console.error('MCP截图失败:', error.message);
      }
    }

    // 如果MCP服务不可用或截图失败，尝试使用Puppeteer
    if (screenshotService) {
      try {
        console.log('尝试使用Puppeteer生成预览图');
        const result = await screenshotService.generateScreenshot(url, 1200, 630);

        if (result.success) {
          console.log(`Puppeteer预览图生成成功: ${result.previewImage}`);
          return res.json({ previewImage: result.previewImage });
        }
      } catch (error) {
        console.error('Puppeteer截图失败:', error.message);
      }
    }

    // 如果所有服务都不可用或失败，使用颜色预览作为备选方案
    console.log(`所有预览图服务都失败，使用颜色预览作为备选方案`);

    // 尝试获取网页标题
    let pageTitle = '';
    try {
      // 使用简单的HTTP请求获取网页标题
      const titleResponse = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 5000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      // 使用正则表达式提取标题
      const titleMatch = titleResponse.data.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        pageTitle = titleMatch[1].trim();
        console.log(`提取到网页标题: ${pageTitle}`);
      }
    } catch (error) {
      console.error('获取网页标题失败:', error.message);
    }

    const colorPreview = colorPreviewService.generateColorPreview(url, pageTitle);

    // 返回颜色预览信息
    return res.json({
      previewImage: '',
      colorPreview: colorPreview,
      pageTitle: pageTitle || ''
    });
  } catch (error) {
    console.error('生成预览图失败:', error);

    // 如果API调用失败，返回空预览图
    res.status(500).json({
      message: '生成预览图失败',
      previewImage: ''
    });
  }
};

// 获取预览图
exports.getPreview = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ message: '缺少URL参数' });
    }

    // 为URL生成唯一的文件名
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const fileName = `${urlHash}.jpg`;
    const filePath = path.join(previewDir, fileName);
    const publicPath = `/previews/${fileName}`;

    // 检查是否已经有缓存的预览图
    if (fs.existsSync(filePath)) {
      // 尝试获取网页标题
      let pageTitle = '';
      try {
        // 使用简单的HTTP请求获取网页标题
        const titleResponse = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: 5000,
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          })
        });

        // 使用正则表达式提取标题
        const titleMatch = titleResponse.data.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].trim();
          console.log(`提取到网页标题: ${pageTitle}`);
        }

        // 对于特定网站的特殊处理
        if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
          pageTitle = '夸克';
          console.log(`特殊处理夸克网站，设置标题为: ${pageTitle}`);
        }
      } catch (error) {
        console.error('获取网页标题失败:', error.message);
      }

      return res.json({
        previewImage: publicPath,
        pageTitle: pageTitle || ''
      });
    }

    // 首先尝试使用图片提取服务
    if (imageExtractorService) {
      try {
        // 检查腾讯云COS上是否有预览图
        const extractorCosPreviewPath = await imageExtractorService.getFromCOS(fileName);
        if (extractorCosPreviewPath) {
          console.log('从图片提取服务的COS缓存获取预览图成功');
          return res.json({ previewImage: extractorCosPreviewPath });
        }

        // 如果本地和COS都没有，尝试提取图片
        console.log('尝试使用图片提取服务获取预览图');
        const extractResult = await imageExtractorService.extractImageFromUrl(url);
        if (extractResult.success) {
          console.log(`图片提取成功: ${extractResult.previewImage}, 标题: ${extractResult.pageTitle || '无标题'}`);
          return res.json({
            previewImage: extractResult.previewImage,
            pageTitle: extractResult.pageTitle || ''
          });
        } else {
          console.log('图片提取失败，尝试其他方法');
        }
      } catch (error) {
        console.error('图片提取服务错误:', error.message);
      }
    }

    // 如果图片提取服务不可用或失败，尝试从MCP服务获取或生成预览图
    if (mcpScreenshotService) {
      try {
        // 检查腾讯云COS上是否有预览图
        const mcpCosPreviewPath = await mcpScreenshotService.getFromCOS(fileName);
        if (mcpCosPreviewPath) {
          console.log('从MCP服务的COS缓存获取预览图成功');
          return res.json({ previewImage: mcpCosPreviewPath });
        }

        // 如果本地和COS都没有，尝试使用MCP生成预览图
        console.log('尝试使用MCP服务生成预览图');
        const mcpResult = await mcpScreenshotService.generateScreenshot(url, 1200, 630);
        if (mcpResult.success) {
          console.log(`MCP预览图生成成功: ${mcpResult.previewImage}`);
          return res.json({ previewImage: mcpResult.previewImage });
        } else {
          console.log('MCP截图服务生成失败，尝试其他方法');
        }
      } catch (error) {
        console.error('MCP服务错误:', error.message);
      }
    }

    // 如果MCP服务不可用或截图失败，尝试使用Puppeteer
    if (screenshotService) {
      try {
        // 检查腾讯云COS上是否有预览图
        const cosPreviewPath = await screenshotService.getFromCOS(fileName);
        if (cosPreviewPath) {
          console.log('从Puppeteer服务的COS缓存获取预览图成功');
          return res.json({ previewImage: cosPreviewPath });
        }

        // 如果本地和COS都没有，尝试使用Puppeteer生成预览图
        console.log('尝试使用Puppeteer生成预览图');
        const result = await screenshotService.generateScreenshot(url, 1200, 630);
        if (result.success) {
          console.log(`Puppeteer预览图生成成功: ${result.previewImage}`);
          return res.json({ previewImage: result.previewImage });
        }
      } catch (error) {
        console.error('Puppeteer服务错误:', error.message);
      }
    }

    // 如果所有服务都不可用或失败，使用颜色预览作为备选方案
    console.log(`所有预览图服务都失败，使用颜色预览作为备选方案`);

    // 尝试获取网页标题
    let pageTitle = '';
    try {
      // 使用简单的HTTP请求获取网页标题
      const titleResponse = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 5000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      // 使用正则表达式提取标题
      const titleMatch = titleResponse.data.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        pageTitle = titleMatch[1].trim();
        console.log(`提取到网页标题: ${pageTitle}`);
      }
    } catch (error) {
      console.error('获取网页标题失败:', error.message);
    }

    const colorPreview = colorPreviewService.generateColorPreview(url, pageTitle);

    // 返回颜色预览信息
    return res.json({
      previewImage: '',
      colorPreview: colorPreview,
      pageTitle: pageTitle || ''
    });
  } catch (error) {
    console.error('获取预览图失败:', error);
    res.status(500).json({
      message: '获取预览图失败',
      previewImage: ''
    });
  }
};
