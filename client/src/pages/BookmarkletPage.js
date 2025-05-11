import React, { useState, useEffect } from 'react';
import { FaPuzzlePiece, FaCheck, FaInfoCircle } from 'react-icons/fa';

const BookmarkletPage = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    // 获取当前应用的基础URL
    const url = window.location.origin;
    setBaseUrl(url);
  }, []);
  
  // 生成书签小工具代码
  const generateBookmarkletCode = () => {
    return `javascript:(function(){
  var title = document.title;
  var url = window.location.href;
  var reason = prompt('收藏原因（可选）:', '');
  var tags = prompt('标签（用逗号分隔）:', '');
  
  window.open('${baseUrl}/quickadd?title=' + 
    encodeURIComponent(title) + '&url=' + 
    encodeURIComponent(url) + '&reason=' + 
    encodeURIComponent(reason || '') + '&tags=' + 
    encodeURIComponent(tags || ''), 
    'bookdollar_add', 
    'width=500,height=600');
})();`;
  };
  
  // 复制书签小工具代码到剪贴板
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateBookmarkletCode())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaPuzzlePiece className="mr-2" /> 书签小工具
      </h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">一键收藏工具</h2>
        <p className="mb-4 text-gray-700">
          书签小工具是一种特殊的书签，点击它可以快速将当前浏览的网页保存到BookDollar。
          无需安装浏览器扩展，适用于所有主流浏览器。
        </p>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium flex items-center mb-2">
            <FaInfoCircle className="mr-2 text-blue-500" /> 安装步骤
          </h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>将下面的"保存到BookDollar"链接拖动到书签栏</li>
            <li>或者右键点击链接，选择"添加到书签"</li>
            <li>在任何网页上点击此书签，即可快速保存</li>
          </ol>
        </div>
        
        <div className="flex flex-col items-center mb-6">
          <a 
            href={`javascript:${generateBookmarkletCode()}`}
            className="bg-primary-600 text-white py-3 px-6 rounded-lg text-lg font-medium mb-4 hover:bg-primary-700 transition duration-200"
            onClick={(e) => e.preventDefault()}
          >
            保存到BookDollar
          </a>
          <p className="text-sm text-gray-500">
            ↑ 拖动此链接到书签栏 ↑
          </p>
        </div>
        
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">高级用户：复制代码</h3>
          <p className="text-sm text-gray-600 mb-2">
            如果拖动不起作用，您可以复制下面的代码，手动创建书签：
          </p>
          <div className="relative">
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {generateBookmarkletCode()}
            </pre>
            <button
              onClick={copyToClipboard}
              className={`absolute top-2 right-2 p-2 rounded ${
                copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {copied ? <FaCheck /> : '复制'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">使用说明</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">1. 在任何网页上点击书签</h3>
            <p className="text-gray-700">
              当您浏览到想要保存的网页时，点击书签栏中的"保存到BookDollar"。
            </p>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">2. 添加收藏原因和标签</h3>
            <p className="text-gray-700">
              系统会弹出提示框，询问您保存此页面的原因和相关标签。
              这些信息可以帮助您日后更容易找到和理解为什么保存了这个页面。
            </p>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">3. 确认保存</h3>
            <p className="text-gray-700">
              在弹出的BookDollar窗口中，您可以进一步编辑书签信息，
              选择保存的文件夹，然后点击"保存书签"按钮完成操作。
            </p>
          </div>
        </div>
        
        <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-medium flex items-center mb-2">
            <FaInfoCircle className="mr-2 text-yellow-500" /> 提示
          </h3>
          <p className="text-gray-700">
            如果您未登录BookDollar，系统会先要求您登录，然后再继续保存书签。
            登录后，您的书签会与您的账户关联，可以在任何设备上访问。
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookmarkletPage;
