import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBookmarks } from '../context/BookmarkContext';
import BookmarkList from '../components/bookmarks/BookmarkList';

const SearchResults = () => {
  const { query } = useParams();
  const { bookmarks, loading, searchBookmarks } = useBookmarks();

  useEffect(() => {
    if (query) {
      searchBookmarks(query);
    }
  }, [query]);

  return (
    <div className="p-4">
      <BookmarkList 
        bookmarks={bookmarks} 
        loading={loading} 
        title={`搜索结果: "${query}"`} 
      />
    </div>
  );
};

export default SearchResults;
