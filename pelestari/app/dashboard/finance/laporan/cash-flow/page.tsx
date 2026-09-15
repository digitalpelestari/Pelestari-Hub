"use client"

import { useEffect, useState } from "react"
import { getCashFlowData, CashFlowData } from "@/app/actions/cashflow"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Download, Wallet } from "lucide-react"

export default function CashFlowReport() {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const toDateInputValue = (d: Date) => d.toISOString().split("T")[0]

  const [startDate, setStartDate] = useState<string>(toDateInputValue(firstDayOfMonth))
  const [endDate, setEndDate] = useState<string>(toDateInputValue(lastDayOfMonth))
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchCashFlow = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await getCashFlowData("", "", start, end)
      setData(res)
    } catch (error) {
      console.error("Error fetching cash flow data:", error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      void fetchCashFlow(startDate, endDate)
    }
  }, [startDate, endDate])

  const formatRupiah = (num: number) => {
    const isNegative = num < 0
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Math.abs(num))

    return isNegative ? `(${formatted})` : formatted
  }

  const getActivityClass = (val: number) => {
    if (val > 0) return "text-emerald-700"
    if (val < 0) return "text-red-700"
    return "text-zinc-500"
  }

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 text-xs font-black text-zinc-400 uppercase tracking-widest italic bg-white">
        <RefreshCw className="h-4 w-4 animate-spin text-black" />
        Memuat data arus kas...
      </div>
    )
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      {/* HEADER BAR UTAMA */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Laporan Cash Flow
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            PT Peduli Lestari Indonesia Cash Flow Statement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase italic">
                Dari
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36 rounded-sm border-zinc-300 bg-white px-2 text-xs font-bold"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase italic">
                Sampai
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36 rounded-sm border-zinc-300 bg-white px-2 text-xs font-bold"
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => void fetchCashFlow(startDate, endDate)}
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" /> RELOAD
          </Button>

          <Button className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
            <Download className="h-4 w-4" /> EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* AREA DATA CASH FLOW */}
      <Card className="border border-zinc-200 shadow-none rounded-sm bg-white w-full overflow-hidden">
        <CardHeader className="text-left border-b border-zinc-200 bg-zinc-50/50 py-5 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight text-zinc-900">
                LAPORAN ARUS KAS
              </CardTitle>
              <p className="text-xs font-black text-blue-600 uppercase tracking-wider mt-0.5">
                PT PEDULI LESTARI INDONESIA
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <p>Periode: {data?.labelBulan || "-"} {data?.labelTahun || "-"}</p>
              <p className="mt-0.5">Denominasi Nilai: IDR (Rupiah)</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 w-full">
          <div className="divide-y divide-zinc-200 w-full">
            {/* ARUS KAS OPERASIONAL */}
            <div className="w-full">
              <div className="bg-zinc-100/80 border-b border-zinc-200 py-2.5 px-6">
                <span className="font-black text-xs uppercase tracking-wider text-zinc-800">
                  Arus Kas Operasional
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-200 hover:bg-zinc-100/80">
                    <TableHead className="font-black text-xs uppercase tracking-wider text-zinc-800">
                      Keterangan
                    </TableHead>
                    <TableHead className="text-right font-black text-xs uppercase tracking-wider text-zinc-800">
                      Jumlah
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Kas masuk dari pelanggan
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      {formatRupiah(data?.kasMasukDariPelanggan || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Pengeluaran operasional
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      -{formatRupiah(data?.pengeluaranOperasional || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-500 italic">
                      Kas bersih operasional
                    </TableCell>
                    <TableCell className={`text-right font-mono pr-6 font-black ${getActivityClass(data?.kasBersihOperasional || 0)}`}>
                      {formatRupiah(data?.kasBersihOperasional || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* ARUS KAS INVESTASI */}
            <div className="w-full">
              <div className="bg-zinc-100/80 border-b border-zinc-200 py-2.5 px-6">
                <span className="font-black text-xs uppercase tracking-wider text-zinc-800">
                  Arus Kas Investasi
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-200 hover:bg-zinc-100/80">
                    <TableHead className="font-black text-xs uppercase tracking-wider text-zinc-800">
                      Keterangan
                    </TableHead>
                    <TableHead className="text-right font-black text-xs uppercase tracking-wider text-zinc-800">
                      Jumlah
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Kas masuk investasi
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      {formatRupiah(data?.kasMasukInvestasi || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Kas keluar investasi
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      -{formatRupiah(data?.kasKeluarInvestasi || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-500 italic">
                      Kas bersih investasi
                    </TableCell>
                    <TableCell className={`text-right font-mono pr-6 font-black ${getActivityClass(data?.kasBersihInvestasi || 0)}`}>
                      {formatRupiah(data?.kasBersihInvestasi || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* ARUS KAS PEMBIAYAAN */}
            <div className="w-full">
              <div className="bg-zinc-100/80 border-b border-zinc-200 py-2.5 px-6">
                <span className="font-black text-xs uppercase tracking-wider text-zinc-800">
                  Arus Kas Pembiayaan
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-200 hover:bg-zinc-100/80">
                    <TableHead className="font-black text-xs uppercase tracking-wider text-zinc-800">
                      Keterangan
                    </TableHead>
                    <TableHead className="text-right font-black text-xs uppercase tracking-wider text-zinc-800">
                      Jumlah
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Kas masuk pembiayaan
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      {formatRupiah(data?.kasMasukPembiayaan || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-none hover:bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-700">
                      Kas keluar pembiayaan
                    </TableCell>
                    <TableCell className="text-right font-mono pr-6">
                      -{formatRupiah(data?.kasKeluarPembiayaan || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t border-zinc-100 bg-zinc-50/30">
                    <TableCell className="py-2.5 pl-6 text-zinc-500 italic">
                      Kas bersih pembiayaan
                    </TableCell>
                    <TableCell className={`text-right font-mono pr-6 font-black ${getActivityClass(data?.kasBersihPembiayaan || 0)}`}>
                      {formatRupiah(data?.kasBersihPembiayaan || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* TOTAL BALANCE FOOTER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-900 text-white font-black text-xs">
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">
                Perubahan Kas Bersih
              </span>
              <span className="font-mono text-base border-b-4 border-double border-emerald-400 pb-0.5">
                {formatRupiah(data?.kasBersihPerubahan || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">
                Kas Awal Periode
              </span>
              <span className="font-mono text-emerald-400 text-base">
                {formatRupiah(data?.kasAwalPeriode || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">
                Kas dan Setara Kas (Akhir)
              </span>
              <span className="font-mono text-emerald-400 text-base border-b-4 border-double border-emerald-400 pb-0.5">
                {formatRupiah(data?.kasDanSetaraKas || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FOOTER TIMESTAMPS */}
      <div className="text-[9px] font-bold text-zinc-400 flex justify-between px-2 uppercase italic tracking-wider">
        <p>* Sistem Cash Flow Terintegrasi</p>
        <p>Status Cash Flow: Real-time Report</p>
      </div>
    </div>
  )
}
