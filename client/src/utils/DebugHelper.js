// 调试辅助工具
const DebugHelper = {
  // 是否启用调试 - 确保在生产环境中禁用
  isDebugEnabled: false,

  // 记录登录过程 - 空函数，避免不必要的调用
  logLoginProcess: () => {},

  // 记录认证状态 - 空函数，避免不必要的调用
  logAuthState: () => {},

  // 记录令牌 - 空函数，避免不必要的调用
  logToken: () => {},

  // 记录错误 - 仅在开发环境中记录
  logError: (source, error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[错误 - ${source}]`, error);
    }
  }
};

export default DebugHelper;
