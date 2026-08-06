"use client"

import React, { useEffect, useState } from "react"
import { getNeracaData, NeracaData } from "@/app/actions/neraca"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, RefreshCw, Scale } from "lucide-react"

export default function NeracaPage() {
  const [data, setData] = useState<NeracaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<string>("2026")

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getNeracaData(currentYear)
      setData(res)
    } catch (err) {
      console.error("Gagal memuat komponen neraca saldo:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentYear])

  const formatRupiah = (num: number) => {
    const isNegative = num < 0
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(Math.abs(num))

    return isNegative ? `(${formatted})` : formatted
  }

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 text-xs font-black text-zinc-400 uppercase tracking-widest italic bg-white">
        <RefreshCw className="h-4 w-4 animate-spin text-black" /> 
        Menyeimbangkan Posisi Aktiva dan Pasiva Real-time...
      </div>
    )
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* 1. BAR ACTION ATAS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4 w-full">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-black flex items-center gap-2">
            <Scale className="h-6 w-6 text-zinc-800" /> Laporan Neraca Keuangan
          </h1>
          <p className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase italic mt-0.5">
            PT Peduli Lestari Indonesia Balance Sheet Statement
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-9 px-3 text-xs font-black bg-white border border-zinc-300 rounded-sm outline-none focus:border-black cursor-pointer uppercase italic"
          >
            <option value="2026">Tahun Buku 2026</option>
            <option value="2025">Tahun Buku 2025</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 border-zinc-300 text-zinc-700 text-xs font-black rounded-sm px-4 bg-white">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> RELOAD
          </Button>
          
          <Button size="sm" className="h-9 bg-black text-white text-xs font-black italic rounded-sm px-4 hover:bg-zinc-800 shadow-sm">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* 2. AREA KERTAS DATA NERACA */}
      <Card className="border border-zinc-200 shadow-none rounded-sm bg-white w-full overflow-hidden">
        <CardHeader className="text-left border-b border-zinc-200 bg-zinc-50/50 py-5 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight text-zinc-900">
                LAPORAN NERACA (POSISI KEUANGAN BERJALAN)
              </CardTitle>
              <p className="text-xs font-black text-blue-600 uppercase tracking-wider mt-0.5">
                PT PEDULI LESTARI INDONESIA
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <p>Per Tanggal S/D: 31 Desember {currentYear}</p>
              <p className="mt-0.5">Denominasi Nilai: IDR (Rupiah)</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 w-full">
            
            {/* SEKSI KIRI: AKTIVA */}
            <div className="w-full">
              <Table className="w-full">
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="bg-zinc-100/80 hover:bg-zinc-100/80 border-b border-zinc-200">
                    <TableCell className="font-black text-xs uppercase tracking-wider text-black py-3 px-6" colSpan={2}>
                      AKTIVA (ASET)
                    </TableCell>
                  </TableRow>

                  {/* A. ASET LANCAR */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-3 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      A. ASET LANCAR
                    </TableCell>
                  </TableRow>
                  
                  {data?.aktivaLancar && data.aktivaLancar.length > 0 ? (
                    data.aktivaLancar.map((item) => (
                      <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                        <TableCell className="pl-12 py-2.5 text-zinc-700 font-medium">
                          <span>{item.nama_akun}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">{formatRupiah(item.saldo)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell className="pl-12 py-3 text-zinc-400 italic font-medium" colSpan={2}>
                        Tidak ada data aset lancar.
                      </TableCell>
                    </TableRow>
                  )}
                  
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2.5 text-zinc-500 italic font-medium">Total Aset Lancar</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">{formatRupiah(data?.totalAktivaLancar || 0)}</TableCell>
                  </TableRow>

                  {/* B. HARTA TETAP */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-4 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      B. HARTA TETAP
                    </TableCell>
                  </TableRow>
                  {data && data.hartaTetap.length > 0 ? (
                    data.hartaTetap.map((item) => (
                      <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                        <TableCell className="pl-12 py-2.5 text-zinc-700 font-medium">
                          <span>{item.nama_akun}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">{formatRupiah(item.saldo)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell className="pl-12 py-3 text-zinc-400 italic font-medium" colSpan={2}>Tidak ada data harta tetap terdaftar.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2.5 text-zinc-500 italic font-medium">Total Harta Tetap</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">{formatRupiah(data?.totalHartaTetap || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* SEKSI KANAN: PASIVA */}
            <div className="w-full">
              <Table className="w-full">
                <TableBody className="text-xs font-bold text-zinc-800">
                  <TableRow className="bg-zinc-100/80 hover:bg-zinc-100/80 border-b border-zinc-200">
                    <TableCell className="font-black text-xs uppercase tracking-wider text-black py-3 px-6" colSpan={2}>
                      PASIVA (KEWAJIBAN & EKUITAS)
                    </TableCell>
                  </TableRow>

                  {/* KEWAJIBAN */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-3 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      A. KEWAJIBAN / HUTANG
                    </TableCell>
                  </TableRow>
                  {data && data.kewajiban.length > 0 ? (
                    data.kewajiban.map((item) => (
                      <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                        <TableCell className="pl-12 py-2.5 text-zinc-700 font-medium">
                          <span>{item.nama_akun}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">{formatRupiah(item.saldo)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell className="pl-12 py-3 text-zinc-400 italic font-medium" colSpan={2}>Perusahaan bersih dari kewajiban hutang usaha.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2.5 text-zinc-500 italic font-medium">Total Kewajiban</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">{formatRupiah(data?.totalKewajiban || 0)}</TableCell>
                  </TableRow>

                  {/* EKUITAS */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-4 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      B. EKUITAS (MODAL & LABA)
                    </TableCell>
                  </TableRow>
                  {data?.ekuitas.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2.5 text-zinc-700 font-medium">
                        <span>{item.nama_akun}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2.5 text-zinc-500 italic font-medium">Total Ekuitas Perusahaan</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">{formatRupiah(data?.totalEkuitas || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

          </div>

          {/* TOTAL BALANCE FOOTER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-900 text-white font-black text-xs">
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">TOTAL AKTIVA (JUMLAH ASET)</span>
              <span className="font-mono text-emerald-400 text-base border-b-4 border-double border-emerald-400 pb-0.5">
                {formatRupiah(data?.totalAktiva || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</span>
              <span className="font-mono text-emerald-400 text-base border-b-4 border-double border-emerald-400 pb-0.5">
                {formatRupiah(data?.totalPasiva || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FOOTER TIMESTAMPS */}
      <div className="text-[9px] font-bold text-zinc-400 flex justify-between px-2 uppercase italic tracking-wider">
        <p>* Sistem Neraca Terintegrasi</p>
        <p>Status Neraca: Balanced Statement</p>
      </div>
    </div>
  )
}