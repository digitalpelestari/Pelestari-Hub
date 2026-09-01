"use client";

import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
  Layers as LayersIcon,
  Calendar,
  MapPin,
  FileText,
  Users,
} from "lucide-react";

interface Batch {
  id: number;
  nama: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  lokasi: string | null;
  jumlah_peserta: number;
}

interface BatchForm {
  nama: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  lokasi: string;
}

const emptyForm: BatchForm = {
  nama: "",
  tanggal_mulai: "",
  tanggal_selesai: "",
  lokasi: "",
};

export default function BatchMasterPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/batch");
      const json = await res.json();
      if (json.success) setBatches(json.data);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Gagal memuat data batch",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setIsEditMode(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (b: Batch) => {
    setForm({
      nama: b.nama || "",
      tanggal_mulai: b.tanggal_mulai || "",
      tanggal_selesai: b.tanggal_selesai || "",
      lokasi: b.lokasi || "",
    });
    setIsEditMode(true);
    setEditingId(b.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Perhatian",
        text: "Nama batch wajib diisi",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const url = isEditMode && editingId ? `/api/batch?id=${editingId}` : "/api/batch";
      const method = isEditMode ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        await fetchBatches();
        closeModal();
        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: isEditMode ? "Batch berhasil diperbarui." : "Batch baru berhasil dibuat.",
          timer: 2000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: (isEditMode ? "Gagal memperbarui batch: " : "Gagal membuat batch: ") +
            (result.error || "unknown error"),
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: "Terjadi kesalahan saat menyimpan batch",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (b: Batch) => {
    const confirm = await Swal.fire({
      title: "Hapus Batch?",
      text: `Batch "${b.nama}" dan ${b.jumlah_peserta} peserta di dalamnya akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/batch?id=${b.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        await fetchBatches();
        await Swal.fire({
          icon: "success",
          title: "Terhapus!",
          text: result.message || "Batch berhasil dihapus.",
          timer: 2000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: "Gagal menghapus batch: " + (result.error || "unknown error"),
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: "Terjadi kesalahan saat menghapus batch",
      });
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return "-";
    const date = new Date(s);
    if (isNaN(date.getTime())) return s;
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.nama.toLowerCase().includes(q) ||
      (b.lokasi || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <LayersIcon className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Master Batch Pelatihan
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kelola daftar batch pelatihan beserta periode dan lokasi.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Batch</span>
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama batch atau lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total: {filtered.length} batch
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3.5 text-center w-12">No</th>
                <th className="px-4 py-3.5">Nama Batch</th>
                <th className="px-4 py-3.5">Periode</th>
                <th className="px-4 py-3.5">Lokasi</th>
                <th className="px-4 py-3.5 text-center">Peserta</th>
                <th className="px-4 py-3.5 text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Memuat data batch...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>Belum ada batch. Klik <b>Tambah Batch</b> untuk membuat.</span>
                  </td>
                </tr>
              ) : (
                filtered.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{b.nama}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(b.tanggal_mulai)} s/d {formatDate(b.tanggal_selesai)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {b.lokasi || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                        <Users className="w-3 h-3" />
                        {b.jumlah_peserta}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          title="Edit Batch"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
                          title="Hapus Batch"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {isEditMode ? "Edit Batch" : "Tambah Batch Baru"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEditMode
                    ? "Perbarui informasi batch pelatihan."
                    : "Tambahkan batch pelatihan baru ke dalam sistem."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Nama Batch *
                </label>
                <input
                  type="text"
                  required
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                  placeholder="Contoh: Batch XII - Surabaya"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={form.tanggal_mulai}
                    onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={form.tanggal_selesai}
                    onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Lokasi
                </label>
                <input
                  type="text"
                  value={form.lokasi}
                  onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  placeholder="Lokasi / Site pelatihan"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? "Simpan Perubahan" : "Simpan Batch"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}