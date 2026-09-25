"use client"

import React, { useEffect, useState } from "react"
import { getNeracaData, NeracaData } from "@/app/actions/neraca"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, RefreshCw, Scale } from "lucide-react"

const BULAN_OPTIONS = [
  { value: "all", label: "Semua Bulan (Tahunan)" },
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
]

export default function NeracaPage() {
  const [data, setData] = useState<NeracaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<string>("2026")
  const [currentMonth, setCurrentMonth] = useState<string>("all")

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getNeracaData(currentYear, currentMonth)
      setData(res)
    } catch (err) {
      console.error("Gagal memuat komponen neraca saldo:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentYear, currentMonth])

  const formatRupiah = (num: number) => {
    const isNegative = num < 0
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(Math.abs(num))

    return isNegative ? `(${formatted})` : formatted
  }

  const getPeriodeLabel = () => {
    if (currentMonth === "all") {
      return `Per Tanggal S/D: 31 Desember ${currentYear}`
    }
    const monthNum = parseInt(currentMonth)
    const lastDay = new Date(parseInt(currentYear), monthNum, 0).getDate()
    const selectedMonth = BULAN_OPTIONS.find((b) => b.value === currentMonth)?.label
    return `Per Tanggal S/D: ${lastDay} ${selectedMonth} ${currentYear}`
  }

  const getPeriodeShortLabel = () => {
    if (currentMonth === "all") {
      return `Tahun Buku ${currentYear}`
    }
    const selectedMonth = BULAN_OPTIONS.find((b) => b.value === currentMonth)?.label
    return `${selectedMonth} ${currentYear}`
  }

  const totalAsetLancar = data?.totalAktivaLancar || 0
  const totalHartaTetap = data?.totalHartaTetap || 0
  const totalInvestasi = data?.totalInvestasi || 0
  const totalAktiva = data?.totalAktiva || 0

  const totalKewajiban = data?.totalKewajiban || 0
  const totalEkuitas = data?.totalEkuitas || 0
  const totalPasiva = data?.totalPasiva || 0

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 bg-white text-xs font-black tracking-widest text-zinc-400 uppercase italic">
        <RefreshCw className="h-4 w-4 animate-spin text-black" /> 
        Menyeimbangkan Posisi Aktiva dan Pasiva Real-time...
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-6 font-sans text-zinc-900">
      
      {/* HEADER BAR UTAMA */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Laporan Neraca Keuangan
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            PT Peduli Lestari Indonesia Balance Sheet Statement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* FILTER BULAN */}
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="h-10 cursor-pointer rounded-sm border border-zinc-300 bg-white px-3 text-xs font-black uppercase text-zinc-700 outline-none focus:border-black"
          >
            {BULAN_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {/* FILTER TAHUN */}
          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-10 cursor-pointer rounded-sm border border-zinc-300 bg-white px-3 text-xs font-black uppercase text-zinc-700 outline-none focus:border-black"
          >
            <option value="2026">Tahun Buku 2026</option>
            <option value="2025">Tahun Buku 2025</option>
            <option value="2024">Tahun Buku 2024</option>
          </select>

          <Button
            variant="outline"
            onClick={fetchData}
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" /> RELOAD
          </Button>
          
          <Button className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
            <FileSpreadsheet className="h-4 w-4" /> EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* AREA KERTAS DATA NERACA */}
      <Card className="w-full overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-none">
        <CardHeader className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5 text-left">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight text-zinc-900">
                LAPORAN NERACA (POSISI KEUANGAN BERJALAN)
              </CardTitle>
              <p className="mt-0.5 text-xs font-black uppercase tracking-wider text-blue-600">
                PT PEDULI LESTARI INDONESIA
              </p>
            </div>
            <div className="text-left font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 sm:text-right">
              <p>{getPeriodeLabel()}</p>
              <p className="mt-0.5">Denominasi Nilai: IDR (Rupiah)</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="w-full p-0">
          <div className="grid w-full grid-cols-1 divide-y divide-zinc-200 lg:grid-cols-2 lg:divide-y-0 lg:divide-x">
            
            {/* ========================================================
                SEKSI KIRI: AKTIVA (ASET)
            ======================================================== */}
            <div className="w-full">
              <Table className="w-full">
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="border-b border-zinc-200 bg-zinc-100/80 hover:bg-zinc-100/80">
                    <TableCell className="px-6 py-3 text-xs font-black uppercase tracking-wider text-black" colSpan={2}>
                      AKTIVA (ASET)
                    </TableCell>
                  </TableRow>

                  {/* A. ASET LANCAR */}
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell className="pl-6 pt-3 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900" colSpan={2}>
                      A. ASET LANCAR
                    </TableCell>
                  </TableRow>
                  {(data?.aktivaLancar || []).map((item) => (
                    <TableRow key={item.no_akun} className="border-none transition-colors hover:bg-zinc-50/30">
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="pr-8 text-right font-mono text-sm text-zinc-900">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2 pl-8 font-medium text-zinc-500 italic">Total Aset Lancar</TableCell>
                    <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                      {formatRupiah(totalAsetLancar)}
                    </TableCell>
                  </TableRow>

                  {/* B. HARTA TETAP */}
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell className="pl-6 pt-4 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900" colSpan={2}>
                      B. HARTA TETAP
                    </TableCell>
                  </TableRow>
                  {(data?.hartaTetap || []).map((item) => (
                    <TableRow key={item.no_akun} className="border-none transition-colors hover:bg-zinc-50/30">
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className={`pr-8 text-right font-mono text-sm ${item.saldo < 0 ? "text-rose-600 font-medium" : "text-zinc-900"}`}>
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2 pl-8 font-medium text-zinc-500 italic">Total Harta Tetap</TableCell>
                    <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                      {formatRupiah(totalHartaTetap)}
                    </TableCell>
                  </TableRow>

                  {/* C. INVESTASI */}
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell className="pl-6 pt-4 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900" colSpan={2}>
                      C. INVESTASI
                    </TableCell>
                  </TableRow>
                  {(data?.investasi || []).map((item) => (
                    <TableRow key={item.no_akun} className="border-none transition-colors hover:bg-zinc-50/30">
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="pr-8 text-right font-mono text-sm text-zinc-900">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="py-2 pl-8 font-medium text-zinc-500 italic">Total Investasi</TableCell>
                    <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                      {formatRupiah(totalInvestasi)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* ========================================================
                SEKSI KANAN: PASIVA (KEWAJIBAN & EKUITAS)
            ======================================================== */}
            <div className="w-full">
              <Table className="w-full">
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="border-b border-zinc-200 bg-zinc-100/80 hover:bg-zinc-100/80">
                    <TableCell className="px-6 py-3 text-xs font-black uppercase tracking-wider text-black" colSpan={2}>
                      PASIVA (KEWAJIBAN & EKUITAS)
                    </TableCell>
                  </TableRow>

                  {/* A. KEWAJIBAN */}
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell className="pl-6 pt-3 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900" colSpan={2}>
                      A. KEWAJIBAN / UTANG
                    </TableCell>
                  </TableRow>
                  {(data?.kewajiban || []).map((item) => (
                    <TableRow key={item.no_akun} className="border-none transition-colors hover:bg-zinc-50/30">
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="pr-8 text-right font-mono text-sm text-zinc-900">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2 pl-8 font-medium text-zinc-500 italic">Total Kewajiban</TableCell>
                    <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                      {formatRupiah(totalKewajiban)}
                    </TableCell>
                  </TableRow>

                  {/* B. EKUITAS / MODAL */}
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell className="pl-6 pt-4 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900" colSpan={2}>
                      B. MODAL & EKUITAS
                    </TableCell>
                  </TableRow>
                  {(data?.ekuitas || []).map((item) => (
                    <TableRow key={item.no_akun} className="border-none transition-colors hover:bg-zinc-50/30">
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className={`pr-8 text-right font-mono text-sm ${item.saldo < 0 ? "text-rose-600 font-medium" : "text-zinc-900"}`}>
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="py-2 pl-8 font-medium text-zinc-500 italic">Total Modal & Ekuitas</TableCell>
                    <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                      {formatRupiah(totalEkuitas)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

          </div>

          {/* TOTAL BALANCE FOOTER */}
          <div className="grid w-full grid-cols-1 divide-y divide-zinc-800 border-t border-zinc-800 bg-zinc-900 text-xs font-black text-white lg:grid-cols-2 lg:divide-y-0 lg:divide-x">
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-[10px] uppercase tracking-widest">TOTAL AKTIVA (JUMLAH ASET)</span>
              <span className="border-b-4 border-double border-emerald-400 pb-0.5 font-mono text-base text-emerald-400">
                {formatRupiah(totalAktiva)}
              </span>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-[10px] uppercase tracking-widest">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</span>
              <span className="border-b-4 border-double border-emerald-400 pb-0.5 font-mono text-base text-emerald-400">
                {formatRupiah(totalPasiva)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FOOTER TIMESTAMPS */}
      <div className="flex justify-between px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 italic">
        <p>* Sistem Neraca Terintegrasi</p>
        <p>Status Neraca: {Math.round(totalAktiva) === Math.round(totalPasiva) ? "Balanced Statement" : "Unbalanced Statement"}</p>
        <p>Periode: {getPeriodeShortLabel()}</p>
      </div>
    </div>
  )
}