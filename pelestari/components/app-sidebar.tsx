"use client"

import * as React from "react"
import { useSession } from "next-auth/react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { 
  LayoutDashboardIcon, 
  FileTextIcon, 
  Settings2Icon, 
  CommandIcon,
  FolderIcon,
  ShoppingCartIcon, 
  FileText,
  Package,
  Wrench
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession()
  const userRole = (session?.user as any)?.role?.toUpperCase()

  // === MENENTUKAN URL DASHBOARD SECARA DINAMIS BERDASARKAN ROLE ===
  let dashboardUrl = "/dashboard"
  if (userRole === "MANAGER FINANCE" || userRole === "FINANCE") {
    dashboardUrl = "/dashboard/finance"
  } else if (userRole === "GA") {
    dashboardUrl = "/dashboard/ga"
  }

  const navMainData = [
    {
      title: "Dashboard",
      url: dashboardUrl, // Menggunakan URL dinamis hasil saringan di atas
      icon: <LayoutDashboardIcon />,
    },

    // FINANCE DROPDOWN
    {
      title: "Point of Sale",
      url: "#",
      icon: <CommandIcon />,
      isActive: true,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"], 
      items: [
        { title: "Jurnal Umum", url: "/dashboard/finance/pos/jurnal" },
        { title: "Kasir", url: "/dashboard/finance/pos/kasir" },
        { title: "Daftar Akun", url: "/dashboard/finance/pos/akun" },
        { title: "Kelompok Biaya", url: "/dashboard/finance/pos/kelompok-biaya" },
      ],
    },
    
    {
      title: "Invoice",
      url: "#",
      icon: <FolderIcon />,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"], 
      items: [
        { title: "Invoice", url: "/dashboard/finance/invoices" },
      ],
    },
    {
      title: "Laporan",
      icon: <FileTextIcon />,
      url: "#",
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"], 
      items: [
        { title: "Laporan Neraca", url: "/dashboard/finance/laporan/lap-neraca" },
        { title: "Laporan Laba Rugi", url: "/dashboard/finance/laporan/lap-labarugi" },
      ],
    },
    {
      title: "Tracking",
      url: "#",
      icon: <CommandIcon />,
      isActive: true,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"], 
      items: [
        { title: "PO Tracking", url: "/dashboard/finance/po-tracking" },
        { title: "Asset Tracking", url: "/dashboard/finance/asset-tracking" },
      ],
    },

    // GA DROPDOWN
    {
      title: "Purchase Order",
      url: "#",
      icon: <FileText />,
      roles: ["ADMIN", "GA"], 
      items: [
        { title: "Purchase Order", url: "/dashboard/ga/purchase-order" },
      ],
    },
     {
      title: "Asset",
      url: "#",
      icon: <Package />,
      roles: ["ADMIN", "GA"], 
      items: [
        { title: "Asset", url: "/dashboard/ga/asset" },
      ],
    },
    {
      title: "Utilities",
      url: "#",
      icon: <Wrench />,
      roles: ["ADMIN", "GA"], 
      items: [
        { title: "Utilities", url: "/dashboard/ga/utilities" },
      ],
    },
  ]

  // Saring menu berdasarkan role setelah data URL dashboard di-set
  const filteredNavMain = navMainData.filter((menu) => {
    if (!menu.roles) return true
    if (status === "loading") return false
    return userRole ? menu.roles.includes(userRole) : false
  })

  const navSecondaryData = [
    { title: "Account Settings", url: "/dashboard/account", icon: <Settings2Icon /> },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <span className="text-base font-semibold">APP PELESTARI</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <NavMain items={filteredNavMain} />
        <NavSecondary items={navSecondaryData} className="mt-auto" />
      </SidebarContent>
      
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}