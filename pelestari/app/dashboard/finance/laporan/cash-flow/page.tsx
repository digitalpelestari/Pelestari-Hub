"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Wrench, RefreshCw, Clock, ArrowLeft, Mail } from "lucide-react";

export default function MaintenancePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-700">
      {/* Background Decorative Element */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg text-center space-y-8">
        {/* Animated Badge Icon */}
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <Wrench className="w-10 h-10 text-blue-600 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pemeliharaan Sistem
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Kami Akan Segera Kembali
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Sistem saat ini sedang dalam peningkatan performa berkala dan pembaruan sistem database untuk pengalaman yang lebih optimal.
          </p>
        </div>

        {/* Status Box */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-left space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 pb-2">
            <span>Status Layanan</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Database Backup & Migration
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Estimasi Selesai</span>
            <span className="font-medium text-slate-700">~ 1–2 Jam</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-75 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Memeriksa Status..." : "Muat Ulang Halaman"}
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        {/* Footer Contact */}
        <div className="pt-4 border-t border-slate-200/60 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Mail className="w-3.5 h-3.5" />
          Butuh bantuan mendesak? Hubungi{" "}
          <a
            href="mailto:support@domain.com"
            className="text-blue-600 hover:underline font-medium"
          >
            Tim Support
          </a>
        </div>
      </div>
    </main>
  );
}