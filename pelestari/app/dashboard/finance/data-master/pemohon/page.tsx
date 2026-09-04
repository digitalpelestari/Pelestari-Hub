"use client"

import { useEffect, useState, useTransition } from "react"
import {
  getPemohon,
  createPemohon,
  updatePemohon,
  deletePemohon,
} from "@/app/actions/pemohon" // sesuaikan path import dengan lokasi file actions kamu

type Pemohon = {
  id: number
  nama_pemohon: string
}

export default function PemohonPage() {
  const [data, setData] = useState<Pemohon[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // form state
  const [nama, setNama] = useState("")
  const [editId, setEditId] = useState<number | null>(null)

  // ui state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Pemohon | null>(null)

  async function loadData() {
    setLoading(true)
    const rows = await getPemohon()
    setData(rows)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditId(null)
    setNama("")
    setErrorMsg("")
    setIsModalOpen(true)
  }

  function openEditModal(item: Pemohon) {
    setEditId(item.id)
    setNama(item.nama_pemohon)
    setErrorMsg("")
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setNama("")
    setEditId(null)
    setErrorMsg("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")

    startTransition(async () => {
      const result = editId
        ? await updatePemohon(editId, nama)
        : await createPemohon(nama)

      if (!result.success) {
        setErrorMsg(result.message ?? "Terjadi kesalahan")
        return
      }

      closeModal()
      await loadData()
    })
  }

  function confirmDelete(item: Pemohon) {
    setDeleteTarget(item)
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deletePemohon(deleteTarget.id)
      setDeleteTarget(null)
      await loadData()
    })
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Data Pemohon</h1>
        <button
          onClick={openCreateModal}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Tambah Pemohon
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="w-16 px-4 py-2">No</th>
              <th className="px-4 py-2">Nama Pemohon</th>
              <th className="w-40 px-4 py-2 text-center">Aksi</th>
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
                  Belum ada data pemohon
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{item.nama_pemohon}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(item)}
                        className="text-xs font-medium text-red-600 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editId ? "Edit Pemohon" : "Tambah Pemohon"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Nama Pemohon
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Masukkan nama pemohon"
                  autoFocus
                />
                {errorMsg && (
                  <p className="mt-1 text-xs text-red-600">{errorMsg}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Hapus Pemohon</h2>
            <p className="mb-4 text-sm text-gray-600">
              Yakin ingin menghapus{" "}
              <span className="font-medium">{deleteTarget.nama_pemohon}</span>?
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
