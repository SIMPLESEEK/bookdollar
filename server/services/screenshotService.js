const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const COS = require('cos-nodejs-sdk-v5');
const crypto = require('crypto');

// 确保预览图目录存在
const previewDir = path.join(__dirname, '../../client/public/previews');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

// 初始化腾讯云COS
const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

// 生成截图并保存到本地
async function generateScreenshot(url, width = 1200, height = 630) {
  console.log(`正在为URL生成截图: ${url}`);

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
        console.log(`使用缓存的预览图: ${filePath}`);
        return { success: true, previewImage: publicPath };
      }
    }

    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1200,630'
      ]
    });

    try {
      // 创建新页面
      const page = await browser.newPage();

      // 设置视口大小
      await page.setViewport({ width, height });

      // 设置超时
      await page.setDefaultNavigationTimeout(30000);

      // 导航到URL
      await page.goto(url, { waitUntil: 'networkidle2' });

      // 等待一段时间，确保页面完全加载
      // 使用setTimeout代替waitForTimeout，兼容不同版本的Puppeteer
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 截图
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: false
      });

      // 保存截图到本地
      await promisify(fs.writeFile)(filePath, screenshot);
      console.log(`预览图已保存到本地: ${filePath}`);

      // 如果配置了腾讯云COS，则上传到COS
      if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY && process.env.COS_BUCKET) {
        await uploadToCOS(fileName, screenshot);
      }

      return { success: true, previewImage: publicPath };
    } finally {
      // 关闭浏览器
      await browser.close();
    }
  } catch (error) {
    console.error('生成预览图失败:', error);

    // 如果生成失败，返回空预览图
    return { success: false, previewImage: '' };
  }
}

// 上传到腾讯云COS
async function uploadToCOS(fileName, fileContent) {
  if (!process.env.COS_SECRET_ID || !process.env.COS_SECRET_KEY || !process.env.COS_BUCKET) {
    console.log('未配置腾讯云COS，跳过上传');
    return;
  }

  try {
    console.log(`正在上传预览图到腾讯云COS: ${fileName}`);

    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: `previews/${fileName}`,
      Body: fileContent,
      ContentType: 'image/jpeg'
    });

    console.log(`预览图已上传到腾讯云COS: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('上传预览图到腾讯云COS失败:', error);
    throw error;
  }
}

// 从腾讯云COS获取预览图
async function getFromCOS(fileName) {
  if (!process.env.COS_SECRET_ID || !process.env.COS_SECRET_KEY || !process.env.COS_BUCKET) {
    console.log('未配置腾讯云COS，跳过获取');
    return null;
  }

  try {
    console.log(`正在从腾讯云COS获取预览图: ${fileName}`);

    const result = await cos.getObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: `previews/${fileName}`,
      Output: fs.createWriteStream(path.join(previewDir, fileName))
    });

    console.log(`预览图已从腾讯云COS下载: ${fileName}`);
    return `/previews/${fileName}`;
  } catch (error) {
    console.error('从腾讯云COS获取预览图失败:', error);
    return null;
  }
}

module.exports = {
  generateScreenshot,
  uploadToCOS,
  getFromCOS
};
