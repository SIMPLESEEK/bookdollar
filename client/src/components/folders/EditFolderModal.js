import React, { useState, useEffect } from 'react';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import { useFolders } from '../../context/FolderContext';

const EditFolderModal = ({ folder, onClose }) => {
  const { updateFolder, folders } = useFolders();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: folder.name,
    parent: folder.parent || ''
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
    
    // 检查文件夹名称是否已存在（排除当前文件夹）
    const folderExists = folders.some(f => 
      f.name.toLowerCase() === formData.name.toLowerCase() && f._id !== folder._id
    );
    
    if (folderExists) {
      setError('文件夹名称已存在');
      return;
    }
    
    // 检查是否选择了自己作为父文件夹
    if (formData.parent === folder.name) {
      setError('不能选择自己作为父文件夹');
      return;
    }
    
    // 检查是否选择了自己的子文件夹作为父文件夹（防止循环引用）
    const isChildFolder = (parentName, childName) => {
      const childFolder = folders.find(f => f.name === childName);
      if (!childFolder) return false;
      
      const children = folders.filter(f => f.parent === childName);
      if (children.some(child => child.name === parentName)) return true;
      
      return children.some(child => isChildFolder(parentName, child.name));
    };
    
    if (formData.parent && isChildFolder(folder.name, formData.parent)) {
      setError('不能选择子文件夹作为父文件夹');
      return;
    }
    
    try {
      setLoading(true);
      await updateFolder(folder._id, {
        name: formData.name,
        parent: formData.parent || null
      });
      setLoading(false);
      onClose();
    } catch (error) {
      setError('更新文件夹失败');
      setLoading(false);
    }
  };

  // 过滤掉当前文件夹及其子文件夹，防止循环引用
  const getAvailableParentFolders = () => {
    // 找出所有子文件夹
    const findAllChildren = (folderName) => {
      const directChildren = folders.filter(f => f.parent === folderName).map(f => f.name);
      let allChildren = [...directChildren];
      
      directChildren.forEach(child => {
        allChildren = [...allChildren, ...findAllChildren(child)];
      });
      
      return allChildren;
    };
    
    const childFolders = findAllChildren(folder.name);
    
    // 返回可用的父文件夹（排除自己和所有子文件夹）
    return folders.filter(f => 
      f._id !== folder._id && !childFolders.includes(f.name)
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">编辑文件夹</h2>
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
              {getAvailableParentFolders().map(f => (
                <option key={f._id} value={f.name}>
                  {f.name}
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
                  保存中...
                </>
              ) : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFolderModal;
