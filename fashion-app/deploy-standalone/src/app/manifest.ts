import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Amou 服装工作室',
    short_name: 'Amou',
    description: 'Amou 服装工作室 · AI 服装街拍生图平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f0eb',
    theme_color: '#f5f0eb',
    orientation: 'any',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
