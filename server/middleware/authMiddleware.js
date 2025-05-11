const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 保护路由中间件
exports.protect = async (req, res, next) => {
  let token;
  
  // 检查请求头中的Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 获取令牌
      token = req.headers.authorization.split(' ')[1];
      
      // 验证令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 获取用户信息（不包含密码）
      req.user = await User.findById(decoded.id).select('-password');
      
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: '未授权，令牌无效' });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: '未授权，没有令牌' });
  }
};
