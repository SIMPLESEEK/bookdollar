const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const https = require('https');

// 腾讯云COS
let cos = null;
try {
  const COS = require('cos-nodejs-sdk-v5');

  // 如果配置了腾讯云COS，则初始化COS对象
  if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY) {
    cos = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY
    });
  }
} catch (error) {
  console.error('腾讯云COS SDK加载失败:', error.message);
}

// 在Vercel环境中，我们不能依赖本地文件系统
// 定义预览图目录路径，但在Vercel环境中不会实际创建
const previewDir = process.env.VERCEL
  ? '/tmp/previews' // 在Vercel中使用临时目录
  : path.join(__dirname, '../../client/public/previews');

// 只在非Vercel环境中创建目录
if (!process.env.VERCEL && !fs.existsSync(previewDir)) {
  try {
    fs.mkdirSync(previewDir, { recursive: true });
    console.log(`[图片提取] 创建预览图目录: ${previewDir}`);
  } catch (error) {
    console.error(`[图片提取] 创建预览图目录失败: ${error.message}`);
  }
}

/**
 * 从网页中提取图片和标题作为预览图，优先存储在腾讯云COS上
 * @param {string} url 目标网址
 * @returns {Promise<{success: boolean, previewImage: string, pageTitle: string}>} 结果对象
 */
async function extractImageFromUrl(url) {
  console.log(`[图片提取] 正在从URL提取图片和标题: ${url}`);

  // 检查环境和配置
  if (process.env.VERCEL) {
    console.log(`[图片提取] 在Vercel环境中运行`);
    console.log(`[图片提取] COS配置: Bucket=${process.env.COS_BUCKET ? '已配置' : '未配置'}, Region=${process.env.COS_REGION || '未配置'}`);
    console.log(`[图片提取] COS对象状态: ${cos ? '已初始化' : '未初始化'}`);
  }

  // 移除URL中的查询参数，以便更好地匹配缓存
  let baseUrl = url;
  try {
    // 验证URL格式
    if (!url || typeof url !== 'string') {
      console.error(`[图片提取] 无效的URL: ${url}`);
      return {
        success: false,
        message: '无效的URL',
        previewImage: '',
        pageTitle: ''
      };
    }

    // 尝试解析URL
    const urlObj = new URL(url);
    console.log(`[图片提取] URL解析成功: ${urlObj.href}`);

    // 如果URL中有查询参数，移除它们
    if (urlObj.search) {
      baseUrl = url.replace(urlObj.search, '');
      console.log(`[图片提取] 移除查询参数后的URL: ${baseUrl}`);
    }
  } catch (error) {
    // 如果URL解析失败，使用原始URL
    console.error(`[图片提取] URL解析失败: ${error.message}`);
    console.error(`[图片提取] 错误堆栈: ${error.stack}`);

    // 尝试修复常见的URL问题
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      baseUrl = 'https://' + url;
      console.log(`[图片提取] 尝试修复URL: ${baseUrl}`);
    }
  }

  // 特殊处理acuitybrands.com网站
  if (baseUrl.includes('hydrel.acuitybrands.com')) {
    console.log(`[图片提取] 特殊处理Hydrel网站`);
    // 使用一个公共的图片URL作为备选
    const heroImage = 'https://www.acuitybrands.com/-/media/abl/acuitybrands/images/products/lithonia/wf4-led-hero.jpg';

    // 为URL生成唯一的文件名
    const urlHash = crypto.createHash('md5').update(baseUrl).digest('hex');
    const fileName = `${urlHash}.jpg`;
    const filePath = path.join(previewDir, fileName);
    const publicPath = `/previews/${fileName}`;

    try {
      // 下载图片
      console.log(`[图片提取] 下载预设图片: ${heroImage}`);
      const imageResponse = await axios.get(heroImage, {
        responseType: 'arraybuffer',
        timeout: 15000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      // 保存到本地
      await promisify(fs.writeFile)(filePath, imageResponse.data);
      console.log(`[图片提取] 预设图片已保存到本地: ${filePath}`);

      // 上传到COS
      if (cos && process.env.COS_BUCKET) {
        try {
          const cosUrl = await uploadToCOS(fileName, imageResponse.data);
          console.log(`[图片提取] 预设图片已上传到腾讯云COS: ${cosUrl}`);
        } catch (cosError) {
          console.error('[图片提取] 上传预设图片到腾讯云COS失败:', cosError.message);
        }
      }

      return {
        success: true,
        previewImage: publicPath,
        originalImageUrl: heroImage
      };
    } catch (error) {
      console.error('[图片提取] 下载预设图片失败:', error.message);
      // 如果下载失败，继续使用常规方法
    }
  }

  // 为URL生成唯一的文件名
  const urlHash = crypto.createHash('md5').update(baseUrl).digest('hex');
  const fileName = `${urlHash}.jpg`;
  const filePath = path.join(previewDir, fileName);
  const publicPath = `/previews/${fileName}`;

  try {
    // 首先检查腾讯云COS上是否有预览图
    if (cos && process.env.COS_BUCKET) {
      try {
        const cosPreviewPath = await getFromCOS(fileName);
        if (cosPreviewPath) {
          console.log(`[图片提取] 从COS获取预览图成功: ${cosPreviewPath}`);
          return { success: true, previewImage: cosPreviewPath };
        }
      } catch (error) {
        console.error('[图片提取] 从COS获取预览图失败:', error.message);
      }
    }

    // 如果COS上没有，检查本地是否有缓存
    if (fs.existsSync(filePath)) {
      // 获取文件的创建时间
      const stats = await promisify(fs.stat)(filePath);
      const fileAge = Date.now() - stats.mtime.getTime();

      // 如果文件不超过7天，直接返回缓存的预览图
      if (fileAge < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[图片提取] 使用本地缓存的预览图: ${filePath}`);

        // 如果配置了腾讯云COS，将本地缓存上传到COS
        if (cos && process.env.COS_BUCKET) {
          try {
            const fileData = await promisify(fs.readFile)(filePath);
            await uploadToCOS(fileName, fileData);
            console.log(`[图片提取] 本地缓存已上传到COS`);
          } catch (uploadError) {
            console.error('[图片提取] 上传本地缓存到COS失败:', uploadError.message);
          }
        }

        return { success: true, previewImage: publicPath };
      }
    }

    // 获取网页内容
    console.log(`[图片提取] 正在获取网页内容: ${url}`);

    try {
      // 设置请求选项
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: 15000, // 增加超时时间
        maxContentLength: 10 * 1024 * 1024, // 限制响应大小为10MB
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        // 在Vercel环境中，添加更多的选项
        validateStatus: function (status) {
          return status >= 200 && status < 400; // 只接受2xx和3xx的状态码
        }
      };

      console.log(`[图片提取] 发送HTTP请求，超时设置: ${options.timeout}ms`);
      const response = await axios.get(url, options);

      // 检查响应
      if (!response || !response.data) {
        console.error(`[图片提取] 获取网页内容失败: 响应为空`);
        return {
          success: false,
          message: '获取网页内容失败: 响应为空',
          previewImage: '',
          pageTitle: ''
        };
      }

      console.log(`[图片提取] 成功获取网页内容，状态码: ${response.status}, 长度: ${response.data.length} 字节`);

      // 检查内容类型
      const contentType = response.headers['content-type'] || '';
      console.log(`[图片提取] 内容类型: ${contentType}`);

      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        console.warn(`[图片提取] 警告: 内容类型不是HTML (${contentType}), 但仍将尝试解析`);
      }

      // 使用cheerio解析HTML
      console.log(`[图片提取] 开始解析HTML内容`);
      const $ = cheerio.load(response.data);

      // 提取网页标题
      let pageTitle = '';

      // 首先尝试获取Open Graph标题
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle) {
        pageTitle = ogTitle;
        console.log(`[图片提取] 从Open Graph获取到标题: ${pageTitle}`);
      }
      // 然后尝试获取Twitter卡片标题
      else if ($('meta[name="twitter:title"]').attr('content')) {
        pageTitle = $('meta[name="twitter:title"]').attr('content');
        console.log(`[图片提取] 从Twitter卡片获取到标题: ${pageTitle}`);
      }
      // 然后尝试获取HTML标题标签
      else if ($('title').text()) {
        pageTitle = $('title').text().trim();
        console.log(`[图片提取] 从HTML标题标签获取到标题: ${pageTitle}`);
      }

      // 提取域名
      let domain = '';
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
        console.log(`[图片提取] 提取到域名: ${domain}`);
      } catch (error) {
        console.error(`[图片提取] 域名提取失败: ${error.message}`);
      }

      // 如果标题是空的或者与域名相同，尝试其他方法
      if (!pageTitle || pageTitle === domain) {
        // 尝试获取H1标签
        const h1Text = $('h1').first().text().trim();
        if (h1Text) {
          pageTitle = h1Text;
          console.log(`[图片提取] 从H1标签获取到标题: ${pageTitle}`);
        }
        // 尝试获取应用名称
        else if ($('meta[name="application-name"]').attr('content')) {
          pageTitle = $('meta[name="application-name"]').attr('content');
          console.log(`[图片提取] 从应用名称获取到标题: ${pageTitle}`);
        }
      }

      // 对于特定网站的特殊处理
      if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
        pageTitle = '夸克';
        console.log(`[图片提取] 特殊处理夸克网站，设置标题为: ${pageTitle}`);
      }

      console.log(`[图片提取] 最终提取到的网页标题: ${pageTitle}`);

      // 尝试获取最佳图片（非logo）
      console.log(`[图片提取] 开始查找最佳图片...`);
      const imageUrl = findBestImage($, url);

      if (!imageUrl) {
        console.log(`[图片提取] 未找到合适的图片: ${url}`);
        // 在Vercel环境中，如果找不到图片，返回颜色预览
        return {
          success: false,
          previewImage: '',
          pageTitle: pageTitle || ''
        };
      }

      console.log(`[图片提取] 成功找到最佳图片: ${imageUrl}`);

      // 下载图片
      try {
        console.log(`[图片提取] 开始下载图片: ${imageUrl}`);
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 15000, // 增加超时时间
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          })
        });

        console.log(`[图片提取] 图片下载成功，大小: ${imageResponse.data.length} 字节`);

        // 生成唯一文件名
        const fileName = `preview-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        console.log(`[图片提取] 生成文件名: ${fileName}`);

        // 优先上传到腾讯云COS
        let cosUrl = '';
        if (cos && process.env.COS_BUCKET) {
          try {
            cosUrl = await uploadToCOS(fileName, imageResponse.data);
            console.log(`[图片提取] 图片已上传到腾讯云COS: ${cosUrl}`);

            // 在非Vercel环境中，同时保存到本地作为缓存
            if (!process.env.VERCEL) {
              try {
                // 确定文件路径
                const uploadDir = path.join(__dirname, '../../client/public/previews');
                const filePath = path.join(uploadDir, fileName);
                const publicPath = `/previews/${fileName}`;

                // 确保目录存在
                if (!fs.existsSync(uploadDir)) {
                  fs.mkdirSync(uploadDir, { recursive: true });
                }

                await promisify(fs.writeFile)(filePath, imageResponse.data);
                console.log(`[图片提取] 图片已保存到本地作为缓存: ${filePath}`);
              } catch (fsError) {
                console.error(`[图片提取] 保存到本地缓存失败: ${fsError.message}`);
              }
            }

            // 构建COS URL
            let finalUrl;
            if (process.env.COS_DOMAIN) {
              finalUrl = `${process.env.COS_DOMAIN}/previews/${fileName}`;
            } else {
              finalUrl = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/previews/${fileName}`;
            }

            // 返回COS URL
            return {
              success: true,
              previewImage: finalUrl, // 使用完整的COS URL
              originalImageUrl: imageUrl,
              pageTitle: pageTitle || ''
            };
          } catch (cosError) {
            console.error('[图片提取] 上传到腾讯云COS失败:', cosError.message);
          }
        }
      } catch (downloadError) {
        console.error(`[图片提取] 下载图片失败: ${downloadError.message}`);
        return {
          success: false,
          message: `下载图片失败: ${downloadError.message}`,
          previewImage: '',
          pageTitle: pageTitle || ''
        };
      }

      // 如果COS上传失败或未配置COS
      if (!process.env.VERCEL) {
        // 在非Vercel环境中，保存到本地
        try {
          // 确定文件路径
          const uploadDir = path.join(__dirname, '../../client/public/previews');
          const fileName = `preview-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
          const filePath = path.join(uploadDir, fileName);
          const publicPath = `/previews/${fileName}`;

          // 确保目录存在
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          await promisify(fs.writeFile)(filePath, imageResponse.data);
          console.log(`[图片提取] 图片已保存到本地: ${filePath}`);

          return {
            success: true,
            previewImage: publicPath,
            originalImageUrl: imageUrl,
            pageTitle: pageTitle || ''
          };
        } catch (fsError) {
          console.error(`[图片提取] 保存到本地失败: ${fsError.message}`);
        }
      }

      // 在Vercel环境中，如果COS上传失败，返回失败
      return {
        success: false,
        previewImage: '',
        originalImageUrl: imageUrl,
        pageTitle: pageTitle || ''
      };
    } catch (error) {
      console.error('[图片提取] 提取图片失败:', error.message);
      console.error('[图片提取] 错误堆栈:', error.stack);
      return {
        success: false,
        message: `提取图片失败: ${error.message}`,
        previewImage: '',
        pageTitle: pageTitle || '' // 即使提取图片失败，也返回已获取的标题
      };
    }
}

/**
 * 从HTML中找到最佳的图片URL，优先选择非logo的内容图片
 * @param {CheerioStatic} $ Cheerio对象
 * @param {string} baseUrl 基础URL，用于解析相对路径
 * @returns {string|null} 图片URL或null
 */
function findBestImage($, baseUrl) {
  console.log(`[图片提取] findBestImage: 开始从HTML中查找最佳图片，基础URL: ${baseUrl}`);

  let bestImage = null;
  let bestScore = 0;
  let allImages = [];

  try {
    // 1. 首先尝试获取Open Graph图片（通常是页面的主要图片）
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      console.log(`[图片提取] findBestImage: 找到Open Graph图片: ${ogImage}`);
      const ogImageUrl = resolveUrl(ogImage, baseUrl);
      // 检查是否是logo
      if (ogImageUrl && !isLikelyLogo(ogImageUrl, '')) {
        console.log(`[图片提取] findBestImage: 使用Open Graph图片: ${ogImageUrl}`);
        return ogImageUrl;
      } else {
        console.log(`[图片提取] findBestImage: Open Graph图片可能是logo或无效，继续查找`);
      }
    } else {
      console.log(`[图片提取] findBestImage: 未找到Open Graph图片`);
    }

    // 2. 尝试获取Twitter卡片图片
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) {
      console.log(`[图片提取] findBestImage: 找到Twitter卡片图片: ${twitterImage}`);
      const twitterImageUrl = resolveUrl(twitterImage, baseUrl);
      // 检查是否是logo
      if (twitterImageUrl && !isLikelyLogo(twitterImageUrl, '')) {
        console.log(`[图片提取] findBestImage: 使用Twitter卡片图片: ${twitterImageUrl}`);
        return twitterImageUrl;
      } else {
        console.log(`[图片提取] findBestImage: Twitter卡片图片可能是logo或无效，继续查找`);
      }
    } else {
      console.log(`[图片提取] findBestImage: 未找到Twitter卡片图片`);
    }
  } catch (error) {
    console.error(`[图片提取] findBestImage: 处理元数据图片时出错: ${error.message}`);
  }

  // 3. 查找所有图片并评分
  console.log(`[图片提取] findBestImage: 开始查找所有图片并评分`);

  try {
    const imgElements = $('img');
    console.log(`[图片提取] findBestImage: 找到 ${imgElements.length} 个图片元素`);

    $('img').each((i, el) => {
      try {
        const img = $(el);
        const src = img.attr('src');
        const dataSrc = img.attr('data-src'); // 懒加载图片
        const dataSrcSet = img.attr('data-srcset'); // 另一种懒加载格式
        const lazyLoad = img.attr('data-lazy-src'); // 另一种懒加载格式
        const srcset = img.attr('srcset');
        const alt = img.attr('alt') || '';
        const className = img.attr('class') || '';
        const id = img.attr('id') || '';

        // 跳过没有src的图片
        if (!src && !dataSrc && !srcset && !dataSrcSet && !lazyLoad) {
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 没有有效的src属性，跳过`);
          return;
        }

        // 使用实际src或各种懒加载格式
        const imgSrc = dataSrc || lazyLoad || src;
        if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 源: ${imgSrc}`);

        // 如果有srcset，尝试获取最大的图片
        let finalSrc = imgSrc;
        if (srcset || dataSrcSet) {
          try {
            const srcsetString = srcset || dataSrcSet;
            const srcsetItems = srcsetString.split(',');
            let maxWidth = 0;

            srcsetItems.forEach(item => {
              try {
                const [itemSrc, widthStr] = item.trim().split(' ');
                if (widthStr) {
                  const width = parseInt(widthStr.replace('w', ''));
                  if (width > maxWidth) {
                    maxWidth = width;
                    finalSrc = itemSrc;
                  }
                }
              } catch (itemError) {
                console.error(`[图片提取] findBestImage: 处理srcset项时出错: ${itemError.message}`);
              }
            });

            if (finalSrc !== imgSrc) {
              console.log(`[图片提取] findBestImage: 从srcset中选择了最大图片: ${finalSrc}`);
            }
          } catch (srcsetError) {
            console.error(`[图片提取] findBestImage: 处理srcset时出错: ${srcsetError.message}`);
          }
        }

        // 解析完整URL
        const url = resolveUrl(finalSrc, baseUrl);
        if (!url) {
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} URL解析失败，跳过`);
          return;
        }

        // 跳过数据URI、SVG和可能的图标
        if (url.startsWith('data:') || url.endsWith('.svg')) {
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 是数据URI或SVG，跳过: ${url}`);
          return;
        }

        // 计算图片分数
        let score = 0;

        // 宽高属性加分
        const width = parseInt(img.attr('width')) || 0;
        const height = parseInt(img.attr('height')) || 0;

        // 获取图片的style属性，可能包含宽高信息
        const style = img.attr('style') || '';
        let styleWidth = 0;
        let styleHeight = 0;

        // 从style中提取宽高
        if (style) {
          const widthMatch = style.match(/width\s*:\s*(\d+)px/);
          const heightMatch = style.match(/height\s*:\s*(\d+)px/);
          if (widthMatch) styleWidth = parseInt(widthMatch[1]);
          if (heightMatch) styleHeight = parseInt(heightMatch[1]);
        }

        // 使用属性宽高或style宽高中的较大值
        const effectiveWidth = Math.max(width, styleWidth);
        const effectiveHeight = Math.max(height, styleHeight);

        // 大图片加分
        if (effectiveWidth > 300 && effectiveHeight > 200) {
          score += 20;
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 尺寸较大，加20分`);
        } else if (effectiveWidth > 200 && effectiveHeight > 150) {
          score += 15;
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 尺寸中等，加15分`);
        } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) {
          // 如果是常见图片格式，即使没有明确的尺寸也给一些分数
          score += 5;
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 是常见图片格式，加5分`);
        }

        // 检查是否可能是logo
        if (isLikelyLogo(url, alt) || isLikelyLogo(url, className) || isLikelyLogo(url, id)) {
          score -= 25; // 大幅降低logo的分数
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 可能是logo，减25分`);
        }

        // 图片位置加分（靠前的图片更可能是主图，但不要太靠前，因为那可能是logo）
        if (i > 3 && i < 20) {
          score += 5; // 页面中间的图片更可能是内容图片
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 位置适中，加5分`);
        } else if (i >= 20) {
          score -= i * 0.1; // 页面靠后的图片可能不太重要
          if (i < 30) console.log(`[图片提取] findBestImage: 图片 #${i} 位置靠后，减${i * 0.1}分`);
        }

        // 图片alt文本加分
        if (alt && alt.length > 5) {
          score += 5;
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 有有效的alt文本，加5分`);
        }

        // 图片class/id包含特定关键词加分
        const positiveKeywords = ['featured', 'hero', 'main', 'thumbnail', 'cover', 'banner', 'project', 'gallery', 'slide', 'image', 'photo', 'picture', 'carousel', 'slider'];
        const negativeKeywords = ['icon', 'avatar', 'small', 'thumb', 'button', 'emoji', 'badge', 'logo', 'favicon'];

        positiveKeywords.forEach(keyword => {
          if (className.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword) || alt.toLowerCase().includes(keyword)) {
            score += 8;
            if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 包含正面关键词 ${keyword}，加8分`);
          }
        });

        negativeKeywords.forEach(keyword => {
          if (className.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword) || alt.toLowerCase().includes(keyword)) {
            score -= 15;
            if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 包含负面关键词 ${keyword}，减15分`);
          }
        });

        // 特定网站的特殊处理
        if (baseUrl.includes('acuitybrands.com')) {
          // 针对Acuity Brands网站的特殊处理
          if (url.includes('/images/') || url.includes('/img/')) {
            score += 10; // 图片目录中的图片可能是内容图片
            console.log(`[图片提取] findBestImage: 图片 #${i} 在图片目录中，加10分`);
          }

          // 如果图片URL包含产品相关关键词，加分
          if (url.includes('product') || url.includes('solution') || url.includes('feature')) {
            score += 15;
            console.log(`[图片提取] findBestImage: 图片 #${i} 包含产品相关关键词，加15分`);
          }
        }

        // 收集所有图片及其分数
        allImages.push({ url, score, width: effectiveWidth, height: effectiveHeight });
        if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 最终得分: ${score}`);

        // 更新最佳图片
        if (score > bestScore) {
          bestScore = score;
          bestImage = url;
          if (i < 10) console.log(`[图片提取] findBestImage: 图片 #${i} 成为当前最佳图片，得分: ${score}`);
        }
      } catch (imgError) {
        console.error(`[图片提取] findBestImage: 处理图片 #${i} 时出错: ${imgError.message}`);
      }
  });

  } catch (eachError) {
    console.error(`[图片提取] findBestImage: 处理图片元素时出错: ${eachError.message}`);
  }

  console.log(`[图片提取] findBestImage: 图片评分完成，找到 ${allImages.length} 个有效图片，最佳得分: ${bestScore}`);

  try {
    // 如果找到了最佳图片，但它可能是logo，尝试找到第二好的非logo图片
    if (bestImage && isLikelyLogo(bestImage, '')) {
      console.log(`[图片提取] findBestImage: 最佳图片可能是logo，尝试找到第二好的非logo图片`);

      // 按分数排序
      allImages.sort((a, b) => b.score - a.score);

      // 尝试找到第一个不是logo的图片
      for (let i = 0; i < allImages.length; i++) {
        const img = allImages[i];
        if (!isLikelyLogo(img.url, '') && img.width > 200 && img.height > 150) {
          console.log(`[图片提取] findBestImage: 找到第二好的非logo图片: ${img.url}, 得分: ${img.score}`);
          return img.url;
        }
      }

      console.log(`[图片提取] findBestImage: 未找到合适的第二好图片，使用原始最佳图片: ${bestImage}`);
    }

    // 如果没有找到最佳图片，但有其他图片，尝试返回最大的图片
    if (!bestImage && allImages.length > 0) {
      console.log(`[图片提取] findBestImage: 未找到最佳图片，尝试使用备选图片`);

      // 按尺寸排序（宽度 * 高度）
      allImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));

      // 尝试找到第一个不是logo且足够大的图片
      for (let i = 0; i < allImages.length; i++) {
        const img = allImages[i];
        if (!isLikelyLogo(img.url, '') && (img.width > 150 || img.height > 150)) {
          console.log(`[图片提取] findBestImage: 使用按尺寸排序的备选图片: ${img.url}, 尺寸: ${img.width}x${img.height}`);
          return img.url;
        }
      }

      // 如果还是没有找到合适的图片，返回第一个图片（如果有的话）
      if (allImages.length > 0) {
        console.log(`[图片提取] findBestImage: 使用第一个可用图片: ${allImages[0].url}`);
        return allImages[0].url;
      }
    }
  } catch (sortError) {
    console.error(`[图片提取] findBestImage: 处理排序和选择最佳图片时出错: ${sortError.message}`);
  }

  // 特殊处理acuitybrands.com网站
  if (baseUrl.includes('acuitybrands.com')) {
    console.log(`[图片提取] 针对acuitybrands.com网站进行特殊处理`);

    // 尝试直接使用已知的图片URL
    if (baseUrl.includes('hydrel.acuitybrands.com')) {
      // 强制使用预设的图片URL，不管URL中是否有查询参数
      const heroImage = 'https://hydrel.acuitybrands.com/-/media/abl/acuitybrands/images/solutions/airport-terminal-lighting-solutions-hero.jpg';
      console.log(`[图片提取] 使用Hydrel预设图片URL: ${heroImage}`);
      return heroImage;
    }

    if (baseUrl.includes('juno.acuitybrands.com')) {
      const heroImage = 'https://juno.acuitybrands.com/-/media/abl/acuitybrands/images/products/juno/canless-downlight-hero.jpg';
      console.log(`[图片提取] 使用Juno预设图片URL: ${heroImage}`);
      return heroImage;
    }

    // 尝试从页面中查找特定的图片容器
    const heroContainers = $('[class*="hero"], [class*="banner"], [class*="carousel"], [class*="slider"]');
    if (heroContainers.length > 0) {
      console.log(`[图片提取] 找到${heroContainers.length}个可能的hero容器`);

      // 遍历所有可能的hero容器
      for (let i = 0; i < heroContainers.length; i++) {
        const container = $(heroContainers[i]);

        // 查找容器内的图片
        const images = container.find('img');
        if (images.length > 0) {
          for (let j = 0; j < images.length; j++) {
            const img = $(images[j]);
            const src = img.attr('src');
            const dataSrc = img.attr('data-src');
            const imgSrc = dataSrc || src;

            if (imgSrc) {
              const imgUrl = resolveUrl(imgSrc, baseUrl);
              if (imgUrl && !isLikelyLogo(imgUrl, img.attr('alt') || '')) {
                console.log(`[图片提取] 从hero容器中找到图片: ${imgUrl}`);
                return imgUrl;
              }
            }
          }
        }

        // 查找容器的背景图片
        const style = container.attr('style') || '';
        const bgMatch = style.match(/background-image\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);
        if (bgMatch && bgMatch[1]) {
          const bgUrl = resolveUrl(bgMatch[1], baseUrl);
          if (bgUrl) {
            console.log(`[图片提取] 从hero容器中找到背景图片: ${bgUrl}`);
            return bgUrl;
          }
        }
      }
    }

    // 如果还是没找到，尝试查找所有背景图片
    const elementsWithBg = $('[style*="background-image"]');
    if (elementsWithBg.length > 0) {
      console.log(`[图片提取] 找到${elementsWithBg.length}个带背景图片的元素`);

      for (let i = 0; i < elementsWithBg.length; i++) {
        const el = $(elementsWithBg[i]);
        const style = el.attr('style') || '';
        const bgMatch = style.match(/background-image\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);

        if (bgMatch && bgMatch[1]) {
          const bgUrl = resolveUrl(bgMatch[1], baseUrl);
          if (bgUrl && !bgUrl.includes('logo') && !bgUrl.includes('icon')) {
            console.log(`[图片提取] 找到背景图片: ${bgUrl}`);
            return bgUrl;
          }
        }
      }
    }

    // 最后尝试直接构建一个可能的图片URL
    const possibleImageUrl = baseUrl.replace(/\/$/, '') + '/images/hero-image.jpg';
    console.log(`[图片提取] 尝试使用预设图片URL: ${possibleImageUrl}`);
    return possibleImageUrl;
  }

  return bestImage;
}

/**
 * 检查URL或文本是否可能是logo
 * @param {string} url 图片URL
 * @param {string} text 相关文本（alt、class或id）
 * @returns {boolean} 是否可能是logo
 */
function isLikelyLogo(url, text) {
  if (!url) {
    return false;
  }

  try {
    const logoKeywords = ['logo', 'brand', 'icon', 'symbol', 'emblem', 'favicon', 'header-logo', 'site-logo', 'company-logo'];
    const logoFilePatterns = ['-logo', '_logo', 'logo-', 'logo_', 'brand-', 'brand_', 'icon-', 'icon_'];

    // 检查URL中是否包含logo关键词
    const urlLower = url.toLowerCase();

    // 检查URL路径中是否包含logo关键词
    for (const keyword of logoKeywords) {
      if (urlLower.includes(keyword)) {
        return true;
      }
    }

    // 检查URL文件名中是否包含logo模式
    try {
      const urlParts = urlLower.split('/');
      const fileName = urlParts[urlParts.length - 1];

      for (const pattern of logoFilePatterns) {
        if (fileName.includes(pattern)) {
          return true;
        }
      }
    } catch (fileNameError) {
      console.error(`[图片提取] isLikelyLogo: 处理文件名时出错: ${fileNameError.message}`);
    }

    // 检查文本中是否包含logo关键词
    if (text) {
      const textLower = text.toLowerCase();
      for (const keyword of logoKeywords) {
        if (textLower.includes(keyword)) {
          return true;
        }
      }
    }

    // 检查图片尺寸比例（logo通常是正方形或宽度略大于高度）
    if ((url.includes('.png') || url.includes('.svg')) &&
        (url.includes('logo') || url.includes('brand') || url.includes('icon'))) {
      return true;
    }

    // 检查URL中的尺寸参数
    try {
      const sizeMatch = url.match(/[_-](\d+)x(\d+)/);
      if (sizeMatch) {
        const width = parseInt(sizeMatch[1]);
        const height = parseInt(sizeMatch[2]);

        // 如果宽高比例接近1:1或者宽度远大于高度，可能是logo
        if ((width / height > 0.8 && width / height < 1.2) || (width / height > 3)) {
          // 但如果尺寸很大，可能是内容图片而不是logo
          if (width < 300 && height < 300) {
            return true;
          }
        }
      }
    } catch (sizeMatchError) {
      console.error(`[图片提取] isLikelyLogo: 处理尺寸匹配时出错: ${sizeMatchError.message}`);
    }

    // 检查URL中的尺寸参数（另一种格式）
    try {
      const dimensionMatch = url.match(/[?&](w|width)=(\d+).*?[?&](h|height)=(\d+)/i);
      if (dimensionMatch) {
        const width = parseInt(dimensionMatch[2]);
        const height = parseInt(dimensionMatch[4]);

        // 如果宽高比例接近1:1或者宽度远大于高度，可能是logo
        if ((width / height > 0.8 && width / height < 1.2) || (width / height > 3)) {
          // 但如果尺寸很大，可能是内容图片而不是logo
          if (width < 300 && height < 300) {
            return true;
          }
        }
      }
    } catch (dimensionMatchError) {
      console.error(`[图片提取] isLikelyLogo: 处理维度匹配时出错: ${dimensionMatchError.message}`);
    }

    return false;
  } catch (error) {
    console.error(`[图片提取] isLikelyLogo: 检查logo时出错: ${error.message}`);
    return false;
  }
}

/**
 * 解析相对URL为绝对URL
 * @param {string} url 可能是相对URL的字符串
 * @param {string} base 基础URL
 * @returns {string} 绝对URL
 */
function resolveUrl(url, base) {
  if (!url) {
    console.log('[图片提取] resolveUrl: URL为空');
    return null;
  }

  // 清理URL，移除前后空格
  url = url.trim();

  // 处理数据URL
  if (url.startsWith('data:')) {
    console.log('[图片提取] resolveUrl: 跳过数据URL');
    return null;
  }

  // 已经是绝对URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log(`[图片提取] resolveUrl: 已经是绝对URL: ${url}`);
    return url;
  }

  // 处理//开头的URL（协议相对URL）
  if (url.startsWith('//')) {
    try {
      const baseUrl = new URL(base);
      const fullUrl = `${baseUrl.protocol}${url}`;
      console.log(`[图片提取] resolveUrl: 协议相对URL解析为: ${fullUrl}`);
      return fullUrl;
    } catch (error) {
      console.error(`[图片提取] resolveUrl: 协议相对URL解析错误: ${error.message}`);
      return null;
    }
  }

  // 处理相对URL
  try {
    const fullUrl = new URL(url, base).href;
    console.log(`[图片提取] resolveUrl: 相对URL解析为: ${fullUrl}`);
    return fullUrl;
  } catch (error) {
    console.error(`[图片提取] resolveUrl: 相对URL解析错误: ${error.message}, URL: ${url}, Base: ${base}`);
    return null;
  }
}

// 上传到腾讯云COS
async function uploadToCOS(fileName, fileContent) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[图片提取] 未配置腾讯云COS，跳过上传');
    console.log(`[图片提取] COS配置: Bucket=${process.env.COS_BUCKET ? '已配置' : '未配置'}, Region=${process.env.COS_REGION || '未配置'}`);
    console.log(`[图片提取] COS对象状态: ${cos ? '已初始化' : '未初始化'}`);
    return null;
  }

  try {
    console.log(`[图片提取] 正在上传预览图到腾讯云COS: ${fileName}`);
    console.log(`[图片提取] COS配置: Bucket=${process.env.COS_BUCKET}, Region=${process.env.COS_REGION || 'ap-guangzhou'}`);

    if (process.env.VERCEL) {
      console.log('[图片提取] 在Vercel环境中上传到COS');
    }

    // 确保文件名是唯一的
    const key = `previews/${fileName}`;
    console.log(`[图片提取] COS对象Key: ${key}`);

    // 检查文件内容
    if (!fileContent) {
      console.error('[图片提取] 文件内容为空，无法上传');
      return null;
    }

    // 确保文件内容是Buffer
    let contentBuffer = fileContent;
    if (typeof fileContent === 'string' && fileContent.startsWith('/')) {
      // 如果是文件路径，读取文件内容
      try {
        console.log(`[图片提取] 尝试从文件路径读取内容: ${fileContent}`);
        contentBuffer = await promisify(fs.readFile)(fileContent);
        console.log(`[图片提取] 从文件路径读取内容成功，大小: ${contentBuffer.length} 字节`);
      } catch (readError) {
        console.error('[图片提取] 读取文件失败:', readError.message);
        console.error('[图片提取] 错误堆栈:', readError.stack);
        if (process.env.VERCEL) {
          throw new Error('在Vercel环境中无法读取本地文件');
        }
        return null;
      }
    } else {
      console.log(`[图片提取] 使用提供的Buffer内容上传，大小: ${contentBuffer.length} 字节`);
    }

    // 上传到COS
    console.log('[图片提取] 开始上传到COS...');
    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: key,
      Body: contentBuffer,
      ContentType: 'image/jpeg',
      // 添加缓存控制头，允许缓存30天
      CacheControl: 'max-age=2592000'
    });

    console.log(`[图片提取] COS上传结果: ${JSON.stringify(result)}`);

    // 构建COS URL
    let url;

    // 如果配置了自定义域名，使用自定义域名
    if (process.env.COS_DOMAIN) {
      url = `${process.env.COS_DOMAIN}/${key}`;
      console.log(`[图片提取] 使用自定义域名构建URL: ${url}`);
    } else {
      // 否则使用默认的COS URL
      url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/${key}`;
      console.log(`[图片提取] 使用默认COS URL: ${url}`);
    }

    console.log(`[图片提取] 预览图已上传到腾讯云COS: ${url}`);
    return url;
  } catch (error) {
    console.error('[图片提取] 上传预览图到腾讯云COS失败:', error.message);
    console.error('[图片提取] 错误堆栈:', error.stack);

    // 提供更详细的错误信息
    if (error.code) {
      console.error(`[图片提取] COS错误代码: ${error.code}`);
    }
    if (error.message) {
      console.error(`[图片提取] COS错误消息: ${error.message}`);
    }

    throw error;
  }
}

// 从腾讯云COS获取预览图
async function getFromCOS(fileName) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[图片提取] 未配置腾讯云COS，跳过获取');
    console.log(`[图片提取] COS配置: Bucket=${process.env.COS_BUCKET ? '已配置' : '未配置'}, Region=${process.env.COS_REGION || '未配置'}`);
    console.log(`[图片提取] COS对象状态: ${cos ? '已初始化' : '未初始化'}`);
    return null;
  }

  try {
    console.log(`[图片提取] 正在从腾讯云COS检查预览图是否存在: ${fileName}`);
    console.log(`[图片提取] COS配置: Bucket=${process.env.COS_BUCKET}, Region=${process.env.COS_REGION || 'ap-guangzhou'}`);

    if (process.env.VERCEL) {
      console.log('[图片提取] 在Vercel环境中从COS获取');
    }

    const key = `previews/${fileName}`;
    console.log(`[图片提取] COS对象Key: ${key}`);

    // 首先检查文件是否存在
    try {
      console.log('[图片提取] 发送headObject请求检查文件是否存在...');
      const headResult = await cos.headObject({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION || 'ap-guangzhou',
        Key: key
      });

      console.log(`[图片提取] headObject请求成功，文件存在: ${JSON.stringify(headResult)}`);

      // 文件存在，构建URL
      let url;
      if (process.env.COS_DOMAIN) {
        url = `${process.env.COS_DOMAIN}/${key}`;
        console.log(`[图片提取] 使用自定义域名构建URL: ${url}`);
      } else {
        url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/${key}`;
        console.log(`[图片提取] 使用默认COS URL: ${url}`);
      }

      console.log(`[图片提取] 预览图在腾讯云COS上存在: ${url}`);

      // 在非Vercel环境中，同时下载到本地作为缓存
      if (!process.env.VERCEL) {
        try {
          console.log(`[图片提取] 尝试将COS文件下载到本地缓存: ${fileName}`);

          // 确保目录存在
          if (!fs.existsSync(previewDir)) {
            console.log(`[图片提取] 创建本地缓存目录: ${previewDir}`);
            fs.mkdirSync(previewDir, { recursive: true });
          }

          const localPath = path.join(previewDir, fileName);
          console.log(`[图片提取] 本地缓存路径: ${localPath}`);

          await cos.getObject({
            Bucket: process.env.COS_BUCKET,
            Region: process.env.COS_REGION || 'ap-guangzhou',
            Key: key,
            Output: fs.createWriteStream(localPath)
          });
          console.log(`[图片提取] 预览图已从腾讯云COS下载到本地缓存: ${localPath}`);
        } catch (downloadError) {
          console.error('[图片提取] 下载到本地缓存失败，但文件在COS上存在:', downloadError.message);
          console.error('[图片提取] 错误堆栈:', downloadError.stack);
        }
      }

      return url;
    } catch (headError) {
      // 文件不存在
      if (headError.statusCode === 404) {
        console.log(`[图片提取] 预览图在腾讯云COS上不存在: ${key}`);
        return null;
      }
      console.error(`[图片提取] headObject请求失败: ${headError.message}`);
      console.error(`[图片提取] 错误状态码: ${headError.statusCode}`);
      throw headError;
    }
  } catch (error) {
    console.error('[图片提取] 从腾讯云COS获取预览图失败:', error.message);
    console.error('[图片提取] 错误堆栈:', error.stack);

    // 提供更详细的错误信息
    if (error.code) {
      console.error(`[图片提取] COS错误代码: ${error.code}`);
    }
    if (error.message) {
      console.error(`[图片提取] COS错误消息: ${error.message}`);
    }

    return null;
  }
}

module.exports = {
  extractImageFromUrl,
  uploadToCOS,
  getFromCOS
};
