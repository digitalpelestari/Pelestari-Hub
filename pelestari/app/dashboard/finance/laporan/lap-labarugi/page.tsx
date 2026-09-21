"use client"

import React, { useEffect, useState } from "react"
import { getLabaRugiData, LabaRugiData } from "@/app/actions/labarugi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  FileSpreadsheet,
  RefreshCw,
  Landmark,
  ChevronDown,
  ChevronRight,
  Tag,
} from "lucide-react"

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

export default function LabaRugiPage() {
  const [data, setData] = useState<LabaRugiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<string>("2026")
  const [currentMonth, setCurrentMonth] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (noAkun: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)

      if (next.has(noAkun)) {
        next.delete(noAkun)
      } else {
        next.add(noAkun)
      }

      return next
    })
  }

  const fetchData = async () => {
    setLoading(true)

    try {
      const res = await getLabaRugiData(currentYear, currentMonth)

      if (res) {
        setData(res)
      }
    } catch (err) {
      console.error("Gagal memuat data laba rugi:", err)
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
      minimumFractionDigits: 0,
    }).format(Math.abs(num))

    return isNegative ? `(${formatted})` : formatted
  }

  const getPeriodeLabel = () => {
    if (currentMonth === "all") {
      return `Per Tanggal S/D: 31 Desember ${currentYear}`
    }

    const selectedMonth = BULAN_OPTIONS.find(
      (b) => b.value === currentMonth
    )?.label

    return `Periode: ${selectedMonth} ${currentYear}`
  }

  const getPeriodeShortLabel = () => {
    if (currentMonth === "all") {
      return `Tahun Buku ${currentYear}`
    }

    const selectedMonth = BULAN_OPTIONS.find(
      (b) => b.value === currentMonth
    )?.label

    return `${selectedMonth} ${currentYear}`
  }

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 bg-white text-xs font-black tracking-widest text-zinc-400 uppercase italic">
        <RefreshCw className="h-4 w-4 animate-spin text-black" />
        Mengkalkulasi Laporan Laba Rugi...
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 bg-white p-6 font-sans text-zinc-900">
      {/* ============================================================
          HEADER BAR UTAMA
      ============================================================ */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Landmark className="h-5 w-5" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Laporan Laba Rugi
            </h1>
          </div>

          <p className="pl-9 text-xs text-zinc-500">
            Laporan pendapatan dan beban berdasarkan periode transaksi.
          </p>
        </div>

        {/* FILTER & ACTION */}
        <div className="flex flex-wrap items-center gap-3">
          {/* BULAN */}
          <select
            aria-label="Pilih Bulan"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="h-10 cursor-pointer rounded-sm border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 uppercase outline-none focus:border-black"
          >
            {BULAN_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {/* TAHUN */}
          <select
            aria-label="Pilih Tahun"
            value={currentYear}
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-10 cursor-pointer rounded-sm border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 uppercase outline-none focus:border-black"
          >
            <option value="2026">Tahun Buku 2026</option>
            <option value="2025">Tahun Buku 2025</option>
            <option value="2024">Tahun Buku 2024</option>
          </select>

          {/* RELOAD */}
          <Button
            variant="outline"
            onClick={fetchData}
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" />
            RELOAD
          </Button>

          {/* EXPORT */}
          <Button className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
            <FileSpreadsheet className="h-4 w-4" />
            EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* ============================================================
          AREA KERTAS DATA LAPORAN
      ============================================================ */}
      <Card className="w-full overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-none">
        {/* ==========================================================
            HEADER LAPORAN
        ========================================================== */}
        <CardHeader className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* IDENTITAS LAPORAN */}
            <div>
              <CardTitle className="text-sm font-black tracking-tight text-zinc-900 uppercase">
                LAPORAN LABA RUGI
              </CardTitle>

              <p className="mt-0.5 text-xs font-black tracking-wider text-blue-600 uppercase">
                PT PEDULI LESTARI INDONESIA
              </p>
            </div>

            {/* PERIODE */}
            <div className="text-left font-mono text-[10px] font-bold tracking-wider text-zinc-400 uppercase sm:text-right">
              <p>{getPeriodeLabel()}</p>

              <p className="mt-0.5">Denominasi Nilai: IDR (Rupiah)</p>
            </div>
          </div>
        </CardHeader>

        {/* ==========================================================
            CONTENT LAPORAN
        ========================================================== */}
        <CardContent className="w-full overflow-x-auto p-0">
          <Table className="w-full">
            <TableBody className="text-xs font-bold text-zinc-800">
              {/* ====================================================
                  I. PENDAPATAN
              ==================================================== */}
              <TableRow className="border-b border-zinc-200 bg-zinc-100/80 hover:bg-zinc-100/80">
                <TableCell
                  className="px-6 py-3 text-xs font-black tracking-wider text-black uppercase"
                  colSpan={2}
                >
                  I. PENDAPATAN
                </TableCell>
              </TableRow>

              {/* PENDAPATAN PELATIHAN */}
              <TableRow className="border-none transition-colors hover:bg-zinc-50/30">
                <TableCell className="py-2.5 pl-12 font-medium text-zinc-700">
                  Pendapatan Jasa Pelatihan
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-sm font-medium text-zinc-900">
                  {formatRupiah(data?.pendapatanPelatihan || 0)}
                </TableCell>
              </TableRow>

              {/* PENDAPATAN KONSULTAN */}
              <TableRow className="border-none transition-colors hover:bg-zinc-50/30">
                <TableCell className="py-2.5 pl-12 font-medium text-zinc-700">
                  Pendapatan Jasa Konsultan
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-sm font-medium text-zinc-900">
                  {formatRupiah(data?.pendapatanKonsultan || 0)}
                </TableCell>
              </TableRow>

              {/* TOTAL PENDAPATAN */}
              <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                <TableCell className="py-2.5 pl-8 font-medium text-zinc-500 italic">
                  Total Pendapatan
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                  <span className="border-b border-zinc-300 pb-0.5">
                    {formatRupiah(data?.totalPendapatan || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* SPACING */}
              <TableRow className="h-3 border-none hover:bg-transparent">
                <TableCell colSpan={2} />
              </TableRow>

              {/* ====================================================
                  II. BEBAN OPERASIONAL
              ==================================================== */}
              <TableRow className="border-b border-zinc-200 bg-zinc-100/80 hover:bg-zinc-100/80">
                <TableCell
                  className="px-6 py-3 text-xs font-black tracking-wider text-black uppercase"
                  colSpan={2}
                >
                  II. BEBAN OPERASIONAL & USAHA
                </TableCell>
              </TableRow>

              {/* ====================================================
                  BEBAN OPERASIONAL
              ==================================================== */}
              {data?.bebanOperasional.map((item) => {
                const rincianList = item.rincian || []

                const distinctAccounts = new Set(
                  rincianList.map(
                    (r: any) =>
                      `${r.no_akun}-${r.kelompok_biaya_id || r.kelompok_biaya}`
                  )
                )

                const shouldDropdown =
                  rincianList.length > 1 && distinctAccounts.size > 1

                const isExpanded = expandedRows.has(item.no_akun)

                return (
                  <React.Fragment key={item.no_akun}>
                    {/* MAIN ROW */}
                    <TableRow
                      onClick={() => shouldDropdown && toggleRow(item.no_akun)}
                      className={`border-b border-zinc-100 transition-colors ${
                        shouldDropdown
                          ? "cursor-pointer hover:bg-zinc-50"
                          : "hover:bg-zinc-50/30"
                      }`}
                    >
                      <TableCell className="py-2.5 pl-8">
                        <div className="flex items-center gap-2">
                          {/* CHEVRON */}
                          {shouldDropdown ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-zinc-900" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-zinc-400" />
                            )
                          ) : (
                            <span className="inline-block w-4" />
                          )}

                          {/* NAMA AKUN */}
                          <span
                            className={
                              shouldDropdown
                                ? "font-semibold text-zinc-900"
                                : "font-medium text-zinc-700"
                            }
                          >
                            {item.nama_akun}
                          </span>

                          {/* KODE AKUN */}
                          {!shouldDropdown && item.no_akun && (
                            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                              {item.no_akun}
                            </span>
                          )}

                          {/* BADGE JUMLAH */}
                          {shouldDropdown && (
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                              {rincianList.length} pos akun
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="pr-8 text-right font-mono text-sm font-medium text-zinc-900">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>

                    {/* =================================================
                        SUB ROWS
                    ================================================= */}
                    {shouldDropdown &&
                      isExpanded &&
                      rincianList.map((sub: any, idx) => {
                        const namaKelompok =
                          sub.kelompok_biaya ||
                          sub.nama_kelompok ||
                          (sub.kelompok_biaya_id
                            ? `Kelompok ${sub.kelompok_biaya_id}`
                            : "-")

                        return (
                          <TableRow
                            key={`${sub.no_akun}-${idx}`}
                            className="border-none bg-zinc-50/70 text-xs text-zinc-600 hover:bg-zinc-100/70"
                          >
                            <TableCell className="py-2 pl-16">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />

                                <span className="font-semibold text-zinc-800">
                                  {sub.nama_akun}
                                </span>

                                {sub.no_akun && (
                                  <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-600">
                                    {sub.no_akun}
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                  <Tag className="h-2.5 w-2.5" />
                                  {namaKelompok}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="pr-8 text-right font-mono text-zinc-700">
                              {formatRupiah(sub.saldo)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </React.Fragment>
                )
              })}

              {/* ====================================================
                  SUB TOTAL BEBAN
              ==================================================== */}
              <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                <TableCell className="py-2.5 pl-8 font-medium text-zinc-500 italic">
                  Sub Total Beban
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                  <span className="border-b border-zinc-300 pb-0.5">
                    {formatRupiah(data?.subTotalBeban || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* ====================================================
                  PENYUSUTAN
              ==================================================== */}
              {data?.bebanPenyusutan && data.bebanPenyusutan.length > 0 && (
                <>
                  <TableRow className="border-none bg-zinc-50/50 hover:bg-zinc-50/50">
                    <TableCell
                      className="py-2.5 pl-8 text-[10px] font-extrabold tracking-wide text-zinc-900 uppercase"
                      colSpan={2}
                    >
                      Beban Penyusutan
                    </TableCell>
                  </TableRow>

                  {data.bebanPenyusutan.map((item) => (
                    <TableRow
                      key={item.no_akun}
                      className="border-none hover:bg-zinc-50/30"
                    >
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>

                      <TableCell className="pr-8 text-right font-mono text-sm text-zinc-700">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* ====================================================
                  TOTAL BEBAN USAHA
              ==================================================== */}
              <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                <TableCell className="py-2.5 pl-8 font-medium text-zinc-500 italic">
                  Total Beban Usaha
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-sm font-black text-zinc-700">
                  <span className="border-b border-zinc-300 pb-0.5">
                    {formatRupiah(data?.totalBebanUsaha || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* ====================================================
                  PAJAK & ADMINISTRASI
              ==================================================== */}
              {data?.pnbpDanPajak && data.pnbpDanPajak.length > 0 && (
                <>
                  <TableRow className="border-none bg-zinc-50/50 hover:bg-zinc-50/50">
                    <TableCell
                      className="py-2.5 pl-8 text-[10px] font-extrabold tracking-wide text-zinc-900 uppercase"
                      colSpan={2}
                    >
                      Beban Pajak & Administrasi Lainnya
                    </TableCell>
                  </TableRow>

                  {data.pnbpDanPajak.map((item) => (
                    <TableRow
                      key={item.no_akun}
                      className="border-none hover:bg-zinc-50/30"
                    >
                      <TableCell className="py-2 pl-12 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>

                      <TableCell className="pr-8 text-right font-mono text-sm text-zinc-700">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* ====================================================
                  LABA BERSIH
              ==================================================== */}
              <TableRow className="border-t border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-900">
                <TableCell className="py-4 pl-6 text-xs font-black tracking-wider uppercase">
                  Laba Bersih Sesudah Pajak
                </TableCell>

                <TableCell className="pr-8 text-right font-mono text-base font-black text-emerald-400">
                  <span className="border-b-4 border-double border-emerald-400 pb-0.5">
                    {formatRupiah(data?.labaBersih || 0)}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ============================================================
          FOOTER STATUS
      ============================================================ */}
      <div className="flex justify-between px-2 text-[9px] font-bold tracking-wider text-zinc-400 uppercase italic">
        <p>* Laporan Laba Rugi Terintegrasi</p>

        <p>Periode: {getPeriodeShortLabel()}</p>
      </div>
    </div>
  )
}
