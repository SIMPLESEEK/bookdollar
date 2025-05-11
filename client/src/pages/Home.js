import React, { useEffect } from 'react';
import { useBookmarks } from '../context/BookmarkContext';
import BookmarkList from '../components/bookmarks/BookmarkList';

const Home = () => {
  const { bookmarks, loading, getBookmarks } = useBookmarks();

  useEffect(() => {
    // 使用false参数表示不强制刷新，优先使用缓存
    getBookmarks(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <BookmarkList
        bookmarks={bookmarks}
        loading={loading}
        title="所有书签"
      />
    </div>
  );
};

export default Home;
