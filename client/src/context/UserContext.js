import React, { createContext, useReducer, useContext, useEffect, useState } from 'react';
import axios from 'axios';

// 初始状态
const initialState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false
};

// 创建上下文
const UserContext = createContext(initialState);

// Reducer函数 - 简化版本，避免不必要的日志记录和对象创建
const userReducer = (state, action) => {
  switch (action.type) {
    case 'USER_LOADING':
      return {
        ...state,
        loading: true
      };

    case 'USER_LOADED':
      return {
        ...state,
        user: action.payload,
        loading: false,
        isAuthenticated: true,
        error: null
      };

    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        user: action.payload,
        loading: false,
        isAuthenticated: true,
        error: null
      };

    case 'AUTH_ERROR':
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        loading: false,
        isAuthenticated: false,
        error: action.payload
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// Provider组件
export const UserProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);

  // 检查用户是否已登录 - 改进版本，确保在页面刷新时能够正确恢复用户状态
  useEffect(() => {
    // 使用标志变量避免重复加载
    let isMounted = true;

    const loadUser = async () => {
      // 不再在这里设置 USER_LOADING 状态，避免影响登录页面
      // dispatch({ type: 'USER_LOADING' });

      try {
        // 检查本地存储中是否有令牌
        const token = localStorage.getItem('token');

        // 如果没有令牌，则标记初始化完成并返回
        if (!token) {
          if (isMounted) {
            setIsInitialized(true);
          }
          return;
        }

        // 设置请求头
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // 发送请求前检查组件是否仍然挂载
        if (!isMounted) return;

        // 发送请求获取用户信息
        const res = await axios.get('/api/users/profile');

        // 再次检查组件是否仍然挂载
        if (!isMounted) return;

        // 更新状态
        dispatch({
          type: 'USER_LOADED',
          payload: { ...res.data, token }
        });
      } catch (err) {
        // 只有在组件仍然挂载时才处理错误
        if (isMounted) {
          console.error('加载用户信息失败:', err.response?.data?.message || err.message);

          // 移除无效令牌
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];

          dispatch({
            type: 'AUTH_ERROR',
            payload: '会话已过期，请重新登录'
          });
        }
      } finally {
        // 标记初始化完成
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    // 执行加载用户的函数
    loadUser();

    // 清理函数
    return () => {
      isMounted = false;
    };
  }, []);

  // 注册用户
  const register = async (userData) => {
    try {
      dispatch({ type: 'USER_LOADING' });

      const res = await axios.post('/api/users/register', userData);

      dispatch({
        type: 'REGISTER_SUCCESS',
        payload: res.data
      });

      // 设置请求头
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    } catch (err) {
      dispatch({
        type: 'REGISTER_FAIL',
        payload: err.response?.data?.message || '注册失败'
      });
      throw err;
    }
  };

  // 登录用户 - 改进版本，确保在登录成功后正确设置token
  const login = async (userData) => {
    // 使用闭包保存当前的状态，避免竞态条件
    let isCancelled = false;

    try {
      // 验证输入
      const { email, password } = userData;

      if (!email || !password) {
        throw new Error('请提供邮箱和密码');
      }

      // 登录时不再设置全局加载状态，由组件自己管理加载状态
      // dispatch({ type: 'USER_LOADING' });

      // 发送登录请求
      const res = await axios.post('/api/users/login', userData);

      // 检查是否已取消
      if (isCancelled) {
        return null;
      }

      // 保存令牌到本地存储
      try {
        localStorage.setItem('token', res.data.token);
        console.log('Token已保存到localStorage:', res.data.token);
      } catch (storageErr) {
        console.error('无法保存令牌到本地存储:', storageErr);
      }

      // 设置请求头
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

      // 更新状态
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: res.data
      });

      return res.data;
    } catch (err) {
      // 检查是否已取消
      if (isCancelled) {
        return null;
      }

      console.error('登录失败:', err.response?.data || err.message);

      // 更新状态
      dispatch({
        type: 'LOGIN_FAIL',
        payload: err.response?.data?.message || '登录失败'
      });

      throw err;
    } finally {
      // 提供一个取消函数，允许在组件卸载时取消操作
      return () => {
        isCancelled = true;
      };
    }
  };

  // 注销用户
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  // 清除错误
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // 在登录和注册页面不显示加载指示器，直接渲染子组件
  // 只有在其他页面才显示加载指示器
  if (!isInitialized && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>;
  }

  return (
    <UserContext.Provider
      value={{
        user: state.user,
        loading: state.loading,
        error: state.error,
        isAuthenticated: state.isAuthenticated,
        isInitialized,
        register,
        login,
        logout,
        clearError
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// 自定义Hook
export const useUser = () => useContext(UserContext);
