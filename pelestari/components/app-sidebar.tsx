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
  LayoutDashboard,
  Users,
  Store,
  History,
  Receipt,
  FileSpreadsheet,
  PackageSearch,
  Building2,
  Settings2,
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession()
  const userRole = (session?.user as any)?.role?.toUpperCase()

  // === MENENTUKAN URL DASHBOARD SECARA DINAMIS BERDASARKAN ROLE ===
  let dashboardUrl = "/dashboard"
  if (userRole === "ADMIN") {
    dashboardUrl = "/dashboard/admin"
  } else if (userRole === "MANAGER FINANCE" || userRole === "FINANCE") {
    dashboardUrl = "/dashboard/finance"
  } else if (userRole === "GA") {
    dashboardUrl = "/dashboard/ga"
  }

  const navMainData = [
    {
      title: "Dashboard",
      url: dashboardUrl,
      icon: <LayoutDashboard />,
    },
    {
      title: "Karyawan",
      url: "#",
      icon: <Users />,
      roles: ["ADMIN", "GA", "FINANCE", "MANAGER FINANCE"],
      items: [
        {
          title: "Perjalanan Dinas",
          url: "/dashboard/karyawan/perjalanan-dinas",
        },
        {
          title: "Pengajuan Barang",
          url: "/dashboard/karyawan/pengajuan-barang",
        },
        { title: "Gajian", url: "/dashboard/karyawan/gajian" },
      ],
    },

    // FINANCE DROPDOWN
    {
      title: "Point of Sale",
      url: "#",
      icon: <Store />,
      isActive: true,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"],
      items: [
        { title: "Jurnal Umum", url: "/dashboard/finance/pos/jurnal" },
        { title: "Kasir", url: "/dashboard/finance/pos/kasir" },
        { title: "Daftar Akun", url: "/dashboard/finance/pos/akun" },
        {
          title: "Kelompok Biaya",
          url: "/dashboard/finance/pos/kelompok-biaya",
        },
      ],
    },
    {
      title: "Riwayat Transaksi",
      url: "#",
      icon: <History />,
      isActive: true,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"],
      items: [
        { title: "Riwayat Transaksi", url: "/dashboard/finance/riwayat" },
      ],
    },

    {
      title: "Invoice",
      url: "#",
      icon: <Receipt />,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"],
      items: [{ title: "Invoice", url: "/dashboard/finance/invoices" }],
    },
    {
      title: "Laporan",
      icon: <FileSpreadsheet />,
      url: "#",
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"],
      items: [
        {
          title: "Laporan Neraca",
          url: "/dashboard/finance/laporan/lap-neraca",
        },
        {
          title: "Laporan Laba Rugi",
          url: "/dashboard/finance/laporan/lap-labarugi",
        },
      ],
    },
    {
      title: "Tracking",
      url: "#",
      icon: <PackageSearch />,
      isActive: true,
      roles: ["ADMIN", "MANAGER FINANCE", "FINANCE"],
      items: [
        { title: "PO Tracking", url: "/dashboard/finance/po-tracking" },
        { title: "Asset Tracking", url: "/dashboard/finance/asset-tracking" },
      ],
    },

    // GA DROPDOWN
    {
      title: "Facility Management",
      url: "#",
      icon: <Building2 />,
      roles: ["ADMIN", "GA"],
      items: [
        { title: "Purchase Order", url: "/dashboard/ga/purchase-order" },
        { title: "Asset", url: "/dashboard/ga/asset" },
        { title: "Utilities", url: "/dashboard/ga/utilities" },
      ],
    },
  ]

  const filteredNavMain = navMainData.filter((menu) => {
    if (!menu.roles) return true
    if (status === "loading") return false
    return userRole ? menu.roles.includes(userRole) : false
  })

  const navSecondaryData = [
    {
      title: "Account Settings",
      url: "/dashboard/account",
      icon: <Settings2 />,
    },
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