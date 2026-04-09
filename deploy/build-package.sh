#!/bin/bash

# 本地构建打包脚本
# 在项目根目录运行此脚本，生成部署包

set -e

echo "==================================="
echo "  构建部署包"
echo "==================================="

# 创建临时目录
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_DIR="fashion-deploy-${TIMESTAMP}"

echo ""
echo "📦 创建打包目录: ${PACKAGE_DIR}"
mkdir -p ${PACKAGE_DIR}/backend/dist
mkdir -p ${PACKAGE_DIR}/backend/prisma
mkdir -p ${PACKAGE_DIR}/frontend
mkdir -p ${PACKAGE_DIR}/deploy

echo ""
echo "🔨 构建后端代码..."
cd backend
npm run build
cp -r dist/* ../${PACKAGE_DIR}/backend/dist/
cp package*.json ../${PACKAGE_DIR}/backend/
cp -r prisma ../${PACKAGE_DIR}/backend/prisma/
cp -r uploads ../${PACKAGE_DIR}/backend/ 2>/dev/null || mkdir -p ../${PACKAGE_DIR}/backend/uploads/{results,upscaled}
cd ..

echo ""
echo "🔨 构建前端代码..."
cd frontend
npm run build
cp -r dist/* ../${PACKAGE_DIR}/frontend/
cd ..

echo ""
echo "📋 复制部署文件..."
cp deploy/.env.production ${PACKAGE_DIR}/backend/.env.example
cp deploy/deploy.sh ${PACKAGE_DIR}/deploy/
cp deploy/nginx.conf.example ${PACKAGE_DIR}/deploy/
cp deploy/DEPLOY_GUIDE.md ${PACKAGE_DIR}/

# 添加 README
cat > ${PACKAGE_DIR}/README.txt <<EOF
服装街拍项目部署包
==================

目录结构：
- backend/        后端代码
- frontend/       前端静态文件
- deploy/         部署脚本和配置
- DEPLOY_GUIDE.md 详细部署文档

快速开始：
1. 上传整个目录到服务器 /www/wwwroot/fz.yejunmou.com
2. 将 frontend 目录内容移动到根目录
3. 参照 DEPLOY_GUIDE.md 进行部署

重要：
- 修改 backend/.env 文件中的数据库密码和 JWT 密钥
- 确保 MySQL 已创建 fashion_street 数据库

生成时间：${TIMESTAMP}
EOF

echo ""
echo "📦 打包压缩..."
tar -czf ${PACKAGE_DIR}.tar.gz ${PACKAGE_DIR}

echo ""
echo "✅ 打包完成！"
echo ""
echo "部署包：${PACKAGE_DIR}.tar.gz"
echo "大小：$(du -h ${PACKAGE_DIR}.tar.gz | cut -f1)"
echo ""
echo "下一步："
echo "1. 下载 ${PACKAGE_DIR}.tar.gz"
echo "2. 上传到服务器 /www/wwwroot/"
echo "3. 解压：tar -xzf ${PACKAGE_DIR}.tar.gz"
echo "4. 重命名：mv ${PACKAGE_DIR} fz.yejunmou.com"
echo "5. 参照 DEPLOY_GUIDE.md 完成部署"
echo "==================================="
