#!/bin/bash

echo "🚀 Deploying Fashion AI to Production Server..."

# 打包项目
echo "📦 Building project..."
npm run build

# 创建部署包
echo "📁 Creating deployment package..."
rm -rf deploy-package
mkdir -p deploy-package

# 复制必要文件
cp -r .next deploy-package/
cp -r public deploy-package/
cp -r prisma deploy-package/
cp -r node_modules deploy-package/
cp package.json deploy-package/
cp package-lock.json deploy-package/
cp .env deploy-package/
cp next.config.ts deploy-package/
cp start.sh deploy-package/

# 创建数据目录
mkdir -p deploy-package/prisma/data

# 创建上传目录
mkdir -p deploy-package/uploads/{clothing,models,scenes,results,upscaled}

# 打包
echo "📦 Creating archive..."
tar -czf fashion-app-deploy.tar.gz deploy-package/

echo "✅ Deployment package created: fashion-app-deploy.tar.gz"
echo ""
echo "📋 Next steps:"
echo "1. Upload fashion-app-deploy.tar.gz to your server"
echo "2. Extract: tar -xzf fashion-app-deploy.tar.gz"
echo "3. Run: cd deploy-package && chmod +x start.sh && ./start.sh"
