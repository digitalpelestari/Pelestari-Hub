// app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Laptop, Mail, Sparkles } from "lucide-react";

// Custom SVG Icons untuk Footer Media Sosial
function FacebookIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: email.trim(),
      password: password,
      redirect: false,
    });

    if (res?.error) {
      setLoading(false);
      if (res.error === "CredentialsSignin" || res.error.includes("CallbackRouteError")) {
        setError("Email atau password yang Anda masukkan salah.");
      } else {
        setError(res.error);
      }
    } else {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        const userRole = sessionData?.user?.role?.toUpperCase();

        const requestedPath = searchParams.get("callbackUrl");
        const callbackUrl =
          requestedPath?.startsWith("/dashboard") && !requestedPath.startsWith("//")
            ? requestedPath
            : null;

        let defaultDestination = "/dashboard";
        if (userRole === "GA") {
          defaultDestination = "/dashboard/ga";
        } else if (userRole === "FINANCE" || userRole === "MANAGER FINANCE") {
          defaultDestination = "/dashboard/finance";
        }

        router.replace(callbackUrl ?? defaultDestination);
        router.refresh();
      } catch (err) {
        router.replace("/login");
        router.refresh();
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans">
      
      {/* PANEL KIRI (BLUE ARTWORK & BRANDING) */}
      <div className="relative hidden md:flex md:w-5/12 lg:w-1/2 flex-col justify-between bg-[#2F65F6] p-10 lg:p-14 text-white">
        {/* Background Decorative Shapes */}
        <div className="absolute top-16 left-12 h-24 w-48 rounded-full bg-white/10 blur-sm pointer-events-none" />
        <div className="absolute top-24 right-16 h-16 w-36 rounded-full bg-white/10 blur-sm pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-blue-700/40 pointer-events-none" />

        {/* Brand Title Atas */}
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white/95">
            PT Peduli Lestari Indonesia
          </h1>
        </div>

        {/* Area Ilustrasi Vektor */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
          <div className="relative flex flex-col items-center">
            <div className="relative flex h-64 w-80 items-center justify-center scale-125">
              {/* Glow & Sparkles */}
              <div className="absolute -top-4 right-12 flex items-center gap-1 text-yellow-300 animate-pulse">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="absolute top-10 left-4 h-14 w-16 rounded bg-blue-400/40" />

              {/* Desk Base */}
              <div className="absolute bottom-4 h-20 w-60 rounded-lg bg-[#1B3E9B] shadow-inner flex flex-col justify-around p-2.5">
                <div className="h-4 w-24 bg-[#254DBF] rounded-sm self-start ml-2" />
                <div className="h-4 w-24 bg-[#254DBF] rounded-sm self-start ml-2" />
              </div>

              {/* Mailbox Icon */}
              <div className="absolute bottom-6 -left-4 flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-t-xl bg-[#142A68] text-white shadow-md">
                  <Mail className="h-5 w-5 text-yellow-300" />
                </div>
                <div className="h-14 w-2 bg-blue-900" />
              </div>

              {/* Character Silhouette & Laptop */}
              <div className="relative -top-2 flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-zinc-900" />
                <div className="h-14 w-20 rounded-t-2xl bg-yellow-400 -mt-2 shadow-sm" />
                <div className="h-12 w-24 rounded-b-xl bg-blue-300 -mt-1 flex items-center justify-center">
                  <Laptop className="h-8 w-8 text-white drop-shadow" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Panel Kiri */}
        <div className="relative z-10 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-6 text-blue-200">
            <span className="cursor-pointer hover:text-white transition-colors">
              <FacebookIcon className="h-5 w-5" />
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              <LinkedinIcon className="h-5 w-5" />
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              <InstagramIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="text-sm text-blue-100/90 font-normal">
            <p>© PT Peduli Lestari Indonesia</p>
            <p>All rights reserved</p>
          </div>
        </div>
      </div>

      {/* PANEL KANAN (FORM LOGIN - BIG FONT) */}
      <div className="flex w-full md:w-7/12 lg:w-1/2 flex-col justify-center items-center p-8 sm:p-14 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-lg space-y-10">
          
          {/* Header Title */}
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
              Sign in
            </h2>
            <p className="mt-2 text-base text-zinc-500 font-medium">
              Masukkan email dan password akun Anda untuk masuk ke dashboard.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-center text-sm font-semibold text-red-600 border border-red-200 shadow-sm">
              {error}
            </div>
          )}

          <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
            {/* Input Email (Underline Style - Font Besar) */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold  tracking-wider text-zinc-400 block">
                Username / Email
              </label>
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@pelestari.id"
                className="w-full border-b-2 border-zinc-200 py-3 text-lg font-medium text-zinc-900 placeholder-zinc-300 outline-none focus:border-[#2F65F6] transition-colors disabled:bg-transparent"
              />
            </div>

            {/* Input Password (Underline Style - Font Besar) */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold tracking-wider text-zinc-400 block">
                Password
              </label>
              <input
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border-b-2 border-zinc-200 py-3 text-lg font-medium text-zinc-900 placeholder-zinc-300 outline-none focus:border-[#2F65F6] transition-colors disabled:bg-transparent tracking-widest"
              />
            </div>

            {/* Remember Me Only */}
            <div className="flex items-center pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded-md border-zinc-300 text-[#2F65F6] focus:ring-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-zinc-600">Remember me</span>
              </label>
            </div>

            {/* Tombol Sign In (Besar & Tegas) */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-3 rounded-full bg-[#2F65F6] px-10 py-4 text-base font-bold text-white shadow-xl shadow-blue-500/25 hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
              >
                <span>{loading ? "Signing in..." : "Sign in"}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </form>

        </div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}