const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { protect } = require('../middleware/authMiddleware');

// 需要认证的路由
router.post('/bookmark', protect, shareController.shareBookmark);
router.post('/folder', protect, shareController.shareFolder);
router.post('/tag', protect, shareController.shareTag);
router.get('/my-shares', protect, shareController.getUserShares);
router.delete('/:shareId', protect, shareController.deleteShare);

// 获取分享内容 - 可以是公开的，也可以是需要认证的
router.get('/:shareId', shareController.getSharedContent);

module.exports = router;
