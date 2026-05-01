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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0eb' },
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={parisienne.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fashion-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');document.documentElement.style.background='#18181b'}else{document.documentElement.style.background='#faf7f4'}}catch(e){document.documentElement.style.background='#faf7f4'}})()`,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
