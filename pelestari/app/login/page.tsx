"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Panggil fungsi login bawaan NextAuth
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false, // Handle redirect manual agar transisinya smooth
    });

    if (res?.error) {
      setError("Email atau password salah!");
      setLoading(false);
    } else {
      try {
        // 2. AMBIL DATA USER AKTIF: Karena login sukses, kita panggil session saat ini 
        // untuk tahu role asli user yang baru saja masuk sebelum dilempar halaman.
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        
        const userRole = sessionData?.user?.role?.toUpperCase();

        // 3. LOGIKA REDIRECT BERDASARKAN ROLE (RBAC LANDING)
        if (userRole === "GA") {
          // Jika role-nya GA, langsung arahkan ke dashboard khusus purchase order
          router.push("/dashboard/ga");
        } else if (userRole === "FINANCE" || userRole === "MANAGER FINANCE") {
          // Jika rumpun finance, arahkan ke manajemen invoice
          router.push("/dashboard/finance");
        } else {
          // Fallback umum jika ada role lain atau admin biasa
          router.push("/dashboard");
        }

        router.refresh();
      } catch (err) {
        // Jika ada kendala jaringan saat fetch session data
        router.push("/dashboard");
        router.refresh();
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign In Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            PT Peduli Lestari Indonesia
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 font-medium border border-red-200">
              {error}
            </div>
          )}
          
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="nama@pelestari.id"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:bg-blue-400"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}