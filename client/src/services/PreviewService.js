import axios from 'axios';

// 创建预览图服务
const PreviewService = {
  // 生成预览图
  generatePreview: async (url) => {
    try {
      // 获取用户令牌
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('未登录，无法生成预览图');
        return { previewImage: '', colorPreview: generateLocalColorPreview(url), pageTitle: '' };
      }

      const response = await axios.post(
        '/api/preview/generate',
        { url },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // 如果服务器返回了颜色预览信息，使用它
      if (response.data.colorPreview) {
        return response.data;
      }

      // 如果服务器没有返回颜色预览信息，但也没有预览图，生成本地颜色预览
      if (!response.data.previewImage || response.data.previewImage === '') {
        console.log('服务器返回数据但没有预览图，使用本地颜色预览:', response.data);

        // 确保pageTitle字段存在
        const pageTitle = response.data.pageTitle || '';
        console.log('使用页面标题:', pageTitle);

        return {
          ...response.data,
          colorPreview: generateLocalColorPreview(url, pageTitle),
          pageTitle: pageTitle
        };
      }

      // 确保pageTitle字段存在
      if (!response.data.pageTitle) {
        console.log('服务器返回数据但没有页面标题，尝试从其他字段获取');
        // 尝试从colorPreview.domain获取标题
        const pageTitle = response.data.colorPreview?.domain || '';
        response.data.pageTitle = pageTitle;
      } else {
        console.log('服务器返回的页面标题:', response.data.pageTitle);
      }

      // 对于特定网站的特殊处理
      if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
        console.log('特殊处理夸克网站，设置标题为: 夸克');
        response.data.pageTitle = '夸克';
      }

      return response.data;
    } catch (error) {
      console.error('生成预览图失败:', error);
      // 尝试从错误响应中获取页面标题
      const pageTitle = error.response?.data?.pageTitle || '';
      // 出错时生成本地颜色预览
      return { previewImage: '', colorPreview: generateLocalColorPreview(url, pageTitle), pageTitle };
    }
  },

  // 获取预览图
  getPreview: async (url) => {
    try {
      // 获取用户令牌
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('未登录，无法获取预览图');
        return { previewImage: '', colorPreview: generateLocalColorPreview(url), pageTitle: '' };
      }

      const response = await axios.get(
        '/api/preview',
        {
          params: { url },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // 如果服务器返回了颜色预览信息，使用它
      if (response.data.colorPreview) {
        return response.data;
      }

      // 如果服务器没有返回颜色预览信息，但也没有预览图，生成本地颜色预览
      if (!response.data.previewImage || response.data.previewImage === '') {
        console.log('服务器返回数据但没有预览图，使用本地颜色预览:', response.data);

        // 确保pageTitle字段存在
        const pageTitle = response.data.pageTitle || '';
        console.log('使用页面标题:', pageTitle);

        return {
          ...response.data,
          colorPreview: generateLocalColorPreview(url, pageTitle),
          pageTitle: pageTitle
        };
      }

      // 确保pageTitle字段存在
      if (!response.data.pageTitle) {
        console.log('服务器返回数据但没有页面标题，尝试从其他字段获取');
        // 尝试从colorPreview.domain获取标题
        const pageTitle = response.data.colorPreview?.domain || '';
        response.data.pageTitle = pageTitle;
      } else {
        console.log('服务器返回的页面标题:', response.data.pageTitle);
      }

      // 对于特定网站的特殊处理
      if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
        console.log('特殊处理夸克网站，设置标题为: 夸克');
        response.data.pageTitle = '夸克';
      }

      return response.data;
    } catch (error) {
      console.error('获取预览图失败:', error);
      // 尝试从错误响应中获取页面标题
      const pageTitle = error.response?.data?.pageTitle || '';
      // 出错时生成本地颜色预览
      return { previewImage: '', colorPreview: generateLocalColorPreview(url, pageTitle), pageTitle };
    }
  },

  // 上传自定义预览图
  uploadImage: async (file) => {
    try {
      console.log('PreviewService: 开始上传图片', file);

      // 获取用户令牌
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('未登录，无法上传图片');
        return { success: false, message: '未登录，无法上传图片' };
      }

      // 验证文件是否有效
      if (!file) {
        console.error('无效的文件对象');
        return { success: false, message: '无效的文件对象' };
      }

      // 创建FormData对象
      const formData = new FormData();
      formData.append('image', file);

      console.log('PreviewService: 发送上传请求');
      const response = await axios.post(
        '/api/preview/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('PreviewService: 上传响应', response.data);

      // 验证响应数据
      if (!response.data || !response.data.success) {
        console.error('服务器返回错误:', response.data);
        return {
          success: false,
          message: response.data?.message || '服务器返回错误'
        };
      }

      return response.data;
    } catch (error) {
      console.error('上传预览图失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || '上传预览图失败'
      };
    }
  }
};

// 生成本地颜色预览（当服务器没有返回颜色预览时使用）
/**
 * 生成本地颜色预览
 * @param {string} url 目标URL
 * @param {string} pageTitle 可选的页面标题
 * @returns {Object} 颜色预览对象
 */
function generateLocalColorPreview(url, pageTitle) {
  // 使用URL生成一个哈希值
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 转换为颜色
  const r = (hash & 0xFF0000) >> 16;
  const g = (hash & 0x00FF00) >> 8;
  const b = hash & 0x0000FF;

  const backgroundColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  // 计算对比色
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const textColor = brightness > 128 ? '#000000' : '#ffffff';

  // 生成一个不同的颜色作为强调色
  const accentColor = `#${(b.toString(16).padStart(2, '0'))}${(r.toString(16).padStart(2, '0'))}${(g.toString(16).padStart(2, '0'))}`;

  // 提取域名
  let domain = '';
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
  } catch (error) {
    domain = url.replace(/^https?:\/\//, '').split('/')[0];
  }

  // 如果提供了页面标题，优先使用页面标题
  if (pageTitle && pageTitle.trim()) {
    domain = pageTitle.trim();
  }

  return {
    backgroundColor,
    textColor,
    accentColor,
    domain
  };
}

export default PreviewService;
