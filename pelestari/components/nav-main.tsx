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
                  <a href={item.url} className="w-full flex items-center gap-2 h-full px-2.5">
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
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-zinc-400" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="transition-all duration-300">
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={subItem.url} className="flex items-center w-full">
                            <span className="text-zinc-600 hover:text-black">{subItem.title}</span>
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