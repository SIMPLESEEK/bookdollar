import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSpinner, FaImage, FaUpload, FaPaste, FaLink } from 'react-icons/fa';
import { useBookmarks } from '../../context/BookmarkContext';
import { useFolders } from '../../context/FolderContext';
import PreviewService from '../../services/PreviewService';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const AddBookmarkModal = ({ onClose }) => {
  const { addBookmark } = useBookmarks();
  const { folders, getFolders } = useFolders();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewMode, setPreviewMode] = useState('auto'); // 'auto', 'url', 'upload', 'paste'
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    reason: '',
    previewImage: '',
    tags: '',
    folder: '未分类',
    customPreviewUrl: '' // 用于手动输入的预览图URL
  });
  const [error, setError] = useState('');

  // 检测是否为移动设备
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    getFolders();

    // 防止滚动
    document.body.style.overflow = 'hidden';

    // 清理函数
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // 上一次URL值的引用，用于比较变化
  const lastUrlRef = useRef('');

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 如果是URL字段，记录上一次的值用于比较
    if (name === 'url') {
      lastUrlRef.current = formData.url;
    }

    setFormData({ ...formData, [name]: value });
  };

  // 生成一个基于标题的颜色（用于无图片时的背景色）
  const getColorFromTitle = (title) => {
    // 简单的哈希函数，将标题转换为颜色
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    // 转换为HSL颜色，保持饱和度和亮度适中
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 80%)`;
  };

  // 从URL获取网页标题和预览图
  const fetchUrlMetadata = async () => {
    if (!formData.url) return;

    // 确保URL格式正确
    let processedUrl = formData.url;

    // 如果URL不包含协议，添加https://
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = 'https://' + processedUrl;
    }

    // 如果用户正在输入中，不执行请求
    if (!isCompleteUrl(processedUrl)) {
      console.log('URL不完整，跳过元数据获取');
      return;
    }

    try {
      setPreviewLoading(true);

      // 从URL提取域名作为标题
      const domain = processedUrl.replace(/^https?:\/\//, '').split('/')[0];

      // 使用预览图服务生成预览图
      const previewResult = await PreviewService.generatePreview(processedUrl);

      // 只有当用户没有手动修改过标题时，才自动设置标题
      // 或者当前标题是之前自动设置的域名时
      const shouldUpdateTitle = !formData.title ||
                               formData.title === lastUrlRef.current.replace(/^https?:\/\//, '').split('/')[0];

      // 优先使用服务器返回的页面标题，其次使用colorPreview中的domain，最后使用本地提取的域名
      let bestTitle = previewResult.pageTitle || previewResult.colorPreview?.domain || domain;

      // 对于特定网站的特殊处理
      if (processedUrl.includes('quark.cn') || processedUrl.includes('ai.quark.cn')) {
        bestTitle = '夸克';
        console.log('特殊处理夸克网站，设置标题为: 夸克');
      }

      console.log('获取到的标题信息:', {
        pageTitle: previewResult.pageTitle,
        colorPreviewDomain: previewResult.colorPreview?.domain,
        localDomain: domain,
        bestTitle
      });

      if (shouldUpdateTitle) {
        setFormData({
          ...formData,
          url: processedUrl, // 更新为格式化后的URL
          title: bestTitle,
          previewImage: previewResult.previewImage || '',
          colorPreview: previewResult.colorPreview
        });
      } else {
        setFormData({
          ...formData,
          url: processedUrl, // 更新为格式化后的URL
          previewImage: previewResult.previewImage || '',
          colorPreview: previewResult.colorPreview
        });
      }

      setPreviewLoading(false);
      console.log('设置预览图:', previewResult.previewImage ? '使用预览图' : '使用颜色背景');
    } catch (error) {
      console.error('获取URL元数据失败:', error);
      setPreviewLoading(false);

      // 出错时使用本地生成的颜色预览
      const domain = processedUrl.replace(/^https?:\/\//, '').split('/')[0];
      const localColorPreview = PreviewService.generateLocalColorPreview
        ? PreviewService.generateLocalColorPreview(processedUrl)
        : null;

      // 只有当用户没有手动修改过标题时，才自动设置标题
      const shouldUpdateTitle = !formData.title ||
                               formData.title === lastUrlRef.current.replace(/^https?:\/\//, '').split('/')[0];

      // 尝试从错误响应中获取页面标题
      const pageTitle = error.response?.data?.pageTitle || '';

      // 优先使用服务器返回的页面标题，其次使用localColorPreview中的domain，最后使用本地提取的域名
      let bestTitle = pageTitle || localColorPreview?.domain || domain;

      // 对于特定网站的特殊处理
      if (processedUrl.includes('quark.cn') || processedUrl.includes('ai.quark.cn')) {
        bestTitle = '夸克';
        console.log('特殊处理夸克网站，设置标题为: 夸克');
      }

      console.log('错误处理中获取到的标题信息:', {
        pageTitle: pageTitle,
        localColorPreviewDomain: localColorPreview?.domain,
        localDomain: domain,
        bestTitle
      });

      if (shouldUpdateTitle) {
        setFormData({
          ...formData,
          url: processedUrl, // 更新为格式化后的URL
          title: bestTitle,
          previewImage: '',
          colorPreview: localColorPreview
        });
      } else {
        setFormData({
          ...formData,
          url: processedUrl, // 更新为格式化后的URL
          previewImage: '',
          colorPreview: localColorPreview
        });
      }
    }
  };

  // 用于存储元数据获取的定时器ID
  const metadataTimerRef = useRef(null);

  // 判断URL是否完整
  const isCompleteUrl = (url) => {
    // 检查URL是否包含至少一个点和一个顶级域名
    return /^(https?:\/\/)?[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/.*)?$/.test(url);
  };

  useEffect(() => {
    // 当URL改变时，如果是自动模式才尝试获取元数据
    if (formData.url && previewMode === 'auto') {
      // 清除之前的定时器
      if (metadataTimerRef.current) {
        clearTimeout(metadataTimerRef.current);
      }

      // 检查URL是否发生了重大变化（例如添加了新的域名部分）
      const urlChanged = !lastUrlRef.current.includes(formData.url) && !formData.url.includes(lastUrlRef.current);

      // 只有当URL看起来是完整的，或者发生了重大变化时才获取元数据
      if (isCompleteUrl(formData.url) || urlChanged) {
        // 使用更长的延迟，给用户足够的时间完成输入
        metadataTimerRef.current = setTimeout(() => {
          fetchUrlMetadata();
        }, 1500); // 增加到1.5秒的防抖
      }

      return () => {
        if (metadataTimerRef.current) {
          clearTimeout(metadataTimerRef.current);
        }
      };
    }
  }, [formData.url, previewMode]);

  // 处理自定义预览图URL变更
  useEffect(() => {
    if (previewMode === 'url' && formData.customPreviewUrl) {
      setFormData({
        ...formData,
        previewImage: formData.customPreviewUrl
      });
    }
  }, [formData.customPreviewUrl, previewMode]);

  // 处理图片上传
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const result = await PreviewService.uploadImage(file);
      if (result.previewImage) {
        setFormData({
          ...formData,
          previewImage: result.previewImage
        });
        setPreviewMode('upload');
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      setError('上传图片失败');
    } finally {
      setUploadingImage(false);
    }
  };

  // 处理图片粘贴
  const handleImagePaste = async (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    let blob = null;

    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        blob = item.getAsFile();
        break;
      }
    }

    if (!blob) {
      console.log('剪贴板中没有图片');
      return;
    }

    try {
      setUploadingImage(true);
      const result = await PreviewService.uploadImage(blob);
      if (result.previewImage) {
        setFormData({
          ...formData,
          previewImage: result.previewImage
        });
        setPreviewMode('paste');
      }
    } catch (error) {
      console.error('粘贴图片失败:', error);
      setError('粘贴图片失败');
    } finally {
      setUploadingImage(false);
    }
  };

  // 切换预览模式
  const switchPreviewMode = (mode) => {
    setPreviewMode(mode);

    if (mode === 'auto' && formData.url) {
      // 切换到自动模式时，重新获取元数据
      fetchUrlMetadata();
    } else if (mode === 'url') {
      // 切换到URL模式时，如果已有自定义URL，使用它
      if (formData.customPreviewUrl) {
        setFormData({
          ...formData,
          previewImage: formData.customPreviewUrl
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.url || !formData.title) {
      setError('URL和标题是必填项');
      return;
    }

    try {
      setLoading(true);

      // 处理标签 - 将逗号分隔的标签转换为数组
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : [];

      await addBookmark({
        ...formData,
        tags: tagsArray
      });

      setLoading(false);
      onClose();
    } catch (error) {
      setError('添加书签失败');
      setLoading(false);
    }
  };

  // 阻止点击模态框内部时关闭
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg ${isMobile ? 'p-3' : 'p-6'} w-full ${isMobile ? 'max-w-full mx-3' : 'max-w-md'}`}
        onClick={handleModalClick}
      >
        <div className={`flex justify-between items-center ${isMobile ? 'mb-2' : 'mb-4'}`}>
          <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>添加新书签</h2>
          <button
            className="text-gray-500 hover:text-gray-700 p-2"
            onClick={onClose}
          >
            <FaTimes size={isMobile ? 20 : 16} />
          </button>
        </div>

        {error && (
          <div className={`bg-red-100 text-red-700 p-2 rounded ${isMobile ? 'mb-2 text-sm' : 'mb-4'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>URL *</label>
            <input
              type="url"
              name="url"
              className={`form-control ${isMobile ? 'text-sm py-1.5' : ''}`}
              value={formData.url}
              onChange={handleChange}
              onBlur={() => {
                // 在输入框失去焦点时，如果URL看起来是完整的，立即获取元数据
                if (formData.url && isCompleteUrl(formData.url) && previewMode === 'auto') {
                  fetchUrlMetadata();
                }
              }}
              required
            />
          </div>

          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>标题 *</label>
            <div className="flex">
              <input
                type="text"
                name="title"
                className={`form-control ${isMobile ? 'text-sm py-1.5' : ''}`}
                value={formData.title}
                onChange={handleChange}
                required
              />
              {previewLoading && (
                <div className="ml-2 flex items-center">
                  <FaSpinner className="animate-spin text-primary-500" />
                </div>
              )}
            </div>
          </div>

          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>收藏原因</label>
            <textarea
              name="reason"
              className={`form-control ${isMobile ? 'text-sm py-1.5' : ''}`}
              value={formData.reason}
              onChange={handleChange}
              rows={isMobile ? "3" : "5"}
              placeholder="为什么要收藏这个页面？描述一下这个页面的内容或您的想法。"
              style={{ minHeight: isMobile ? "70px" : "100px" }}
            />
          </div>

          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>预览图</label>

            {/* 预览图提示文字 */}
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mb-1`}>
              预览图为自动生成，如果需要调整请在书签卡片点击设置按钮
            </div>

            {/* 隐藏的文件上传输入 */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />



            {/* 预览图显示区域 */}
            <div
              className={`mt-1 ${isMobile ? 'h-16' : 'h-20'} bg-cover bg-center rounded`}
              style={
                formData.previewImage && formData.previewImage.trim() !== ''
                  ? { backgroundImage: `url(${formData.previewImage})` }
                  : {
                      backgroundColor: formData.colorPreview?.backgroundColor || getColorFromTitle(formData.title || formData.url || 'Bookmark'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '0.8rem' : '0.9rem',
                      fontWeight: 'bold',
                      color: formData.colorPreview?.textColor || '#333',
                      textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }
              }
              onPaste={previewMode === 'paste' ? handleImagePaste : undefined}
            >
              {(!formData.previewImage || formData.previewImage.trim() === '') && (
                <>
                  {/* 添加渐变背景效果 */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: formData.colorPreview?.accentColor
                      ? `radial-gradient(circle, ${formData.colorPreview.accentColor}22 0%, ${formData.colorPreview.backgroundColor || getColorFromTitle(formData.title || formData.url || 'Bookmark')}ff 70%)`
                      : `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.05) 70%)`,
                    zIndex: 1
                  }} />

                  {/* 显示域名和URL */}
                  <div style={{
                    padding: isMobile ? '0.25rem' : '0.5rem',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    width: '100%',
                    zIndex: 5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
                      {formData.colorPreview?.domain || formData.title || formData.url || 'Bookmark'}
                    </div>
                  </div>
                </>
              )}

              {/* 上传中指示器 */}
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                  <FaSpinner className="animate-spin text-white text-xl" />
                </div>
              )}
            </div>
          </div>

          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>标签 (用逗号分隔)</label>
            <input
              type="text"
              name="tags"
              className={`form-control ${isMobile ? 'text-sm py-1.5' : ''}`}
              value={formData.tags}
              onChange={handleChange}
              placeholder="例如: 技术, 学习, 参考"
            />
          </div>

          <div className={`form-group ${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>文件夹</label>
            <select
              name="folder"
              className={`form-control ${isMobile ? 'text-sm py-1.5' : ''}`}
              value={formData.folder}
              onChange={handleChange}
            >
              <option value="未分类">未分类</option>
              {folders.filter(folder => folder.name !== '未分类').map(folder => (
                <option key={folder._id} value={folder.name}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className={`flex justify-end ${isMobile ? 'mt-3' : 'mt-4'}`}>
            <button
              type="button"
              className={`btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300 ${isMobile ? 'text-sm py-1.5 px-3' : ''}`}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${isMobile ? 'text-sm py-1.5 px-3' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-1" />
                  保存中...
                </>
              ) : '保存书签'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBookmarkModal;
