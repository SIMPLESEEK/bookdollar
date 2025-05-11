const Folder = require('../models/Folder');
const Bookmark = require('../models/Bookmark');

// 获取当前用户的所有文件夹
exports.getFolders = async (req, res) => {
  try {
    // 设置缓存控制头，允许浏览器缓存30秒
    res.set('Cache-Control', 'private, max-age=30');

    // 获取ETag（如果请求头中有）
    const ifNoneMatch = req.headers['if-none-match'];

    // 查询文件夹
    const folders = await Folder.find({ user: req.user._id }).sort({ name: 1 });

    // 生成简单的ETag（基于文件夹数据的哈希）
    const foldersJSON = JSON.stringify(folders);
    const etag = `W/"${Buffer.from(foldersJSON).length.toString(16)}"`;

    // 设置ETag响应头
    res.set('ETag', etag);

    // 如果客户端的ETag匹配，返回304 Not Modified
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    // 否则返回完整数据
    res.json(folders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取当前用户的单个文件夹
exports.getFolder = async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: '文件夹未找到' });
    }

    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 创建文件夹
exports.createFolder = async (req, res) => {
  try {
    // 检查同一用户下是否已存在同名文件夹
    const folderExists = await Folder.findOne({
      name: req.body.name,
      user: req.user._id
    });

    if (folderExists) {
      return res.status(400).json({ message: '文件夹名称已存在' });
    }

    const newFolder = new Folder({
      ...req.body,
      user: req.user._id
    });

    const folder = await newFolder.save();
    res.status(201).json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 更新文件夹
exports.updateFolder = async (req, res) => {
  try {
    // 检查是否尝试更新为已存在的名称
    if (req.body.name) {
      const folderExists = await Folder.findOne({
        name: req.body.name,
        user: req.user._id,
        _id: { $ne: req.params.id }
      });

      if (folderExists) {
        return res.status(400).json({ message: '文件夹名称已存在' });
      }
    }

    const folder = await Folder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: '文件夹未找到或无权限修改' });
    }

    const oldName = folder.name;

    // 更新文件夹
    const updatedFolder = await Folder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // 如果文件夹名称已更改，更新所有相关书签
    if (req.body.name && req.body.name !== oldName) {
      await Bookmark.updateMany(
        { folder: oldName, user: req.user._id },
        { folder: req.body.name }
      );

      // 更新子文件夹的父文件夹引用
      await Folder.updateMany(
        { parent: oldName, user: req.user._id },
        { parent: req.body.name }
      );
    }

    res.json(updatedFolder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 删除文件夹
exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: '文件夹未找到或无权限删除' });
    }

    // 检查是否有书签使用此文件夹
    const bookmarksCount = await Bookmark.countDocuments({
      folder: folder.name,
      user: req.user._id
    });

    if (bookmarksCount > 0) {
      return res.status(400).json({
        message: '无法删除文件夹，因为它包含书签',
        count: bookmarksCount
      });
    }

    // 检查是否有子文件夹
    const childFoldersCount = await Folder.countDocuments({
      parent: folder.name,
      user: req.user._id
    });

    if (childFoldersCount > 0) {
      return res.status(400).json({
        message: '无法删除文件夹，因为它包含子文件夹',
        count: childFoldersCount
      });
    }

    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: '文件夹已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
};
