import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 1. DAFTAR MATRIKS HAK AKSES (ROLE MAPPING)
const routePermissions: Record<string, string[]> = {
  "/dashboard/finance": ["ADMIN", "MANAGER FINANCE", "FINANCE"],
  "/dashboard/purchase-order": ["ADMIN", "GA"], 
  "/dashboard/ga": ["ADMIN", "GA"],
  "/dashboard/admin": ["ADMIN"],
};

// 2. IMPORT INSTANCE AUTH YANG SUDAH KITA BUAT SEBELUMNYA
// Pastikan path ke file auth.ts utama kamu sudah benar
import { auth } from "./auth"; 

// @ts-ignore
export default auth(async function middleware(req: NextRequest & { auth: any }) {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth; // Cek apakah session ada
  const urlPath = nextUrl.pathname;

  // PENGAMAN 1: Jika belum login dan mencoba mengakses rute /dashboard, tendang ke /login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Ambil role dari session user
  const userRole = req.auth?.user?.role?.toUpperCase();

  // 3. PROSES PENGECEKAN HAK AKSES ROLE
  const matchedRoute = Object.keys(routePermissions).find((route) =>
    urlPath.startsWith(route)
  );

  if (matchedRoute) {
    const allowedRoles = routePermissions[matchedRoute];

    // JIKA ROLE USER TIDAK TERDAFTAR DI KELOMPOK YANG DIPERBOLEHKAN
    if (!userRole || !allowedRoles.includes(userRole)) {
      // Blokir aksesnya dan alihkan balik ke halaman dashboard utama dengan indikator error
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized", req.url));
    }
  }

  return NextResponse.next();
});

// 4. JALUR YANG DILINDUNGI
export const config = {
  matcher: [
    "/dashboard/:path*", // Mengunci folder dashboard beserta seluruh sub-folder di dalamnya
  ],
};