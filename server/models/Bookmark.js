const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  reason: {
    type: String,
    trim: true,
    description: '书签的收藏原因或描述'
  },
  previewImage: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  folder: {
    type: String,
    default: '未分类',
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时自动更新updatedAt字段
BookmarkSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Bookmark', BookmarkSchema);
