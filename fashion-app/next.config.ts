import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
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
