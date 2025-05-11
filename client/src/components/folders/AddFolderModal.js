import React, { useState, useEffect } from 'react';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import { useFolders } from '../../context/FolderContext';

const AddFolderModal = ({ onClose }) => {
  const { addFolder, folders } = useFolders();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    parent: null
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setError('文件夹名称是必填项');
      return;
    }
    
    // 检查文件夹名称是否已存在
    const folderExists = folders.some(folder => 
      folder.name.toLowerCase() === formData.name.toLowerCase()
    );
    
    if (folderExists) {
      setError('文件夹名称已存在');
      return;
    }
    
    try {
      setLoading(true);
      await addFolder(formData);
      setLoading(false);
      onClose();
    } catch (error) {
      setError('添加文件夹失败');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">添加新文件夹</h2>
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
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="block mb-1">文件夹名称 *</label>
            <input
              type="text"
              name="name"
              className="form-control"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="block mb-1">父文件夹 (可选)</label>
            <select
              name="parent"
              className="form-control"
              value={formData.parent || ''}
              onChange={handleChange}
            >
              <option value="">无 (顶级文件夹)</option>
              {folders.map(folder => (
                <option key={folder._id} value={folder.name}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              type="button"
              className="btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-1" />
                  创建中...
                </>
              ) : '创建文件夹'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFolderModal;
