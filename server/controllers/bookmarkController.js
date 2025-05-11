const Bookmark = require('../models/Bookmark');

// 获取当前用户的所有书签
exports.getBookmarks = async (req, res) => {
  try {
    // 设置缓存控制头，允许浏览器缓存10秒
    res.set('Cache-Control', 'private, max-age=10');

    // 获取ETag（如果请求头中有）
    const ifNoneMatch = req.headers['if-none-match'];

    const bookmarks = await Bookmark.find({ user: req.user._id }).sort({ createdAt: -1 });

    // 生成简单的ETag（基于书签数据的哈希）
    const bookmarksJSON = JSON.stringify(bookmarks);
    const etag = `W/"${Buffer.from(bookmarksJSON).length.toString(16)}"`;

    // 设置ETag响应头
    res.set('ETag', etag);

    // 如果客户端的ETag匹配，返回304 Not Modified
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.json(bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 按文件夹获取当前用户的书签
exports.getBookmarksByFolder = async (req, res) => {
  try {
    // 设置缓存控制头，允许浏览器缓存10秒
    res.set('Cache-Control', 'private, max-age=10');

    // 获取ETag（如果请求头中有）
    const ifNoneMatch = req.headers['if-none-match'];

    const { folder } = req.params;
    const bookmarks = await Bookmark.find({
      folder,
      user: req.user._id
    }).sort({ createdAt: -1 });

    // 生成简单的ETag（基于书签数据的哈希）
    const bookmarksJSON = JSON.stringify(bookmarks);
    const etag = `W/"${Buffer.from(bookmarksJSON).length.toString(16)}"`;

    // 设置ETag响应头
    res.set('ETag', etag);

    // 如果客户端的ETag匹配，返回304 Not Modified
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.json(bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 按标签获取当前用户的书签
exports.getBookmarksByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const bookmarks = await Bookmark.find({
      tags: tag,
      user: req.user._id
    }).sort({ createdAt: -1 });
    res.json(bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 按多个标签获取当前用户的书签
exports.getBookmarksByTags = async (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ message: '请提供有效的标签数组' });
    }

    const bookmarks = await Bookmark.find({
      tags: { $all: tags },
      user: req.user._id
    }).sort({ createdAt: -1 });

    res.json(bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取当前用户的单个书签
exports.getBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!bookmark) {
      return res.status(404).json({ message: '书签未找到' });
    }

    res.json(bookmark);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 创建书签
exports.createBookmark = async (req, res) => {
  try {
    const newBookmark = new Bookmark({
      ...req.body,
      user: req.user._id
    });

    const bookmark = await newBookmark.save();
    res.status(201).json(bookmark);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 更新书签
exports.updateBookmark = async (req, res) => {
  try {
    console.log(`[BookmarkController] 更新书签请求: ID=${req.params.id}, 用户=${req.user._id}`);
    console.log(`[BookmarkController] 更新内容:`, req.body);

    // 验证请求数据
    if (req.body.folder) {
      console.log(`[BookmarkController] 检查目标文件夹: ${req.body.folder}`);
    }

    // 添加超时保护
    const updatePromise = Bookmark.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    // 设置15秒超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('数据库操作超时'));
      }, 15000);
    });

    // 使用Promise.race来实现超时控制
    const bookmark = await Promise.race([updatePromise, timeoutPromise]);

    if (!bookmark) {
      console.log(`[BookmarkController] 书签未找到: ID=${req.params.id}, 用户=${req.user._id}`);
      return res.status(404).json({ message: '书签未找到或无权限修改' });
    }

    console.log(`[BookmarkController] 书签更新成功: ID=${bookmark._id}`);
    res.json(bookmark);
  } catch (err) {
    console.error(`[BookmarkController] 更新书签错误:`, err);

    // 提供更详细的错误信息
    let errorMessage = '服务器错误';
    let statusCode = 500;

    if (err.name === 'ValidationError') {
      errorMessage = '数据验证错误: ' + Object.values(err.errors).map(e => e.message).join(', ');
      statusCode = 400;
    } else if (err.name === 'CastError') {
      errorMessage = '无效的ID格式';
      statusCode = 400;
    } else if (err.message === '数据库操作超时') {
      errorMessage = '操作超时，请稍后重试';
      statusCode = 408; // Request Timeout
    }

    res.status(statusCode).json({
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 删除书签
exports.deleteBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!bookmark) {
      return res.status(404).json({ message: '书签未找到或无权限删除' });
    }

    res.json({ message: '书签已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 搜索当前用户的书签
exports.searchBookmarks = async (req, res) => {
  try {
    const { query } = req.params;
    const bookmarks = await Bookmark.find({
      user: req.user._id,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { reason: { $regex: query, $options: 'i' } },
        { url: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    }).sort({ createdAt: -1 });

    res.json(bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};


