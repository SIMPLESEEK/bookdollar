import React, { createContext, useReducer, useContext } from 'react';
import axios from 'axios';

// 初始状态
const initialState = {
  folders: [],
  loading: true,
  error: null,
  currentFolder: null
};

// 创建上下文
const FolderContext = createContext(initialState);

// Reducer函数
const folderReducer = (state, action) => {
  switch (action.type) {
    case 'GET_FOLDERS':
      return {
        ...state,
        folders: action.payload,
        loading: false
      };
    case 'GET_FOLDER':
      return {
        ...state,
        currentFolder: action.payload,
        loading: false
      };
    case 'ADD_FOLDER':
      return {
        ...state,
        folders: [...state.folders, action.payload]
      };
    case 'UPDATE_FOLDER':
      return {
        ...state,
        folders: state.folders.map(folder =>
          folder._id === action.payload._id ? action.payload : folder
        )
      };
    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter(folder => folder._id !== action.payload)
      };
    case 'FOLDER_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: true
      };
    default:
      return state;
  }
};

// Provider组件
export const FolderProvider = ({ children }) => {
  const [state, dispatch] = useReducer(folderReducer, initialState);

  // 缓存文件夹数据和上次请求时间
  const folderCache = {
    data: null,
    timestamp: 0,
    loading: false,
    pendingPromise: null
  };

  // 获取所有文件夹 - 带缓存和防抖功能
  const getFolders = async (forceRefresh = false) => {
    const now = Date.now();
    const cacheLifetime = 30000; // 缓存有效期30秒

    // 如果缓存有效且不强制刷新，直接使用缓存数据
    if (
      !forceRefresh &&
      folderCache.data &&
      now - folderCache.timestamp < cacheLifetime
    ) {
      console.log('FolderContext: 使用缓存的文件夹数据');

      // 如果当前状态不是缓存数据，则更新状态
      if (JSON.stringify(state.folders) !== JSON.stringify(folderCache.data)) {
        dispatch({
          type: 'GET_FOLDERS',
          payload: folderCache.data
        });
      }

      return folderCache.data;
    }

    // 如果已经有一个正在进行的请求，返回该请求的Promise
    if (folderCache.loading && folderCache.pendingPromise) {
      console.log('FolderContext: 已有正在进行的文件夹请求，等待结果');
      return folderCache.pendingPromise;
    }

    // 标记为正在加载
    folderCache.loading = true;
    dispatch({ type: 'SET_LOADING' });

    // 创建新的Promise
    folderCache.pendingPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('FolderContext: 发起新的文件夹请求');

        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await axios.get('/api/bookmarks/folders/all', {
          signal: controller.signal,
          timeout: 15000
        });

        clearTimeout(timeoutId);

        // 确保"未分类"文件夹存在
        let hasUncategorized = false;
        const folders = [...res.data];

        // 检查是否已存在"未分类"文件夹
        for (const folder of folders) {
          if (folder.name === '未分类') {
            hasUncategorized = true;
            break;
          }
        }

        // 如果不存在"未分类"文件夹，创建一个虚拟的"未分类"文件夹
        // 注意：这只是前端显示用，不会实际创建到数据库
        if (!hasUncategorized) {
          folders.push({
            _id: 'uncategorized-virtual',
            name: '未分类',
            user: res.data.length > 0 ? res.data[0].user : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        // 更新缓存
        folderCache.data = folders;
        folderCache.timestamp = Date.now();

        // 更新状态
        dispatch({
          type: 'GET_FOLDERS',
          payload: folders
        });

        resolve(folders);
      } catch (err) {
        console.error('FolderContext: 获取文件夹失败', err);

        // 如果有缓存数据，在出错时使用缓存数据
        if (folderCache.data) {
          console.log('FolderContext: 请求失败，使用缓存数据');
          dispatch({
            type: 'GET_FOLDERS',
            payload: folderCache.data
          });
          resolve(folderCache.data);
        } else {
          dispatch({
            type: 'FOLDER_ERROR',
            payload: err.name === 'AbortError'
              ? '获取文件夹超时'
              : (err.response?.data?.message || '获取文件夹失败')
          });
          reject(err);
        }
      } finally {
        // 重置加载状态
        folderCache.loading = false;
        folderCache.pendingPromise = null;
      }
    });

    return folderCache.pendingPromise;
  };

  // 获取单个文件夹
  const getFolder = async (id) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const res = await axios.get(`/api/bookmarks/folders/${id}`);
      dispatch({
        type: 'GET_FOLDER',
        payload: res.data
      });
    } catch (err) {
      dispatch({
        type: 'FOLDER_ERROR',
        payload: err.response?.data?.message || '获取文件夹失败'
      });
    }
  };

  // 添加文件夹
  const addFolder = async (folder) => {
    try {
      const res = await axios.post('/api/bookmarks/folders', folder);
      dispatch({
        type: 'ADD_FOLDER',
        payload: res.data
      });
      return res.data;
    } catch (err) {
      dispatch({
        type: 'FOLDER_ERROR',
        payload: err.response?.data?.message || '添加文件夹失败'
      });
      throw err;
    }
  };

  // 更新文件夹
  const updateFolder = async (id, folder) => {
    try {
      const res = await axios.put(`/api/bookmarks/folders/${id}`, folder);
      dispatch({
        type: 'UPDATE_FOLDER',
        payload: res.data
      });
      return res.data;
    } catch (err) {
      dispatch({
        type: 'FOLDER_ERROR',
        payload: err.response?.data?.message || '更新文件夹失败'
      });
      throw err;
    }
  };

  // 删除文件夹
  const deleteFolder = async (id) => {
    try {
      await axios.delete(`/api/bookmarks/folders/${id}`);
      dispatch({
        type: 'DELETE_FOLDER',
        payload: id
      });
    } catch (err) {
      dispatch({
        type: 'FOLDER_ERROR',
        payload: err.response?.data?.message || '删除文件夹失败'
      });
      throw err;
    }
  };

  return (
    <FolderContext.Provider
      value={{
        folders: state.folders,
        currentFolder: state.currentFolder,
        loading: state.loading,
        error: state.error,
        getFolders,
        getFolder,
        addFolder,
        updateFolder,
        deleteFolder
      }}
    >
      {children}
    </FolderContext.Provider>
  );
};

// 自定义Hook
export const useFolders = () => useContext(FolderContext);
