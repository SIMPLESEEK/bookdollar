# BookDollar - 智能浏览器收藏夹

BookDollar是一个现代化的浏览器收藏夹应用，旨在解决传统浏览器收藏夹的局限性，提供更直观、更智能的网页收藏体验。

## 主要特点

- 📝 **收藏原因记录** - 记录为什么收藏页面，永不遗忘
- 🖼️ **网页预览** - 直观的网页预览图，快速识别收藏内容
- 🌐 **跨浏览器访问** - 任何浏览器都可访问，不再受限于单一平台
- 🏷️ **标签系统** - 灵活的标签管理，轻松分类和筛选
- 📱 **响应式设计** - 完美适配PC和移动设备
- 📂 **文件夹组织** - 层级化管理收藏内容

## 技术栈

- **前端**: React.js, Tailwind CSS
- **后端**: Node.js, Express
- **数据库**: MongoDB Atlas
- **图片存储**: 腾讯云 COS

## 安装指南

### 前提条件

- Node.js (v14+)
- npm 或 yarn
- MongoDB Atlas 账户

### 安装步骤

1. 克隆仓库
   ```
   git clone https://github.com/SIMPLESEEK/bookdollar.git
   cd bookdollar
   ```

2. 安装依赖
   ```
   npm install
   # 或
   yarn install
   ```

3. 配置环境变量
   - 创建 `.env` 文件在项目根目录
   - 添加以下配置（替换为您的实际值）:
     ```
     MONGODB_URI=your_mongodb_atlas_connection_string
     JWT_SECRET=your_jwt_secret_key
     PORT=5001
     COS_SECRET_ID=your_cos_secret_id
     COS_SECRET_KEY=your_cos_secret_key
     COS_REGION=your_cos_region
     COS_BUCKET=your_cos_bucket
     ```

4. 启动开发服务器
   ```
   npm run dev
   # 或
   yarn dev
   ```

5. 访问应用
   - 打开浏览器访问 `http://localhost:5001`

## Vercel 部署指南

BookDollar 可以轻松部署到 Vercel 平台。请按照以下步骤操作：

1. 在 Vercel 上创建新项目
   - 连接您的 GitHub 仓库
   - 选择 BookDollar 仓库

2. 配置环境变量
   - 在 Vercel 项目设置中添加以下环境变量：
     ```
     MONGODB_URI=your_mongodb_atlas_connection_string
     JWT_SECRET=your_jwt_secret_key
     NODE_ENV=production
     VERCEL=true
     COS_SECRET_ID=your_cos_secret_id
     COS_SECRET_KEY=your_cos_secret_key
     COS_REGION=your_cos_region
     COS_BUCKET=your_cos_bucket
     ```

3. 部署项目
   - Vercel 将自动构建和部署您的应用
   - 部署完成后，您可以通过提供的 URL 访问您的应用

### 注意事项

- 在 Vercel 环境中，预览图和图片上传功能依赖于腾讯云 COS
- 确保正确配置了腾讯云 COS 环境变量
- Vercel 不支持本地文件系统持久化，所有图片必须存储在 COS 中

## 使用指南

### 添加收藏

1. 点击"添加收藏"按钮
2. 输入网址、标题（自动获取）
3. 添加收藏原因（可选）
4. 选择或创建文件夹
5. 添加标签（可选）
6. 保存

### 管理收藏

- 使用左侧导航在文件夹间切换
- 通过标签筛选收藏内容
- 搜索特定收藏
- 编辑或删除已有收藏

## 项目结构

```
bookdollar/
├── client/             # 前端React应用
│   ├── public/         # 静态资源
│   └── src/            # 源代码
│       ├── components/ # React组件
│       ├── pages/      # 页面组件
│       ├── hooks/      # 自定义Hooks
│       ├── context/    # React Context
│       ├── utils/      # 工具函数
│       └── styles/     # 样式文件
├── server/             # 后端Node.js/Express应用
│   ├── controllers/    # 路由控制器
│   ├── models/         # 数据模型
│   ├── routes/         # API路由
│   ├── middleware/     # 中间件
│   └── utils/          # 工具函数
├── .env                # 环境变量
└── package.json        # 项目配置
```

## 贡献指南

欢迎贡献代码、报告问题或提出新功能建议。请遵循以下步骤：

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 联系方式

如有问题或建议，请通过 [issues](https://github.com/SIMPLESEEK/bookdollar/issues) 联系我们。
