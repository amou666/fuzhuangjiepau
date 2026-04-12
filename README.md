# AI 时尚街拍生成平台

基于 AI 的时尚街拍图像生成平台，支持模特配置、场景选择、服装搭配等功能。

## 功能特性

- 用户认证（登录/注册/Token 刷新）
- 积分系统（生成/放大消耗积分）
- 模特配置（类别/年龄/人种/性别/肤色/体型/姿势/表情）
- 场景配置（上传/预设/替换模式）
- 服装配置（正面/背面/细节图上传）
- AI 图像生成（SSE 实时进度推送）
- 模特融合（多张模特面部特征融合）
- 图像放大（高清处理）
- 管理后台（用户管理/积分充值/审计日志/数据统计）

## 技术栈

- **前端框架**: Next.js 15 (App Router) + React 19
- **后端**: Next.js API Routes (Route Handlers)
- **数据库**: better-sqlite3 (WAL 模式)
- **状态管理**: Zustand
- **AI 服务**: OpenAI 兼容格式 API (api.apiyi.com)
- **语言**: TypeScript

## 本地开发

```bash
cd fashion-app
cp .env.local.example .env.local  # 首次需要配置环境变量
npm install
npm run dev
```

访问 http://localhost:3001

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_EMAIL` | 管理员邮箱 | `admin@fashionai.local` |
| `ADMIN_PASSWORD` | 管理员密码 | 启动时随机生成 |
| `JWT_SECRET` | JWT 访问令牌密钥 | 启动时随机生成 |
| `JWT_REFRESH_SECRET` | JWT 刷新令牌密钥 | 启动时随机生成 |
| `AI_API_URL` | AI API 地址 | `https://api.apiyi.com/v1` |
| `AI_API_KEY` | AI API Key | 无 |
| `AI_MODEL` | AI 模型名 | `nano-banana-2` |
| `PUBLIC_API_BASE_URL` | 公开 API 基础 URL | `http://localhost:3001` |
| `MAX_FILE_SIZE` | 最大上传文件大小 | `10485760` (10MB) |

> **重要**: 生产环境必须设置 `JWT_SECRET`、`JWT_REFRESH_SECRET` 和 `ADMIN_PASSWORD`。

## 默认账户

首次启动会自动创建：

- 管理员: `admin@fashionai.local` / 控制台输出随机密码
- 演示用户: `demo@fashionai.local` / 控制台输出随机密码

## 项目结构

```
fashion-app/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (admin)/      # 管理后台页面
│   │   ├── (app)/        # 用户应用页面
│   │   ├── (auth)/       # 登录注册页面
│   │   └── api/          # API Routes（后端逻辑）
│   └── lib/              # 共享库
│       ├── ai-service.ts # AI 调用服务
│       ├── api/          # 前端 API 客户端
│       ├── components/   # 共享组件
│       ├── config.ts     # 配置
│       ├── db.ts         # 数据库
│       ├── stores/       # Zustand 状态
│       └── types.ts      # 类型定义
└── uploads/              # 上传文件目录（gitignore）
```
