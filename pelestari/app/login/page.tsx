// app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Panggil fungsi login bawaan NextAuth dengan email yang sudah di-trim
    const res = await signIn("credentials", {
      email: email.trim(),
      password: password,
      redirect: false, // Handle redirect manual agar transisinya smooth
    });

    // MENANGKAP ERROR ASLI DARI BACKEND
    if (res?.error) {
      setLoading(false);
      
      // Jika error berupa kode internal standar NextAuth, buat fallback yang ramah
      if (res.error === "CredentialsSignin" || res.error.includes("CallbackRouteError")) {
        setError("Email atau password yang Anda masukkan salah.");
      } else {
        // Menampilkan pesan spesifik yang dikirim lewat 'throw new Error' di auth.ts
        setError(res.error);
      }
    } else {
      try {
        // 2. AMBIL DATA USER AKTIF: Panggil session untuk tahu role user
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        
        const userRole = sessionData?.user?.role?.toUpperCase();

        // Accept only an internal dashboard URL. This prevents an open redirect
        // when callbackUrl is supplied manually in the browser.
        const requestedPath = searchParams.get("callbackUrl");
        const callbackUrl =
          requestedPath?.startsWith("/dashboard") && !requestedPath.startsWith("//")
            ? requestedPath
            : null;

        // 3. LOGIKA REDIRECT BERDASARKAN ROLE (RBAC LANDING)
        let defaultDestination = "/dashboard";
        if (userRole === "GA") {
          defaultDestination = "/dashboard/ga";
        } else if (userRole === "FINANCE" || userRole === "MANAGER FINANCE") {
          defaultDestination = "/dashboard/finance";
        }

        router.replace(callbackUrl ?? defaultDestination);
        router.refresh();
      } catch (err) {
        // Fallback jika ada gangguan fetch session data
        router.replace("/login");
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
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 font-medium border border-red-200 text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                placeholder="nama@pelestari.id"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
              <input
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}
