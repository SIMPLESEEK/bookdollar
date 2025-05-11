import React from 'react';
import { FaFileExport, FaDownload } from 'react-icons/fa';
import axios from 'axios';

const ExportData = () => {
  const handleExport = async () => {
    try {
      // 获取导出数据并触发下载
      const response = await axios.get('/api/data/export', {
        responseType: 'blob' // 重要：设置响应类型为blob
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bookdollar-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      
      // 清理
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出数据失败，请稍后重试');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaFileExport className="mr-2" /> 导出数据
      </h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">导出您的书签数据</h2>
        <p className="mb-4 text-gray-700">
          您可以导出所有书签和文件夹数据，以便备份或迁移到其他设备。导出的数据将以JSON格式保存。
        </p>
        
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
          <div>
            <h3 className="font-medium">完整数据导出</h3>
            <p className="text-sm text-gray-600">包含所有书签、文件夹和标签</p>
          </div>
          <button
            onClick={handleExport}
            className="btn btn-primary flex items-center"
          >
            <FaDownload className="mr-2" /> 导出数据
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">关于数据导出</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>导出的数据包含您的所有书签和文件夹信息</li>
          <li>导出文件为JSON格式，可用于后续导入</li>
          <li>导出不包含您的账户信息和密码</li>
          <li>建议定期导出数据进行备份</li>
        </ul>
      </div>
    </div>
  );
};

export default ExportData;
