# AI 时尚街拍生成平台

一个基于 AI 的时尚街拍图像生成平台，支持模特配置、场景选择、服装搭配等功能。

## 部署信息

### CloudBase 环境
- **环境 ID**: `amou-3gc97uqr06a87da1`
- **环境别名**: `amou`
- **区域**: 上海

### 后端服务（Cloud Run）
- **服务名称**: `fashion-street-api`
- **服务类型**: 容器型（Node.js + Express）
- **访问地址**: https://fashion-street-api-240719-7-1300845201.sh.run.tcloudbase.com
- **配置**: 
  - CPU: 1 核
  - 内存: 2 GB
  - 最小实例: 1
  - 最大实例: 5

### 前端服务（静态托管）
- **访问地址**: https://amou-3gc97uqr06a87da1-1300845201.tcloudbaseapp.com/
- **框架**: React + Vite + TypeScript

## 功能特性

- ✅ 用户认证（登录/注册/Token 刷新）
- ✅ 积分系统（生成/放大消耗积分）
- ✅ 模特配置（类别/年龄/人种/性别/肤色/体型/姿势/表情）
- ✅ 场景配置（上传/预设/替换模式）
- ✅ 服装配置（上传/生成）
- ✅ AI 图像生成（支持流式进度推送）
- ✅ 图像放大（高清处理）
- ✅ 历史记录管理

## 账户信息

### 管理员账户
- 邮箱: `admin@fashionai.local`
- 密码: `123456`

### 演示账户
- 邮箱: `demo@fashionai.local`
- 密码: `123456`

## 开发指南

### 本地开发

#### 后端
```bash
cd backend
npm install
npm run dev
```

#### 前端
```bash
cd frontend
npm install
npm run dev
```

### 生产构建

#### 后端
```bash
cd backend
npm run build
npm start
```

#### 前端
```bash
cd frontend
npm run build
```

## 技术栈

### 后端
- Node.js 20
- Express 5
- Prisma (SQLite)
- TypeScript
- JWT 认证
- WebSocket (SSE)

### 前端
- React 19
- Vite 8
- TypeScript
- Zustand (状态管理)
- Axios (HTTP 客户端)

## CloudBase 控制台

- [环境概览](https://tcb.cloud.tencent.com/dev?envId=amou-3gc97uqr06a87da1#/overview)
- [云托管服务](https://tcb.cloud.tencent.com/dev?envId=amou-3gc97uqr06a87da1#/platform-run)
- [静态网站托管](https://tcb.cloud.tencent.com/dev?envId=amou-3gc97uqr06a87da1#/static-hosting)

## 注意事项

⚠️ **数据库限制**: 当前使用 SQLite 数据库，容器重启会重置数据。生产环境建议迁移到 CloudBase MySQL 数据库。

⚠️ **API Key**: 当前使用测试 API Key，生产环境请替换为有效的 AI 服务 API Key。
