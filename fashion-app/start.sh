#!/bin/bash

echo "🚀 Starting Fashion AI Application..."

# 进入项目目录
cd "$(dirname "$0")"

# 安装依赖
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# 生成 Prisma 客户端
echo "🔧 Generating Prisma client..."
npx prisma generate

# 确保上传目录存在
echo "📁 Creating upload directories..."
mkdir -p uploads/{clothing,models,scenes,results,upscaled}

# 确保数据库目录存在
mkdir -p prisma/data

# 初始化数据库
echo "🗄️ Initializing database..."
npx prisma db push --skip-generate

# 启动应用
echo "✅ Starting server..."
npm run start
