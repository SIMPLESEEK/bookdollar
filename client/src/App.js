import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { BookmarkProvider } from './context/BookmarkContext';
import { FolderProvider } from './context/FolderContext';
import { ModalProvider } from './context/ModalContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import PrivateRoute from './components/routing/PrivateRoute';
import Home from './pages/Home';
import FolderView from './pages/FolderView';
import TagView from './pages/TagView';
import TagsView from './pages/TagsView';
import SearchResults from './pages/SearchResults';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Profile from './pages/Profile';
import ExportData from './pages/ExportData';
import ImportData from './pages/ImportData';
import QuickAdd from './pages/QuickAdd';
import BookmarkletPage from './pages/BookmarkletPage';
import './styles/App.css';

function App() {
  return (
    <UserProvider>
      <BookmarkProvider>
        <FolderProvider>
          <ModalProvider>
            <Router>
              <div className="app-container">
                <Navbar />
                <Routes>
                {/* 公开路由 */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* 私有路由 */}
                <Route path="/" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <Home />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/folder/:folderName" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <FolderView />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/tag/:tagName" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <TagView />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/tags" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <TagsView />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/search/:query" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <SearchResults />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/profile" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <Profile />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/export" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <ExportData />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                <Route path="/import" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <ImportData />
                      </div>
                    </div>
                  </PrivateRoute>
                } />

                {/* 快速添加书签路由 - 用于书签小工具 */}
                <Route path="/quickadd" element={
                  <PrivateRoute>
                    <QuickAdd />
                  </PrivateRoute>
                } />

                {/* 书签小工具安装页面 */}
                <Route path="/bookmarklet" element={
                  <PrivateRoute>
                    <div className="main-content">
                      <Sidebar />
                      <div className="content-area">
                        <BookmarkletPage />
                      </div>
                    </div>
                  </PrivateRoute>
                } />
              </Routes>
            </div>
          </Router>
          </ModalProvider>
        </FolderProvider>
      </BookmarkProvider>
    </UserProvider>
  );
}

export default App;
