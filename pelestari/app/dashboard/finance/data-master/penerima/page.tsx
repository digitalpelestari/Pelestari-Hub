"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getPenerima,
  createPenerima,
  updatePenerima,
  deletePenerima,
} from "@/app/actions/penerima"; // sesuaikan path import dengan lokasi file actions kamu

type Penerima = {
  id: number;
  nama_penerima: string;
};
    
export default function PenerimaPage() {
  const [data, setData] = useState<Penerima[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // form state
  const [nama, setNama] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  // ui state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Penerima | null>(null);

  async function loadData() {
    setLoading(true);
    const rows = await getPenerima();
    setData(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditId(null);
    setNama("");
    setErrorMsg("");
    setIsModalOpen(true);
  }

  function openEditModal(item: Penerima) {
    setEditId(item.id);
    setNama(item.nama_penerima);
    setErrorMsg("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setNama("");
    setEditId(null);
    setErrorMsg("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    startTransition(async () => {
      const result = editId
        ? await updatePenerima(editId, nama)
        : await createPenerima(nama);

      if (!result.success) {
        setErrorMsg(result.message ?? "Terjadi kesalahan");
        return;
      }

      closeModal();
      await loadData();
    });
  }

  function confirmDelete(item: Penerima) {
    setDeleteTarget(item);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deletePenerima(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Data Penerima</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition"
        >
          + Tambah Penerima
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 w-16">No</th>
              <th className="px-4 py-2">Nama Penerima</th>
              <th className="px-4 py-2 w-40 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  Belum ada data penerima
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{item.nama_penerima}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(item)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editId ? "Edit Penerima" : "Tambah Penerima"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Nama Penerima
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan nama penerima"
                  autoFocus
                />
                {errorMsg && (
                  <p className="text-red-600 text-xs mt-1">{errorMsg}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm rounded-md border text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Hapus Penerima</h2>
            <p className="text-sm text-gray-600 mb-4">
              Yakin ingin menghapus{" "}
              <span className="font-medium">{deleteTarget.nama_penerima}</span>?
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-md border text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}