const axios = require('axios');
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
    console.log(`[MCP] 创建预览图目录: ${previewDir}`);
  } catch (error) {
    console.error(`[MCP] 创建预览图目录失败: ${error.message}`);
  }
}

// 使用Browser-Tool MCP生成截图
async function generateScreenshot(url, width = 1200, height = 630) {
  console.log(`[MCP] 正在为URL生成截图: ${url}`);

  // 为URL生成唯一的文件名
  const urlHash = crypto.createHash('md5').update(url).digest('hex');
  const fileName = `${urlHash}.jpg`;
  const filePath = path.join(previewDir, fileName);
  const publicPath = `/previews/${fileName}`;

  try {
    // 在非Vercel环境中检查本地缓存
    if (!process.env.VERCEL && fs.existsSync(filePath)) {
      try {
        // 获取文件的创建时间
        const stats = await promisify(fs.stat)(filePath);
        const fileAge = Date.now() - stats.mtime.getTime();

        // 如果文件不超过7天，直接返回缓存的预览图
        if (fileAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`[MCP] 使用缓存的预览图: ${filePath}`);
          return { success: true, previewImage: publicPath };
        }
      } catch (error) {
        console.error(`[MCP] 检查本地缓存失败: ${error.message}`);
      }
    }

    // 在Vercel环境中，首先尝试从COS获取
    if (process.env.VERCEL && cos && process.env.COS_BUCKET) {
      try {
        const cosUrl = await getFromCOS(fileName);
        if (cosUrl) {
          console.log(`[MCP] 从COS获取预览图成功: ${cosUrl}`);
          return { success: true, previewImage: cosUrl };
        }
      } catch (error) {
        console.error(`[MCP] 从COS获取预览图失败: ${error.message}`);
      }
    }

    // 构建请求参数
    const requestData = {
      url,
      width,
      height,
      fullPage: false,
      format: 'jpeg',
      quality: 80
    };

    console.log(`[MCP] 请求参数:`, requestData);

    // 发送请求到Browser-Tool MCP API
    const response = await axios.post(
      'https://mcp.agentdesk.io/api/screenshot',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        // 配置超时
        timeout: 30000,
        // 在开发环境中禁用SSL证书验证
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`[MCP] 响应状态:`, response.status);

    // 在Vercel环境中，直接上传到COS，不保存到本地
    if (process.env.VERCEL) {
      if (cos && process.env.COS_BUCKET) {
        try {
          const cosUrl = await uploadToCOS(fileName, response.data);
          console.log(`[MCP] 预览图已上传到腾讯云COS: ${cosUrl}`);
          return { success: true, previewImage: cosUrl };
        } catch (cosError) {
          console.error(`[MCP] 上传到腾讯云COS失败: ${cosError.message}`);
          return { success: false, previewImage: '', message: 'COS上传失败' };
        }
      } else {
        console.error('[MCP] Vercel环境中未配置COS，无法保存预览图');
        return { success: false, previewImage: '', message: 'Vercel环境中未配置COS' };
      }
    } else {
      // 非Vercel环境，保存到本地
      try {
        await promisify(fs.writeFile)(filePath, response.data);
        console.log(`[MCP] 预览图已保存到本地: ${filePath}`);

        // 同时上传到COS作为备份
        if (cos && process.env.COS_BUCKET) {
          try {
            await uploadToCOS(fileName, response.data);
          } catch (cosError) {
            console.error(`[MCP] 上传到腾讯云COS失败: ${cosError.message}`);
          }
        }

        return { success: true, previewImage: publicPath };
      } catch (fsError) {
        console.error(`[MCP] 保存到本地失败: ${fsError.message}`);

        // 如果本地保存失败但配置了COS，尝试只上传到COS
        if (cos && process.env.COS_BUCKET) {
          try {
            const cosUrl = await uploadToCOS(fileName, response.data);
            console.log(`[MCP] 预览图已上传到腾讯云COS: ${cosUrl}`);
            return { success: true, previewImage: cosUrl };
          } catch (cosError) {
            console.error(`[MCP] 上传到腾讯云COS失败: ${cosError.message}`);
          }
        }

        return { success: false, previewImage: '', message: '保存预览图失败' };
      }
    }
  } catch (error) {
    console.error('[MCP] 生成预览图失败:', error.message);

    if (error.response) {
      console.error('[MCP] 响应状态:', error.response.status);
      console.error('[MCP] 响应头:', JSON.stringify(error.response.headers, null, 2));
    }

    // 如果生成失败，返回空预览图
    return { success: false, previewImage: '' };
  }
}

// 上传到腾讯云COS
async function uploadToCOS(fileName, fileContent) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[MCP] 未配置腾讯云COS，跳过上传');
    return null;
  }

  try {
    console.log(`[MCP] 正在上传预览图到腾讯云COS: ${fileName}`);

    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: `previews/${fileName}`,
      Body: fileContent,
      ContentType: 'image/jpeg',
      // 添加缓存控制头，允许缓存30天
      CacheControl: 'max-age=2592000'
    });

    // 构建COS URL
    let url;
    if (process.env.COS_DOMAIN) {
      url = `${process.env.COS_DOMAIN}/previews/${fileName}`;
    } else {
      url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/previews/${fileName}`;
    }

    console.log(`[MCP] 预览图已上传到腾讯云COS: ${url}`);
    return url;
  } catch (error) {
    console.error('[MCP] 上传预览图到腾讯云COS失败:', error.message);
    if (error.code) {
      console.error(`[MCP] COS错误代码: ${error.code}`);
    }
    throw error;
  }
}

// 从腾讯云COS获取预览图
async function getFromCOS(fileName) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[MCP] 未配置腾讯云COS，跳过获取');
    return null;
  }

  try {
    console.log(`[MCP] 正在从腾讯云COS检查预览图是否存在: ${fileName}`);

    // 首先检查文件是否存在
    try {
      const headResult = await cos.headObject({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION || 'ap-guangzhou',
        Key: `previews/${fileName}`
      });

      console.log(`[MCP] 预览图在腾讯云COS上存在`);

      // 构建COS URL
      let url;
      if (process.env.COS_DOMAIN) {
        url = `${process.env.COS_DOMAIN}/previews/${fileName}`;
      } else {
        url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/previews/${fileName}`;
      }

      // 在Vercel环境中，直接返回COS URL
      if (process.env.VERCEL) {
        console.log(`[MCP] 在Vercel环境中返回COS URL: ${url}`);
        return url;
      }

      // 在非Vercel环境中，下载到本地
      try {
        await cos.getObject({
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION || 'ap-guangzhou',
          Key: `previews/${fileName}`,
          Output: fs.createWriteStream(path.join(previewDir, fileName))
        });

        console.log(`[MCP] 预览图已从腾讯云COS下载到本地: ${fileName}`);
        return `/previews/${fileName}`;
      } catch (downloadError) {
        console.error(`[MCP] 下载到本地失败，返回COS URL: ${downloadError.message}`);
        return url;
      }
    } catch (headError) {
      // 文件不存在
      if (headError.statusCode === 404) {
        console.log(`[MCP] 预览图在腾讯云COS上不存在`);
        return null;
      }
      throw headError;
    }
  } catch (error) {
    console.error('[MCP] 从腾讯云COS获取预览图失败:', error.message);
    if (error.code) {
      console.error(`[MCP] COS错误代码: ${error.code}`);
    }
    return null;
  }
}

module.exports = {
  generateScreenshot,
  uploadToCOS,
  getFromCOS
};
