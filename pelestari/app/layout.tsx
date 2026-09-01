import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import AuthProvider from "@/components/Authprovider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Peduli Lestari Indonesia",
  description: "Sistem Manajemen Invoice PT Pelestari",
  icons: {
    icon: "/logo.png?v=1", 
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}