const Bookmark = require('../models/Bookmark');
const Folder = require('../models/Folder');
const Share = require('../models/Share');
const mongoose = require('mongoose');

// 分享单个书签
exports.shareBookmark = async (req, res) => {
  try {
    const { bookmarkId, isPublic, expiresAt, allowedUsers } = req.body;
    
    // 验证书签存在且属于当前用户
    const bookmark = await Bookmark.findOne({
      _id: bookmarkId,
      user: req.user._id
    });
    
    if (!bookmark) {
      return res.status(404).json({ message: '书签未找到或无权限分享' });
    }
    
    // 创建分享记录
    const share = new Share({
      type: 'bookmark',
      bookmark: bookmarkId,
      owner: req.user._id,
      isPublic,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowedUsers: allowedUsers || []
    });
    
    await share.save();
    
    res.status(201).json({
      message: '书签分享成功',
      shareId: share._id,
      shareUrl: `${req.protocol}://${req.get('host')}/share/${share._id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 分享文件夹
exports.shareFolder = async (req, res) => {
  try {
    const { folderName, isPublic, expiresAt, allowedUsers } = req.body;
    
    // 验证文件夹存在且属于当前用户
    const folder = await Folder.findOne({
      name: folderName,
      user: req.user._id
    });
    
    if (!folder) {
      return res.status(404).json({ message: '文件夹未找到或无权限分享' });
    }
    
    // 创建分享记录
    const share = new Share({
      type: 'folder',
      folderName,
      owner: req.user._id,
      isPublic,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowedUsers: allowedUsers || []
    });
    
    await share.save();
    
    res.status(201).json({
      message: '文件夹分享成功',
      shareId: share._id,
      shareUrl: `${req.protocol}://${req.get('host')}/share/${share._id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 分享标签
exports.shareTag = async (req, res) => {
  try {
    const { tag, isPublic, expiresAt, allowedUsers } = req.body;
    
    // 验证用户有使用此标签的书签
    const bookmarksWithTag = await Bookmark.find({
      user: req.user._id,
      tags: tag
    });
    
    if (bookmarksWithTag.length === 0) {
      return res.status(404).json({ message: '未找到使用此标签的书签' });
    }
    
    // 创建分享记录
    const share = new Share({
      type: 'tag',
      tag,
      owner: req.user._id,
      isPublic,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowedUsers: allowedUsers || []
    });
    
    await share.save();
    
    res.status(201).json({
      message: '标签分享成功',
      shareId: share._id,
      shareUrl: `${req.protocol}://${req.get('host')}/share/${share._id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取分享内容
exports.getSharedContent = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    // 查找分享记录
    const share = await Share.findById(shareId);
    
    if (!share) {
      return res.status(404).json({ message: '分享内容未找到' });
    }
    
    // 检查分享是否过期
    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({ message: '分享链接已过期' });
    }
    
    // 检查访问权限
    if (!share.isPublic && 
        share.owner.toString() !== req.user?._id?.toString() && 
        !share.allowedUsers.includes(req.user?._id)) {
      return res.status(403).json({ message: '无权访问此分享内容' });
    }
    
    let content;
    
    // 根据分享类型获取内容
    if (share.type === 'bookmark' && share.bookmark) {
      content = await Bookmark.findById(share.bookmark).select('-user');
    } else if (share.type === 'folder' && share.folderName) {
      content = await Bookmark.find({ 
        folder: share.folderName,
        user: share.owner
      }).select('-user');
    } else if (share.type === 'tag' && share.tag) {
      content = await Bookmark.find({ 
        tags: share.tag,
        user: share.owner
      }).select('-user');
    }
    
    if (!content) {
      return res.status(404).json({ message: '分享内容不存在或已被删除' });
    }
    
    res.json({
      share: {
        type: share.type,
        owner: share.owner,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt
      },
      content
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取用户的所有分享
exports.getUserShares = async (req, res) => {
  try {
    const shares = await Share.find({ owner: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(shares);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 删除分享
exports.deleteShare = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    const share = await Share.findOne({
      _id: shareId,
      owner: req.user._id
    });
    
    if (!share) {
      return res.status(404).json({ message: '分享未找到或无权限删除' });
    }
    
    await Share.findByIdAndDelete(shareId);
    
    res.json({ message: '分享已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};
