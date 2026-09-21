// app/dashboard/finance/buku-kas/page.tsx
"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Calendar,
  ReceiptText,
  User,
  X,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { getJurnalList } from "@/app/actions/riwayat-transaksi"
import { exportBukuKasToExcel } from "@/app/actions/export-buku-kas"
import { swal } from "@/lib/sweetalert"

export default function BukuKasPage() {
  const [rawJurnalList, setRawJurnalList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedType, setSelectedType] = useState<"ALL" | "BK" | "BD" | "KK">("ALL")
  const [isExporting, setIsExporting] = useState(false)
  const [saldoKas, setSaldoKas] = useState(0)

  // --- Pagination state ---
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const pageSizeOptions = [10, 20, 50, 100, 200]
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleDownloadExcel = async () => {
    setIsExporting(true)
    try {
      const res = await exportBukuKasToExcel(
        startDate || undefined,
        endDate || undefined
      )
      if (!res.success || !res.base64) {
        swal.error(res.message || "Gagal mengunduh file Excel")
        return
      }

      const byteCharacters = atob(res.base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = res.fileName || "Pengeluaran_Kas.xlsx"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (err: any) {
      swal.error("Error saat export: " + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getJurnalList(
        startDate || undefined,
        endDate || undefined,
        currentPage,
        pageSize,
        searchQuery.trim() || undefined,
        selectedType
      )

      if (!res || !res.success) {
        console.error("Gagal memuat data:", res?.message)
        setRawJurnalList([])
        return
      }

      setRawJurnalList(Array.isArray(res.data) ? res.data : [])
      setSaldoKas(Number(res.summary?.saldoKas || 0))

      setPagination({
        page: res.pagination?.page ?? currentPage,
        pageSize: res.pagination?.pageSize ?? pageSize,
        total: res.pagination?.total ?? 0,
        totalPages: res.pagination?.totalPages ?? 0,
      })
    } catch (error) {
      console.error("Gagal memuat data:", error)
      setRawJurnalList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate, currentPage, pageSize, searchQuery, selectedType])

  // Ekstraksi data mutasi kas secara dinamis berdasarkan klasifikasi COA KAS/BANK
  const kasMutasiList = useMemo(() => {
    const sorted = [...rawJurnalList].sort((a: any, b: any) => {
      const dateA = new Date(a.tanggal).getTime()
      const dateB = new Date(b.tanggal).getTime()
      return dateA === dateB ? a.id - b.id : dateA - dateB
    })

    let runningSaldo = 0

    return sorted.map((jurnal: any) => {
      const items = Array.isArray(jurnal.items) ? jurnal.items : []

      // Deteksi otomatis akun Kas & Bank berdasarkan kelompok akun
      const kasItem = items.find((i: any) => {
        const kelompok = String(i.nama_kelompok || i.kelompok_biaya || "").toUpperCase()
        const nama = String(i.nama_akun || "").toUpperCase()
        return (
          kelompok.includes("KAS") ||
          kelompok.includes("BANK") ||
          nama.includes("KAS") ||
          nama.includes("BANK") ||
          nama.includes("PETTY")
        )
      })

      // Akun lawan transaksi
      const lawanItem = items.find((i: any) => i !== kasItem) || items[0] || {}

      const debit = kasItem ? Number(kasItem.debit) || 0 : 0
      const kredit = kasItem ? Number(kasItem.kredit) || 0 : 0

      runningSaldo = runningSaldo + debit - kredit
      const isTopUp = debit > 0

      return {
        id: jurnal.id,
        no_registrasi: jurnal.no_registrasi || "-",
        penerima: jurnal.penerima || "-",
        tanggal: jurnal.tanggal,
        kelompok_biaya:
          lawanItem.nama_kelompok ||
          lawanItem.kelompok_biaya ||
          (isTopUp ? "Kas / Bank" : "Biaya Operasional"),
        jenis_biaya:
          lawanItem.nama_akun || (isTopUp ? "Penerimaan / Top Up" : "Operasional"),
        keterangan: jurnal.keterangan || "-",
        debit: debit,
        kredit: kredit,
        total_saldo: runningSaldo,
        isTopUp: isTopUp,
      }
    })
  }, [rawJurnalList])

  const handleResetFilter = () => {
    setStartDate("")
    setEndDate("")
    setSearchInput("")
    setSearchQuery("")
    setSelectedType("ALL")
    setCurrentPage(1)
  }

  const totalItems = pagination.total
  const totalPages = Math.max(1, pagination.totalPages)
  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, totalItems)

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = []
    const delta = 1

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...")
      }
    }
    return pages
  }, [totalPages, currentPage])

  return (
    <div className="min-h-screen w-full space-y-6 bg-zinc-50/50 p-6 font-sans text-zinc-900">
      {/* HEADER UTAMA */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Laporan Pengeluaran Kas (Petty Cash)
            </h1>
          </div>
          <p className="mt-1 pl-9 text-xs text-zinc-500">
            Rekapitulasi mutasi pengeluaran operasional dan top up saldo kas.
          </p>
        </div>

        {/* SUMMARY SALDO */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting || loading}
            variant="outline"
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            {isExporting ? "MENGONVERSI..." : "EKSPOR EXCEL"}
          </Button>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right shadow-xs">
            <p className="text-[10px] font-bold text-emerald-700 uppercase">
              Total Saldo Terakhir
            </p>
            <p className="font-mono text-sm font-bold text-emerald-800">
              Rp{" "}
              {saldoKas.toLocaleString("id-ID", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR BERSIH & MODERN */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm xl:flex-row">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center xl:w-auto">
          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-72">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Cari regis, biaya, penerima, memo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 rounded-lg border-zinc-200 bg-zinc-50/50 pl-9 text-xs focus-visible:ring-1 focus-visible:ring-zinc-900"
            />
          </div>

          {/* TOGGLE TIPE: ALL, BK, BD, KK */}
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100/60 p-1">
            <div className="flex items-center gap-1 px-2 text-zinc-400">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Tipe:</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedType("ALL")
                setCurrentPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                selectedType === "ALL"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedType("BK")
                setCurrentPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                selectedType === "BK"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-zinc-500 hover:text-rose-600"
              }`}
            >
              BK
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedType("BD")
                setCurrentPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                selectedType === "BD"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-500 hover:text-blue-600"
              }`}
            >
              BD
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedType("KK")
                setCurrentPage(1)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                selectedType === "KK"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-zinc-500 hover:text-amber-600"
              }`}
            >
              KK
            </button>
          </div>
        </div>

        {/* DATE RANGE FILTER */}
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">
              Dari:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="cursor-pointer bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>

          <span className="text-zinc-300">-</span>

          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">
              Sampai:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="cursor-pointer bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>

          {(startDate || endDate || selectedType !== "ALL" || searchInput) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilter}
              className="h-10 rounded-lg px-2.5 text-rose-600 hover:bg-rose-50"
              title="Reset Filter"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            disabled={loading}
            className="h-10 w-10 rounded-lg border-zinc-200"
            title="Muat Ulang Data"
          >
            <RefreshCw
              className={`h-4 w-4 text-zinc-600 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* TABEL DATA MUTASI (STRUKTUR 10 KOLOM) */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[1200px] border-collapse">
            <TableHeader className="border-b border-zinc-200 bg-zinc-50/70">
              <TableRow className="text-[11px] font-bold tracking-wider text-zinc-600 uppercase">
                <TableHead className="w-[50px] border-r border-zinc-200 px-3 py-3.5 text-center text-zinc-600">
                  No
                </TableHead>
                <TableHead className="w-[120px] border-r border-zinc-200 px-3 py-3.5 text-zinc-600">
                  No Regist
                </TableHead>
                <TableHead className="w-[100px] border-r border-zinc-200 px-3 py-3.5 text-zinc-600">
                  Tanggal
                </TableHead>
                <TableHead className="min-w-[170px] border-r border-zinc-200 px-3 py-3.5 text-zinc-600">
                  Kelompok Biaya
                </TableHead>
                <TableHead className="min-w-[170px] border-r border-zinc-200 px-3 py-3.5 text-zinc-600">
                  Jenis Biaya
                </TableHead>
                <TableHead className="min-w-[240px] border-r border-zinc-200 px-4 py-3.5 text-zinc-600">
                  Keterangan
                </TableHead>
                {/* PENERIMA */}
                <TableHead className="w-[150px] border-r border-zinc-200 px-3 py-3.5 text-zinc-600">
                  Penerima
                </TableHead>
                <TableHead className="w-[120px] border-r border-zinc-200 px-3 py-3.5 text-right text-zinc-600">
                  Debit
                </TableHead>
                <TableHead className="w-[120px] border-r border-zinc-200 px-3 py-3.5 text-right text-zinc-600">
                  Kredit
                </TableHead>
                <TableHead className="w-[130px] px-3 py-3.5 text-right text-zinc-600">
                  Total Saldo
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-200 text-xs font-medium">
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-36 text-center text-zinc-400 italic"
                  >
                    Memuat data mutasi buku kas...
                  </TableCell>
                </TableRow>
              ) : kasMutasiList.length > 0 ? (
                kasMutasiList.map((row, index) => (
                  <TableRow
                    key={row.id || index}
                    className={`transition-colors ${
                      row.isTopUp
                        ? "bg-[#FFEB3B]/30 font-semibold hover:bg-[#FFEB3B]/50"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 text-center font-mono text-zinc-500">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>

                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 font-mono whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.no_registrasi.startsWith("BK")
                            ? "border border-rose-100 bg-rose-50 text-rose-700"
                            : row.no_registrasi.startsWith("BD")
                            ? "border border-blue-100 bg-blue-50 text-blue-700"
                            : row.no_registrasi.startsWith("KK")
                            ? "border border-amber-100 bg-amber-50 text-amber-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {row.no_registrasi}
                      </span>
                    </TableCell>

                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 font-mono whitespace-nowrap text-zinc-600">
                      {row.tanggal
                        ? new Date(row.tanggal).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })
                        : "-"}
                    </TableCell>

                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 text-zinc-700">
                      {row.kelompok_biaya}
                    </TableCell>

                    <TableCell
                      className={`border-r border-zinc-100 px-3 py-2.5 ${
                        row.isTopUp
                          ? "font-bold text-emerald-800 italic"
                          : "text-zinc-800"
                      }`}
                    >
                      {row.jenis_biaya}
                    </TableCell>

                    {/* KETERANGAN */}
                    <TableCell className="border-r border-zinc-100 px-4 py-2.5 text-zinc-800">
                      {row.keterangan}
                    </TableCell>

                    {/* PENERIMA */}
                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 text-zinc-700">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="font-semibold text-zinc-800 uppercase">
                          {row.penerima || "-"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-700">
                      {row.debit > 0
                        ? `Rp ${row.debit.toLocaleString("id-ID")}`
                        : ""}
                    </TableCell>

                    <TableCell className="border-r border-zinc-100 px-3 py-2.5 text-right font-mono whitespace-nowrap text-zinc-800">
                      {row.kredit > 0
                        ? `Rp ${row.kredit.toLocaleString("id-ID")}`
                        : ""}
                    </TableCell>

                    <TableCell className="bg-zinc-50/50 px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap text-zinc-900">
                      Rp {row.total_saldo.toLocaleString("id-ID")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-zinc-400 italic"
                  >
                    Tidak ada catatan mutasi kas pada filter ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION BAR */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 px-4 py-3 sm:flex-row">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>
                Menampilkan{" "}
                <span className="font-semibold text-zinc-700">{startRow}</span>–
                <span className="font-semibold text-zinc-700">{endRow}</span>{" "}
                dari{" "}
                <span className="font-semibold text-zinc-700">{totalItems}</span>{" "}
                data
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  Baris:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="h-8 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-xs text-zinc-400"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(p as number)}
                    className={`h-8 min-w-8 rounded-lg px-2 text-xs ${
                      p === currentPage
                        ? "bg-zinc-900 text-white hover:bg-zinc-800"
                        : "border-zinc-200 text-zinc-700"
                    }`}
                  >
                    {p}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}