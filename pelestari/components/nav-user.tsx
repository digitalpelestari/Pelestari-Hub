"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, CircleUserRoundIcon, CreditCardIcon, BellIcon, LogOutIcon } from "lucide-react"

// 1. Import hook dan fungsi dari next-auth
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export function NavUser() {
  const { isMobile } = useSidebar()
  
  // 2. Ambil data session yang sedang aktif secara real-time
  const { data: session } = useSession()

  // Jika data session belum ke-load, berikan tampilan loading sementara atau fallback kosong
  const userName = session?.user?.name || "Loading..."
  const userEmail = session?.user?.email || "..."
  const userAvatar = (session?.user as any)?.avatar || "" // Jika ada kolom avatar di DB, jika tidak ada akan fallback ke inisial

  // Ambil 2 huruf pertama nama untuk fallback avatar (misal: Ahmad Finance -> AH)
  const avatarFallback = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg grayscale">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="rounded-lg">{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userName}</span>
              <span className="truncate text-xs text-white/70">
                {userEmail}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="rounded-lg">{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {/* 3. Bungkus menu Account dengan Link agar mengarah ke halaman setting akun */}
              <Link href="/dashboard/account" passHref legacyBehavior>
                <DropdownMenuItem className="cursor-pointer">
                  <CircleUserRoundIcon />
                  Account
                </DropdownMenuItem>
              </Link>
             
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* 4. Tambahkan fungsi signOut bawaan NextAuth pada tombol Log Out */}
            <DropdownMenuItem 
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}