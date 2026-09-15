"use client"

import React, { useState, useEffect } from "react"
import {
  Plus,
  X,
  Trash2,
  ClipboardList,
  Activity,
  BarChart3,
  Filter,
} from "lucide-react"
import {
  getUtilitiesAction,
  createUtilityAction,
  deleteUtilityAction,
} from "@/app/actions/utility"
import { swal } from "@/lib/sweetalert"

export default function GaUtilitiesPage() {
  const [records, setRecords] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // === STATE FILTER BULANAN & JENIS ===
  const [filterUtility, setFilterJenis] = useState("Semua")

  // === STATE FORM INPUT ===
  const [namaUtility, setNamaUtility] = useState("PLN/Listrik")
  const [bulan, setBulan] = useState("Januari")
  const [tahun, setTahun] = useState<number | "">("")
  const [nominal, setNominal] = useState("")
  const [tanggalBayar, setTanggalBayar] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [keterangan, setKeterangan] = useState("")

  useEffect(() => {
    fetchRecords()
    setTahun(new Date().getFullYear())
  }, [])

  const fetchRecords = async () => {
    const res = await getUtilitiesAction()
    if (res.success) setRecords(res.data)
  }

  // === LOGIC FILTER DATA UNTUK TABEL & GRAFIK ===
  const filteredRecords = records.filter((rec) => {
    return filterUtility === "Semua" || rec.nama_utility === filterUtility
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      nama_utility: namaUtility,
      bulan,
      tahun: Number(tahun),
      nominal: Number(nominal),
      tanggal_bayar: tanggalBayar,
      keterangan,
    }

    const res = await createUtilityAction(payload)
    if (res.success) {
      swal.success("Tagihan utilitas berhasil dicatat")
      setIsModalOpen(false)
      setNominal("")
      setKeterangan("")
      fetchRecords()
    } else {
      swal.error(res.message)
    }
    setLoading(false)
  }

  const handleDelete = async (id: number, nama: string, bln: string) => {
    const konfirmasi = await swal.confirm(
      `Hapus catatan pembayaran ${nama} bulan ${bln}?`
    )
    if (!konfirmasi) return

    const res = await deleteUtilityAction(id)
    if (res.success) {
      swal.success("Catatan pembayaran berhasil dihapus")
      fetchRecords()
    } else {
      swal.error(res.message)
    }
  }

  // Balik urutan khusus untuk tampilan grafik batang dari kiri-ke-kanan / atas-ke-bawah (kronologis waktu lama ke baru)
  const chartRecords = [...filteredRecords].reverse()

  // Ambil batas tertinggi nominal dari data yang sudah terfilter sebagai basis pembagi lebar bar
  const maxNominal =
    chartRecords.length > 0
      ? Math.max(...chartRecords.map((r) => Number(r.nominal)))
      : 1

  return (
    <div className="mx-auto max-w-7xl p-6 font-sans text-xs">
      {/* HEADER UTAMA */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-zinc-900 uppercase">
            <Activity className="h-5 w-5 text-blue-600" /> GA: Tracking
            Pembayaran Utilitas
          </h1>
          <p className="text-[11px] text-zinc-500">
            Analisis pengeluaran bulanan tagihan PLN, Air, dan internet kantor
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="animate-fade-in flex items-center gap-1 rounded bg-blue-600 px-4 py-2 font-bold text-white shadow transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Catat Tagihan Baru
        </button>
      </div>
      {/* PANEL CONTROL FILTER UTILLITAS */}
      <div className="mb-6 flex flex-col items-center gap-3 rounded border border-zinc-200 bg-zinc-50 p-3 shadow-sm sm:flex-row">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-zinc-500 uppercase">
            <Filter className="h-3 w-3 text-zinc-400" /> Jenis Utilitas:
          </span>
          <select
            value={filterUtility}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="w-full cursor-pointer rounded border border-zinc-300 bg-white p-2 text-xs font-semibold text-zinc-800 focus:outline-none sm:w-48"
          >
            <option value="Semua">Semua Utilitas</option>
            <option value="PLN/Listrik">PLN / Listrik</option>
            <option value="PDAM/Air">PDAM / Air Bersih</option>
            <option value="WiFi/Internet">WiFi / Internet</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        {/* Info Total Log */}
        <div className="text-[11px] font-medium whitespace-nowrap text-zinc-500 sm:ml-auto">
          Menampilkan{" "}
          <span className="font-bold text-zinc-800">
            {filteredRecords.length}
          </span>{" "}
          dari {records.length} total baris log
        </div>
      </div>
      {/* TABEL REKAP BULANAN */}
      <div className="mb-6 overflow-hidden rounded border bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="border-b bg-zinc-100 text-[11px] font-bold text-zinc-800 uppercase">
            <tr>
              <th className="w-12 p-3 text-center">No</th>
              <th className="p-3">Jenis Utilitas</th>
              <th className="p-3 text-center">Periode Buku</th>
              <th className="p-3 text-center">Tanggal Bayar</th>
              <th className="p-3 text-right">Biaya Tagihan</th>
              <th className="p-3">Keterangan / Catatan</th>
              <th className="w-16 p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y font-medium text-zinc-700">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  {records.length === 0
                    ? "Belum ada rekam tagihan utilitas yang di-input."
                    : "Tidak ada catatan tagihan untuk jenis utilitas ini."}
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, idx) => (
                <tr
                  key={rec.id_utility}
                  className="align-middle hover:bg-zinc-50/80"
                >
                  <td className="p-3 text-center font-bold text-zinc-400">
                    {idx + 1}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                        rec.nama_utility === "PLN/Listrik"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : rec.nama_utility === "PDAM/Air"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : rec.nama_utility === "WiFi/Internet"
                              ? "border-purple-200 bg-purple-50 text-purple-700"
                              : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {rec.nama_utility}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-zinc-900">
                    {rec.bulan} {rec.tahun}
                  </td>
                  <td className="p-3 text-center text-zinc-500">
                    {new Date(rec.tanggal_bayar).toLocaleDateString("id-ID")}
                  </td>
                  <td className="p-3 text-right font-black text-zinc-900">
                    Rp {Number(rec.nominal).toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-[11px] text-zinc-500">
                    {rec.keterangan || "-"}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        handleDelete(
                          rec.id_utility,
                          rec.nama_utility,
                          rec.bulan
                        )
                      }
                      className="rounded border border-red-200 p-1.5 text-red-500 transition-colors hover:bg-red-50"
                      title="Hapus Log"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* BAR CHART TREN BULANAN */}
      <div className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-1.5 border-b pb-2 text-xs font-bold text-zinc-900 uppercase">
          <BarChart3 className="h-4 w-4 text-zinc-500" />
          Grafik Tren Biaya Terfilter ({filterUtility})
        </h2>

        {chartRecords.length === 0 ? (
          <p className="py-4 text-center text-zinc-400 italic">
            Tidak ada grafik untuk ditampilkan pada filter ini.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="relative h-72 border-b border-l border-zinc-300 px-4">
                {/* Grid & Y Axis */}
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {[100, 75, 50, 25, 0].map((value) => (
                    <div
                      key={value}
                      className="flex w-full items-center border-t border-dashed border-zinc-100"
                    >
                      <span className="absolute -left-16 w-12 text-right text-[9px] text-zinc-400">
                        {Math.round((maxNominal * value) / 100).toLocaleString(
                          "id-ID"
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bar Chart */}
                <div className="relative z-10 flex h-full items-end justify-around gap-4 px-4">
                  {chartRecords.map((rec) => {
                    const nominalValue = Number(rec.nominal)

                    const percentageHeight =
                      maxNominal > 0 ? (nominalValue / maxNominal) * 100 : 0

                    const barColor =
                      rec.nama_utility === "PLN/Listrik"
                        ? "bg-amber-500"
                        : rec.nama_utility === "PDAM/Air"
                          ? "bg-blue-500"
                          : rec.nama_utility === "WiFi/Internet"
                            ? "bg-purple-500"
                            : "bg-zinc-500"

                    return (
                      <div
                        key={rec.id_utility}
                        className="flex h-full max-w-24 flex-1 flex-col items-center justify-end"
                      >
                        {/* Nominal */}
                        <div className="mb-1 text-center text-[9px] font-black text-zinc-700">
                          Rp {nominalValue.toLocaleString("id-ID")}
                        </div>

                        {/* Bar */}
                        <div
                          className={`w-full max-w-16 rounded-t-sm ${barColor} transition-all duration-500 ease-out`}
                          style={{
                            height: `${Math.max(percentageHeight, 2)}%`,
                          }}
                          title={`${rec.nama_utility} - ${rec.bulan} ${rec.tahun}: Rp ${nominalValue.toLocaleString(
                            "id-ID"
                          )}`}
                        />

                        {/* Label */}
                        <div className="mt-2 text-center">
                          <div className="text-[10px] font-bold text-zinc-700">
                            {rec.bulan}
                          </div>

                          <div className="text-[9px] text-zinc-400">
                            {rec.tahun}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-[10px] font-semibold text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  PLN/Listrik
                </span>

                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                  PDAM/Air
                </span>

                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" />
                  WiFi/Internet
                </span>

                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-zinc-500" />
                  Lainnya
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* DIALOG FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded bg-white shadow-xl">
            <div className="flex items-center justify-between bg-zinc-900 px-5 py-3 font-bold tracking-wide text-white uppercase">
              <span className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-blue-400" /> Registrasi
                Tagihan Bulanan
              </span>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Nama Utilitas Operasional *
                </label>
                <select
                  value={namaUtility}
                  onChange={(e) => setNamaUtility(e.target.value)}
                  className="w-full cursor-pointer rounded border bg-white p-2 font-semibold focus:outline-none"
                >
                  <option value="PLN/Listrik">PLN / Listrik</option>
                  <option value="PDAM/Air">PDAM / Air Bersih</option>
                  <option value="WiFi/Internet">
                    WiFi / Internet IndiHome/Biznet
                  </option>
                  <option value="Lainnya">Lainnya (Token/Iuran Gedung)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Bulan Buku Tagihan
                  </label>
                  <select
                    value={bulan}
                    onChange={(e) => setBulan(e.target.value)}
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
                    Tahun Buku *
                  </label>
                  <input
                    type="number"
                    required
                    value={tahun}
                    onChange={(e) =>
                      setTahun(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full rounded border p-2 text-center font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Total Nominal Tagihan *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 1500000"
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value)}
                    className="w-full rounded border p-2 text-right font-black"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-zinc-700">
                    Tanggal Bayar *
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalBayar}
                    onChange={(e) => setTanggalBayar(e.target.value)}
                    className="w-full cursor-pointer rounded border p-2 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Keterangan / Nomor ID Pelanggan
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: No. ID PLN 5321xxxxxxxx (Dibayar via m-banking)"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full resize-none rounded border p-2"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded border px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-5 py-2 font-bold text-white shadow transition-colors disabled:bg-blue-400"
                >
                  {loading ? "Menyimpan..." : "Simpan Tagihan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
