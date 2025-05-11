const Bookmark = require('../models/Bookmark');
const Folder = require('../models/Folder');

// 导出用户的所有书签和文件夹
exports.exportUserData = async (req, res) => {
  try {
    // 获取用户的所有书签
    const bookmarks = await Bookmark.find({ user: req.user._id });
    
    // 获取用户的所有文件夹
    const folders = await Folder.find({ user: req.user._id });
    
    // 创建导出数据对象
    const exportData = {
      bookmarks,
      folders,
      exportDate: new Date(),
      version: '1.0'
    };
    
    // 设置响应头，使浏览器下载文件
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=bookdollar-export-${Date.now()}.json`);
    
    // 发送JSON数据
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '导出数据失败' });
  }
};

// 导入书签和文件夹数据
exports.importUserData = async (req, res) => {
  try {
    const { bookmarks, folders } = req.body;
    
    if (!bookmarks || !folders) {
      return res.status(400).json({ message: '无效的导入数据格式' });
    }
    
    // 导入文件夹
    const folderResults = [];
    for (const folder of folders) {
      try {
        // 检查是否已存在同名文件夹
        const existingFolder = await Folder.findOne({
          name: folder.name,
          user: req.user._id
        });
        
        if (existingFolder) {
          folderResults.push({
            name: folder.name,
            status: 'skipped',
            message: '文件夹已存在'
          });
          continue;
        }
        
        // 创建新文件夹
        const newFolder = new Folder({
          name: folder.name,
          parent: folder.parent,
          user: req.user._id
        });
        
        await newFolder.save();
        
        folderResults.push({
          name: folder.name,
          status: 'success',
          message: '文件夹导入成功'
        });
      } catch (error) {
        folderResults.push({
          name: folder.name,
          status: 'error',
          message: error.message
        });
      }
    }
    
    // 导入书签
    const bookmarkResults = [];
    for (const bookmark of bookmarks) {
      try {
        // 检查是否已存在相同URL的书签
        const existingBookmark = await Bookmark.findOne({
          url: bookmark.url,
          user: req.user._id
        });
        
        if (existingBookmark) {
          bookmarkResults.push({
            title: bookmark.title,
            url: bookmark.url,
            status: 'skipped',
            message: '书签已存在'
          });
          continue;
        }
        
        // 创建新书签
        const newBookmark = new Bookmark({
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description,
          reason: bookmark.reason,
          previewImage: bookmark.previewImage,
          tags: bookmark.tags,
          folder: bookmark.folder,
          user: req.user._id
        });
        
        await newBookmark.save();
        
        bookmarkResults.push({
          title: bookmark.title,
          url: bookmark.url,
          status: 'success',
          message: '书签导入成功'
        });
      } catch (error) {
        bookmarkResults.push({
          title: bookmark.title || 'Unknown',
          url: bookmark.url || 'Unknown',
          status: 'error',
          message: error.message
        });
      }
    }
    
    res.json({
      message: '导入完成',
      summary: {
        folders: {
          total: folders.length,
          success: folderResults.filter(r => r.status === 'success').length,
          skipped: folderResults.filter(r => r.status === 'skipped').length,
          error: folderResults.filter(r => r.status === 'error').length
        },
        bookmarks: {
          total: bookmarks.length,
          success: bookmarkResults.filter(r => r.status === 'success').length,
          skipped: bookmarkResults.filter(r => r.status === 'skipped').length,
          error: bookmarkResults.filter(r => r.status === 'error').length
        }
      },
      details: {
        folders: folderResults,
        bookmarks: bookmarkResults
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '导入数据失败' });
  }
};
