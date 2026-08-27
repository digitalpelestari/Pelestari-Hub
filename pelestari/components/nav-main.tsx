"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // 1. JIKA MENU TUNGGAL (MISAL: DASHBOARD)
          if (!item.items || item.items.length === 0) {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  className="p-0"
                  isActive={isActive}
                >
                  <Link
                    href={item.url}
                    className="flex h-full w-full items-center gap-2 px-2.5"
                    onClick={(e) => {
                      if (isActive) e.preventDefault()
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // 2. JIKA MENU DROPDOWN (MISAL: POINT OF SALE, LAPORAN)
          const isParentActive = item.items?.some(
            (subItem) => pathname === subItem.url
          )
          return (
            <Collapsible
              key={item.title}
              defaultOpen={false}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="flex w-full items-center justify-between"
                    isActive={isParentActive}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent className="transition-all duration-300">
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isSubActive = pathname === subItem.url
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton isActive={isSubActive}>
                            <Link
                              href={subItem.url}
                              className="flex w-full items-center"
                              onClick={(e) => {
                                if (isSubActive) e.preventDefault()
                              }}
                            >
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
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
