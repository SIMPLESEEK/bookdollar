import React, { useState, useEffect } from 'react';
import { FaTimes, FaSpinner, FaFolder, FaFolderOpen } from 'react-icons/fa';
import { useBookmarks } from '../../context/BookmarkContext';
import { useFolders } from '../../context/FolderContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * 移动书签到其他文件夹的模态框组件
 */
const MoveToFolderModal = ({ bookmark, onClose }) => {
  const { updateBookmark } = useBookmarks();
  const { folders, getFolders } = useFolders();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(bookmark.folder || '未分类');
  const [expandedFolders, setExpandedFolders] = useState({});

  // 检测是否为移动设备
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 加载文件夹列表 - 只在组件挂载时加载一次
  useEffect(() => {
    // 使用false参数表示不强制刷新，优先使用缓存
    getFolders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换文件夹展开/折叠状态
  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // 将文件夹组织成层级结构
  const organizeIntoHierarchy = () => {
    const folderMap = {};
    const rootFolders = [];

    // 首先创建所有文件夹的映射
    folders.forEach(folder => {
      folderMap[folder.name] = {
        ...folder,
        children: []
      };
    });

    // 然后构建层级关系
    folders.forEach(folder => {
      if (folder.parent && folderMap[folder.parent]) {
        folderMap[folder.parent].children.push(folderMap[folder.name]);
      } else {
        rootFolders.push(folderMap[folder.name]);
      }
    });

    return rootFolders;
  };

  // 渲染文件夹树
  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map(folder => {
      const hasChildren = folder.children && folder.children.length > 0;
      const isExpanded = expandedFolders[folder.name];
      const isSelected = selectedFolder === folder.name;

      return (
        <li key={folder._id} className="mb-1">
          <div className="flex items-center">
            {/* 缩进 */}
            {level > 0 && (
              <div style={{ width: `${level * 16}px` }} className="flex-shrink-0"></div>
            )}

            {/* 展开/折叠图标 - 只有当有子文件夹时才显示 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.name);
              }}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-primary-500"
            >
              {hasChildren ? (
                isExpanded ? <FaFolderOpen size={12} /> : <FaFolder size={12} />
              ) : (
                <div className="w-3 h-3"></div> // 占位符，保持对齐
              )}
            </button>

            {/* 文件夹选择按钮 */}
            <button
              onClick={() => setSelectedFolder(folder.name)}
              className={`flex items-center p-2 rounded flex-grow ${
                isSelected ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
              }`}
            >
              {folder.name}
            </button>
          </div>

          {/* 子文件夹 */}
          {hasChildren && isExpanded && (
            <ul className="list-none mt-1">
              {renderFolderTree(folder.children, level + 1)}
            </ul>
          )}
        </li>
      );
    });
  };

  // 保存更改
  const saveChanges = async () => {
    if (selectedFolder === bookmark.folder) {
      onClose();
      return;
    }

    // 最大重试次数
    const maxRetries = 2;
    let retryCount = 0;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        setLoading(true);
        setError(''); // 清除之前的错误

        if (retryCount > 0) {
          console.log(`尝试第 ${retryCount} 次重试移动书签...`);
        }

        console.log('开始移动书签:', {
          bookmarkId: bookmark._id,
          currentFolder: bookmark.folder,
          targetFolder: selectedFolder,
          retryAttempt: retryCount
        });

        // 创建一个可以取消的请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        try {
          // 使用自定义配置调用updateBookmark
          const updatedBookmark = await updateBookmark(
            bookmark._id,
            { folder: selectedFolder },
            { signal: controller.signal }
          );

          // 清除超时
          clearTimeout(timeoutId);

          console.log('书签移动成功:', updatedBookmark);
          success = true;
          setLoading(false);
          onClose();
          return;
        } catch (abortError) {
          // 清除超时
          clearTimeout(timeoutId);

          // 重新抛出错误以便外层catch处理
          throw abortError;
        }
      } catch (error) {
        console.error(`移动书签失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);

        // 提供更详细的错误信息
        let errorMessage = '移动书签失败';

        if (error.name === 'AbortError') {
          errorMessage += ': 请求超时，服务器响应时间过长';
        } else if (error.response) {
          // 服务器返回了错误响应
          errorMessage += `: ${error.response.data?.message || error.response.statusText || '服务器错误'}`;
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage += ': 网络连接问题，请检查您的网络连接';
        } else {
          // 请求设置时出错
          errorMessage += `: ${error.message || '未知错误'}`;
        }

        // 如果还有重试机会，则继续重试
        if (retryCount < maxRetries) {
          retryCount++;
          // 显示正在重试的消息
          setError(`${errorMessage}，正在重试 (${retryCount}/${maxRetries})...`);
          // 等待一段时间再重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // 已达到最大重试次数，显示最终错误
          setError(errorMessage);
          setLoading(false);
        }
      }
    }

    // 如果所有重试都失败，确保loading状态被重置
    if (!success) {
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
        <div className="flex justify-between items-center mb-4">
          <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>移动书签到其他文件夹</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 border border-red-300 shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">移动失败</h3>
                <div className="mt-1 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            书签标题
          </label>
          <div className="p-2 bg-gray-100 rounded">
            {bookmark.title}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            当前文件夹
          </label>
          <div className="p-2 bg-gray-100 rounded">
            {bookmark.folder || '未分类'}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            选择目标文件夹
          </label>
          <div className="max-h-60 overflow-y-auto border rounded p-2">
            <ul className="list-none p-0">
              {renderFolderTree(organizeIntoHierarchy())}
            </ul>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveChanges}
            disabled={loading || selectedFolder === bookmark.folder}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-1" />
                移动中...
              </>
            ) : '移动书签'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveToFolderModal;
