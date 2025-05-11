const express = require('express');
const router = express.Router();
const previewController = require('../controllers/previewController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// 尝试加载腾讯云COS SDK
let cos = null;
try {
  const COS = require('cos-nodejs-sdk-v5');

  // 如果配置了腾讯云COS，则初始化COS对象
  if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY) {
    cos = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY
    });
    console.log('腾讯云COS SDK加载成功');
  }
} catch (error) {
  console.error('腾讯云COS SDK加载失败:', error.message);
}

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../client/public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置Multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'preview-' + uniqueSuffix + ext);
  }
});

// 文件过滤器，只允许图片
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

// 创建Multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  }
});

// 生成预览图 - 需要认证
router.post('/generate', protect, previewController.generatePreview);

// 获取预览图 - 需要认证
router.get('/', protect, previewController.getPreview);

// 上传到腾讯云COS
async function uploadToCOS(fileName, filePath) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('未配置腾讯云COS，跳过上传');
    return null;
  }

  try {
    console.log(`正在上传图片到腾讯云COS: ${fileName}`);

    // 读取文件内容
    const fileContent = await promisify(fs.readFile)(filePath);

    // 上传到COS
    const key = `uploads/${fileName}`;
    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: key,
      Body: fileContent,
      ContentType: 'image/jpeg',
      // 添加缓存控制头，允许缓存30天
      CacheControl: 'max-age=2592000'
    });

    // 构建COS URL
    let url;
    if (process.env.COS_DOMAIN) {
      url = `${process.env.COS_DOMAIN}/${key}`;
    } else {
      url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/${key}`;
    }

    console.log(`图片已上传到腾讯云COS: ${url}`);
    return url;
  } catch (error) {
    console.error('上传图片到腾讯云COS失败:', error);
    return null;
  }
}

// 上传自定义预览图 - 需要认证
router.post('/upload', protect, (req, res) => {
  console.log('接收到图片上传请求');

  // 使用单独的错误处理中间件
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Multer错误:', err);
      return res.status(400).json({
        success: false,
        message: err.message || '文件上传错误'
      });
    }

    try {
      console.log('文件上传处理中...');

      if (!req.file) {
        console.error('没有上传文件或文件上传失败');
        return res.status(400).json({ success: false, message: '没有上传文件或文件上传失败' });
      }

      console.log('文件已上传:', req.file);

      // 构建文件的公共URL路径
      const localPath = `/uploads/${req.file.filename}`;
      console.log('生成的本地路径:', localPath);

      // 如果配置了腾讯云COS，上传到COS
      let previewImage = localPath;
      if (cos && process.env.COS_BUCKET) {
        try {
          const cosUrl = await uploadToCOS(req.file.filename, req.file.path);
          if (cosUrl) {
            previewImage = cosUrl;
            console.log('使用腾讯云COS URL:', previewImage);
          }
        } catch (cosError) {
          console.error('上传到腾讯云COS失败，使用本地路径:', cosError);
        }
      }

      res.json({
        success: true,
        previewImage: previewImage,
        message: '图片上传成功'
      });
    } catch (error) {
      console.error('处理上传图片失败:', error);
      res.status(500).json({
        success: false,
        message: '处理上传图片失败: ' + (error.message || '未知错误')
      });
    }
  });
});

module.exports = router;
