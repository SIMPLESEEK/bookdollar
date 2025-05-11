import React, { createContext, useReducer, useContext } from 'react';
import axios from 'axios';

// 初始状态
const initialState = {
  bookmarks: [],
  loading: true,
  error: null,
  currentBookmark: null
};

// 创建上下文
const BookmarkContext = createContext(initialState);

// Reducer函数
const bookmarkReducer = (state, action) => {
  switch (action.type) {
    case 'GET_BOOKMARKS':
      return {
        ...state,
        bookmarks: action.payload,
        loading: false
      };
    case 'GET_BOOKMARK':
      return {
        ...state,
        currentBookmark: action.payload,
        loading: false
      };
    case 'ADD_BOOKMARK':
      return {
        ...state,
        bookmarks: [action.payload, ...state.bookmarks]
      };
    case 'UPDATE_BOOKMARK':
      return {
        ...state,
        bookmarks: state.bookmarks.map(bookmark =>
          bookmark._id === action.payload._id ? action.payload : bookmark
        )
      };
    case 'DELETE_BOOKMARK':
      return {
        ...state,
        bookmarks: state.bookmarks.filter(bookmark => bookmark._id !== action.payload)
      };
    case 'BOOKMARK_ERROR':
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
export const BookmarkProvider = ({ children }) => {
  const [state, dispatch] = useReducer(bookmarkReducer, initialState);

  // 缓存书签数据和上次请求时间
  const bookmarkCache = {
    all: { data: null, timestamp: 0, loading: false, pendingPromise: null },
    byFolder: {}, // 按文件夹缓存
    byTag: {}, // 按标签缓存
    byTags: {}, // 按多标签缓存
    search: {} // 按搜索词缓存
  };

  // 获取所有书签 - 带缓存功能
  const getBookmarks = async (forceRefresh = false) => {
    const now = Date.now();
    const cacheLifetime = 10000; // 缓存有效期10秒
    const cache = bookmarkCache.all;

    // 如果缓存有效且不强制刷新，直接使用缓存数据
    if (
      !forceRefresh &&
      cache.data &&
      now - cache.timestamp < cacheLifetime
    ) {
      console.log('BookmarkContext: 使用缓存的书签数据');

      // 如果当前状态不是缓存数据，则更新状态
      if (JSON.stringify(state.bookmarks) !== JSON.stringify(cache.data)) {
        dispatch({
          type: 'GET_BOOKMARKS',
          payload: cache.data
        });
      }

      return cache.data;
    }

    // 如果已经有一个正在进行的请求，返回该请求的Promise
    if (cache.loading && cache.pendingPromise) {
      console.log('BookmarkContext: 已有正在进行的书签请求，等待结果');
      return cache.pendingPromise;
    }

    // 标记为正在加载
    cache.loading = true;
    dispatch({ type: 'SET_LOADING' });

    // 创建新的Promise
    cache.pendingPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('BookmarkContext: 发起新的书签请求');

        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await axios.get('/api/bookmarks', {
          signal: controller.signal,
          timeout: 15000
        });

        clearTimeout(timeoutId);

        // 更新缓存
        cache.data = res.data;
        cache.timestamp = Date.now();

        // 更新状态
        dispatch({
          type: 'GET_BOOKMARKS',
          payload: res.data
        });

        resolve(res.data);
      } catch (err) {
        console.error('BookmarkContext: 获取书签失败', err);

        // 如果有缓存数据，在出错时使用缓存数据
        if (cache.data) {
          console.log('BookmarkContext: 请求失败，使用缓存数据');
          dispatch({
            type: 'GET_BOOKMARKS',
            payload: cache.data
          });
          resolve(cache.data);
        } else {
          dispatch({
            type: 'BOOKMARK_ERROR',
            payload: err.name === 'AbortError'
              ? '获取书签超时'
              : (err.response?.data?.message || '获取书签失败')
          });
          reject(err);
        }
      } finally {
        // 重置加载状态
        cache.loading = false;
        cache.pendingPromise = null;
      }
    });

    return cache.pendingPromise;
  };

  // 按文件夹获取书签 - 带缓存功能
  const getBookmarksByFolder = async (folder, forceRefresh = false) => {
    const now = Date.now();
    const cacheLifetime = 10000; // 缓存有效期10秒

    // 确保文件夹缓存对象存在
    if (!bookmarkCache.byFolder[folder]) {
      bookmarkCache.byFolder[folder] = {
        data: null,
        timestamp: 0,
        loading: false,
        pendingPromise: null
      };
    }

    const cache = bookmarkCache.byFolder[folder];

    // 如果缓存有效且不强制刷新，直接使用缓存数据
    if (
      !forceRefresh &&
      cache.data &&
      now - cache.timestamp < cacheLifetime
    ) {
      console.log(`BookmarkContext: 使用缓存的文件夹[${folder}]书签数据`);

      // 如果当前状态不是缓存数据，则更新状态
      if (JSON.stringify(state.bookmarks) !== JSON.stringify(cache.data)) {
        dispatch({
          type: 'GET_BOOKMARKS',
          payload: cache.data
        });
      }

      return cache.data;
    }

    // 如果已经有一个正在进行的请求，返回该请求的Promise
    if (cache.loading && cache.pendingPromise) {
      console.log(`BookmarkContext: 已有正在进行的文件夹[${folder}]书签请求，等待结果`);
      return cache.pendingPromise;
    }

    // 标记为正在加载
    cache.loading = true;
    dispatch({ type: 'SET_LOADING' });

    // 创建新的Promise
    cache.pendingPromise = new Promise(async (resolve, reject) => {
      try {
        console.log(`BookmarkContext: 发起新的文件夹[${folder}]书签请求`);

        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await axios.get(`/api/bookmarks/folder/${folder}`, {
          signal: controller.signal,
          timeout: 15000
        });

        clearTimeout(timeoutId);

        // 更新缓存
        cache.data = res.data;
        cache.timestamp = Date.now();

        // 更新状态
        dispatch({
          type: 'GET_BOOKMARKS',
          payload: res.data
        });

        resolve(res.data);
      } catch (err) {
        console.error(`BookmarkContext: 获取文件夹[${folder}]书签失败`, err);

        // 如果有缓存数据，在出错时使用缓存数据
        if (cache.data) {
          console.log(`BookmarkContext: 请求失败，使用缓存的文件夹[${folder}]书签数据`);
          dispatch({
            type: 'GET_BOOKMARKS',
            payload: cache.data
          });
          resolve(cache.data);
        } else {
          dispatch({
            type: 'BOOKMARK_ERROR',
            payload: err.name === 'AbortError'
              ? '获取书签超时'
              : (err.response?.data?.message || '获取书签失败')
          });
          reject(err);
        }
      } finally {
        // 重置加载状态
        cache.loading = false;
        cache.pendingPromise = null;
      }
    });

    return cache.pendingPromise;
  };

  // 按单个标签获取书签
  const getBookmarksByTag = async (tag) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const res = await axios.get(`/api/bookmarks/tag/${tag}`);
      dispatch({
        type: 'GET_BOOKMARKS',
        payload: res.data
      });
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '获取书签失败'
      });
    }
  };

  // 按多个标签获取书签
  const getBookmarksByTags = async (tags) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const res = await axios.post('/api/bookmarks/tags', { tags });
      dispatch({
        type: 'GET_BOOKMARKS',
        payload: res.data
      });
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '获取书签失败'
      });
    }
  };

  // 搜索书签
  const searchBookmarks = async (query) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const res = await axios.get(`/api/bookmarks/search/${query}`);
      dispatch({
        type: 'GET_BOOKMARKS',
        payload: res.data
      });
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '搜索书签失败'
      });
    }
  };

  // 获取单个书签
  const getBookmark = async (id) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const res = await axios.get(`/api/bookmarks/${id}`);
      dispatch({
        type: 'GET_BOOKMARK',
        payload: res.data
      });
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '获取书签失败'
      });
    }
  };

  // 添加书签
  const addBookmark = async (bookmark) => {
    try {
      const res = await axios.post('/api/bookmarks', bookmark);
      dispatch({
        type: 'ADD_BOOKMARK',
        payload: res.data
      });
      return res.data;
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '添加书签失败'
      });
      throw err;
    }
  };

  // 更新书签
  const updateBookmark = async (id, bookmark, customConfig = {}) => {
    console.log('BookmarkContext: 开始更新书签', id, bookmark);
    try {
      // 确保标签是数组
      if (bookmark.tags !== undefined) {
        if (!Array.isArray(bookmark.tags)) {
          console.warn('BookmarkContext: 标签不是数组，正在转换', bookmark.tags);
          bookmark.tags = bookmark.tags ? [bookmark.tags] : [];
        }
        // 确保所有标签都是字符串
        bookmark.tags = bookmark.tags.map(tag => String(tag).trim()).filter(tag => tag);
        console.log('BookmarkContext: 处理后的标签', bookmark.tags);
      }

      // 确保文件夹名称是字符串
      if (bookmark.folder !== undefined) {
        bookmark.folder = String(bookmark.folder).trim();
        console.log('BookmarkContext: 处理后的文件夹名称', bookmark.folder);
      }

      // 设置默认配置
      const defaultConfig = {
        timeout: 15000 // 15秒超时
      };

      // 合并自定义配置和默认配置
      const config = {
        ...defaultConfig,
        ...customConfig
      };

      console.log('BookmarkContext: 发送请求', `/api/bookmarks/${id}`, bookmark, '配置:', config);

      // 添加重试逻辑
      let retryCount = 0;
      const maxRetries = 1; // 最多重试1次

      while (true) {
        try {
          const res = await axios.put(`/api/bookmarks/${id}`, bookmark, config);
          console.log('BookmarkContext: 更新成功', res.data);

          // 确保返回的数据中标签是数组
          if (res.data.tags && !Array.isArray(res.data.tags)) {
            console.warn('BookmarkContext: 服务器返回的标签不是数组，正在修复', res.data.tags);
            res.data.tags = res.data.tags ? [res.data.tags] : [];
          }

          dispatch({
            type: 'UPDATE_BOOKMARK',
            payload: res.data
          });
          return res.data;
        } catch (requestError) {
          // 如果是网络错误且还有重试机会，则重试
          if (
            (requestError.code === 'ECONNABORTED' || !requestError.response) &&
            retryCount < maxRetries
          ) {
            console.warn(`BookmarkContext: 请求失败，正在重试 (${retryCount + 1}/${maxRetries})...`);
            retryCount++;
            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // 如果不是网络错误或已达到最大重试次数，则抛出错误
          throw requestError;
        }
      }
    } catch (err) {
      console.error('BookmarkContext: 更新失败', err);

      // 详细记录错误信息
      if (err.name === 'AbortError') {
        console.error('请求被中止:', {
          message: '请求超时或被用户取消'
        });
      } else if (err.response) {
        // 服务器返回了错误响应
        console.error('服务器响应错误:', {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data
        });
      } else if (err.request) {
        // 请求已发送但没有收到响应
        console.error('网络请求错误:', {
          request: err.request,
          message: '请求已发送但没有收到响应'
        });
      } else {
        // 请求设置时出错
        console.error('请求设置错误:', {
          message: err.message
        });
      }

      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '更新书签失败'
      });
      throw err;
    }
  };

  // 删除书签
  const deleteBookmark = async (id) => {
    try {
      await axios.delete(`/api/bookmarks/${id}`);
      dispatch({
        type: 'DELETE_BOOKMARK',
        payload: id
      });
    } catch (err) {
      dispatch({
        type: 'BOOKMARK_ERROR',
        payload: err.response?.data?.message || '删除书签失败'
      });
      throw err;
    }
  };



  return (
    <BookmarkContext.Provider
      value={{
        bookmarks: state.bookmarks,
        currentBookmark: state.currentBookmark,
        loading: state.loading,
        error: state.error,
        getBookmarks,
        getBookmarksByFolder,
        getBookmarksByTag,
        getBookmarksByTags,
        searchBookmarks,
        getBookmark,
        addBookmark,
        updateBookmark,
        deleteBookmark
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

// 自定义Hook
export const useBookmarks = () => useContext(BookmarkContext);
