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

// 确保预览图目录存在
const previewDir = path.join(__dirname, '../../client/public/previews');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
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
    // 检查是否已经有缓存的预览图
    if (fs.existsSync(filePath)) {
      // 获取文件的创建时间
      const stats = await promisify(fs.stat)(filePath);
      const fileAge = Date.now() - stats.mtime.getTime();
      
      // 如果文件不超过7天，直接返回缓存的预览图
      if (fileAge < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[MCP] 使用缓存的预览图: ${filePath}`);
        return { success: true, previewImage: publicPath };
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
    
    // 保存截图到本地
    await promisify(fs.writeFile)(filePath, response.data);
    console.log(`[MCP] 预览图已保存到本地: ${filePath}`);
    
    // 如果配置了腾讯云COS，则上传到COS
    if (cos && process.env.COS_BUCKET) {
      await uploadToCOS(fileName, response.data);
    }
    
    return { success: true, previewImage: publicPath };
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
    return;
  }
  
  try {
    console.log(`[MCP] 正在上传预览图到腾讯云COS: ${fileName}`);
    
    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: `previews/${fileName}`,
      Body: fileContent,
      ContentType: 'image/jpeg'
    });
    
    console.log(`[MCP] 预览图已上传到腾讯云COS: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('[MCP] 上传预览图到腾讯云COS失败:', error);
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
    console.log(`[MCP] 正在从腾讯云COS获取预览图: ${fileName}`);
    
    const result = await cos.getObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: `previews/${fileName}`,
      Output: fs.createWriteStream(path.join(previewDir, fileName))
    });
    
    console.log(`[MCP] 预览图已从腾讯云COS下载: ${fileName}`);
    return `/previews/${fileName}`;
  } catch (error) {
    console.error('[MCP] 从腾讯云COS获取预览图失败:', error);
    return null;
  }
}

module.exports = {
  generateScreenshot,
  uploadToCOS,
  getFromCOS
};
