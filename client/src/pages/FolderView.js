import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBookmarks } from '../context/BookmarkContext';
import BookmarkList from '../components/bookmarks/BookmarkList';

const FolderView = () => {
  const { folderName } = useParams();
  const { bookmarks, loading, getBookmarksByFolder } = useBookmarks();

  useEffect(() => {
    if (folderName) {
      // 使用false参数表示不强制刷新，优先使用缓存
      getBookmarksByFolder(folderName, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderName]);

  return (
    <div className="p-4">
      <BookmarkList
        bookmarks={bookmarks}
        loading={loading}
        title={`${folderName} 文件夹`}
      />
    </div>
  );
};

export default FolderView;
