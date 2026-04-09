# 本地构建打包脚本 (Windows PowerShell)
# 在项目根目录运行此脚本，生成部署包

$ErrorActionPreference = "Stop"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  构建部署包" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 创建临时目录
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$packageDir = "fashion-deploy-$timestamp"

Write-Host "`n📦 创建打包目录: $packageDir" -ForegroundColor Yellow

# 创建目录结构
New-Item -ItemType Directory -Force -Path "$packageDir\backend\dist" | Out-Null
New-Item -ItemType Directory -Force -Path "$packageDir\backend\prisma" | Out-Null
New-Item -ItemType Directory -Force -Path "$packageDir\backend\uploads\results" | Out-Null
New-Item -ItemType Directory -Force -Path "$packageDir\backend\uploads\upscaled" | Out-Null
New-Item -ItemType Directory -Force -Path "$packageDir\frontend" | Out-Null
New-Item -ItemType Directory -Force -Path "$packageDir\deploy" | Out-Null

# 构建后端
Write-Host "`n🔨 构建后端代码..." -ForegroundColor Yellow
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "后端构建失败"
}

# 复制后端文件
Copy-Item -Recurse -Force "dist\*" "..\$packageDir\backend\dist\"
Copy-Item -Force "package.json" "..\$packageDir\backend\"
Copy-Item -Force "package-lock.json" "..\$packageDir\backend\"
Copy-Item -Recurse -Force "prisma\*" "..\$packageDir\backend\prisma\"

Set-Location ..

# 构建前端
Write-Host "`n🔨 构建前端代码..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "前端构建失败"
}

# 复制前端文件
Copy-Item -Recurse -Force "dist\*" "..\$packageDir\frontend\"

Set-Location ..

# 复制部署文件
Write-Host "`n📋 复制部署文件..." -ForegroundColor Yellow
Copy-Item -Force "deploy\.env.production" "$packageDir\backend\.env.example"
Copy-Item -Force "deploy\deploy.sh" "$packageDir\deploy\"
Copy-Item -Force "deploy\nginx.conf.example" "$packageDir\deploy\"
Copy-Item -Force "deploy\DEPLOY_GUIDE.md" "$packageDir\"

# 创建 README
$readmeLines = @(
    "Fashion Street Photo Deployment Package",
    "========================================",
    "",
    "Directory Structure:",
    "  backend/        Backend code",
    "  frontend/       Frontend static files",
    "  deploy/         Deployment scripts and config",
    "  DEPLOY_GUIDE.md Detailed deployment guide",
    "",
    "Quick Start:",
    "  1. Upload the entire directory to server /www/wwwroot/fz.yejunmou.com",
    "  2. Move frontend directory contents to root directory",
    "  3. Follow DEPLOY_GUIDE.md for deployment",
    "",
    "Important:",
    "  - Modify database password and JWT secret in backend/.env",
    "  - Ensure MySQL has created fashion_street database",
    "",
    "Generated: $timestamp"
)
$readmeLines | Out-File -FilePath "$packageDir\README.txt" -Encoding UTF8

# 打包
Write-Host "`n📦 打包压缩..." -ForegroundColor Yellow
Compress-Archive -Path $packageDir -DestinationPath "$packageDir.zip" -Force

# 获取文件大小
$fileSize = (Get-Item "$packageDir.zip").Length / 1MB
$fileSizeStr = "{0:N2} MB" -f $fileSize

Write-Host "`n✅ 打包完成！" -ForegroundColor Green
Write-Host "`n部署包：$packageDir.zip" -ForegroundColor Cyan
Write-Host "大小：$fileSizeStr" -ForegroundColor Cyan
Write-Host "`n下一步：" -ForegroundColor Yellow
Write-Host "1. 下载 $packageDir.zip" -ForegroundColor White
Write-Host "2. 在宝塔面板文件管理器中上传到 /www/wwwroot/" -ForegroundColor White
Write-Host "3. 解压并重命名为 fz.yejunmou.com" -ForegroundColor White
Write-Host "4. 将 frontend 目录内容移动到根目录" -ForegroundColor White
Write-Host "5. 参照 DEPLOY_GUIDE.md 完成部署" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Cyan
