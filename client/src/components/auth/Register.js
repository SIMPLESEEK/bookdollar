import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserPlus, FaSpinner } from 'react-icons/fa';
import { useUser } from '../../context/UserContext';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const { username, email, password, confirmPassword } = formData;
  const { register, isAuthenticated, loading, error, clearError } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // 如果已认证，重定向到主页
    if (isAuthenticated) {
      navigate('/');
    }
    
    // 清除错误
    return () => {
      clearError();
    };
  }, [isAuthenticated, navigate, clearError]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // 清除对应字段的错误
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: '' });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!username) {
      errors.username = '请输入用户名';
    } else if (username.length < 3) {
      errors.username = '用户名至少需要3个字符';
    }
    
    if (!email) {
      errors.email = '请输入邮箱';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = '请输入有效的邮箱地址';
    }
    
    if (!password) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少需要6个字符';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await register({
        username,
        email,
        password
      });
    } catch (err) {
      console.error('注册失败:', err);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center">
          <FaUserPlus className="mr-2" /> 注册
        </h2>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              name="username"
              value={username}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.username ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入用户名"
            />
            {formErrors.username && (
              <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入邮箱"
            />
            {formErrors.email && (
              <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">密码</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入密码"
            />
            {formErrors.password && (
              <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">确认密码</label>
            <input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请再次输入密码"
            />
            {formErrors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 px-4 rounded hover:bg-primary-700 transition duration-200"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" /> 注册中...
              </span>
            ) : (
              '注册'
            )}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <p>
            已有账号？{' '}
            <Link to="/login" className="text-primary-600 hover:underline">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
