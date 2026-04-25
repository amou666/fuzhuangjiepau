import type { Metadata, Viewport } from 'next'
import { Parisienne } from 'next/font/google'
import './globals.css'

const parisienne = Parisienne({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-parisienne',
})

export const metadata: Metadata = {
  title: 'Amou 服装工作室',
  description: 'Amou 服装工作室 · AI 服装街拍生图平台',
  applicationName: 'Amou 服装工作室',
  appleWebApp: {
    capable: true,
    title: 'Amou',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#faf7f4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={parisienne.variable}>
      <body>{children}</body>
    </html>
  )
}
