# AI 模拍后端服务

基于 Express 5 + Prisma + SQLite 的 AI 模拍平台后端服务。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

**重要配置项：**

- `JWT_SECRET` / `JWT_REFRESH_SECRET`: JWT 密钥（生产环境必须设置）
- `ADMIN_PASSWORD` / `DEMO_PASSWORD`: 管理员和演示账户密码
- `AI_API_KEY`: AI 服务 API 密钥

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate

# 推送数据库 schema（开发环境）
npm run db:push

# 或运行种子数据
npm run seed
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 首次启动

首次启动时，系统会自动：

1. 创建管理员账户（如果不存在）
2. 创建演示账户（如果不存在）
3. 为演示账户充值 60 积分
4. 生成随机密码（如果未配置环境变量）

**控制台会输出：**

- 管理员和演示账户的登录信息
- JWT 密钥使用警告（如果使用自动生成的密钥）

⚠️ **生产环境请务必设置环境变量！**

## API 端点

### 认证

- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `POST /api/auth/refresh` - 刷新 token

### 用户功能

- `GET /api/credits` - 获取积分余额
- `GET /api/credits/history` - 积分历史
- `POST /api/tasks` - 创建生图任务
- `POST /api/tasks/:id/upscale` - 放大图片
- `GET /api/tasks/:id` - 获取任务详情
- `GET /api/records` - 获取任务记录
- `GET /api/sse/token` - 获取 SSE token
- `GET /api/sse/tasks` - SSE 任务状态推送

### 管理员功能

- `GET /api/admin/dashboard` - 管理员看板数据
- `GET /api/admin/customers` - 客户列表
- `GET /api/admin/credits` - 积分管理
- `GET /api/admin/stats` - 统计数据

## 安全特性

### JWT 密钥

- 支持环境变量配置
- 未配置时自动生成随机密钥
- 启动时警告提示

### 密码安全

- 管理员和演示账户密码支持环境变量配置
- 未配置时自动生成随机密码
- 首次启动时在控制台输出

### SSE 认证

- 使用短期 SSE token（5分钟有效期）
- 先通过 JWT 获取 SSE token，再建立连接
- 避免 token 暴露在 URL 中

### 积分事务

- 使用 Prisma 事务确保积分操作的原子性
- 任务创建失败自动退款
- 图片放大失败自动退款

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 3001 |
| DATABASE_URL | 数据库连接 | file:./prisma/dev.db |
| JWT_SECRET | JWT 访问密钥 | 自动生成 |
| JWT_REFRESH_SECRET | JWT 刷新密钥 | 自动生成 |
| FRONTEND_ORIGIN | 前端源地址 | http://localhost:5173 |
| ADMIN_EMAIL | 管理员邮箱 | admin@fashionai.local |
| ADMIN_PASSWORD | 管理员密码 | 自动生成 |
| DEMO_EMAIL | 演示邮箱 | demo@fashionai.local |
| DEMO_PASSWORD | 演示密码 | 自动生成 |
| AI_API_KEY | AI API 密钥 | 无 |
| CREDIT_PER_GENERATION | 每次生图消耗积分 | 10 |
| CREDIT_PER_UPSCALE | 每次放大消耗积分 | 5 |

## 开发

```bash
# 运行测试
npm test

# 监听模式测试
npm run test:watch
```

## 生产部署

1. 设置环境变量（必须）：
   - `JWT_SECRET` - 使用 `openssl rand -hex 32` 生成
   - `JWT_REFRESH_SECRET` - 使用 `openssl rand -hex 32` 生成
   - `ADMIN_PASSWORD` - 设置管理员密码
   - `AI_API_KEY` - AI 服务密钥

2. 使用绝对路径数据库：
   ```
   DATABASE_URL="file:/absolute/path/to/prisma/prod.db"
   ```

3. 构建并启动：
   ```bash
   npm run build
   npm start
   ```

## License

ISC
