const Bookmark = require('../models/Bookmark');
const Folder = require('../models/Folder');

// 从Chrome/Edge书签HTML文件导入
exports.importFromChrome = async (req, res) => {
  try {
    const { bookmarks } = req.body;
    
    if (!bookmarks || !Array.isArray(bookmarks)) {
      return res.status(400).json({ message: '无效的书签数据' });
    }
    
    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // 处理每个书签
    for (const bookmark of bookmarks) {
      try {
        // 检查必要字段
        if (!bookmark.url || !bookmark.title) {
          results.push({
            title: bookmark.title || 'Unknown',
            status: 'error',
            message: '缺少必要字段(URL或标题)'
          });
          errorCount++;
          continue;
        }
        
        // 检查是否已存在相同URL的书签
        const existingBookmark = await Bookmark.findOne({
          url: bookmark.url,
          user: req.user._id
        });
        
        if (existingBookmark) {
          results.push({
            title: bookmark.title,
            url: bookmark.url,
            status: 'skipped',
            message: '书签已存在'
          });
          skipCount++;
          continue;
        }
        
        // 处理文件夹
        let folderName = '默认';
        if (bookmark.folder) {
          // 检查文件夹是否存在，不存在则创建
          const folderExists = await Folder.findOne({
            name: bookmark.folder,
            user: req.user._id
          });
          
          if (!folderExists) {
            const newFolder = new Folder({
              name: bookmark.folder,
              user: req.user._id
            });
            await newFolder.save();
          }
          
          folderName = bookmark.folder;
        }
        
        // 创建新书签
        const newBookmark = new Bookmark({
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description || '',
          folder: folderName,
          tags: bookmark.tags || [],
          user: req.user._id
        });
        
        await newBookmark.save();
        
        results.push({
          title: bookmark.title,
          url: bookmark.url,
          status: 'success',
          message: '书签导入成功'
        });
        successCount++;
      } catch (error) {
        results.push({
          title: bookmark.title || 'Unknown',
          url: bookmark.url || 'Unknown',
          status: 'error',
          message: error.message
        });
        errorCount++;
      }
    }
    
    res.json({
      message: '导入完成',
      summary: {
        total: bookmarks.length,
        success: successCount,
        skipped: skipCount,
        error: errorCount
      },
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '导入数据失败' });
  }
};

// 从Firefox书签JSON文件导入
exports.importFromFirefox = async (req, res) => {
  try {
    const { bookmarks } = req.body;
    
    if (!bookmarks || !Array.isArray(bookmarks)) {
      return res.status(400).json({ message: '无效的书签数据' });
    }
    
    // 处理逻辑与Chrome导入类似
    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // 处理每个书签
    for (const bookmark of bookmarks) {
      try {
        // Firefox书签格式处理
        if (!bookmark.url || !bookmark.title) {
          results.push({
            title: bookmark.title || 'Unknown',
            status: 'error',
            message: '缺少必要字段(URL或标题)'
          });
          errorCount++;
          continue;
        }
        
        // 检查是否已存在相同URL的书签
        const existingBookmark = await Bookmark.findOne({
          url: bookmark.url,
          user: req.user._id
        });
        
        if (existingBookmark) {
          results.push({
            title: bookmark.title,
            url: bookmark.url,
            status: 'skipped',
            message: '书签已存在'
          });
          skipCount++;
          continue;
        }
        
        // 处理文件夹
        let folderName = '默认';
        if (bookmark.folder) {
          const folderExists = await Folder.findOne({
            name: bookmark.folder,
            user: req.user._id
          });
          
          if (!folderExists) {
            const newFolder = new Folder({
              name: bookmark.folder,
              user: req.user._id
            });
            await newFolder.save();
          }
          
          folderName = bookmark.folder;
        }
        
        // 创建新书签
        const newBookmark = new Bookmark({
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description || '',
          folder: folderName,
          tags: bookmark.tags || [],
          user: req.user._id
        });
        
        await newBookmark.save();
        
        results.push({
          title: bookmark.title,
          url: bookmark.url,
          status: 'success',
          message: '书签导入成功'
        });
        successCount++;
      } catch (error) {
        results.push({
          title: bookmark.title || 'Unknown',
          url: bookmark.url || 'Unknown',
          status: 'error',
          message: error.message
        });
        errorCount++;
      }
    }
    
    res.json({
      message: '导入完成',
      summary: {
        total: bookmarks.length,
        success: successCount,
        skipped: skipCount,
        error: errorCount
      },
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '导入数据失败' });
  }
};
