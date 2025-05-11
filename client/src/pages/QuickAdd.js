import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBookmark, FaSpinner } from 'react-icons/fa';
import { useBookmarks } from '../context/BookmarkContext';
import { useFolders } from '../context/FolderContext';
import { useUser } from '../context/UserContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

const QuickAdd = () => {
  const { addBookmark } = useBookmarks();
  const { folders, getFolders } = useFolders();
  const { isAuthenticated, user } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // 检测是否为移动设备
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [formData, setFormData] = useState({
    title: '',
    url: '',
    reason: '',
    tags: '',
    folder: '未分类'
  });

  // 从URL参数获取数据
  useEffect(() => {
    if (!isAuthenticated) {
      // 如果未登录，重定向到登录页面并保存当前URL
      const currentPath = window.location.pathname + window.location.search;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // 获取文件夹列表
    getFolders();

    // 解析URL参数
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || '';
    const url = params.get('url') || '';
    const reason = params.get('reason') || '';
    const tags = params.get('tags') || '';

    setFormData({
      ...formData,
      title,
      url,
      reason,
      tags
    });
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // 清除成功和错误消息
    setSuccess(false);
    setError('');
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
      setSuccess(true);

      // 如果是从书签小工具打开的，可以自动关闭窗口
      if (window.opener) {
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } catch (error) {
      setError('添加书签失败');
      setLoading(false);
    }
  };

  // 如果未登录，显示加载中
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <FaSpinner className="animate-spin text-4xl text-primary-500" />
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'p-3' : 'p-6'} max-w-md mx-auto`}>
      <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold ${isMobile ? 'mb-3' : 'mb-6'} flex items-center justify-center`}>
        <FaBookmark className="mr-2" /> 快速添加书签
      </h1>

      <div className={`bg-white rounded-lg shadow-md ${isMobile ? 'p-3' : 'p-6'}`}>
        {success && (
          <div className={`bg-green-100 text-green-700 ${isMobile ? 'p-2 text-sm' : 'p-3'} rounded ${isMobile ? 'mb-2' : 'mb-4'}`}>
            书签添加成功！
            {window.opener && <div className={`${isMobile ? 'text-xs' : 'text-sm'} mt-1`}>窗口将自动关闭...</div>}
          </div>
        )}

        {error && (
          <div className={`bg-red-100 text-red-700 ${isMobile ? 'p-2 text-sm' : 'p-3'} rounded ${isMobile ? 'mb-2' : 'mb-4'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={`${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block text-gray-700 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>URL *</label>
            <input
              type="url"
              name="url"
              className={`w-full ${isMobile ? 'p-1.5 text-sm' : 'p-2'} border rounded border-gray-300`}
              value={formData.url}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block text-gray-700 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>标题 *</label>
            <input
              type="text"
              name="title"
              className={`w-full ${isMobile ? 'p-1.5 text-sm' : 'p-2'} border rounded border-gray-300`}
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block text-gray-700 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>收藏原因</label>
            <textarea
              name="reason"
              className={`w-full ${isMobile ? 'p-1.5 text-sm' : 'p-2'} border rounded border-gray-300`}
              value={formData.reason}
              onChange={handleChange}
              rows={isMobile ? "2" : "3"}
              placeholder="为什么要收藏这个页面？描述一下这个页面的内容或您的想法。"
              style={{ minHeight: isMobile ? "60px" : "80px" }}
            />
          </div>

          <div className={`${isMobile ? 'mb-2' : 'mb-4'}`}>
            <label className={`block text-gray-700 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>标签 (用逗号分隔)</label>
            <input
              type="text"
              name="tags"
              className={`w-full ${isMobile ? 'p-1.5 text-sm' : 'p-2'} border rounded border-gray-300`}
              value={formData.tags}
              onChange={handleChange}
              placeholder="例如: 技术, 学习, 参考"
            />
          </div>

          <div className={`${isMobile ? 'mb-3' : 'mb-6'}`}>
            <label className={`block text-gray-700 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>文件夹</label>
            <select
              name="folder"
              className={`w-full ${isMobile ? 'p-1.5 text-sm' : 'p-2'} border rounded border-gray-300`}
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

          <button
            type="submit"
            className={`w-full bg-primary-600 text-white ${isMobile ? 'py-1.5 text-sm' : 'py-2'} px-4 rounded hover:bg-primary-700 transition duration-200`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" /> 保存中...
              </span>
            ) : '保存书签'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuickAdd;
