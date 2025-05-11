import { useState, useEffect } from 'react';

/**
 * 自定义 Hook，用于检测媒体查询是否匹配
 * @param {string} query - CSS 媒体查询字符串，例如 '(max-width: 768px)'
 * @returns {boolean} - 如果媒体查询匹配，则返回 true，否则返回 false
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // 设置初始值
    setMatches(mediaQuery.matches);

    // 定义回调函数
    const handleChange = (event) => {
      setMatches(event.matches);
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
