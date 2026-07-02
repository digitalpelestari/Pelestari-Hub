import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// 1. DAFTAR MATRIKS HAK AKSES (ROLE MAPPING)
// Tentukan path folder dan role apa saja yang DIPERBOLEHKAN masuk ke sana
const routePermissions: Record<string, string[]> = {
  "/dashboard/finance": ["ADMIN", "MANAGER FINANCE", "FINANCE"],
  "/dashboard/purchase-order": ["ADMIN", "GA"], // Khusus GA dan Admin
  "/dashboard/ga": ["ADMIN", "GA"],
  "/dashboard/admin": ["ADMIN"],
};

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    // Mengambil role dari token NextAuth dan mengubahnya ke huruf besar agar pengecekan konsisten
    const userRole = (token?.role as string)?.toUpperCase();
    const urlPath = req.nextUrl.pathname;

    // 2. PROSES PENGECEKAN HAK AKSES ROLE
    // Mencari apakah URL yang sedang diakses saat ini cocok dengan daftar di routePermissions
    const matchedRoute = Object.keys(routePermissions).find((route) =>
      urlPath.startsWith(route)
    );

    if (matchedRoute) {
      const allowedRoles = routePermissions[matchedRoute];

      // JIKA ROLE USER TIDAK TERDAFTAR DI KELOMPOK YANG DIPERBOLEHKAN
      if (!allowedRoles.includes(userRole)) {
        // Blokir aksesnya dan alihkan balik ke halaman dashboard utama dengan indikator error
        return NextResponse.redirect(new URL("/dashboard?error=unauthorized", req.url));
      }
    }
  },
  {
    callbacks: {
      // Fungsi authorized ini memastikan middleware hanya berjalan jika token JWT sudah ada (sudah login)
      authorized: ({ token }) => !!token,
    },
    pages: {
      // Jika user belum login sama sekali, otomatis ditendang balik ke halaman ini
      signIn: "/login",
    },
  }
);

// 3. JALUR YANG DILINDUNGI
export const config = {
  matcher: [
    "/dashboard/:path*", // Mengunci folder dashboard beserta seluruh sub-folder di dalamnya
  ],
};