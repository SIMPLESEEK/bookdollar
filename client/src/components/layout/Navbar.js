import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaPlus, FaBookmark, FaSignOutAlt, FaUser, FaFileExport, FaFileImport, FaPuzzlePiece } from 'react-icons/fa';
import AddBookmarkModal from '../bookmarks/AddBookmarkModal';
import { useUser } from '../../context/UserContext';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // 判断是否在登录或注册页面
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // 调试用：记录认证状态变化
  useEffect(() => {
    console.log('认证状态:', isAuthenticated);
  }, [isAuthenticated]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search/${searchQuery}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  // 强制在登录/注册页面隐藏搜索栏和用户操作区
  const shouldShowAuthenticatedUI = isAuthenticated && !isAuthPage;

  return (
    <nav className={`navbar bg-white shadow-sm ${!shouldShowAuthenticatedUI ? 'navbar-not-authenticated' : ''}`}>
      {/* BookDollar标志 - 始终显示 */}
      <div className="flex items-center">
        <Link to="/" className="flex items-center text-primary-600 no-underline">
          <FaBookmark className="text-xl md:mr-2 mr-1" />
          <h1 className="text-xl font-bold m-0 md:mr-0 mr-1">BookDollar</h1>
        </Link>
      </div>

      {shouldShowAuthenticatedUI ? (
        <>
          {/* 搜索栏 - 仅在登录后显示 */}
          <form onSubmit={handleSearch} className="search-bar flex">
            <input
              type="text"
              className="form-control flex-grow h-10 md:w-auto w-full"
              placeholder="搜索书签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary ml-2 h-10 flex items-center justify-center md:px-4 md:w-auto w-10 md:min-w-[80px]">
              {/* PC端显示文字，移动端显示图标 */}
              <FaSearch className="md:hidden text-sm" />
              <span className="hidden md:inline md:whitespace-nowrap">搜索</span>
            </button>
          </form>

          {/* 用户操作区 - 仅在登录后显示 */}
          <div className="flex items-center">
            <button
              className="btn btn-primary flex items-center justify-center mr-2 h-10 md:px-4 md:w-auto w-10 md:min-w-[100px]"
              onClick={() => setShowAddModal(true)}
            >
              <FaPlus className="md:hidden text-sm" />
              {/* 在移动端只显示+图标，在PC端显示完整文本 */}
              <span className="hidden md:inline md:whitespace-nowrap">添加书签</span>
            </button>

            <div className="relative">
              <button
                className="flex items-center justify-center text-gray-700 hover:text-primary-600 p-2 rounded-full md:h-10 md:w-10 h-8 w-8"
                onClick={toggleUserMenu}
              >
                <FaUser className="md:text-base text-sm" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    {user?.username || '用户'}
                  </div>

                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FaUser className="mr-2" /> 个人资料
                  </Link>

                  <Link
                    to="/export"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FaFileExport className="mr-2" /> 导出数据
                  </Link>

                  <Link
                    to="/import"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FaFileImport className="mr-2" /> 导入数据
                  </Link>

                  <Link
                    to="/bookmarklet"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <FaPuzzlePiece className="mr-2" /> 书签小工具
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                  >
                    <FaSignOutAlt className="mr-2" /> 退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex ml-auto">
          <Link to="/login" className="btn bg-white text-primary-600 border border-primary-600 mr-2">
            登录
          </Link>
          <Link to="/register" className="btn btn-primary">
            注册
          </Link>
        </div>
      )}

      {/* 添加书签模态框 - 仅在登录后且点击添加按钮时显示 */}
      {shouldShowAuthenticatedUI && showAddModal && (
        <AddBookmarkModal onClose={() => setShowAddModal(false)} />
      )}
    </nav>
  );
};

export default Navbar;
