import React, { useState, useEffect } from 'react';
import { FaUser, FaSpinner } from 'react-icons/fa';
import { useUser } from '../context/UserContext';
import axios from 'axios';

const Profile = () => {
  const { user, loading: userLoading } = useUser();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // 清除对应字段的错误
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: '' });
    }
    // 清除成功和错误消息
    setUpdateSuccess(false);
    setUpdateError('');
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username) {
      errors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      errors.username = '用户名至少需要3个字符';
    }
    
    if (!formData.email) {
      errors.email = '请输入邮箱';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = '请输入有效的邮箱地址';
    }
    
    // 只有当密码字段有值时才验证
    if (formData.password) {
      if (formData.password.length < 6) {
        errors.password = '密码至少需要6个字符';
      }
      
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = '两次输入的密码不一致';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setUpdateLoading(true);
    setUpdateSuccess(false);
    setUpdateError('');
    
    try {
      // 准备更新数据
      const updateData = {
        username: formData.username,
        email: formData.email
      };
      
      // 只有当密码字段有值时才包含密码
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      // 发送更新请求
      await axios.put('/api/users/profile', updateData);
      
      setUpdateSuccess(true);
      // 清空密码字段
      setFormData({
        ...formData,
        password: '',
        confirmPassword: ''
      });
    } catch (err) {
      setUpdateError(err.response?.data?.message || '更新资料失败');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaUser className="mr-2" /> 个人资料
      </h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {updateSuccess && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            资料更新成功
          </div>
        )}
        
        {updateError && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {updateError}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.username ? 'border-red-500' : 'border-gray-300'
              }`}
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
              value={formData.email}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.email && (
              <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">新密码 (留空则不更改)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.password && (
              <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">确认新密码</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={!formData.password}
            />
            {formErrors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 px-4 rounded hover:bg-primary-700 transition duration-200"
            disabled={updateLoading}
          >
            {updateLoading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" /> 更新中...
              </span>
            ) : (
              '保存更改'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
