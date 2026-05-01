import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'archiver'],
  devIndicators: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  images: {
    remotePatterns: [
      // AI 生成图 CDN — 按需添加更多域名，不再允许所有来源
      { protocol: 'https', hostname: '*.apiyi.com' },
      { protocol: 'https', hostname: '*.oaidalleapiprodscus.blob.core.windows.net' },
      { protocol: 'https', hostname: '*.openai.com' },
      // 本地上传预览
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/serve/:path*',
      },
    ]
  },
}

export default nextConfig
