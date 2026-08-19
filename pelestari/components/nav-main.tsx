"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // 1. JIKA MENU TUNGGAL (MISAL: DASHBOARD)
          // Tanpa asChild karena anaknya langsung tag HTML <a> murni, menghindari eror atribut DOM React
          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} className="p-0">
                  <a
                    href={item.url}
                    className="flex h-full w-full items-center gap-2 px-2.5"
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // 2. JIKA MENU DROPDOWN (MISAL: POINT OF SALE, LAPORAN)
          // Menggunakan asChild pada CollapsibleTrigger agar mengeliminasi elemen <button> bawaan Radix,
          // sehingga tidak terjadi struktur ilegal <button> di dalam <button> milik SidebarMenuButton (Anti-Hydration Error)
          return (
            <Collapsible
              key={item.title}
              // Hapus baris asChild di sini
              defaultOpen={false}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent className="transition-all duration-300">
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton>
                          <a
                            href={subItem.url}
                            className="flex w-full items-center"
                          >
                            <span className="text-zinc-600 hover:text-black">
                              {subItem.title}
                            </span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
