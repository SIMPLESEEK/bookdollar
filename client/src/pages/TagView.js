import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBookmarks } from '../context/BookmarkContext';
import BookmarkList from '../components/bookmarks/BookmarkList';
import { FaTimes } from 'react-icons/fa';

const TagView = () => {
  const { tagName } = useParams();
  const navigate = useNavigate();
  const { bookmarks, loading, getBookmarksByTag } = useBookmarks();

  // 清除标签筛选，返回所有书签页面
  const clearTagFilter = () => {
    navigate('/');
  };

  useEffect(() => {
    if (tagName) {
      getBookmarksByTag(tagName);
    }
  }, [tagName]);

  return (
    <div className="p-4">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-semibold">标签: {tagName}</h2>
        <button
          onClick={clearTagFilter}
          className="flex items-center ml-3 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-sm"
          title="清除标签筛选"
        >
          <FaTimes className="mr-1" /> 清除筛选
        </button>
      </div>
      <BookmarkList
        bookmarks={bookmarks}
        loading={loading}
        hideTitle={true}
      />
    </div>
  );
};

export default TagView;
