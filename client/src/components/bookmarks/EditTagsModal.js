import React, { useState, useEffect } from 'react';
import { FaTimes, FaSpinner, FaPlus, FaTag } from 'react-icons/fa';
import { useBookmarks } from '../../context/BookmarkContext';

/**
 * 标签编辑模态框组件
 * 用于添加、删除书签的标签
 */
const EditTagsModal = ({ bookmark, onClose }) => {
  const { updateBookmark } = useBookmarks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tags, setTags] = useState(bookmark.tags || []);
  const [newTag, setNewTag] = useState('');

  // 添加标签
  const addTag = () => {
    if (!newTag.trim()) return;

    // 处理逗号分隔的多个标签
    const tagList = newTag.split(',').map(tag => tag.trim()).filter(tag => tag);

    // 过滤掉已存在的标签
    const newTags = tagList.filter(tag => !tags.includes(tag));

    // 如果有重复标签，显示警告
    if (newTags.length < tagList.length) {
      setError('已跳过重复的标签');
    } else {
      setError('');
    }

    // 添加新标签
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
      setNewTag('');
    }
  };

  // 删除标签
  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // 保存标签
  const saveChanges = async () => {
    try {
      setLoading(true);

      // 确保标签是一个数组并且每个标签都是字符串
      const tagsArray = Array.isArray(tags)
        ? tags.map(tag => String(tag).trim()).filter(tag => tag)
        : [];

      console.log('准备保存标签:', {
        bookmarkId: bookmark._id,
        tags: tagsArray,
        originalTags: bookmark.tags
      });

      // 只有当标签有变化时才更新
      if (JSON.stringify(tagsArray.sort()) !== JSON.stringify((bookmark.tags || []).sort())) {
        const updatedBookmark = await updateBookmark(bookmark._id, { tags: tagsArray });
        console.log('标签更新成功:', updatedBookmark);
      } else {
        console.log('标签没有变化，跳过更新');
      }

      setLoading(false);
      onClose();
    } catch (error) {
      console.error('更新标签失败:', error);
      setError('更新标签失败: ' + (error.message || '未知错误'));
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
        className="bg-white rounded-lg p-6 w-full max-w-md"
        onClick={handleModalClick}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">编辑标签</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
            {error}
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
            当前标签
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.length > 0 ? (
              tags.map(tag => (
                <div
                  key={tag}
                  className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                >
                  <FaTag className="mr-1 text-xs" />
                  <span>{tag}</span>
                  <button
                    className="ml-1 text-blue-600 hover:text-red-500"
                    onClick={() => removeTag(tag)}
                    title="删除标签"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic">暂无标签</div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            添加新标签
          </label>
          <div className="flex">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              className="form-control flex-grow mr-2"
              placeholder="输入标签名称 (可用逗号分隔多个标签)"
            />
            <button
              className="btn btn-primary flex items-center justify-center min-w-[80px] h-[38px] text-white bg-blue-600 hover:bg-blue-700 rounded"
              onClick={addTag}
              disabled={!newTag.trim()}
              style={{ padding: '0.5rem 1rem' }}
            >
              添加
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            按回车键快速添加标签，可用逗号分隔同时添加多个标签
          </p>
        </div>

        <div className="flex justify-end mt-6">
          <button
            className="btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300 flex items-center justify-center min-w-[80px] h-[38px] rounded"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem' }}
          >
            取消
          </button>
          <button
            className="btn btn-primary flex items-center justify-center min-w-[100px] h-[38px] text-white bg-blue-600 hover:bg-blue-700 rounded"
            onClick={saveChanges}
            disabled={loading}
            style={{ padding: '0.5rem 1rem' }}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-1" />
                保存中...
              </>
            ) : '保存标签'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTagsModal;
