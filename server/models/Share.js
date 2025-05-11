const mongoose = require('mongoose');

const ShareSchema = new mongoose.Schema({
  // 分享类型：bookmark（单个书签）、folder（文件夹）、tag（标签）
  type: {
    type: String,
    required: true,
    enum: ['bookmark', 'folder', 'tag']
  },
  
  // 分享的书签ID（当type为bookmark时）
  bookmark: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bookmark'
  },
  
  // 分享的文件夹名称（当type为folder时）
  folderName: {
    type: String
  },
  
  // 分享的标签（当type为tag时）
  tag: {
    type: String
  },
  
  // 分享所有者
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 是否公开分享
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // 分享过期时间（可选）
  expiresAt: {
    type: Date,
    default: null
  },
  
  // 允许访问的用户ID列表（当isPublic为false时使用）
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // 访问次数
  viewCount: {
    type: Number,
    default: 0
  },
  
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Share', ShareSchema);
