import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaFolder, FaFolderOpen, FaPlus, FaTags, FaChevronRight, FaChevronDown, FaChevronUp, FaEdit, FaTrash, FaEllipsisV } from 'react-icons/fa';
import { useFolders } from '../../context/FolderContext';
import { useBookmarks } from '../../context/BookmarkContext';
import AddFolderModal from '../folders/AddFolderModal';
import EditFolderModal from '../folders/EditFolderModal';
import DeleteFolderModal from '../folders/DeleteFolderModal';

const Sidebar = () => {
  const { folders, getFolders } = useFolders();
  const { bookmarks } = useBookmarks();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState({});
  const [tags, setTags] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  // 获取当前选中的标签
  const getSelectedTags = () => {
    if (location.pathname === '/tags' && location.search) {
      const searchParams = new URLSearchParams(location.search);
      const tagsParam = searchParams.get('tags');
      return tagsParam ? tagsParam.split(',') : [];
    }
    return [];
  };

  const selectedTags = getSelectedTags();

  useEffect(() => {
    // 使用false参数表示不强制刷新，优先使用缓存
    getFolders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 从所有书签中提取唯一标签
    if (bookmarks.length > 0) {
      const allTags = bookmarks.reduce((acc, bookmark) => {
        if (bookmark.tags && bookmark.tags.length > 0) {
          return [...acc, ...bookmark.tags];
        }
        return acc;
      }, []);

      // 去重
      const uniqueTags = [...new Set(allTags)];
      setTags(uniqueTags);
    }
  }, [bookmarks]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // 处理标签点击
  const handleTagClick = (tag, e) => {
    // 阻止默认行为
    if (e) e.preventDefault();

    // 如果标签已经选中，则不做任何操作
    if (selectedTags.includes(tag)) {
      return;
    }

    // 如果已经有选中的标签，则添加到已选标签列表
    if (selectedTags.length > 0) {
      const newTags = [...selectedTags, tag];
      navigate(`/tags?tags=${newTags.join(',')}`);
    } else {
      // 如果没有选中的标签，则直接导航到单标签页面
      navigate(`/tags?tags=${tag}`);
    }
  };

  // 切换文件夹展开/折叠状态
  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // 切换文件夹菜单
  const toggleFolderMenu = (e, folderId) => {
    e.stopPropagation();
    e.preventDefault();
    setFolderMenuOpen(prev => {
      const newState = {};
      // 关闭所有其他菜单
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      // 切换当前菜单
      newState[folderId] = !prev[folderId];
      return newState;
    });
  };

  // 关闭所有文件夹菜单
  const closeAllFolderMenus = () => {
    setFolderMenuOpen({});
  };

  // 处理编辑文件夹
  const handleEditFolder = (e, folder) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentFolder(folder);
    setShowEditModal(true);
    closeAllFolderMenus();
  };

  // 处理删除文件夹
  const handleDeleteFolder = (e, folder) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentFolder(folder);
    setShowDeleteModal(true);
    closeAllFolderMenus();
  };

  // 点击页面其他地方时关闭所有文件夹菜单
  useEffect(() => {
    const handleClickOutside = () => {
      closeAllFolderMenus();
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // 组织文件夹为层级结构
  const organizeIntoHierarchy = () => {
    const rootFolders = [];
    const folderMap = {};
    let uncategorizedFolder = null;

    // 首先创建所有文件夹的映射
    folders.forEach(folder => {
      folderMap[folder.name] = {
        ...folder,
        children: []
      };

      // 标记"未分类"文件夹
      if (folder.name === '未分类') {
        uncategorizedFolder = folderMap[folder.name];
      }
    });

    // 然后构建层级关系
    folders.forEach(folder => {
      // 跳过"未分类"文件夹，稍后单独处理
      if (folder.name === '未分类') {
        return;
      }

      if (folder.parent) {
        // 如果有父文件夹，添加到父文件夹的children中
        if (folderMap[folder.parent]) {
          folderMap[folder.parent].children.push(folderMap[folder.name]);
        } else {
          // 如果父文件夹不存在，作为根文件夹处理
          rootFolders.push(folderMap[folder.name]);
        }
      } else {
        // 没有父文件夹，作为根文件夹
        rootFolders.push(folderMap[folder.name]);
      }
    });

    // 如果存在"未分类"文件夹，将其添加到根文件夹列表的最后
    if (uncategorizedFolder) {
      rootFolders.push(uncategorizedFolder);
    }

    return rootFolders;
  };

  // 递归渲染文件夹树
  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map(folder => {
      const hasChildren = folder.children && folder.children.length > 0;
      const isExpanded = expandedFolders[folder.name];

      return (
        <li key={folder._id} className="mb-1">
          <div className="flex items-center">
            {/* 缩进 */}
            {level > 0 && (
              <div style={{ width: `${level * 16}px` }} className="flex-shrink-0"></div>
            )}

            {/* 展开/折叠图标 */}
            {hasChildren ? (
              <button
                onClick={() => toggleFolder(folder.name)}
                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-primary-500"
              >
                {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
              </button>
            ) : (
              <div className="w-5 h-5"></div>
            )}

            {/* 文件夹链接 */}
            <div className="flex items-center flex-grow">
              <Link
                to={`/folder/${folder.name}`}
                className={`flex items-center p-2 rounded flex-grow ${
                  isActive(`/folder/${folder.name}`) ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                }`}
              >
                {isActive(`/folder/${folder.name}`) ? (
                  <FaFolderOpen className="mr-2" />
                ) : (
                  <FaFolder className="mr-2" />
                )}
                {folder.name}
              </Link>

              {/* 不允许编辑或删除"未分类"文件夹 */}
              {folder.name !== '未分类' && (
                <div className="relative">
                  <button
                    onClick={(e) => toggleFolderMenu(e, folder._id)}
                    className="p-2 text-gray-500 hover:text-primary-500 focus:outline-none"
                  >
                    <FaEllipsisV size={14} />
                  </button>

                  {folderMenuOpen[folder._id] && (
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg py-1 z-10">
                      <button
                        onClick={(e) => handleEditFolder(e, folder)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <FaEdit className="mr-2" /> 编辑文件夹
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(e, folder)}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                      >
                        <FaTrash className="mr-2" /> 删除文件夹
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 子文件夹 */}
          {hasChildren && isExpanded && (
            <ul className="list-none mt-1">
              {renderFolderTree(folder.children, level + 1)}
            </ul>
          )}
        </li>
      );
    });
  };

  // 获取层级结构的文件夹
  const hierarchicalFolders = organizeIntoHierarchy();

  return (
    <div className="sidebar">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold">文件夹</h3>
            <Link
              to="/"
              className={`ml-2 px-2 py-1 text-xs rounded-full ${
                isActive('/') ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="查看所有书签"
            >
              全部
            </Link>
          </div>
          <button
            className="text-primary-500 hover:text-primary-700"
            onClick={() => setShowAddModal(true)}
          >
            <FaPlus />
          </button>
        </div>

        {/* PC端垂直文件夹列表 - 在移动端隐藏 */}
        <ul className="list-none p-0 hidden md:block">
          {/* 渲染层级文件夹结构 */}
          {renderFolderTree(hierarchicalFolders)}
        </ul>

        {/* 移动端文件夹列表 - 在PC端隐藏 */}
        <div className="md:hidden">
          {/* 顶级文件夹行 - 使用网格布局，每行4个 */}
          <div className="grid grid-cols-4 gap-x-1 gap-y-0.5 mb-1">
            {hierarchicalFolders
              .filter(folder => !folder.parent) // 只显示顶级文件夹
              .map(folder => (
                <div key={folder._id} className="mb-0.5 w-full">
                  <div className="flex items-center">
                    <Link
                      to={`/folder/${folder.name}`}
                      className={`flex items-center px-1 py-0.5 rounded-md whitespace-nowrap shadow-sm text-xs flex-grow ${
                        isActive(`/folder/${folder.name}`) ? 'bg-primary-100 text-primary-700 border-l-2 border-primary-500' : 'bg-white hover:bg-gray-50'
                      }`}
                      style={{ minWidth: 0 }} // 允许内容收缩
                    >
                      {isActive(`/folder/${folder.name}`) ? (
                        <FaFolderOpen className="mr-0.5 flex-shrink-0 text-primary-500" size={9} />
                      ) : (
                        <FaFolder className="mr-0.5 flex-shrink-0 text-gray-500" size={9} />
                      )}
                      <span className="truncate text-xs">{folder.name}</span>
                    </Link>

                    {/* 如果有子文件夹，添加展开/折叠按钮 */}
                    {folder.children && folder.children.length > 0 && (
                      <button
                        onClick={() => toggleFolder(folder.name)}
                        className="ml-0.5 p-0.5 text-gray-400 hover:text-primary-500 bg-white rounded-full shadow-sm flex-shrink-0"
                      >
                        {expandedFolders[folder.name] ? (
                          <FaChevronUp size={8} />
                        ) : (
                          <FaChevronDown size={8} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* 子文件夹 - 如果有子文件夹且父文件夹被选中或展开，则显示 */}
                  {folder.children && folder.children.length > 0 && (isActive(`/folder/${folder.name}`) || expandedFolders[folder.name]) && (
                    <div className="mt-0.5 ml-1.5 flex flex-col gap-0.5 w-full max-w-full">
                      {folder.children.map(childFolder => (
                        <Link
                          key={childFolder._id}
                          to={`/folder/${childFolder.name}`}
                          className={`flex items-center px-2 py-1 rounded-md shadow-sm text-xs w-full ${
                            isActive(`/folder/${childFolder.name}`) ? 'bg-primary-50 text-primary-600 border-l-2 border-primary-300' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          {isActive(`/folder/${childFolder.name}`) ? (
                            <FaFolderOpen className="mr-1 flex-shrink-0 text-primary-400" size={10} />
                          ) : (
                            <FaFolder className="mr-1 flex-shrink-0 text-gray-400" size={10} />
                          )}
                          <span className="text-xs break-words">{childFolder.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* 展开/折叠所有文件夹的按钮 */}
          <div className="flex justify-end mb-2">
            <button
              className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center px-2 py-1 rounded-full shadow-sm"
              onClick={() => {
                // 获取所有有子文件夹的父文件夹
                const parentFolders = hierarchicalFolders
                  .filter(folder => folder.children && folder.children.length > 0)
                  .map(folder => folder.name);

                // 检查是否所有父文件夹都已展开
                const allExpanded = parentFolders.length > 0 &&
                  parentFolders.every(name => expandedFolders[name]);

                if (allExpanded) {
                  // 如果所有文件夹都已展开，则全部折叠
                  setExpandedFolders({});
                } else {
                  // 否则全部展开
                  const newExpandedState = {};
                  parentFolders.forEach(name => {
                    newExpandedState[name] = true;
                  });
                  setExpandedFolders(newExpandedState);
                }
              }}
            >
              全部展开/折叠
              {Object.keys(expandedFolders).length > 0 ?
                <FaChevronUp className="ml-1" size={10} /> :
                <FaChevronDown className="ml-1" size={10} />
              }
            </button>
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div>
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-semibold">标签</h3>
            <FaTags className="ml-2 text-gray-500" />
          </div>

          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <a
                key={tag}
                href="#"
                onClick={(e) => handleTagClick(tag, e)}
                className={`text-xs px-2 py-1 rounded-full ${
                  selectedTags.includes(tag)
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag}
              </a>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddFolderModal onClose={() => setShowAddModal(false)} />
      )}

      {showEditModal && currentFolder && (
        <EditFolderModal
          folder={currentFolder}
          onClose={() => {
            setShowEditModal(false);
            setCurrentFolder(null);
          }}
        />
      )}

      {showDeleteModal && currentFolder && (
        <DeleteFolderModal
          folder={currentFolder}
          onClose={() => {
            setShowDeleteModal(false);
            setCurrentFolder(null);
          }}
        />
      )}
    </div>
  );
};

export default Sidebar;
