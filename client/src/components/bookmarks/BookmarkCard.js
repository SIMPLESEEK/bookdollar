import React, { memo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaTrash, FaClock, FaEdit, FaImage, FaCheck, FaTimes, FaTag, FaCloudUploadAlt, FaUpload, FaFolderOpen, FaExchangeAlt } from 'react-icons/fa';
import { useBookmarks } from '../../context/BookmarkContext';
import { useModal } from '../../context/ModalContext';
import PreviewService from '../../services/PreviewService';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * 书签卡片组件
 * 显示书签信息，支持直接编辑标题、收藏原因和预览图
 */
const BookmarkCard = ({ bookmark }) => {
  const { deleteBookmark, updateBookmark } = useBookmarks();
  const { openDeleteModal, openEditTagsModal, openMoveToFolderModal } = useModal();
  const fileInputRef = useRef(null);

  // 检测是否为移动设备
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 编辑状态
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingReason, setEditingReason] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 编辑内容
  const [title, setTitle] = useState(bookmark.title || '');
  const [reason, setReason] = useState(bookmark.reason || bookmark.description || '');

  // 保存标题
  const saveTitle = async (e) => {
    e?.preventDefault();
    if (!title.trim()) return;

    try {
      await updateBookmark(bookmark._id, { title });
      setEditingTitle(false);
    } catch (error) {
      console.error('更新标题失败:', error);
    }
  };

  // 保存收藏原因
  const saveReason = async (e) => {
    e?.preventDefault();

    try {
      await updateBookmark(bookmark._id, { reason });
      setEditingReason(false);
    } catch (error) {
      console.error('更新收藏原因失败:', error);
    }
  };

  // 处理图片上传
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingImage(true);

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('只能上传图片文件');
        return;
      }

      // 检查文件大小
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('图片文件不能超过5MB');
        return;
      }

      const result = await PreviewService.uploadImage(file);

      if (result && result.success && result.previewImage) {
        await updateBookmark(bookmark._id, { previewImage: result.previewImage });
      } else {
        console.error('上传图片返回无效结果:', result);
        if (result && result.message) {
          alert(`上传失败: ${result.message}`);
        } else {
          alert('上传图片失败，请稍后重试');
        }
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      alert('上传图片失败，请稍后重试');
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

      // 检查文件大小
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (blob.size > maxSize) {
        alert('图片文件不能超过5MB');
        return;
      }

      const result = await PreviewService.uploadImage(blob);

      if (result && result.success && result.previewImage) {
        await updateBookmark(bookmark._id, { previewImage: result.previewImage });
      } else {
        console.error('粘贴图片上传返回无效结果:', result);
        if (result && result.message) {
          alert(`上传失败: ${result.message}`);
        } else {
          alert('粘贴图片上传失败，请尝试使用上传按钮');
        }
      }
    } catch (error) {
      console.error('粘贴图片失败:', error);
      alert('粘贴图片失败，请尝试使用上传按钮');
    } finally {
      setUploadingImage(false);
    }
  };

  // 处理打开删除模态框
  const handleOpenDeleteModal = (e) => {
    e.stopPropagation();
    e.preventDefault();
    openDeleteModal(
      "删除书签",
      "确定要删除这个书签吗？此操作无法撤销。",
      async () => {
        try {
          await deleteBookmark(bookmark._id);
        } catch (error) {
          console.error('删除书签失败:', error);
        }
      }
    );
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('zh-CN', options);
  };

  // 生成一个基于标题的颜色（用于无图片时的背景色）
  const getColorFromTitle = (title) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 80%)`;
  };

  // 处理预览图
  const isValidPreviewImage = bookmark.previewImage &&
                             bookmark.previewImage.trim() !== '' &&
                             !bookmark.previewImage.includes('placeholder.com');

  const previewImage = isValidPreviewImage ? bookmark.previewImage : null;

  // 使用服务器返回的颜色预览或本地生成的颜色
  const colorPreview = bookmark.colorPreview || {};
  const bgColor = colorPreview.backgroundColor || getColorFromTitle(bookmark.title || 'Bookmark');
  const textColor = colorPreview.textColor || '#333';
  const domain = colorPreview.domain || (bookmark.title || 'Bookmark');

  return (
    <div
      className="bookmark-card bg-white"
      style={{ userSelect: 'none', width: '100%', display: 'block' }}
    >
      {/* 预览图区域 */}
      <div
        className="bookmark-preview"
        onClick={(e) => {
          // 在PC端点击时聚焦元素，以便接收粘贴事件
          if (!isMobile) {
            e.currentTarget.focus();
          }
        }}
        onPaste={!isMobile ? handleImagePaste : undefined} // 只在PC端添加粘贴事件处理
        title={!isMobile ? "点击此处可粘贴新的预览图 (Ctrl+V)" : "点击右上角按钮上传图片"}
        tabIndex={!isMobile ? "0" : undefined} // 只在PC端使div可聚焦以接收粘贴事件
        style={{
          ...((previewImage
            ? {
                backgroundImage: `url(${previewImage})`,
                backgroundSize: 'contain', // 改为contain以保持图片比例
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                paddingBottom: isMobile ? '50%' : '56.25%', // 移动端使用更紧凑的比例
              }
            : {
                backgroundColor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '0.9rem' : '1.2rem',
                fontWeight: 'bold',
                color: textColor,
                textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                paddingBottom: isMobile ? '50%' : '56.25%', // 移动端使用更紧凑的比例
              })),
          position: 'relative',
          height: 'auto', // 允许高度自适应
          minHeight: isMobile ? '80px' : '120px', // 移动端减小最小高度
          borderBottom: 'none', // 移除底部边框，消除缝隙
          cursor: 'pointer', // 添加指针样式，表明可点击
          outline: 'none', // 移除聚焦时的轮廓
        }}
      >
        {/* 悬停提示 - PC端显示粘贴提示，移动端显示上传提示 */}
        {!isMobile ? (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-200 z-3">
            <div className="text-center px-4">
              <div className="text-lg font-bold mb-1">粘贴图片</div>
              <div className="text-sm">复制图片后点击此处粘贴 (Ctrl+V)</div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-200 z-3">
            <div className="text-center px-4">
              <div className="text-base font-bold mb-0.5">上传图片</div>
              <div className="text-xs">点击右上角按钮上传图片</div>
            </div>
          </div>
        )}
        {/* 预览图上传按钮 - 使用更符合上传语义的图标，低调样式但悬停时有明显反差 */}
        <div className="absolute top-1 right-1 flex space-x-1 z-10">
          <button
            className={`bg-white bg-opacity-70 text-gray-400 hover:text-blue-500 hover:bg-white hover:bg-opacity-90 ${isMobile ? 'p-1' : 'p-1.5'} rounded-full transition-all duration-200`}
            style={{
              border: '1px solid #d1d5db', // 淡灰色边框
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)', // 轻微阴影
              position: 'relative', // 确保按钮有自己的定位上下文
              zIndex: 10, // 确保按钮在最上层
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.border = '1px solid #9ca3af'; // 悬停时边框变深
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)'; // 悬停时阴影增强
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.border = '1px solid #d1d5db'; // 恢复淡灰色边框
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'; // 恢复轻微阴影
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            title="上传本地图片"
          >
            <FaUpload size={isMobile ? 12 : 16} />
          </button>
        </div>

        {/* 隐藏的文件上传输入 */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />

        {/* 上传中指示器 */}
        {uploadingImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}

        {!previewImage && (
          <>
            {/* 渐变背景效果 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: colorPreview.accentColor
                ? `radial-gradient(circle, ${colorPreview.accentColor}22 0%, ${bgColor}ff 70%)`
                : `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.05) 70%)`,
              zIndex: 1
            }} />

            {/* 显示域名和URL */}
            <div style={{
              padding: '1rem',
              textAlign: 'center',
              wordBreak: 'break-word',
              maxHeight: '100%',
              overflow: 'hidden',
              width: '100%',
              zIndex: 2, // 降低z-index，确保不会覆盖上传按钮
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                {domain}
              </div>
              {colorPreview.domain && colorPreview.domain !== bookmark.title && (
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {bookmark.title}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 书签内容区域 */}
      <div className={`bookmark-content ${isMobile ? 'p-1.5' : 'p-2'}`} style={{ marginTop: '-1px' }}>
        <div className="flex justify-between items-start mb-1">
          {editingTitle ? (
            <div className="flex items-center space-x-1" style={{ maxWidth: "75%" }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold w-full border border-blue-300 rounded px-1`}
                autoFocus
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              />
              <button
                onClick={saveTitle}
                className="text-green-500 hover:text-green-700"
                title="保存"
              >
                <FaCheck size={isMobile ? 10 : 12} />
              </button>
              <button
                onClick={() => {
                  setTitle(bookmark.title);
                  setEditingTitle(false);
                }}
                className="text-red-500 hover:text-red-700"
                title="取消"
              >
                <FaTimes size={isMobile ? 10 : 12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1" style={{ maxWidth: "75%" }}>
              <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold truncate`}>
                {bookmark.title}
              </h3>
              <button
                className="text-gray-400 hover:text-blue-500 hover:opacity-100"
                onClick={() => setEditingTitle(true)}
                title="编辑标题"
              >
                <FaEdit size={isMobile ? 10 : 12} />
              </button>
            </div>
          )}

          <div className="flex space-x-1">
            {/* 移动到文件夹按钮 */}
            <button
              className="text-gray-400 hover:text-blue-500 text-sm hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                openMoveToFolderModal(bookmark);
              }}
              title="移动到其他文件夹"
            >
              <FaExchangeAlt size={isMobile ? 12 : 14} />
            </button>

            {/* 删除按钮 */}
            <button
              className="text-gray-400 hover:text-red-500 text-sm hover:opacity-100"
              onClick={handleOpenDeleteModal}
              title="删除书签"
            >
              <FaTrash size={isMobile ? 12 : 14} />
            </button>
          </div>
        </div>

        {/* URL链接 */}
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-600 ${isMobile ? 'text-[10px]' : 'text-xs'} mb-1 flex items-center hover:text-primary-500`}
        >
          {bookmark.url.length > (isMobile ? 20 : 30) ? bookmark.url.substring(0, isMobile ? 20 : 30) + '...' : bookmark.url}
          <FaCloudUploadAlt className="ml-1 text-blue-500" style={{ fontSize: isMobile ? '12px' : '16px' }} />
        </a>

        {/* 收藏原因 */}
        {editingReason ? (
          <div className="mb-1">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${isMobile ? 'text-[10px]' : 'text-xs'} w-full border border-blue-300 rounded p-1`}
              rows={isMobile ? "3" : "4"}
              autoFocus
              onBlur={saveReason}
              onPaste={!isMobile ? handleImagePaste : undefined} // 只在PC端添加粘贴事件处理
            />
            <div className="flex justify-end space-x-1 mt-1">
              <button
                onClick={saveReason}
                className="text-green-500 hover:text-green-700 text-xs"
                title="保存"
              >
                <FaCheck size={isMobile ? 10 : 12} />
              </button>
              <button
                onClick={() => {
                  setReason(bookmark.reason || bookmark.description || '');
                  setEditingReason(false);
                }}
                className="text-red-500 hover:text-red-700 text-xs"
                title="取消"
              >
                <FaTimes size={isMobile ? 10 : 12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-1">
            {(bookmark.reason || bookmark.description) ? (
              <div className="flex items-start">
                <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-700 whitespace-pre-wrap break-words ${isMobile ? 'max-h-16' : 'max-h-24'} overflow-y-auto`}>
                  {bookmark.reason || bookmark.description}
                </p>
                <button
                  className="text-gray-400 hover:text-blue-500 hover:opacity-100 flex-shrink-0 ml-1"
                  onClick={() => setEditingReason(true)}
                  title="编辑收藏原因"
                >
                  <FaEdit size={isMobile ? 10 : 12} />
                </button>
              </div>
            ) : (
              <button
                className={`text-gray-400 hover:text-blue-500 ${isMobile ? 'text-[10px]' : 'text-xs'} hover:opacity-100 flex items-center`}
                onClick={() => setEditingReason(true)}
              >
                添加收藏原因 <FaEdit size={isMobile ? 10 : 12} className="ml-1" />
              </button>
            )}
          </div>
        )}

        {/* 底部信息栏 */}
        <div className="flex flex-wrap items-center justify-between">
          <div className={`flex items-center ${isMobile ? 'text-[8px]' : 'text-xs'} text-gray-500`}>
            <FaClock className="mr-0.5" style={{ fontSize: isMobile ? "0.5rem" : "0.6rem" }} />
            <span style={{ fontSize: isMobile ? "0.5rem" : "0.6rem" }}>{formatDate(bookmark.createdAt)}</span>
          </div>

          <div className={`${isMobile ? 'text-[8px]' : 'text-xs'} text-gray-500`}>
            <Link
              to={`/folder/${bookmark.folder}`}
              className="text-primary-500"
              style={{ fontSize: isMobile ? "0.5rem" : "0.6rem" }}
            >
              {bookmark.folder}
            </Link>
          </div>
        </div>

        {/* 标签 */}
        {bookmark.tags && bookmark.tags.length > 0 ? (
          <div className="bookmark-tags mt-1">
            <div className="flex flex-wrap items-center">
              {bookmark.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/tag/${tag}`}
                  className={`tag ${isMobile ? 'text-[8px]' : 'text-xs'} py-0 px-1 mr-1 mb-1`}
                >
                  {tag}
                </Link>
              ))}
              <button
                className="text-gray-400 hover:text-blue-500 hover:opacity-100 inline-flex mb-1"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openEditTagsModal(bookmark);
                }}
                title="编辑标签"
              >
                <FaEdit size={isMobile ? 10 : 12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <button
              className={`text-gray-400 hover:text-blue-500 ${isMobile ? 'text-[10px]' : 'text-xs'} hover:opacity-100 flex items-center`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                openEditTagsModal(bookmark);
              }}
            >
              添加标签 <FaEdit size={isMobile ? 10 : 12} className="ml-1" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

// 使用memo包装组件，避免不必要的重新渲染
export default memo(BookmarkCard);
