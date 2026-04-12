'use client'

import { AdminSidebarLayout } from '@/lib/components/layout/Sidebar'
import { GlobalNotifications } from '@/lib/components/GlobalNotifications'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSidebarLayout>
      <GlobalNotifications />
      {children}
    </AdminSidebarLayout>
  )
}
