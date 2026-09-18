"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import NotificationBell from "@/components/NotificationBell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />

      <main className="w-full min-w-0">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b bg-white p-2">
          <div className="flex items-center">
            <SidebarTrigger />
            <span className="ml-4 text-sm font-semibold">Dashboard</span>
          </div>

          {/* 2. Pasang di sisi kanan topbar */}
         <div className="flex items-center gap-2 mr-2">
          <NotificationBell role="finance" userId="user_finance_01" />
        </div>
        </div>

        {/* Konten Halaman */}
        <div className="min-w-0 overflow-x-hidden p-4">{children}</div>
      </main>
    </SidebarProvider>
  )
}