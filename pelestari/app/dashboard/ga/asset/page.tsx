"use client"

import React, { useState, useEffect } from "react"
import {
  Plus,
  X,
  FileSpreadsheet,
  ClipboardList,
  Trash2,
  Search,
  Filter,
  Pencil,
} from "lucide-react"
// IMPORT DIPERBARUI: Menambahkan updateAssetKondisiAction dari Server Action Backend
import {
  getAssetsAction,
  createAssetAction,
  updateAssetAction,
  deleteAssetAction,
  updateAssetKondisiAction,
} from "@/app/actions/asset"
import { exportAssetToExcelGA } from "@/app/utils/assetExport"
import { swal } from "@/lib/sweetalert"

export default function GaAssetPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null) // State loading inline per baris

  // === STATE FILTER & SEARCHING ===
  const [searchQuery, setSearchQuery] = useState("")
  const [filterJenis, setFilterJenis] = useState("Semua")
  const [editingId, setEditingId] = useState<number | null>(null)

  // === STATE FORM INPUT ===
  const [namaAsset, setNamaAsset] = useState("")
  const [kelompok, setKelompok] = useState("1")
  const [kodeAsset, setKodeAsset] = useState("")
  const [jenisAsset, setJenisAsset] = useState("Aset Tetap")
  const [bulanPerolehan, setBulanPerolehan] = useState("Januari")
  const [tahunPerolehan, setTahunPerolehan] = useState<number | "">("")
  const [hargaBeli, setHargaBeli] = useState("")
  const [caraPerolehan, setCaraPerolehan] = useState("cash")
  const [jumlah, setJumlah] = useState(1)
  const [keterangan, setKeterangan] = useState("")
  const [kondisi, setKondisi] = useState("Baik")

  useEffect(() => {
    fetchAssets()
    setTahunPerolehan(new Date().getFullYear())
  }, [])

  const fetchAssets = async () => {
    const res = await getAssetsAction(false)
    if (res.success) setAssets(res.data)
  }

  // === LOGIC FILTER & SEARCHING DATA ASET ===
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.nama_asset?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.kode_asset?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterJenis === "Semua" || asset.jenis_asset === filterJenis

    return matchesSearch && matchesFilter
  })

  const handleEditAsset = (asset: any) => {
    setEditingId(asset.id_asset)

    setNamaAsset(asset.nama_asset || "")
    setKelompok(String(asset.kelompok || "1"))
    setKodeAsset(asset.kode_asset || "")
    setJenisAsset(asset.jenis_asset || "Aset Tetap")
    setBulanPerolehan(asset.bulan_perolehan || "Januari")
    setTahunPerolehan(Number(asset.tahun_perolehan) || new Date().getFullYear())
    setHargaBeli(String(asset.harga_beli || ""))
    setCaraPerolehan(asset.cara_perolehan || "cash")
    setJumlah(Number(asset.jumlah) || 1)
    setKeterangan(asset.keterangan || "")
    setKondisi(asset.kondisi || "Baik")

    setIsModalOpen(true)
  }

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      nama_asset: namaAsset,
      kode_asset: kodeAsset,
      jenis_asset: jenisAsset,
      bulan_perolehan: bulanPerolehan,
      tahun_perolehan: Number(tahunPerolehan),
      harga_beli: hargaBeli,
      cara_perolehan: caraPerolehan,
      jumlah: jumlah,
      kelompok: kelompok,
      keterangan: keterangan,
      kondisi: kondisi,
    }

    const res =
      editingId !== null
        ? await updateAssetAction(editingId, payload)
        : await createAssetAction(payload)

    if (res.success) {
      swal.success(
        editingId !== null
          ? "Data aset berhasil diperbarui"
          : "Aset berhasil ditambahkan"
      )

      setIsModalOpen(false)
      setEditingId(null)

      setNamaAsset("")
      setKodeAsset("")
      setJenisAsset("Aset Tetap")
      setHargaBeli("")
      setJumlah(1)
      setKelompok("1")
      setKeterangan("")
      setKondisi("Baik")

      fetchAssets()
    } else {
      swal.error(res.message)
    }

    setLoading(false)
  }

  // === FUNGSI INLINE EDIT KONDISI BARANG (SUDAH AKTIF KE DATABASE) ===
  const handleInlineChangeKondisi = async (
    id_asset: number,
    kondisiBaru: string
  ) => {
    setUpdatingId(id_asset)

    // Optimistic Update UI (Biar kerasa instan di mata user sebelum network selesai)
    const originalAssets = [...assets]
    setAssets(
      assets.map((a) =>
        a.id_asset === id_asset ? { ...a, kondisi: kondisiBaru } : a
      )
    )

    try {
      // Menjalankan fungsi server action untuk update kondisi ke MySQL
      const res = await updateAssetKondisiAction(id_asset, kondisiBaru)

      if (!res.success) {
        throw new Error(res.message)
      }

      // Sinkronisasi ulang data agar selaras dengan database terbaru
      fetchAssets()
    } catch (error: any) {
      swal.error("Gagal memperbarui kondisi ke database: " + error.message)
      setAssets(originalAssets) // Kembalikan ke kondisi asal jika query gagal/error
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteAsset = async (id_asset: number, nama_asset: string) => {
    const konfirmasi = await swal.confirm(
      `Apakah Anda yakin ingin menghapus aset "${nama_asset}"? Data di menu Finance juga akan ikut terhapus.`
    )
    if (!konfirmasi) return

    const res = await deleteAssetAction(id_asset)
    if (res.success) {
      swal.success("Aset berhasil dihapus")
      fetchAssets()
    } else {
      swal.error("Gagal menghapus aset: " + res.message)
    }
  }

  const getKondisiSelectStyle = (statusKondisi: string) => {
    switch (statusKondisi) {
      case "Baik":
        return "text-green-700 font-bold bg-green-50 border-green-200"
      case "Rusak":
        return "text-red-700 font-bold bg-red-50 border-red-200"
      case "Perlu Perbaikan":
        return "text-amber-700 font-bold bg-amber-50 border-amber-200"
      case "Tidak Layak Pakai":
        return "text-zinc-700 font-bold bg-zinc-100 border-zinc-300"
      default:
        return "text-zinc-600 bg-zinc-50 border-zinc-200"
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 font-sans text-xs">
      {/* HEADER UTAMA */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 uppercase">
            General Affairs: Registrasi Inventaris
          </h1>
          <p className="text-[11px] text-zinc-500">
            Input data master aset logistik kantor PT Peduli Lestari Indonesia
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportAssetToExcelGA(filteredAssets)}
            className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 font-bold whitespace-nowrap text-white shadow"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Cetak Excel GA
          </button>
          <button
            onClick={() => {
              setEditingId(null)
              setNamaAsset("")
              setKodeAsset("")
              setJenisAsset("Aset Tetap")
              setKelompok("1")
              setBulanPerolehan("Januari")
              setTahunPerolehan(new Date().getFullYear())
              setHargaBeli("")
              setCaraPerolehan("cash")
              setJumlah(1)
              setKeterangan("")
              setKondisi("Baik")
              setIsModalOpen(true)
            }}
            className="flex items-center gap-1 rounded bg-blue-600 px-4 py-2 font-bold whitespace-nowrap text-white shadow"
          >
            <Plus className="h-4 w-4" /> Tambah Aset Baru
          </button>
        </div>
      </div>

      {/* PANEL CONTROL: SEARCHING & FILTERING */}
      <div className="mb-6 flex flex-col items-center gap-3 rounded border border-zinc-200 bg-zinc-50 p-3 shadow-sm md:flex-row">
        <div className="relative w-full md:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari nama barang atau kode aset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white py-2 pr-3 pl-8 font-medium text-zinc-800 focus:outline-zinc-400"
          />
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <span className="flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-zinc-500 uppercase">
            <Filter className="h-3 w-3 text-zinc-400" /> Klasifikasi:
          </span>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="w-full cursor-pointer rounded border border-zinc-300 bg-white p-2 font-semibold text-zinc-800 focus:outline-none md:w-44"
          >
            <option value="Semua">Semua Aset</option>
            <option value="Aset Tetap">Aset Tetap</option>
            <option value="Aset Non-Tetap">Aset Non-Tetap</option>
          </select>
        </div>

        <div className="text-[11px] font-medium whitespace-nowrap text-zinc-500 md:ml-auto">
          Menampilkan{" "}
          <span className="font-bold text-zinc-800">
            {filteredAssets.length}
          </span>{" "}
          dari {assets.length} total aset
        </div>
      </div>

      {/* TABEL MASTER DATA ASET */}
      <div className="overflow-hidden rounded border bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b bg-zinc-100 font-bold text-zinc-800 uppercase">
            <tr>
              <th className="w-12 p-3 text-center">No</th>
              <th>Nama Asset</th>
              <th className="p-3 text-center">Kelompok</th>
              <th className="p-3 text-center">Kode</th>
              <th className="p-3 text-center">Jenis Aset</th>
              <th className="p-3 text-center">Bulan / Tahun</th>
              <th className="p-3 text-right">Harga Beli</th>
              <th className="p-3 text-center">Perolehan</th>
              <th className="p-3 text-center">Jumlah</th>
              <th>Keterangan</th>
              <th className="w-36 p-3 text-center">Kondisi (Bisa Edit)</th>
              <th className="w-16 p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAssets.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center font-medium text-zinc-400"
                >
                  {assets.length === 0
                    ? "Belum ada data inventaris aset yang terdaftar."
                    : "Tidak ada data aset yang cocok dengan kriteria pencarian/filter."}
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset, index) => (
                <tr
                  key={asset.id_asset}
                  className="align-middle hover:bg-zinc-50"
                >
                  <td className="p-3 text-center font-bold text-zinc-400">
                    {index + 1}
                  </td>
                  <td className="p-3 font-semibold text-zinc-900">
                    {asset.nama_asset}
                  </td>
                  <td className="p-3 text-center font-medium">
                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                      {asset.kelompok || "1"}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-medium">
                    {asset.kode_asset || "-"}
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold ${
                        asset.jenis_asset === "Aset Tetap"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {asset.jenis_asset || "Aset Tetap"}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    {asset.bulan_perolehan} {asset.tahun_perolehan}
                  </td>
                  <td className="p-3 text-right font-bold text-zinc-900">
                    Rp {Number(asset.harga_beli).toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-center uppercase">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px]">
                      {asset.cara_perolehan}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold">{asset.jumlah}</td>
                  <td className="p-3 font-medium text-zinc-600">
                    {asset.keterangan || "-"}
                  </td>

                  {/* EDITABLE SELECT DROPDOWN (SUDAH TERHUBUNG BE ACTION) */}
                  <td className="p-2 text-center">
                    <select
                      value={asset.kondisi || "Baik"}
                      disabled={updatingId === asset.id_asset}
                      onChange={(e) =>
                        handleInlineChangeKondisi(
                          asset.id_asset,
                          e.target.value
                        )
                      }
                      className={`w-full cursor-pointer rounded border p-1 text-center text-[10px] transition-all focus:outline-none ${getKondisiSelectStyle(asset.kondisi)}`}
                    >
                      <option
                        value="Baik"
                        className="bg-white font-medium text-green-700"
                      >
                        Baik
                      </option>
                      <option
                        value="Perlu Perbaikan"
                        className="bg-white font-medium text-amber-700"
                      >
                        Perlu Perbaikan
                      </option>
                      <option
                        value="Rusak"
                        className="bg-white font-medium text-red-700"
                      >
                        Rusak
                      </option>
                      <option
                        value="Tidak Layak Pakai"
                        className="bg-white font-medium text-zinc-700"
                      >
                        Tidak Layak Pakai
                      </option>
                    </select>
                  </td>

                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEditAsset(asset)}
                        className="rounded border border-blue-200 p-1.5 text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50"
                        title="Edit Data Aset"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteAsset(asset.id_asset, asset.nama_asset)
                        }
                        className="rounded border border-red-200 p-1.5 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
                        title="Hapus Data Aset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DIALOG MODAL GA INPUT FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded bg-white shadow-xl">
            {/* HEADER MODAL */}
            <div className="flex items-center justify-between bg-zinc-900 px-5 py-3 font-bold text-white uppercase">
              <span className="flex items-center gap-1.5">
                {editingId !== null ? (
                  <Pencil className="h-4 w-4 text-blue-400" />
                ) : (
                  <ClipboardList className="h-4 w-4 text-blue-400" />
                )}

                {editingId !== null ? "Edit Data Aset" : "Form Registrasi Aset"}
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingId(null)
                }}
                className="rounded p-1 hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSaveAsset} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Nama Aset / Barang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CCTV rumah ibu maya"
                  value={namaAsset}
                  onChange={(e) => setNamaAsset(e.target.value)}
                  className="w-full rounded border p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Kode Aset
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: LK.01"
                    value={kodeAsset}
                    onChange={(e) => setKodeAsset(e.target.value)}
                    className="w-full rounded border p-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Jenis Klasifikasi *
                  </label>
                  <select
                    value={jenisAsset}
                    onChange={(e) => setJenisAsset(e.target.value)}
                    className="w-full cursor-pointer rounded border bg-white p-2 font-semibold focus:outline-zinc-400"
                  >
                    <option value="Aset Tetap">Aset Tetap</option>
                    <option value="Aset Non-Tetap">Aset Non-Tetap</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Kelompok *
                  </label>
                  <select
                    value={kelompok}
                    onChange={(e) => setKelompok(e.target.value)}
                    required
                    className="w-full cursor-pointer rounded border bg-white p-2 font-semibold focus:outline-zinc-400"
                  >
                    <option value="1">Kelompok 1</option>
                    <option value="2">Kelompok 2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Bulan Perolehan
                  </label>
                  <select
                    value={bulanPerolehan}
                    onChange={(e) => setBulanPerolehan(e.target.value)}
                    className="w-full cursor-pointer rounded border bg-white p-2"
                  >
                    {[
                      "Januari",
                      "Februari",
                      "Maret",
                      "April",
                      "Mei",
                      "Juni",
                      "Juli",
                      "Agustus",
                      "September",
                      "Oktober",
                      "November",
                      "Desember",
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Tahun Perolehan *
                  </label>
                  <input
                    type="number"
                    required
                    value={tahunPerolehan}
                    onChange={(e) =>
                      setTahunPerolehan(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full rounded border p-2 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block font-bold text-zinc-700">
                    Harga Beli Total (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Nominal"
                    value={hargaBeli}
                    onChange={(e) => setHargaBeli(e.target.value)}
                    className="w-full rounded border p-2 text-right font-semibold"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Jumlah Unit *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={jumlah}
                    onChange={(e) => setJumlah(Number(e.target.value))}
                    className="w-full rounded border p-2 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Cara Perolehan
                  </label>
                  <select
                    value={caraPerolehan}
                    onChange={(e) => setCaraPerolehan(e.target.value)}
                    className="w-full cursor-pointer rounded border bg-white p-2 font-bold"
                  >
                    <option value="cash">CASH</option>
                    <option value="Kredit">KREDIT</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Kondisi Barang *
                  </label>
                  <select
                    value={kondisi}
                    onChange={(e) => setKondisi(e.target.value)}
                    className="w-full cursor-pointer rounded border bg-white p-2 font-semibold focus:outline-zinc-400"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Tidak Layak Pakai">Tidak Layak Pakai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Keterangan Catatan / Lokasi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: R.Arsip / Di rumah ibu maya"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full rounded border p-2"
                />
              </div>

              {/* FOOTER FORM */}
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingId(null)
                  }}
                  className="rounded border px-4 py-2 font-semibold text-zinc-600"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-5 py-2 font-bold text-white shadow"
                >
                  {loading
                    ? "Menyimpan..."
                    : editingId !== null
                      ? "Simpan Perubahan"
                      : "Simpan Berkas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
