import React, { useState } from 'react';
import { FaTimes, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { useFolders } from '../../context/FolderContext';
import { useBookmarks } from '../../context/BookmarkContext';

const DeleteFolderModal = ({ folder, onClose }) => {
  const { deleteFolder, folders } = useFolders();
  const { bookmarks } = useBookmarks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 检查是否有书签使用此文件夹
  const bookmarksInFolder = bookmarks.filter(bookmark => bookmark.folder === folder.name);
  
  // 检查是否有子文件夹
  const childFolders = folders.filter(f => f.parent === folder.name);

  const handleDelete = async () => {
    // 如果有书签或子文件夹，不允许删除
    if (bookmarksInFolder.length > 0) {
      setError(`无法删除文件夹，因为它包含 ${bookmarksInFolder.length} 个书签`);
      return;
    }

    if (childFolders.length > 0) {
      setError(`无法删除文件夹，因为它包含 ${childFolders.length} 个子文件夹`);
      return;
    }

    try {
      setLoading(true);
      await deleteFolder(folder._id);
      setLoading(false);
      onClose();
    } catch (error) {
      setError('删除文件夹失败');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">删除文件夹</h2>
          <button 
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>
        
        {error ? (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 flex items-start">
            <FaExclamationTriangle className="mr-2 mt-1 flex-shrink-0" />
            <div>{error}</div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="mb-2">
              确定要删除文件夹 <strong>"{folder.name}"</strong> 吗？
            </p>
            
            {(bookmarksInFolder.length > 0 || childFolders.length > 0) && (
              <div className="bg-yellow-100 text-yellow-800 p-3 rounded mt-2">
                <div className="flex items-start">
                  <FaExclamationTriangle className="mr-2 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">警告：</p>
                    {bookmarksInFolder.length > 0 && (
                      <p>此文件夹包含 {bookmarksInFolder.length} 个书签，删除前需要先移动或删除这些书签。</p>
                    )}
                    {childFolders.length > 0 && (
                      <p>此文件夹包含 {childFolders.length} 个子文件夹，删除前需要先删除这些子文件夹。</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={loading || bookmarksInFolder.length > 0 || childFolders.length > 0}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-1" />
                删除中...
              </>
            ) : '删除文件夹'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteFolderModal;
