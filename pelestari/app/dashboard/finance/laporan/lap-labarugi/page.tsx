"use client"

import React, { useEffect, useState } from "react"
import { getLabaRugiData, LabaRugiData } from "@/app/actions/labarugi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, RefreshCw, Landmark, ArrowRightLeft } from "lucide-react"

export default function LabaRugiPage() {
  const [data, setData] = useState<LabaRugiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<string>("2026")

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getLabaRugiData(currentYear)
      setData(res)
    } catch (err) {
      console.error("Gagal memuat struktur laba rugi:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentYear])

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(num)
  }

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 text-xs font-bold text-zinc-500 uppercase tracking-widest italic bg-white/50">
        <RefreshCw className="h-4 w-4 animate-spin text-zinc-900" /> 
        Menghitung Akumulasi Saldo Invoice & Beban Master...
      </div>
    )
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* 1. HEADER BAR UTAMA (FULL WIDTH) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4 w-full">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-black flex items-center gap-2">
            <Landmark className="h-6 w-6" /> Laporan Finansial Laba Rugi
          </h1>
          
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* PILIHAN TAHUN BUKU */}
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-9 px-3 text-xs font-black bg-white border border-zinc-300 rounded-sm outline-none focus:border-black cursor-pointer uppercase italic"
          >
            <option value="2026">Tahun Buku 2026</option>
            <option value="2025">Tahun Buku 2025</option>
            <option value="2024">Tahun Buku 2024</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 border-zinc-300 text-zinc-700 text-xs font-black rounded-sm px-4 gap-1.5 bg-white">
            <RefreshCw className="h-3.5 w-3.5" /> REFRESH
          </Button>
          
          <Button size="sm" className="h-9 bg-black text-white text-xs font-black italic rounded-sm px-4 gap-1.5 hover:bg-zinc-800 shadow-sm">
            <FileSpreadsheet className="h-4 w-4" /> EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* 2. AREA DATA LAPORAN (FULL WIDTH DARI KIRI KE KANAN) */}
      <Card className="border border-zinc-300 shadow-sm rounded-sm bg-white w-full overflow-hidden">
        {/* KOP LAPORAN AKUNTANSI */}
        <CardHeader className="text-left border-b border-zinc-300 bg-zinc-50/50 py-5 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-tight text-zinc-900">
                LAPORAN LABA RUGI
              </CardTitle>
              <p className="text-xs font-black text-blue-700 uppercase tracking-wider mt-0.5">
                PT PEDULI LESTARI INDONESIA
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <p>Periode S/D: 31 Desember {currentYear}</p>
              <p className="mt-0.5">Mata Uang: IDR (Rupiah)</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 w-full overflow-x-auto">
          {/* Pembungkus Tabel Akuntansi Dua Kolom tanpa Batas Maksimal */}
          <Table className="w-full border-collapse">
            <TableBody className="text-xs font-bold text-zinc-800">
              
              {/* ======================================================== */}
              {/* A. KELOMPOK PENDAPATAN (SUM INVOICE) */}
              {/* ======================================================== */}
              <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-b border-zinc-300">
                <TableCell className="font-black text-xs uppercase tracking-wider text-black py-3 px-6" colSpan={2}>
                  I. KELOMPOK PENDAPATAN OPERASIONAL
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-zinc-50/40 border-b border-zinc-100 transition-colors">
                <TableCell className="pl-12 py-3 text-zinc-600 font-medium uppercase tracking-tight">
                  Pendapatan Jasa Pelatihan
                </TableCell>
                <TableCell className="text-right font-mono text-zinc-900 pr-12 text-sm">
                  {formatRupiah(data?.pendapatanPelatihan || 0)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-zinc-50/40 border-b border-zinc-100 transition-colors">
                <TableCell className="pl-12 py-3 text-zinc-600 font-medium uppercase tracking-tight">
                  Pendapatan Jasa Konsultan
                </TableCell>
                <TableCell className="text-right font-mono text-zinc-900 pr-12 text-sm">
                  {formatRupiah(data?.pendapatanKonsultan || 0)}
                </TableCell>
              </TableRow>

              {/* Total Sub Pendapatan */}
              <TableRow className="bg-zinc-50/30 hover:bg-zinc-50/30 border-b border-zinc-300">
                <TableCell className="font-black text-black uppercase tracking-wider pl-6 py-3.5">
                  JUMLAH PENDAPATAN BERSIH
                </TableCell>
                <TableCell className="text-right font-black font-mono text-zinc-950 pr-12 text-sm border-t border-zinc-400">
                  <span className="border-b-2 border-zinc-900 pb-0.5">
                    {formatRupiah(data?.totalPendapatan || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* Spacing Row */}
              <TableRow className="h-6 border-b border-zinc-100 hover:bg-transparent"><TableCell colSpan={2}></TableCell></TableRow>

              {/* ======================================================== */}
              {/* B. KELOMPOK BEBAN (AKUN KEPALA 5) */}
              {/* ======================================================== */}
              <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-b border-zinc-300">
                <TableCell className="font-black text-xs uppercase tracking-wider text-black py-3 px-6" colSpan={2}>
                  II. BEBAN USAHA / JENIS BIAYA OPERASIONAL
                </TableCell>
              </TableRow>
              
              {data && data.bebanOperasional.length > 0 ? (
                data.bebanOperasional.map((item) => (
                  <TableRow key={item.no_akun} className="hover:bg-zinc-50/40 border-b border-zinc-100 transition-colors">
                    <TableCell className="pl-12 py-3 text-zinc-600 font-medium uppercase tracking-tight flex items-center justify-between">
                      <span>{item.nama_akun}</span>
                      <Badge variant="outline" className="text-[8px] rounded-sm bg-zinc-50 font-black text-zinc-400 px-1 py-0 border-zinc-200">
                        {item.kelompok_biaya}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-600 pr-12 font-medium">
                      {formatRupiah(item.saldo)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-b"><TableCell colSpan={2} className="py-4 text-center text-zinc-400 italic">Tidak ada transaksi beban terdata.</TableCell></TableRow>
              )}

              {/* Total Sub Beban */}
              <TableRow className="bg-zinc-50/30 hover:bg-zinc-50/30 border-b border-zinc-300">
                <TableCell className="font-black text-black uppercase tracking-wider pl-6 py-3.5">
                  TOTAL BEBAN USAHA OPERASIONAL
                </TableCell>
                <TableCell className="text-right font-black font-mono text-zinc-950 pr-12 text-sm border-t border-zinc-400">
                  ({formatRupiah(data?.totalBebanOperasional || 0)})
                </TableCell>
              </TableRow>

              {/* Spacing Row */}
              <TableRow className="h-6 border-b border-zinc-100 hover:bg-transparent"><TableCell colSpan={2}></TableCell></TableRow>

              {/* ======================================================== */}
              {/* C. KELOMPOK PNBP & PAJAK (KODE 6 / 9) */}
              {/* ======================================================== */}
              {data && data.pnbpDanPajak.length > 0 && (
                <>
                  <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-b border-zinc-300">
                    <TableCell className="font-black text-xs uppercase tracking-wider text-black py-3 px-6" colSpan={2}>
                      III. POTONGAN PNBP & ESTIMASI PAJAK TERHUTANG
                    </TableCell>
                  </TableRow>
                  {data.pnbpDanPajak.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/40 border-b border-zinc-100 transition-colors">
                      <TableCell className="pl-12 py-3 text-zinc-600 font-medium uppercase tracking-tight">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-600 pr-12 font-medium">
                        ({formatRupiah(item.saldo)})
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-zinc-50/30 hover:bg-zinc-50/30 border-b border-zinc-300">
                    <TableCell className="font-black text-black uppercase tracking-wider pl-6 py-3.5">
                      TOTAL POTONGAN NEGARA & PAJAK
                    </TableCell>
                    <TableCell className="text-right font-black font-mono text-zinc-950 pr-12 text-sm border-t border-zinc-400">
                      ({formatRupiah(data?.totalPnbpDanPajak || 0)})
                    </TableCell>
                  </TableRow>
                  <TableRow className="h-6 border-b border-zinc-100 hover:bg-transparent"><TableCell colSpan={2}></TableCell></TableRow>
                </>
              )}

              {/* ======================================================== */}
              {/* D. GRAND TOTAL LABA BERSIH AKHIR */}
              {/* ======================================================== */}
              <TableRow className="bg-zinc-950 text-white hover:bg-zinc-950">
                <TableCell className="font-black text-xs uppercase tracking-widest pl-6 py-4">
                  LABA BERSIH SESUDAH PAJAK (NET INCOME)
                </TableCell>
                <TableCell className="text-right font-black font-mono text-emerald-400 pr-12 text-base">
                  <span className="border-b-4 border-double border-emerald-400 pb-1">
                    {formatRupiah(data?.labaBersih || 0)}
                  </span>
                </TableCell>
              </TableRow>

            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FOOTER TIMESTAMPS */}
      <div className="text-[9px] font-bold text-zinc-400 flex justify-between px-2 uppercase italic tracking-wider">
        <p>* Seluruh nilai finansial diekstraksi dari relational data model secara otomatis.</p>
        <p>Sistem Akurasi: Lunas (Paid) Invoice Only</p>
      </div>
    </div>
  )
}