const crypto = require('crypto');

/**
 * 生成基于URL的颜色预览
 * 这是一个备选方案，当Puppeteer截图失败时使用
 * @param {string} url 目标网址
 * @param {string} pageTitle 可选的网页标题，如果提供则优先使用
 */
function generateColorPreview(url, pageTitle) {
  // 使用URL生成一个哈希值
  const hash = crypto.createHash('md5').update(url).digest('hex');

  // 从哈希值中提取颜色
  const backgroundColor = `#${hash.substring(0, 6)}`;
  const textColor = getContrastColor(backgroundColor);
  const accentColor = `#${hash.substring(6, 12)}`;

  // 提取域名作为显示文本
  let domain = '';
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
  } catch (error) {
    // 如果URL解析失败，使用原始URL
    domain = url.replace(/^https?:\/\//, '').split('/')[0];
  }

  // 如果提供了页面标题，优先使用页面标题
  if (pageTitle && pageTitle.trim()) {
    domain = pageTitle.trim();
  }

  // 返回颜色信息
  return {
    backgroundColor,
    textColor,
    accentColor,
    domain
  };
}

/**
 * 根据背景色计算对比色（黑色或白色）
 * 确保文本在背景上有足够的可读性
 */
function getContrastColor(hexColor) {
  // 移除#前缀
  const hex = hexColor.replace('#', '');

  // 转换为RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 如果亮度大于128，返回黑色，否则返回白色
  return brightness > 128 ? '#000000' : '#ffffff';
}

/**
 * 生成CSS样式的预览图
 */
function generateCSSPreview(url) {
  const colors = generateColorPreview(url);

  // 生成CSS样式
  const css = `
    .preview-container {
      width: 100%;
      height: 100%;
      background-color: ${colors.backgroundColor};
      color: ${colors.textColor};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }

    .preview-container::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, ${colors.accentColor}22 0%, ${colors.backgroundColor}ff 70%);
      z-index: 1;
    }

    .preview-domain {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      z-index: 2;
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .preview-url {
      font-size: 14px;
      margin-top: 10px;
      opacity: 0.8;
      text-align: center;
      z-index: 2;
    }
  `;

  // 生成HTML
  const html = `
    <div class="preview-container">
      <div class="preview-domain">${colors.domain}</div>
      <div class="preview-url">${url}</div>
    </div>
  `;

  return {
    css,
    html,
    colors
  };
}

module.exports = {
  generateColorPreview,
  generateCSSPreview
};
