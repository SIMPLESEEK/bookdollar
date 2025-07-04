require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// 检查环境
console.log(`当前环境: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL || '未设置'}`);

// 检查必要的环境变量
if (!process.env.JWT_SECRET) {
  console.error('错误: 未设置JWT_SECRET环境变量');
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// 检查COS配置
if (process.env.VERCEL) {
  console.log('在Vercel环境中运行');
  console.log(`COS配置: Bucket=${process.env.COS_BUCKET ? '已配置' : '未配置'}, Region=${process.env.COS_REGION || '未配置'}`);
  console.log(`COS域名: ${process.env.COS_DOMAIN || '未配置'}`);
}

// 导入路由
const bookmarkRoutes = require('./routes/bookmarks');
const userRoutes = require('./routes/users');
const exportRoutes = require('./routes/export');
const shareRoutes = require('./routes/share');
const previewRoutes = require('./routes/preview');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB连接成功'))
.catch(err => console.error('MongoDB连接失败:', err));

// API路由
app.use('/api/users', userRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/data', exportRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/preview', previewRoutes);

// 生产环境下提供静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// 在本地环境中启动服务器
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`服务器运行在端口: ${PORT}`);
  });
}

// 为 Vercel 导出应用
module.exports = app;
