"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Building2,
  Users,
  Search,
  Loader2,
  Calendar,
  Layers,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
} from "lucide-react"

export type JenisPelatihan = "AKBB" | "ABB"

export interface TbMatrix {
  id: number
  batch_id: number | null
  nama_batch?: string
  nama: string
  tempat_lahir: string | null
  tanggal_lahir: string | null
  nik: string | null
  nomor_sim: string | null
  jenis_sim: string | null
  perusahaan: string | null
  lokasi: string | null
  jenis_muatan: string | null
  foto_ktp: string | null
  foto_sim: string | null
  pas_foto: string | null
  jenis_pelatihan: JenisPelatihan | null
  ddt?: boolean | string | number | null
  created_at: string
}

interface BatchSummary {
  id: string
  nama: string
}

interface CompanyGroup {
  namaPerusahaan: string
  totalPeserta: number
  totalBatch: number
  pesertaList: TbMatrix[]
  batches: BatchSummary[]
}

export default function PerusahaanMatrixPage() {
  const [data, setData] = useState<TbMatrix[]>([])
  const [loading, setLoading] = useState(true)

  // State List Perusahaan
  const [searchPerusahaan, setSearchPerusahaan] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<CompanyGroup | null>(null)

  // State Filter di Dalam Detail Perusahaan
  const [searchPeserta, setSearchPeserta] = useState("")
  const [filterBatch, setFilterBatch] = useState<string>("ALL")
  const [filterPelatihan, setFilterPelatihan] = useState<"ALL" | JenisPelatihan>("ALL")

  // 1. Fetch seluruh data matrix
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/matrix")
        const json = await res.json()
        if (json.success) {
          setData(json.data || [])
        }
      } catch (err) {
        console.error("Gagal memuat data matrix:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAllData()
  }, [])

  // 2. Grouping data per perusahaan
  const groupedCompanies = useMemo(() => {
    const map = new Map<string, TbMatrix[]>()

    data.forEach((item) => {
      const rawCompany = item.perusahaan?.trim()
      const compName =
        rawCompany && rawCompany !== "-" ? rawCompany.toUpperCase() : "TANPA PERUSAHAAN"

      if (!map.has(compName)) {
        map.set(compName, [])
      }
      map.get(compName)!.push(item)
    })

    const result: CompanyGroup[] = []
    map.forEach((pesertaList, namaPerusahaan) => {
      const batchMap = new Map<string, string>()

      pesertaList.forEach((p) => {
        const batchKey = p.batch_id ? String(p.batch_id) : "NO_BATCH"
        const batchName =
          p.nama_batch || (p.batch_id ? `Batch #${p.batch_id}` : "Tanpa Batch")
        if (!batchMap.has(batchKey)) {
          batchMap.set(batchKey, batchName)
        }
      })

      const batches: BatchSummary[] = Array.from(batchMap.entries()).map(
        ([id, nama]) => ({ id, nama })
      )

      result.push({
        namaPerusahaan,
        totalPeserta: pesertaList.length,
        totalBatch: batches.length,
        pesertaList,
        batches,
      })
    })

    return result.sort((a, b) => a.namaPerusahaan.localeCompare(b.namaPerusahaan))
  }, [data])

  // Filter daftar perusahaan di list utama
  const filteredCompanies = useMemo(() => {
    const q = searchPerusahaan.toLowerCase()
    return groupedCompanies.filter((c) =>
      c.namaPerusahaan.toLowerCase().includes(q)
    )
  }, [groupedCompanies, searchPerusahaan])

  // Filter peserta di dalam detail perusahaan
  const filteredPeserta = useMemo(() => {
    if (!selectedCompany) return []
    const q = searchPeserta.toLowerCase()

    return selectedCompany.pesertaList.filter((p) => {
      const matchQuery =
        p.nama?.toLowerCase().includes(q) ||
        p.nik?.includes(q) ||
        p.nomor_sim?.includes(q) ||
        (p.nama_batch && p.nama_batch.toLowerCase().includes(q))

      const batchKey = p.batch_id ? String(p.batch_id) : "NO_BATCH"
      const matchBatch = filterBatch === "ALL" || batchKey === filterBatch

      const matchPelatihan =
        filterPelatihan === "ALL" || p.jenis_pelatihan === filterPelatihan

      return matchQuery && matchBatch && matchPelatihan
    })
  }, [selectedCompany, searchPeserta, filterBatch, filterPelatihan])

  // Perhitungan totalan peserta detail
  const statsDetail = useMemo(() => {
    const total = filteredPeserta.length
    const totalAKBB = filteredPeserta.filter((p) => p.jenis_pelatihan === "AKBB").length
    const totalABB = filteredPeserta.filter((p) => p.jenis_pelatihan === "ABB").length
    const totalDDT = filteredPeserta.filter((p) => {
      return (
        p.ddt === true ||
        p.ddt === 1 ||
        String(p.ddt).toLowerCase() === "true" ||
        String(p.ddt).toLowerCase() === "ya"
      )
    }).length

    return { total, totalAKBB, totalABB, totalDDT }
  }, [filteredPeserta])

  const handleSelectCompany = (comp: CompanyGroup) => {
    setSelectedCompany(comp)
    setSearchPeserta("")
    setFilterBatch("ALL")
    setFilterPelatihan("ALL")
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-500">
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Memuat data perusahaan...</span>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {selectedCompany ? (
        /* ================= TAMPILAN DETAIL PESERTA PERUSAHAAN ================= */
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              onClick={() => setSelectedCompany(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Perusahaan
            </button>

            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {selectedCompany.namaPerusahaan}
                  </h1>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Daftar riwayat peserta pelatihan yang terdaftar untuk perusahaan ini.
                </p>
              </div>
            </div>

            {/* Panel Ringkasan Totalan */}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Total Peserta
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {statsDetail.total}
                </span>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <span className="block text-[11px] font-semibold text-blue-600 uppercase">
                  Pelatihan AKBB
                </span>
                <span className="text-lg font-bold text-blue-700">
                  {statsDetail.totalAKBB}
                </span>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <span className="block text-[11px] font-semibold text-sky-600 uppercase">
                  Pelatihan ABB
                </span>
                <span className="text-lg font-bold text-sky-700">
                  {statsDetail.totalABB}
                </span>
              </div>
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                <span className="block text-[11px] font-semibold text-teal-600 uppercase">
                  Status DDT (Ya)
                </span>
                <span className="text-lg font-bold text-teal-700">
                  {statsDetail.totalDDT}
                </span>
              </div>
            </div>
          </div>

          {/* Kontrol & Tabel Peserta */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Peserta */}
                <div className="relative w-64 sm:w-72">
                  <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari Nama, NIK, SIM..."
                    value={searchPeserta}
                    onChange={(e) => setSearchPeserta(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none sm:text-sm"
                  />
                </div>

                {/* Filter Batch */}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <select
                    value={filterBatch}
                    onChange={(e) => setFilterBatch(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none sm:text-sm"
                  >
                    <option value="ALL">Semua Batch</option>
                    {selectedCompany.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter AKBB / ABB */}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <select
                    value={filterPelatihan}
                    onChange={(e) =>
                      setFilterPelatihan(e.target.value as "ALL" | JenisPelatihan)
                    }
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none sm:text-sm"
                  >
                    <option value="ALL">Semua Pelatihan</option>
                    <option value="AKBB">AKBB</option>
                    <option value="ABB">ABB</option>
                  </select>
                </div>
              </div>

              <span className="text-xs font-medium whitespace-nowrap text-slate-500">
                Menampilkan <b>{filteredPeserta.length}</b> dari {selectedCompany.totalPeserta} Peserta
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold tracking-wider text-slate-500 uppercase">
                    <th className="w-12 px-4 py-3.5 text-center">No</th>
                    <th className="px-4 py-3.5">Nama & NIK</th>
                    <th className="px-4 py-3.5">Batch Pelatihan</th>
                    <th className="px-4 py-3.5">Kualifikasi SIM</th>
                    <th className="px-4 py-3.5">Jenis Muatan</th>
                    <th className="px-4 py-3.5">Lokasi</th>
                    <th className="px-4 py-3.5">Pelatihan & DDT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPeserta.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileText className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                        <span>Tidak ada data peserta yang cocok dengan filter.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredPeserta.map((row, idx) => {
                      const isDdt =
                        row.ddt === true ||
                        row.ddt === 1 ||
                        String(row.ddt).toLowerCase() === "true" ||
                        String(row.ddt).toLowerCase() === "ya"

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-blue-50/30"
                        >
                          <td className="px-4 py-3.5 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 uppercase">
                              {row.nama}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-slate-500">
                              NIK: {row.nik || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              <Calendar className="h-3.5 w-3.5 text-blue-600" />
                              {row.nama_batch || (row.batch_id ? `Batch #${row.batch_id}` : "Tanpa Batch")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-blue-700">
                              {row.jenis_sim || "-"}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-slate-500">
                              No: {row.nomor_sim || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-700">
                            {row.jenis_muatan || "-"}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {row.lokasi || "-"}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col items-start gap-1">
                              {row.jenis_pelatihan ? (
                                <span
                                  className={
                                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold " +
                                    (row.jenis_pelatihan === "AKBB"
                                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                                      : "bg-sky-50 text-sky-700 ring-1 ring-sky-200")
                                  }
                                >
                                  {row.jenis_pelatihan}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                              <span
                                className={
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                                  (isDdt
                                    ? "bg-teal-50 text-teal-700"
                                    : "bg-slate-100 text-slate-500")
                                }
                              >
                                {isDdt && <ShieldCheck className="h-3 w-3" />}
                                DDT: {isDdt ? "Ya" : "Tidak"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TAMPILAN LIST UTAMA PERUSAHAAN ================= */
        <div className="space-y-6">
          {/* Header Utama */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Database Perusahaan Klien
                  </h1>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Ringkasan seluruh perusahaan klien beserta total peserta dan batch terkait.
                </p>
              </div>

              {/* Pencarian Perusahaan */}
              <div className="relative w-full md:w-80">
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama perusahaan..."
                  value={searchPerusahaan}
                  onChange={(e) => setSearchPerusahaan(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tabel List Perusahaan */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
              <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Daftar Perusahaan Terdaftar
              </span>
              <span className="text-xs font-medium text-slate-500">
                Total: <b>{filteredCompanies.length}</b> Perusahaan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold tracking-wider text-slate-500 uppercase">
                    <th className="w-14 px-4 py-3.5 text-center">No</th>
                    <th className="px-4 py-3.5">Nama Perusahaan Klien</th>
                    <th className="px-4 py-3.5 text-center">Jumlah Batch</th>
                    <th className="px-4 py-3.5 text-center">Total Peserta</th>
                    <th className="w-28 px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <span>Tidak ada data perusahaan yang sesuai pencarian.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((comp, idx) => (
                      <tr
                        key={comp.namaPerusahaan}
                        onClick={() => handleSelectCompany(comp)}
                        className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-4 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                                {comp.namaPerusahaan}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {comp.batches.map((b) => b.nama).slice(0, 2).join(", ")}
                                {comp.batches.length > 2 ? ` +${comp.batches.length - 2} batch lainnya` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700">
                            <Calendar className="h-3.5 w-3.5" />
                            {comp.totalBatch} Batch
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            <Users className="h-3.5 w-3.5" />
                            {comp.totalPeserta} Peserta
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all group-hover:border-blue-200 group-hover:bg-blue-600 group-hover:text-white"
                          >
                            <span>Detail</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}