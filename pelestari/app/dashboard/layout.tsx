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
      
      <main className="w-full">
        {/* Tombol buka tutup sidebar */}
        <div className="flex items-center p-2 border-b bg-white">
          <SidebarTrigger />
          <span className="ml-4 font-semibold text-sm">PT PELESTARI INDONESIA</span>
        </div>
        
        {/* Konten Halaman (Dashboard, Invoices, dll) */}
        <div className="p-4">
            {children}
        </div>
      </main>
    </SidebarProvider>
  )
}