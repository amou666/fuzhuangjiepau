'use client'

import { AppSidebarLayout } from '@/lib/components/layout/Sidebar'
import { GlobalNotifications } from '@/lib/components/GlobalNotifications'
import { BottomProgress } from '@/lib/components/common/BottomProgress'
import { useTaskSse } from '@/lib/hooks/useTaskSse'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useTaskSse()

  return (
    <AppSidebarLayout>
      <GlobalNotifications />
      {children}
      <BottomProgress />
    </AppSidebarLayout>
  )
}
