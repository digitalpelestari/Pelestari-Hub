// app/dashboard/finance/buku-kas/page.tsx
"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, Calendar, ReceiptText, 
  CalendarDays, Hash, X, RefreshCw, Download 
} from "lucide-react"
import { getJurnalList } from "@/app/actions/jurnal"
import { exportBukuKasToExcel } from "@/app/actions/export-buku-kas"
import { swal } from "@/lib/sweetalert"


export default function BukuKasPage() {
  const [rawJurnalList, setRawJurnalList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const handleDownloadExcel = async () => {
  setIsExporting(true)
  try {
    const res = await exportBukuKasToExcel(startDate || undefined, endDate || undefined)
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
      const startParam = startDate || undefined
      const endParam = endDate || undefined
      
      const res = await getJurnalList(startParam, endParam)
      setRawJurnalList(Array.isArray(res) ? res : [])
    } catch (error) {
      console.error("Gagal memuat data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  // 1. Ekstraksi dan transform data jurnal menjadi mutasi kas
  const kasMutasiList = useMemo(() => {
    // Urutkan dari tanggal & ID paling awal ke terbaru untuk running balance yang tepat
    const sorted = [...rawJurnalList].sort((a: any, b: any) => {
      const dateA = new Date(a.tanggal).getTime()
      const dateB = new Date(b.tanggal).getTime()
      return dateA === dateB ? a.id - b.id : dateA - dateB
    })


    let runningSaldo = 0

    return sorted.map((jurnal: any) => {
      const items = Array.isArray(jurnal.items) ? jurnal.items : []

      // Cari baris Kas / Bank
      const kasItem = items.find((i: any) => 
        String(i.no_akun) === "11100" || 
        String(i.no_akun) === "11200" ||
        (i.nama_akun && i.nama_akun.toLowerCase().includes("kas")) ||
        (i.nama_akun && i.nama_akun.toLowerCase().includes("petty"))
      )

      // Cari baris akun operasional/lawan (ATK, Dapur, Ekspedisi, dll)
      const lawanItem = items.find((i: any) => i !== kasItem) || items[0] || {}

      // Uang Masuk ke Kas (Top Up Kas): Kas posisi Debit
      // Uang Keluar dari Kas (Pengeluaran ATK dll): Kas posisi Kredit
      const debit = kasItem ? Number(kasItem.debit) || 0 : (Number(jurnal.debit) || 0)
      const kredit = kasItem ? Number(kasItem.kredit) || 0 : (Number(jurnal.kredit) || 0)

      runningSaldo = runningSaldo + debit - kredit
      const isTopUp = debit > 0

      return {
        id: jurnal.id,
        no_registrasi: jurnal.no_registrasi || "-",
        tanggal: jurnal.tanggal,
        kelompok_biaya: lawanItem.nama_kelompok || lawanItem.kelompok_biaya || (isTopUp ? "Kas / Petty Cash" : "Biaya Operasional"),
        jenis_biaya: lawanItem.nama_akun || (isTopUp ? "Petty Cash" : "Operasional"),
        keterangan: jurnal.keterangan || "-",
        debit: debit,
        kredit: kredit,
        total_saldo: runningSaldo,
        isTopUp: isTopUp
      }
    })
  }, [rawJurnalList])

  // 2. Filter Search
  const filteredData = useMemo(() => {
    const q = search.toLowerCase()
    return kasMutasiList.filter((item) =>
      item.no_registrasi.toLowerCase().includes(q) ||
      item.keterangan.toLowerCase().includes(q) ||
      item.kelompok_biaya.toLowerCase().includes(q) ||
      item.jenis_biaya.toLowerCase().includes(q)
    )
  }, [kasMutasiList, search])

  // Total akumulasi
  const totalSummary = useMemo(() => {
    let totDebit = 0
    let totKredit = 0
    filteredData.forEach((d) => {
      totDebit += d.debit
      totKredit += d.kredit
    })
    const lastSaldo = filteredData.length > 0 ? filteredData[filteredData.length - 1].total_saldo : 0
    return { totDebit, totKredit, lastSaldo }
  }, [filteredData])

  return (
    <div className="p-6 w-full space-y-6 bg-zinc-50/50 min-h-screen text-zinc-900 font-sans">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800 text-white rounded-lg">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Laporan Pengeluaran Kas (Petty Cash)</h1>
          </div>
          <p className="text-xs text-zinc-500 pl-9 mt-1">
            Rekapitulasi mutasi pengeluaran operasional dan top up saldo kas.
          </p>
        </div>
        

        {/* SUMMARY SALDO */}
        
        <div className="flex items-center gap-3">
            <Button
    onClick={handleDownloadExcel}
    disabled={isExporting || loading}
    variant="outline"
    className="h-10 border-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg px-4 gap-2 hover:bg-zinc-50 transition-all shadow-sm"
  >
    <Download className="h-4 w-4 text-zinc-500" />
    {isExporting ? "MENGONVERSI..." : "EKSPOR EXCEL"}
  </Button>
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-right">
            <p className="text-[10px] uppercase font-bold text-emerald-700">Total Saldo Terakhir</p>
            <p className="font-mono text-sm font-bold text-emerald-800">
              Rp {totalSummary.lastSaldo.toLocaleString("id-ID", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Cari no. registrasi, jenis biaya, memo..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 text-xs bg-zinc-50/50 border-zinc-200 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-50/50 border border-zinc-200 rounded-lg px-3 h-10">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] uppercase font-bold text-zinc-400">Dari:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="outline-none text-xs bg-transparent cursor-pointer font-medium text-zinc-700" 
            />
          </div>

          <span className="text-zinc-300">-</span>

          <div className="flex items-center gap-2 bg-zinc-50/50 border border-zinc-200 rounded-lg px-3 h-10">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] uppercase font-bold text-zinc-400">Sampai:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="outline-none text-xs bg-transparent cursor-pointer font-medium text-zinc-700" 
            />
          </div>

          {(startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="h-10 px-2.5 text-rose-600 hover:bg-rose-50 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadData} 
            disabled={loading}
            className="h-10 w-10 border-zinc-200 rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 text-zinc-600 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* TABLE MIRIP EXCEL */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[1100px] border-collapse">
            <TableHeader className="bg-[#1E5631] text-white">
              <TableRow className="text-[11px] font-bold uppercase tracking-wider hover:bg-[#1E5631]">
                <TableHead className="py-3 px-3 w-[50px] text-center text-white border-r border-emerald-900">No</TableHead>
                <TableHead className="py-3 px-3 w-[120px] text-white border-r border-emerald-900">No Regist</TableHead>
                <TableHead className="py-3 px-3 w-[100px] text-white border-r border-emerald-900">Tanggal</TableHead>
                <TableHead className="py-3 px-3 min-w-[180px] text-white border-r border-emerald-900">Kelompok Biaya</TableHead>
                <TableHead className="py-3 px-3 min-w-[180px] text-white border-r border-emerald-900">Jenis Biaya</TableHead>
                <TableHead className="py-3 px-4 min-w-[260px] text-white border-r border-emerald-900">Keterangan</TableHead>
                <TableHead className="py-3 px-3 w-[120px] text-right text-white border-r border-emerald-900">Debit</TableHead>
                <TableHead className="py-3 px-3 w-[120px] text-right text-white border-r border-emerald-900">Kredit</TableHead>
                <TableHead className="py-3 px-3 w-[130px] text-right text-white">Total Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-medium divide-y divide-zinc-200">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-36 text-center text-zinc-400 italic">
                    Memuat data mutasi buku kas...
                  </TableCell>
                </TableRow>
              ) : filteredData.length > 0 ? (
                filteredData.map((row, index) => (
                  <TableRow 
                    key={row.id || index} 
                    className={`transition-colors ${row.isTopUp ? "bg-[#FFEB3B]/30 hover:bg-[#FFEB3B]/50 font-semibold" : "hover:bg-zinc-50"}`}
                  >
                    <TableCell className="py-2.5 px-3 text-center border-r border-zinc-100 font-mono text-zinc-500">
                      {index + 1}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 font-mono border-r border-zinc-100 text-zinc-800 whitespace-nowrap">
                      {row.no_registrasi}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 font-mono border-r border-zinc-100 text-zinc-600 whitespace-nowrap">
                      {row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID", { day: '2-digit', month: 'short', year: '2-digit' }) : "-"}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 border-r border-zinc-100 text-zinc-700">
                      {row.kelompok_biaya}
                    </TableCell>

                    <TableCell className={`py-2.5 px-3 border-r border-zinc-100 ${row.isTopUp ? "italic text-emerald-800 font-bold" : "text-zinc-800"}`}>
                      {row.jenis_biaya}
                    </TableCell>

                    <TableCell className="py-2.5 px-4 border-r border-zinc-100 text-zinc-800">
                      {row.keterangan}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-right font-mono border-r border-zinc-100 text-emerald-700 whitespace-nowrap">
                      {row.debit > 0 ? `Rp ${row.debit.toLocaleString("id-ID")}` : ""}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-right font-mono border-r border-zinc-100 text-zinc-800 whitespace-nowrap">
                      {row.kredit > 0 ? `Rp ${row.kredit.toLocaleString("id-ID")}` : ""}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap bg-zinc-50/50">
                      Rp {row.total_saldo.toLocaleString("id-ID")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-zinc-400 italic">
                    Tidak ada catatan pengeluaran kas pada periode ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

    </div>
  )
}