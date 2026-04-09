# 服装街拍项目 - 宝塔面板部署指南

域名：fz.yejunmou.com  
系统：OpenCloudOS 9  
面板：宝塔面板

---

## 📋 部署前准备

### 1. 宝塔面板安装软件

在宝塔面板 **软件商店** 中安装以下软件：

- ✅ **Nginx** 1.20+
- ✅ **MySQL** 5.7 或 8.0
- ✅ **PM2管理器** 4.5+
- ✅ **Node.js版本管理器**（然后安装 Node.js 20.x）

### 2. 创建数据库

在宝塔面板 **数据库** → **添加数据库**：

```
数据库名：fashion_street
用户名：fashion
密码：[设置一个强密码]
访问权限：本地服务器
字符集：utf8mb4
```

记录下数据库密码，后面需要配置。

---

## 📦 上传代码

### 方式一：通过宝塔文件管理器上传

1. 在宝塔面板 **文件** 中，进入 `/www/wwwroot/`
2. 创建目录：`fz.yejunmou.com`
3. 上传以下文件：
   - `backend/` 目录（整个目录）
   - `frontend/dist/` 目录内容（解压到根目录）

### 方式二：使用 Git 拉取（推荐）

```bash
cd /www/wwwroot
git clone [你的仓库地址] fz.yejunmou.com
cd fz.yejunmou.com
```

---

## ⚙️ 后端配置

### 1. 配置环境变量

```bash
cd /www/wwwroot/fz.yejunmou.com/backend

# 复制环境变量模板
cp deploy/.env.production .env

# 编辑配置文件
nano .env
```

**修改以下配置：**

```env
# 数据库密码改为你的实际密码
DATABASE_URL=mysql://fashion:你的密码@localhost:3306/fashion_street

# JWT 密钥（改为随机字符串）
JWT_SECRET=随机字符串-至少32位
JWT_REFRESH_SECRET=另一个随机字符串-至少32位

# 前端域名
FRONTEND_ORIGIN=https://fz.yejunmou.com
```

### 2. 安装依赖和初始化

```bash
cd /www/wwwroot/fz.yejunmou.com/backend

# 给部署脚本执行权限
chmod +x deploy/deploy.sh

# 运行部署脚本
bash deploy/deploy.sh
```

### 3. 使用 PM2 启动服务

**方式一：使用宝塔 PM2 管理器**

1. 在宝塔面板 **软件商店** → **PM2管理器** → **设置**
2. 点击 **添加项目**
3. 填写：
   - 项目名称：`fashion-api`
   - 启动文件：`/www/wwwroot/fz.yejunmou.com/backend/dist/app.js`
   - 运行目录：`/www/wwwroot/fz.yejunmou.com/backend`
   - 端口：`3001`
4. 点击 **提交**

**方式二：使用命令行**

```bash
cd /www/wwwroot/fz.yejunmou.com/backend

# 启动服务
pm2 start dist/app.js --name fashion-api

# 保存 PM2 进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### 4. 检查服务状态

```bash
# 查看日志
pm2 logs fashion-api

# 查看状态
pm2 status
```

应该看到服务运行在 3001 端口。

---

## 🌐 Nginx 配置

### 1. 配置网站

在宝塔面板 **网站** → **添加站点**：

```
域名：fz.yejunmou.com
根目录：/www/wwwroot/fz.yejunmou.com
PHP版本：纯静态
```

### 2. 修改 Nginx 配置

在宝塔面板 **网站** → 点击站点名 → **配置文件**，替换为：

```nginx
server {
    listen 80;
    server_name fz.yejunmou.com;
    
    root /www/wwwroot/fz.yejunmou.com;
    index index.html index.htm;
    
    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket/SSE 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 关闭缓冲（SSE 需要）
        proxy_buffering off;
        proxy_cache off;
    }
    
    # 上传文件访问
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
    
    access_log /www/wwwlogs/fz.yejunmou.com.log;
    error_log /www/wwwlogs/fz.yejunmou.com.error.log;
}
```

保存后，点击 **重载配置**。

---

## 🔒 配置 SSL 证书

### 1. 申请免费证书

在宝塔面板 **网站** → 点击站点名 → **SSL**：

- 选择 **Let's Encrypt**
- 勾选域名 `fz.yejunmou.com`
- 点击 **申请**

### 2. 强制 HTTPS

申请成功后，开启 **强制HTTPS** 开关。

---

## ✅ 验证部署

### 1. 检查服务状态

```bash
# 检查 PM2 服务
pm2 status

# 查看后端日志
pm2 logs fashion-api

# 测试 API
curl http://localhost:3001/api/health
```

### 2. 访问网站

打开浏览器访问：`https://fz.yejunmou.com`

### 3. 测试登录

使用测试账号登录：
- 邮箱：`admin@fashionai.local`
- 密码：`123456`

---

## 🔧 常见问题

### 1. 后端启动失败

```bash
# 检查日志
pm2 logs fashion-api --lines 100

# 检查端口占用
netstat -tunlp | grep 3001

# 检查数据库连接
mysql -u fashion -p fashion_street
```

### 2. 无法访问 API

检查防火墙：
```bash
# 查看防火墙状态
firewall-cmd --state

# 开放端口（如果需要）
firewall-cmd --permanent --add-port=3001/tcp
firewall-cmd --reload
```

### 3. 上传文件失败

```bash
# 检查上传目录权限
ls -la /www/wwwroot/fz.yejunmou.com/backend/uploads

# 修复权限
chown -R www:www /www/wwwroot/fz.yejunmou.com/backend/uploads
chmod -R 755 /www/wwwroot/fz.yejunmou.com/backend/uploads
```

### 4. 数据库连接失败

```bash
# 检查 MySQL 服务
systemctl status mysql

# 测试连接
mysql -u fashion -p -h localhost fashion_street
```

---

## 📊 性能优化建议

### 1. 开启 Gzip 压缩

在 Nginx 配置中添加：

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1024;
```

### 2. 配置 PM2 集群模式

```bash
pm2 start dist/app.js --name fashion-api -i max
```

### 3. MySQL 优化

在宝塔面板 **数据库** → **性能优化** 中调整配置。

---

## 🔄 更新部署

### 后端更新

```bash
cd /www/wwwroot/fz.yejunmou.com/backend
git pull
npm install
npm run build
pm2 restart fashion-api
```

### 前端更新

```bash
cd /www/wwwroot/fz.yejunmou.com/frontend
git pull
npm install
npm run build
# 将 dist 目录内容复制到根目录
cp -r dist/* ../
```

---

## 📞 技术支持

如遇到问题，请检查：
1. PM2 日志：`pm2 logs fashion-api`
2. Nginx 错误日志：`/www/wwwlogs/fz.yejunmou.com.error.log`
3. 数据库连接状态

---

**部署完成后，访问：https://fz.yejunmou.com 即可使用！** 🎉
