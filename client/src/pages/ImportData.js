import React, { useState } from 'react';
import { FaFileImport, FaUpload, FaChrome, FaFirefox } from 'react-icons/fa';
import axios from 'axios';

const ImportData = () => {
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('bookdollar'); // bookdollar, chrome, firefox
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setResult(null);
  };

  const handleImportTypeChange = (type) => {
    setImportType(type);
    setFile(null);
    setError('');
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) {
      setError('请选择要导入的文件');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          let endpoint = '';
          let data = {};
          
          // 根据导入类型处理数据
          if (importType === 'bookdollar') {
            // BookDollar导出文件导入
            endpoint = '/api/data/import';
            data = JSON.parse(fileContent);
          } else if (importType === 'chrome') {
            // Chrome书签导入
            endpoint = '/api/data/import/chrome';
            // 这里需要解析Chrome书签HTML文件，实际实现可能更复杂
            // 简化示例：假设我们已经提取了书签数据
            const bookmarks = extractChromeBookmarks(fileContent);
            data = { bookmarks };
          } else if (importType === 'firefox') {
            // Firefox书签导入
            endpoint = '/api/data/import/firefox';
            // 解析Firefox书签JSON文件
            const bookmarks = extractFirefoxBookmarks(fileContent);
            data = { bookmarks };
          }
          
          const response = await axios.post(endpoint, data);
          setResult(response.data);
        } catch (err) {
          console.error('解析文件失败:', err);
          setError('文件格式无效或解析失败');
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('读取文件失败');
        setLoading(false);
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error('导入失败:', err);
      setError('导入数据失败，请稍后重试');
      setLoading(false);
    }
  };

  // 提取Chrome书签的简单示例函数
  // 实际实现需要更复杂的HTML解析
  const extractChromeBookmarks = (html) => {
    // 简化示例，实际需要HTML解析
    const bookmarks = [];
    // 解析逻辑...
    return bookmarks;
  };

  // 提取Firefox书签的简单示例函数
  const extractFirefoxBookmarks = (json) => {
    try {
      const data = JSON.parse(json);
      const bookmarks = [];
      // 解析逻辑...
      return bookmarks;
    } catch (e) {
      throw new Error('无效的Firefox书签文件');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaFileImport className="mr-2" /> 导入数据
      </h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">选择导入类型</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            className={`p-4 border rounded-lg flex flex-col items-center justify-center ${
              importType === 'bookdollar' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
            }`}
            onClick={() => handleImportTypeChange('bookdollar')}
          >
            <FaFileImport className="text-2xl mb-2" />
            <span>BookDollar导出文件</span>
          </button>
          
          <button
            className={`p-4 border rounded-lg flex flex-col items-center justify-center ${
              importType === 'chrome' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
            }`}
            onClick={() => handleImportTypeChange('chrome')}
          >
            <FaChrome className="text-2xl mb-2" />
            <span>Chrome/Edge书签</span>
          </button>
          
          <button
            className={`p-4 border rounded-lg flex flex-col items-center justify-center ${
              importType === 'firefox' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
            }`}
            onClick={() => handleImportTypeChange('firefox')}
          >
            <FaFirefox className="text-2xl mb-2" />
            <span>Firefox书签</span>
          </button>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择文件
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary-50 file:text-primary-700
              hover:file:bg-primary-100"
            accept={importType === 'bookdollar' ? '.json' : 
                   importType === 'chrome' ? '.html' : '.json'}
          />
          <p className="mt-1 text-sm text-gray-500">
            {importType === 'bookdollar' && '请选择BookDollar导出的JSON文件'}
            {importType === 'chrome' && '请选择从Chrome/Edge导出的HTML书签文件'}
            {importType === 'firefox' && '请选择从Firefox导出的JSON书签文件'}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className={`btn btn-primary flex items-center ${
            loading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⟳</span> 导入中...
            </>
          ) : (
            <>
              <FaUpload className="mr-2" /> 开始导入
            </>
          )}
        </button>
      </div>
      
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">导入结果</h2>
          
          <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4">
            {result.message}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">书签</h3>
              <p>总数: {result.summary?.bookmarks?.total || 0}</p>
              <p>成功: {result.summary?.bookmarks?.success || 0}</p>
              <p>跳过: {result.summary?.bookmarks?.skipped || 0}</p>
              <p>失败: {result.summary?.bookmarks?.error || 0}</p>
            </div>
            
            {result.summary?.folders && (
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">文件夹</h3>
                <p>总数: {result.summary.folders.total || 0}</p>
                <p>成功: {result.summary.folders.success || 0}</p>
                <p>跳过: {result.summary.folders.skipped || 0}</p>
                <p>失败: {result.summary.folders.error || 0}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportData;
