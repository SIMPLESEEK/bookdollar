import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import Spinner from '../layout/Spinner';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useUser();
  const location = useLocation();

  // 如果正在加载，显示加载指示器
  if (loading) {
    return <Spinner />;
  }

  // 如果未认证，重定向到登录页，并传递当前URL作为重定向目标
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} />;
  }

  // 用户已认证，渲染子组件
  return children;
};

export default PrivateRoute;
