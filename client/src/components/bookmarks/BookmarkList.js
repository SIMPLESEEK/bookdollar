import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import BookmarkCard from './BookmarkCard';
import Masonry from 'react-masonry-css';

const BookmarkList = ({ bookmarks, loading, title, hideTitle = false }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary-500" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold mb-4">{title || '书签'}</h2>
        <p className="text-gray-500">没有找到书签</p>
      </div>
    );
  }

  // 定义响应式断点
  const breakpointColumnsObj = {
    default: 4, // 默认4列
    1200: 3,    // 屏幕宽度 <= 1200px 时为3列
    900: 2,     // 屏幕宽度 <= 900px 时为2列
    600: 2,     // 屏幕宽度 <= 600px 时为2列
    400: 2      // 屏幕宽度 <= 400px 时仍保持2列
  };

  return (
    <div>
      {!hideTitle && <h2 className="text-2xl font-bold mb-4">{title || '书签'}</h2>}
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {bookmarks.map(bookmark => (
          <BookmarkCard key={bookmark._id} bookmark={bookmark} />
        ))}
      </Masonry>
    </div>
  );
};

export default BookmarkList;
