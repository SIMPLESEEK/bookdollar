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

// 在Vercel环境中，我们不能依赖本地文件系统
// 定义上传目录路径，但在Vercel环境中不会实际创建
const uploadDir = process.env.VERCEL
  ? '/tmp/uploads' // 在Vercel中使用临时目录
  : path.join(__dirname, '../../client/public/uploads');

// 只在非Vercel环境中创建目录
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`创建上传目录: ${uploadDir}`);
  } catch (error) {
    console.error(`创建上传目录失败: ${error.message}`);
  }
}

// 配置Multer存储 - 在Vercel环境中使用内存存储，非Vercel环境使用磁盘存储
let storage;
if (process.env.VERCEL) {
  // 在Vercel环境中使用内存存储
  console.log('在Vercel环境中使用内存存储上传文件');
  storage = multer.memoryStorage();
} else {
  // 在非Vercel环境中使用磁盘存储
  console.log('在非Vercel环境中使用磁盘存储上传文件');
  storage = multer.diskStorage({
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
}

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
async function uploadToCOS(fileName, filePathOrBuffer) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('未配置腾讯云COS，跳过上传');
    return null;
  }

  try {
    console.log(`正在上传图片到腾讯云COS: ${fileName}`);

    // 确定文件内容 - 可以是文件路径或直接是Buffer
    let fileContent;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      // 如果已经是Buffer，直接使用
      fileContent = filePathOrBuffer;
      console.log('使用提供的Buffer直接上传到COS');
    } else {
      // 否则，从文件路径读取内容
      try {
        fileContent = await promisify(fs.readFile)(filePathOrBuffer);
        console.log('从文件读取内容上传到COS');
      } catch (readError) {
        console.error('读取文件失败:', readError);
        return null;
      }
    }

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

      // 处理文件名 - 在内存存储模式下，需要手动生成文件名
      if (process.env.VERCEL && !req.file.filename) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = req.file.originalname ? path.extname(req.file.originalname) : '.jpg';
        req.file.filename = 'preview-' + uniqueSuffix + ext;
        console.log('在Vercel环境中生成文件名:', req.file.filename);
      }

      // 构建文件的公共URL路径
      const localPath = `/uploads/${req.file.filename}`;
      console.log('生成的本地路径:', localPath);

      // 在所有环境中，优先使用腾讯云COS
      // 在Vercel环境中，必须使用腾讯云COS
      if (!cos || !process.env.COS_BUCKET) {
        if (process.env.VERCEL) {
          // Vercel环境中必须有COS配置
          console.error('Vercel环境中未配置腾讯云COS，无法上传图片');
          return res.status(500).json({
            success: false,
            message: 'Vercel环境中未配置腾讯云COS，无法上传图片'
          });
        } else {
          // 非Vercel环境，可以使用本地路径
          console.log('未配置腾讯云COS，使用本地路径');
          return res.json({
            success: true,
            previewImage: localPath,
            message: '图片上传成功（本地存储）'
          });
        }
      }

      try {
        // 在Vercel环境中，直接使用文件buffer上传到COS，避免使用本地文件系统
        let cosUrl;
        if (process.env.VERCEL) {
          // 直接使用文件的buffer上传
          cosUrl = await uploadToCOS(req.file.filename, req.file.buffer);
        } else {
          // 非Vercel环境，可以使用文件路径
          cosUrl = await uploadToCOS(req.file.filename, req.file.path);
        }

        if (!cosUrl) {
          if (process.env.VERCEL) {
            // Vercel环境中必须上传成功
            return res.status(500).json({
              success: false,
              message: '上传到腾讯云COS失败'
            });
          } else {
            // 非Vercel环境，可以使用本地路径作为备选
            console.log('上传到腾讯云COS失败，使用本地路径');
            return res.json({
              success: true,
              previewImage: localPath,
              message: '图片上传成功（本地存储，COS上传失败）'
            });
          }
        }

        console.log('使用腾讯云COS URL:', cosUrl);
        return res.json({
          success: true,
          previewImage: cosUrl,
          message: '图片上传成功'
        });
      } catch (cosError) {
        console.error('上传到腾讯云COS失败:', cosError);

        if (process.env.VERCEL) {
          // Vercel环境中必须上传成功
          return res.status(500).json({
            success: false,
            message: '上传到腾讯云COS失败: ' + (cosError.message || '未知错误')
          });
        } else {
          // 非Vercel环境，可以使用本地路径作为备选
          console.log('上传到腾讯云COS失败，使用本地路径');
          return res.json({
            success: true,
            previewImage: localPath,
            message: '图片上传成功（本地存储，COS上传失败）'
          });
        }
      }
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
