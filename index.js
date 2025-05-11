// 主入口文件，用于Vercel部署
// 导入服务器应用
const app = require('./server/index');

// 导出应用供Vercel使用
module.exports = app;
