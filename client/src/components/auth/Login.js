import React, { useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSignInAlt, FaSpinner } from 'react-icons/fa';
import { useUser } from '../../context/UserContext';

// 完全重构的登录组件，使用更简单的状态管理
const Login = () => {
  // 使用useRef避免不必要的重新渲染
  const formRef = useRef({
    email: '',
    password: ''
  });

  // 只保留必要的状态
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const { login, error } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // 使用useCallback缓存函数，避免不必要的重新创建
  const getRedirectUrl = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const redirectPath = searchParams.get('redirect');
    return redirectPath ? decodeURIComponent(redirectPath) : '/';
  }, [location.search]);

  // 使用useCallback缓存handleChange函数
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    // 直接更新ref，不触发重新渲染
    formRef.current[name] = value;

    // 只有在有错误时才更新错误状态
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  }, [formErrors]);

  // 使用useCallback缓存validateForm函数
  const validateForm = useCallback(() => {
    const errors = {};
    const { email, password } = formRef.current;

    if (!email) {
      errors.email = '请输入邮箱';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = '请输入有效的邮箱地址';
    }

    if (!password) {
      errors.password = '请输入密码';
    }

    // 只有在有错误时才更新错误状态
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }

    return true;
  }, []);

  // 使用useCallback缓存handleSubmit函数
  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 防止重复提交
    if (isSubmitting || localLoading) {
      return;
    }

    setIsSubmitting(true);
    setLocalLoading(true);

    // 使用非异步方式处理登录，避免状态更新冲突
    login(formRef.current)
      .then(() => {
        // 登录成功后使用requestAnimationFrame延迟导航
        // 这比setTimeout更可靠，因为它会在下一次浏览器绘制前执行
        requestAnimationFrame(() => {
          const redirectUrl = getRedirectUrl();
          console.log('登录成功，重定向到:', redirectUrl);
          navigate(redirectUrl);
        });
      })
      .catch(err => {
        // 静默处理错误
        console.error('登录失败:', err);
        setIsSubmitting(false);
        setLocalLoading(false);
      });
  }, [validateForm, isSubmitting, localLoading, login, navigate, getRedirectUrl]);

  // 使用React.memo包装渲染函数，避免不必要的重新渲染
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center">
          <FaSignInAlt className="mr-2" /> 登录
        </h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              name="email"
              defaultValue=""
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入邮箱"
              disabled={localLoading || isSubmitting}
            />
            {formErrors.email && (
              <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">密码</label>
            <input
              type="password"
              name="password"
              defaultValue=""
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入密码"
              disabled={localLoading || isSubmitting}
            />
            {formErrors.password && (
              <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 px-4 rounded hover:bg-primary-700 transition duration-200"
            disabled={localLoading || isSubmitting}
          >
            {(localLoading || isSubmitting) ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" /> 登录中...
              </span>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p>
            还没有账号？{' '}
            <Link to="/register" className="text-primary-600 hover:underline">
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// 使用React.memo包装组件，避免不必要的重新渲染
export default React.memo(Login);
