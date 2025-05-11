const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const browserImportController = require('../controllers/browserImportController');
const { protect } = require('../middleware/authMiddleware');

// 所有路由都需要认证
router.use(protect);

// 导出用户数据
router.get('/export', exportController.exportUserData);

// 导入用户数据
router.post('/import', exportController.importUserData);

// 从浏览器导入
router.post('/import/chrome', browserImportController.importFromChrome);
router.post('/import/firefox', browserImportController.importFromFirefox);

module.exports = router;
