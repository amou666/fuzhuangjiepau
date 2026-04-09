import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '服装街拍 AI',
  description: 'AI 服装街拍生图平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
