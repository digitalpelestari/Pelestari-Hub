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
  const isLoggedIn = !!req.auth;
  const urlPath = nextUrl.pathname;

  // 1. JIKA USER MENGAKSES HALAMAN UTAMA ('/')
  if (urlPath === '/') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } else {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 2. JIKA USER SUDAH LOGIN TAPI MENCOBA AKSES HALAMAN LOGIN LAGI
  if (urlPath === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Pengecualian: Jika mengakses halaman login, biarkan lolos tanpa dicegat di bawah
  if (urlPath === '/login') {
    return NextResponse.next();
  }

  // 3. PROTEKSI UMUM: JIKA BELUM LOGIN DAN MENCOBA AKSES AREA DASHBOARD
  if (!isLoggedIn && urlPath.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 4. VALIDASI ROLE UNTUK SUB-DASHBOARD
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

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',
    '/login',            // <-- Masukkan login ke matcher agar bisa kita kontrol jika sudah login
    '/dashboard/:path*',
  ],
};