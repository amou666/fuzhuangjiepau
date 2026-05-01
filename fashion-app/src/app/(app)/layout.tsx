'use client'

import { AppSidebarLayout } from '@/lib/components/layout/Sidebar'
import { GlobalNotifications } from '@/lib/components/GlobalNotifications'
import { useTaskSse } from '@/lib/hooks/useTaskSse'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useTaskSse()

  return (
    <AppSidebarLayout>
      <GlobalNotifications />
      {children}
    </AppSidebarLayout>
  )
}
