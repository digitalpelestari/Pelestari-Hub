// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const routePermissions: Record<string, string[]> = {
  "/dashboard/finance": ["ADMIN", "MANAGER FINANCE", "FINANCE"],
  "/dashboard/purchase-order": ["ADMIN", "GA"], 
  "/dashboard/ga": ["ADMIN", "GA"],
  "/dashboard/admin": ["ADMIN"],
};

// @ts-ignore
const { auth } = NextAuth(authConfig);

// @ts-ignore
export default auth(async function middleware(req: NextRequest & { auth: any }) {
  const { nextUrl } = req;
  
  // PERBAIKAN: Pastikan memeriksa properti di dalam user (misal: email atau id)
  // Ini menjamin jika session expired/kosong, isLoggedIn akan bernilai FALSE
  const isLoggedIn = !!req.auth?.user?.email; 
  const urlPath = nextUrl.pathname;

  // 1. PROTEKSI AREA DASHBOARD: JIKA BELUM LOGIN
  if (urlPath.startsWith('/dashboard') && !isLoggedIn) {
    // Gunakan nextUrl.clone() atau bersihkan response agar redirect bersih
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 2. JIKA AKSES HALAMAN UTAMA ('/')
  if (urlPath === '/') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } else {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 3. JIKA SUDAH LOGIN TAPI COBA-COBA AKSES /login
  if (urlPath === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 4. VALIDASI ROLE UNTUK SUB-DASHBOARD
  if (urlPath.startsWith('/dashboard') && isLoggedIn) {
    const userRole = req.auth?.user?.role?.toUpperCase();
    const matchedRoute = Object.keys(routePermissions).find((route) =>
      urlPath.startsWith(route)
    );

    if (matchedRoute) {
      const allowedRoles = routePermissions[matchedRoute];
      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard?error=unauthorized", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Tangkap semua rute kecuali file statis (images, favicon, dll)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};