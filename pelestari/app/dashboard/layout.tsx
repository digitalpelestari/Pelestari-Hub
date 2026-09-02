"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* Ini yang manggil file AppSidebar yang kamu kirim tadi */}
      <AppSidebar />

      <main className="w-full min-w-0">
        {/* Tombol buka tutup sidebar */}
        <div className="flex items-center border-b bg-white p-2">
          <SidebarTrigger />
          <span className="ml-4 text-sm font-semibold">
            
          </span>
        </div>

        {/* Konten Halaman (Dashboard, Invoices, dll) */}
        <div className="min-w-0 overflow-x-hidden p-4">{children}</div>
      </main>
    </SidebarProvider>
  )
}
