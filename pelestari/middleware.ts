// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config"; // <-- UBAH KE SINI

const routePermissions: Record<string, string[]> = {
  "/dashboard/finance": ["ADMIN", "MANAGER FINANCE", "FINANCE"],
  "/dashboard/purchase-order": ["ADMIN", "GA"], 
  "/dashboard/ga": ["ADMIN", "GA"],
  "/dashboard/admin": ["ADMIN"],
};
// 13 |
// 14 | // Inisialisasi auth khusus middleware dari config yang ramah Edge
// @ts-ignore
const { auth } = NextAuth(authConfig);
// 16 |
export default auth(async function middleware(req: NextRequest & { auth: any }) {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const urlPath = nextUrl.pathname;

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

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
    "/dashboard/:path*",
  ],
};