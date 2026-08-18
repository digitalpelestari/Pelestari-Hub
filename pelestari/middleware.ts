// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// redirect to login if not authenticated, or redirect to dashboard if already logged in
const routePermissions: Record<string, string[]> = {
  "/dashboard/finance": ["ADMIN", "MANAGER FINANCE", "FINANCE"],
  "/dashboard/purchase-order": ["ADMIN", "GA"], 
  "/dashboard/ga": ["ADMIN", "GA"],
  "/dashboard/admin": ["ADMIN"],
  "/dashboard/admin/finance": ["ADMIN"],
  "/dashboard/admin/ga": ["ADMIN"],  
};

function getDashboardUrl(role?: string) {
  const normalizedRole = role?.toUpperCase();

  if (normalizedRole === "GA") return "/dashboard/ga";
  if (normalizedRole === "ADMIN") return "/dashboard/admin";
  if (normalizedRole === "FINANCE" || normalizedRole === "MANAGER FINANCE") {
    return "/dashboard/finance";
  }

  return "/dashboard";
}

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
    // Keep the requested page so a successful sign-in can return the user to it.
    // Constructing this from NextURL also prevents an arbitrary external URL from
    // being accepted as a redirect destination.
    const loginUrl = nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("callbackUrl", `${urlPath}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2. JIKA AKSES HALAMAN UTAMA ('/')
  if (urlPath === '/') {
    if (isLoggedIn) {
      return NextResponse.redirect(
        new URL(getDashboardUrl(req.auth?.user?.role), req.url),
      );
    } else {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // `/dashboard` is only the landing page for ADMIN/default roles. Route the
  // role-specific users to their own dashboard and avoid a loop for ADMIN.
  if (urlPath === "/dashboard" && isLoggedIn) {
    const dashboardUrl = getDashboardUrl(req.auth?.user?.role);
    if (dashboardUrl !== "/dashboard") {
      return NextResponse.redirect(new URL(dashboardUrl, req.url));
    }
  }

  // 3. JIKA SUDAH LOGIN TAPI COBA-COBA AKSES /login
  if (urlPath === '/login' && isLoggedIn) {
    return NextResponse.redirect(
      new URL(getDashboardUrl(req.auth?.user?.role), req.url),
    );
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
