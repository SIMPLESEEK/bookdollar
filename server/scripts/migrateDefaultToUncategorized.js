/**
 * 迁移脚本：将所有"默认"文件夹的书签更新为"未分类"
 * 
 * 使用方法：
 * 1. 确保MongoDB连接配置正确
 * 2. 在项目根目录运行: node server/scripts/migrateDefaultToUncategorized.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 导入书签模型
const Bookmark = require('../models/Bookmark');

// 连接到MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB 连接成功'))
.catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});

// 执行迁移
const migrateBookmarks = async () => {
  try {
    // 查找所有文件夹为"默认"的书签
    const defaultBookmarks = await Bookmark.find({ folder: '默认' });
    console.log(`找到 ${defaultBookmarks.length} 个"默认"文件夹的书签`);

    if (defaultBookmarks.length === 0) {
      console.log('没有需要迁移的书签');
      process.exit(0);
    }

    // 更新所有"默认"文件夹的书签为"未分类"
    const result = await Bookmark.updateMany(
      { folder: '默认' },
      { $set: { folder: '未分类' } }
    );

    console.log(`成功更新 ${result.modifiedCount} 个书签从"默认"到"未分类"`);
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
};

// 运行迁移
migrateBookmarks();
