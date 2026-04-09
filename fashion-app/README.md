# Fashion AI Application

Next.js + SQLite 全栈应用，完整保留 AI 生图逻辑。

## 技术栈

- **前端**: Next.js 15 + React 19 + Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: SQLite (Prisma ORM)
- **认证**: JWT

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run db:init
```

### 3. 配置环境变量

编辑 `.env` 文件：

```env
# AI 配置
AI_API_KEY="your-api-key-here"

# JWT 密钥
JWT_SECRET="your-random-secret"
JWT_REFRESH_SECRET="your-random-refresh-secret"

# 公开 API 地址（用于图片访问）
PUBLIC_API_BASE_URL="https://your-domain.com"
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3001

## 默认账号

- **管理员**: admin@fashionai.local / admin123456
- **演示用户**: demo@fashionai.local / demo123456

## API 路由

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `POST /api/auth/refresh` - 刷新 Token
- `GET /api/auth/me` - 获取当前用户

### 任务
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/[id]` - 获取任务详情
- `DELETE /api/tasks/[id]` - 删除任务
- `POST /api/tasks/[id]/upscale` - 放大图片

### 积分
- `GET /api/credits/balance` - 获取积分余额
- `GET /api/credits/history` - 获取积分记录

### 管理员
- `GET /api/admin/customers` - 获取客户列表
- `POST /api/admin/customers` - 创建客户
- `POST /api/admin/credits` - 充值积分

## 生产部署

### 方式一：PM2（推荐）

```bash
# 构建
npm run build

# 启动
pm2 start npm --name fashion-app -- start
```

### 方式二：Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## AI 生图逻辑

完整保留了所有 prompt：

1. **analyzeClothing** - 服装分析
2. **describeModel** - 模特描述
3. **describeScene** - 场景描述
4. **generateResultImage** - 融合生成
5. **upscaleImage** - 图片放大

所有逻辑在 `src/lib/ai-service.ts` 中，**绝不能修改**。
