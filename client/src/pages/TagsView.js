import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBookmarks } from '../context/BookmarkContext';
import BookmarkList from '../components/bookmarks/BookmarkList';
import { FaTimes, FaTag } from 'react-icons/fa';

const TagsView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookmarks, loading, getBookmarksByTags } = useBookmarks();
  const [selectedTags, setSelectedTags] = useState([]);

  // 从URL中解析选中的标签
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tagsParam = searchParams.get('tags');
    
    if (tagsParam) {
      const tags = tagsParam.split(',');
      setSelectedTags(tags);
    } else {
      setSelectedTags([]);
    }
  }, [location.search]);

  // 当选中的标签变化时，获取相应的书签
  useEffect(() => {
    if (selectedTags.length > 0) {
      getBookmarksByTags(selectedTags);
    }
  }, [selectedTags]);

  // 移除单个标签
  const removeTag = (tagToRemove) => {
    const newTags = selectedTags.filter(tag => tag !== tagToRemove);
    
    if (newTags.length === 0) {
      // 如果没有标签了，返回首页
      navigate('/');
    } else {
      // 更新URL
      navigate(`/tags?tags=${newTags.join(',')}`);
    }
  };

  // 清除所有标签筛选
  const clearAllTags = () => {
    navigate('/');
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <h2 className="text-xl font-semibold">标签筛选</h2>
          <button
            onClick={clearAllTags}
            className="flex items-center ml-3 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-sm"
            title="清除所有标签筛选"
          >
            <FaTimes className="mr-1" /> 清除所有筛选
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedTags.map(tag => (
            <div 
              key={tag} 
              className="flex items-center bg-primary-100 text-primary-700 px-3 py-1 rounded-full"
            >
              <FaTag className="mr-1" />
              <span>{tag}</span>
              <button
                onClick={() => removeTag(tag)}
                className="ml-2 text-primary-700 hover:text-primary-900"
                title="移除此标签"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <BookmarkList
        bookmarks={bookmarks}
        loading={loading}
        hideTitle={true}
      />
    </div>
  );
};

export default TagsView;
