const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const folderController = require('../controllers/folderController');
const { protect } = require('../middleware/authMiddleware');

// 所有书签路由都需要认证
router.use(protect);

// 书签路由
router.get('/', bookmarkController.getBookmarks);
router.get('/folder/:folder', bookmarkController.getBookmarksByFolder);
router.get('/tag/:tag', bookmarkController.getBookmarksByTag);
router.post('/tags', bookmarkController.getBookmarksByTags);
router.get('/search/:query', bookmarkController.searchBookmarks);
router.get('/:id', bookmarkController.getBookmark);
router.post('/', bookmarkController.createBookmark);
router.put('/:id', bookmarkController.updateBookmark);
router.delete('/:id', bookmarkController.deleteBookmark);


// 文件夹路由
router.get('/folders/all', folderController.getFolders);
router.get('/folders/:id', folderController.getFolder);
router.post('/folders', folderController.createFolder);
router.put('/folders/:id', folderController.updateFolder);
router.delete('/folders/:id', folderController.deleteFolder);

module.exports = router;
