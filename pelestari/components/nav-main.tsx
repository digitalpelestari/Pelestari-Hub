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

function NavItem({
  item,
  depth = 0,
}: {
  item: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
      icon?: React.ReactNode
      isActive?: boolean
      items?: any[]
    }[]
  }
  depth?: number
}) {
  const pathname = usePathname()

  const checkActive = (
    url: string,
    children?: { url: string; items?: any[] }[]
  ): boolean => {
    if (pathname === url) return true
    if (children) {
      return children.some((child) => checkActive(child.url, child.items))
    }
    return false
  }

  const isActiveItem = checkActive(item.url, item.items)

  if (!item.items || item.items.length === 0) {
    if (depth === 0) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={item.title}
            className="p-0"
            isActive={isActiveItem}
          >
            <Link
              href={item.url}
              className="flex h-full w-full items-center gap-2 px-2.5"
              onClick={(e) => {
                if (isActiveItem) e.preventDefault()
              }}
            >
              {item.icon}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton size="sm" isActive={isActiveItem}>
          <Link
            href={item.url}
            className="flex w-full items-center gap-2"
            onClick={(e) => {
              if (isActiveItem) e.preventDefault()
            }}
          >
            {item.icon}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  if (depth === 0) {
    return (
      <Collapsible defaultOpen={false} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger>
            <SidebarMenuButton
              tooltip={item.title}
              className="flex w-full items-center justify-between"
              isActive={isActiveItem}
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
              {item.items?.map((subItem) => (
                <NavItem key={subItem.title} item={subItem} depth={depth + 1} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <SidebarMenuSubItem>
      <Collapsible defaultOpen={false} className="group/collapsible">
        <CollapsibleTrigger>
          <SidebarMenuButton
            tooltip={item.title}
            size="sm"
            className="flex w-full items-center justify-between"
            isActive={isActiveItem}
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
            {item.items?.map((subItem) => (
              <NavItem key={subItem.title} item={subItem} depth={depth + 1} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  )
}

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
      icon?: React.ReactNode
      isActive?: boolean
      items?: any[]
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavItem key={item.title} item={item} depth={0} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
