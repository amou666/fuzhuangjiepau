#!/bin/bash

# 服装街拍项目部署脚本
# 适用于宝塔面板环境

set -e

echo "==================================="
echo "  服装街拍项目部署脚本"
echo "==================================="

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在 backend 目录下运行此脚本"
    exit 1
fi

echo ""
echo "📦 步骤 1/5: 安装依赖..."
npm install --production

echo ""
echo "📦 步骤 2/5: 生成 Prisma Client..."
npx prisma generate

echo ""
echo "📦 步骤 3/5: 初始化数据库表结构..."
npx prisma db push --skip-generate

echo ""
echo "📦 步骤 4/5: 创建上传目录..."
mkdir -p uploads/results uploads/upscaled

echo ""
echo "📦 步骤 5/5: 设置权限..."
chmod -R 755 uploads

echo ""
echo "✅ 部署准备完成！"
echo ""
echo "接下来请执行："
echo "1. 复制 .env.production 为 .env 并修改配置"
echo "2. 使用 PM2 启动服务: pm2 start dist/app.js --name fashion-api"
echo "==================================="
