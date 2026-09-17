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
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num)
  }

  const getPeriodeLabel = () => {
    if (currentMonth === "all") {
      return `Periode : 31 Desember ${currentYear}`
    }
    const selectedMonth = BULAN_OPTIONS.find((b) => b.value === currentMonth)?.label
    return `Periode : ${selectedMonth} ${currentYear}`
  }

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 text-xs font-bold tracking-widest text-slate-500 uppercase">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
        Mengkalkulasi Laporan Laba Rugi...
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* HEADER UTAMA */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Landmark className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Laporan Finansial Laba Rugi
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Kalkulasi pendapatan dan beban berdasarkan bagan akun riil database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih Bulan"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {BULAN_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Pilih Tahun"
            value={currentYear}
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
            <option value="2024">Tahun 2024</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="h-9 gap-1.5 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-600" /> REFRESH
          </Button>

          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> EKSPOR
          </Button>
        </div>
      </div>

      {/* KERTAS KERJA LAPORAN */}
      <Card className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-4 px-6">
          <div>
            <CardTitle className="text-sm font-bold tracking-wider text-blue-950 uppercase">
              LAPORAN LABA RUGI KOMPREHENSIF
            </CardTitle>
            <p className="mt-0.5 text-xs font-bold text-slate-700 uppercase">
              PT PEDULI LESTARI INDONESIA
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              {getPeriodeLabel()}
            </p>
          </div>
        </CardHeader>

        <CardContent className="w-full overflow-x-auto p-0">
          <Table className="w-full border-collapse">
            <TableBody className="text-xs sm:text-sm text-slate-800">
              {/* PENDAPATAN */}
              <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                <TableCell className="py-2.5 px-6 font-bold text-blue-900 uppercase" colSpan={2}>
                  I. Pendapatan
                </TableCell>
              </TableRow>

              <TableRow className="border-none transition-colors hover:bg-slate-50">
                <TableCell className="py-2 pl-8">Pendapatan Jasa Pelatihan</TableCell>
                <TableCell className="w-1/3 py-2 pr-6 text-right font-mono font-medium whitespace-nowrap">
                  {formatRupiah(data?.pendapatanPelatihan || 0)}
                </TableCell>
              </TableRow>

              <TableRow className="border-none transition-colors hover:bg-slate-50">
                <TableCell className="py-2 pl-8">Pendapatan Jasa Konsultan</TableCell>
                <TableCell className="w-1/3 py-2 pr-6 text-right font-mono font-medium whitespace-nowrap">
                  {formatRupiah(data?.pendapatanKonsultan || 0)}
                </TableCell>
              </TableRow>

              <TableRow className="border-b border-slate-200 bg-slate-50/30 hover:bg-slate-50/30">
                <TableCell className="py-2.5 pl-8 font-semibold text-slate-900">
                  Jumlah Pendapatan Bersih
                </TableCell>
                <TableCell className="w-1/3 py-2.5 pr-6 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                  <span className="border-b-2 border-slate-300 pb-0.5">
                    {formatRupiah(data?.totalPendapatan || 0)}
                  </span>
                </TableCell>
              </TableRow>

              <TableRow className="h-3 border-none hover:bg-transparent">
                <TableCell colSpan={2} />
              </TableRow>

              {/* BEBAN OPERASIONAL */}
              <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                <TableCell className="py-2.5 px-6 font-bold text-blue-900 uppercase" colSpan={2}>
                  II. Beban Operasional & Usaha
                </TableCell>
              </TableRow>

              {data?.bebanOperasional.map((item) => {
                const rincianList = item.rincian || []

                // Cek apakah ada lebih dari 1 pos akun DAN kelompok biaya atau nomor akunnya berbeda
                const distinctAccounts = new Set(
                  rincianList.map((r: any) => `${r.no_akun}-${r.kelompok_biaya_id || r.kelompok_biaya}`)
                )
                const shouldDropdown = rincianList.length > 1 && distinctAccounts.size > 1
                const isExpanded = expandedRows.has(item.no_akun)

                return (
                  <React.Fragment key={item.no_akun}>
                    <TableRow
                      onClick={() => shouldDropdown && toggleRow(item.no_akun)}
                      className={`border-b border-slate-100 transition-colors ${
                        shouldDropdown
                          ? "cursor-pointer hover:bg-blue-50/30"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <TableCell className="py-2.5 pl-8">
                        <div className="flex items-center gap-2">
                          {/* Chevron HANYA MUNCUL jika gabungan beda kelompok/akun */}
                          {shouldDropdown ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform" />
                            )
                          ) : (
                            <span className="inline-block w-4" />
                          )}

                          <span
                            className={
                              shouldDropdown
                                ? "font-semibold text-slate-900"
                                : "font-normal text-slate-800"
                            }
                          >
                            {item.nama_akun}
                          </span>

                          {/* Jika cuma akun tunggal, tampilkan kode akun langsung */}
                          {!shouldDropdown && item.no_akun && (
                            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                              {item.no_akun}
                            </span>
                          )}

                          {/* Badge jumlah jika gabungan */}
                          {shouldDropdown && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {rincianList.length} pos akun
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-1/3 py-2.5 pr-6 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>

                    {/* SUB-ROWS: Label murni dari field database kelompok_biaya */}
                    {shouldDropdown &&
                      isExpanded &&
                      rincianList.map((sub: any, idx) => {
                        const namaKelompok =
                          sub.kelompok_biaya ||
                          sub.nama_kelompok ||
                          (sub.kelompok_biaya_id ? `Kelompok ${sub.kelompok_biaya_id}` : "-")

                        return (
                          <TableRow
                            key={`${sub.no_akun}-${idx}`}
                            className="border-none bg-slate-50/70 hover:bg-blue-50/20 text-xs text-slate-600"
                          >
                            <TableCell className="py-2 pl-16">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                <span className="font-semibold text-slate-800">
                                  {sub.nama_akun}
                                </span>

                                {sub.no_akun && (
                                  <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                    {sub.no_akun}
                                  </span>
                                )}

                                {/* TAG KELOMPOK DARI DATABASE */}
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  <Tag className="h-2.5 w-2.5" />
                                  {namaKelompok}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="w-1/3 py-2 pr-6 text-right font-mono text-slate-700 whitespace-nowrap">
                              {formatRupiah(sub.saldo)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </React.Fragment>
                )
              })}

              {/* SUB TOTAL */}
              <TableRow className="border-none bg-slate-50/40 hover:bg-slate-50/40">
                <TableCell className="py-2.5 pl-8 font-semibold text-slate-800">
                  Sub Total Beban
                </TableCell>
                <TableCell className="w-1/3 py-2.5 pr-6 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                  <span className="border-b border-slate-300 pb-0.5">
                    {formatRupiah(data?.subTotalBeban || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* PENYUSUTAN */}
              {data?.bebanPenyusutan && data.bebanPenyusutan.length > 0 && (
                <>
                  <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                    <TableCell className="py-2 pl-8 font-bold text-slate-700" colSpan={2}>
                      Beban Penyusutan
                    </TableCell>
                  </TableRow>
                  {data.bebanPenyusutan.map((item) => (
                    <TableRow key={item.no_akun} className="border-none hover:bg-slate-50">
                      <TableCell className="py-1.5 pl-12">{item.nama_akun}</TableCell>
                      <TableCell className="w-1/3 py-1.5 pr-6 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              <TableRow className="border-b border-slate-200 bg-slate-50/30 hover:bg-slate-50/30">
                <TableCell className="py-2.5 pl-8 font-semibold text-slate-900">
                  Total Beban Usaha
                </TableCell>
                <TableCell className="w-1/3 py-2.5 pr-6 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                  <span className="border-b-2 border-slate-300 pb-0.5">
                    ({formatRupiah(data?.totalBebanUsaha || 0)})
                  </span>
                </TableCell>
              </TableRow>

              {/* PNBP & PAJAK */}
              {data?.pnbpDanPajak && data.pnbpDanPajak.length > 0 && (
                <>
                  <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                    <TableCell className="py-2 pl-8 font-bold text-slate-700" colSpan={2}>
                      Beban Pajak & Administrasi Lainnya
                    </TableCell>
                  </TableRow>
                  {data.pnbpDanPajak.map((item) => (
                    <TableRow key={item.no_akun} className="border-none hover:bg-slate-50">
                      <TableCell className="py-1.5 pl-12">{item.nama_akun}</TableCell>
                      <TableCell className="w-1/3 py-1.5 pr-6 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* LABA BERSIH */}
              <TableRow className="border-t-2 border-slate-300 bg-blue-50/30 hover:bg-blue-50/50">
                <TableCell className="py-4 pl-6 font-bold text-slate-900">
                  Laba Bersih Sesudah Pajak
                </TableCell>
                <TableCell className="w-1/3 py-4 pr-6 text-right font-mono text-base font-bold text-blue-700 whitespace-nowrap">
                  <span className="border-b-4 border-double border-blue-700 pb-1">
                    {formatRupiah(data?.labaBersih || 0)}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}