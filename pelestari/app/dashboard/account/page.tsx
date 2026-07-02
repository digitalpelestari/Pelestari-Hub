"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  // Load data awal dari session login ke dalam form
  useEffect(() => {
    if (session?.user) {
      setNama(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/user/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, email, passwordBaru }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal memperbarui akun");
      }

      setStatusMsg({ type: "success", text: data.message });
      setPasswordBaru(""); 
      
      // === DISINI KUNCI AKTIFNYA SINKRONISASI LAYAR ===
      // Memaksa cookie NextAuth di browser memperbarui state saat ini juga tanpa reload halaman
      await update({
        user: {
          name: nama,
          email: email,
        }
      });
      
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Pengaturan Akun</h1>
        <p className="text-sm text-gray-500 mb-6">Perbarui informasi profil dan kata sandi akun Anda.</p>

        {statusMsg.text && (
          <div className={`p-4 mb-6 rounded-lg text-sm font-medium border ${
            statusMsg.type === "success" 
              ? "bg-green-50 text-green-700 border-green-200" 
              : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdateAccount} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Hak Akses / Role (Read-Only)</label>
            <input
              type="text"
              disabled
              value={session?.user?.role || ""}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 text-sm cursor-not-allowed font-medium"
            />
          </div>

          <hr className="border-gray-100 my-2" />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password Baru (Opsional)</label>
            <input
              type="password"
              placeholder="Biarkan kosong jika tidak ingin mengubah password"
              value={passwordBaru}
              onChange={(e) => setPasswordBaru(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>

        <hr className="border-gray-200 my-8" />

        <div className="rounded-lg border border-red-100 bg-red-50/50 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-900">Keluar dari Aplikasi</h3>
            <p className="text-xs text-red-700">Akhiri sesi login Anda di perangkat ini.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-4 py-2 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-sm"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}