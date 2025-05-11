import React from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';

const DeleteConfirmModal = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center text-red-600">
            <FaExclamationTriangle className="mr-2" />
            {title}
          </h2>
          <button 
            className="text-gray-500 hover:text-gray-700"
            onClick={onCancel}
          >
            <FaTimes />
          </button>
        </div>
        
        <p className="mb-6">{message}</p>
        
        <div className="flex justify-end">
          <button
            className="btn bg-gray-200 text-gray-800 mr-2 hover:bg-gray-300"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
