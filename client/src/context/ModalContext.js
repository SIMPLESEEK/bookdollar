import React, { createContext, useContext, useState, useCallback } from 'react';
import DeleteConfirmModal from '../components/bookmarks/DeleteConfirmModal';
import EditTagsModal from '../components/bookmarks/EditTagsModal';
import MoveToFolderModal from '../components/bookmarks/MoveToFolderModal';

// 创建模态框上下文
const ModalContext = createContext();

// 模态框提供者组件
export const ModalProvider = ({ children }) => {
  // 编辑书签模态框状态
  const [editModalState, setEditModalState] = useState({
    isOpen: false,
    bookmark: null
  });

  // 删除确认模态框状态
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: ''
  });

  // 标签编辑模态框状态
  const [editTagsModalState, setEditTagsModalState] = useState({
    isOpen: false,
    bookmark: null
  });

  // 移动到文件夹模态框状态
  const [moveToFolderModalState, setMoveToFolderModalState] = useState({
    isOpen: false,
    bookmark: null
  });

  // 打开编辑书签模态框
  const openEditModal = useCallback((bookmark) => {
    console.log('ModalContext: 打开编辑模态框', bookmark);
    setEditModalState({
      isOpen: true,
      bookmark
    });
  }, []);

  // 关闭编辑书签模态框
  const closeEditModal = useCallback(() => {
    setEditModalState({
      isOpen: false,
      bookmark: null
    });
  }, []);

  // 打开删除确认模态框
  const openDeleteModal = useCallback((title, message, onConfirm) => {
    setDeleteModalState({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }, []);

  // 关闭删除确认模态框
  const closeDeleteModal = useCallback(() => {
    setDeleteModalState({
      isOpen: false,
      onConfirm: null,
      title: '',
      message: ''
    });
  }, []);

  // 打开标签编辑模态框
  const openEditTagsModal = useCallback((bookmark) => {
    setEditTagsModalState({
      isOpen: true,
      bookmark
    });
  }, []);

  // 关闭标签编辑模态框
  const closeEditTagsModal = useCallback(() => {
    setEditTagsModalState({
      isOpen: false,
      bookmark: null
    });
  }, []);

  // 打开移动到文件夹模态框
  const openMoveToFolderModal = useCallback((bookmark) => {
    setMoveToFolderModalState({
      isOpen: true,
      bookmark
    });
  }, []);

  // 关闭移动到文件夹模态框
  const closeMoveToFolderModal = useCallback(() => {
    setMoveToFolderModalState({
      isOpen: false,
      bookmark: null
    });
  }, []);

  // 提供上下文值
  const contextValue = {
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    openEditTagsModal,
    closeEditTagsModal,
    openMoveToFolderModal,
    closeMoveToFolderModal
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      {/* 编辑书签模态框 - 暂时禁用 */}
      {/* 等待新的编辑组件实现 */}

      {/* 删除确认模态框 - 渲染在应用的最外层 */}
      {deleteModalState.isOpen && (
        <DeleteConfirmModal
          title={deleteModalState.title}
          message={deleteModalState.message}
          onConfirm={() => {
            if (deleteModalState.onConfirm) {
              deleteModalState.onConfirm();
            }
            closeDeleteModal();
          }}
          onCancel={closeDeleteModal}
        />
      )}

      {/* 标签编辑模态框 */}
      {editTagsModalState.isOpen && editTagsModalState.bookmark && (
        <EditTagsModal
          bookmark={editTagsModalState.bookmark}
          onClose={closeEditTagsModal}
        />
      )}

      {/* 移动到文件夹模态框 */}
      {moveToFolderModalState.isOpen && moveToFolderModalState.bookmark && (
        <MoveToFolderModal
          bookmark={moveToFolderModalState.bookmark}
          onClose={closeMoveToFolderModal}
        />
      )}
    </ModalContext.Provider>
  );
};

// 自定义钩子，用于在组件中访问模态框上下文
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
