/**
 * 数据库迁移脚本：将 description 字段合并到 reason 字段
 * 
 * 使用方法：
 * 1. 确保 MongoDB 连接配置正确
 * 2. 在项目根目录运行: node server/scripts/mergeDescriptionToReason.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');

// 连接到 MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB 连接成功，开始迁移数据...');
  migrateData();
})
.catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});

async function migrateData() {
  try {
    // 查找所有有 description 但没有 reason 的书签
    const bookmarksWithDescriptionOnly = await Bookmark.find({
      description: { $exists: true, $ne: null, $ne: '' },
      $or: [
        { reason: { $exists: false } },
        { reason: null },
        { reason: '' }
      ]
    });

    console.log(`找到 ${bookmarksWithDescriptionOnly.length} 个只有 description 的书签`);

    // 将 description 复制到 reason
    for (const bookmark of bookmarksWithDescriptionOnly) {
      await Bookmark.updateOne(
        { _id: bookmark._id },
        { $set: { reason: bookmark.description } }
      );
    }
    console.log(`已将 ${bookmarksWithDescriptionOnly.length} 个书签的 description 复制到 reason`);

    // 查找所有同时有 description 和 reason 的书签
    const bookmarksWithBoth = await Bookmark.find({
      description: { $exists: true, $ne: null, $ne: '' },
      reason: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`找到 ${bookmarksWithBoth.length} 个同时有 description 和 reason 的书签`);

    // 将 description 合并到 reason (如果内容不同)
    for (const bookmark of bookmarksWithBoth) {
      if (bookmark.description !== bookmark.reason) {
        const mergedReason = `${bookmark.reason}\n\n${bookmark.description}`;
        await Bookmark.updateOne(
          { _id: bookmark._id },
          { $set: { reason: mergedReason } }
        );
      }
    }
    console.log(`已合并 ${bookmarksWithBoth.length} 个书签的 description 和 reason`);

    console.log('数据迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  }
}
