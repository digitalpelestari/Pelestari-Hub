"use client"

import React, { useEffect, useState } from "react"
import { getLabaRugiData, LabaRugiData } from "@/app/actions/labarugi" 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, RefreshCw, Landmark } from "lucide-react"

export default function LabaRugiPage() {
  const [data, setData] = useState<LabaRugiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<string>("2026")

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getLabaRugiData(currentYear)
      if (res) {
        setData(res)
      }
    } catch (err) {
      console.error("Gagal memuat struktur laba rugi dari database:", err)
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
        Mengkalkulasi Laporan Laba Rugi...
      </div>
    )
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* HEADER UTAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4 w-full">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-black flex items-center gap-2">
            <Landmark className="h-6 w-6" /> Laporan Finansial Laba Rugi
          </h1>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
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
            <FileSpreadsheet className="h-4 w-4" /> EKSPOR
          </Button>
        </div>
      </div>

      {/* AREA KERTAS KERJA LAPORAN */}
      <Card className="border border-zinc-300 shadow-sm rounded-sm bg-white w-full overflow-hidden">
        {/* KOP LAPORAN (Menyerupai Excel) */}
        <CardHeader className="text-left border-b-2 border-black bg-white py-4 px-6 rounded-none">
          <div>
            <CardTitle className="text-base font-black uppercase text-black">
              LABA RUGI
            </CardTitle>
            <p className="text-sm font-black text-black uppercase mt-0.5">
              PT PEDULI LESTARI INDONESIA
            </p>
            <p className="text-xs font-medium text-black mt-0.5">
              Periode : 31 Desember {currentYear}
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 w-full overflow-x-auto">
          <Table className="w-full border-collapse">
            <TableBody className="text-[13px] font-medium text-black">
              
              {/* ========================================================= */}
              {/* PENDAPATAN */}
              {/* ========================================================= */}
              <TableRow className="hover:bg-transparent border-none">
                <TableCell className="font-bold py-2 px-6" colSpan={2}>
                  Pendapatan
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-zinc-50 border-none transition-colors">
                <TableCell className="pl-6 py-1.5">Pendapatan Jasa Pelatihan</TableCell>
                <TableCell className="text-right pr-6 w-1/3 whitespace-nowrap">
                  {formatRupiah(data?.pendapatanPelatihan || 0)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-zinc-50 border-none transition-colors">
                <TableCell className="pl-6 py-1.5">Pendapatan Jasa Konsultan</TableCell>
                <TableCell className="text-right pr-6 w-1/3 whitespace-nowrap">
                  {formatRupiah(data?.pendapatanKonsultan || 0)}
                </TableCell>
              </TableRow>

              <TableRow className="hover:bg-transparent border-none">
                <TableCell className="pl-6 py-2">Jumlah Pendapatan Bersih</TableCell>
                <TableCell className="text-right font-bold pr-6 pt-2 w-1/3 whitespace-nowrap">
                  <span className="border-b-4 border-double border-black pb-0.5 block w-full text-right">
                    {formatRupiah(data?.totalPendapatan || 0)}
                  </span>
                </TableCell>
              </TableRow>
              
              <TableRow className="h-4 border-none hover:bg-transparent"><TableCell colSpan={2}></TableCell></TableRow>

              {/* ========================================================= */}
              {/* BEBAN OPERASIONAL */}
              {/* ========================================================= */}
              <TableRow className="hover:bg-transparent border-none">
                <TableCell className="font-bold py-2 px-6" colSpan={2}>
                  Beban
                </TableCell>
              </TableRow>
              
              {data?.bebanOperasional.map((item) => (
                <TableRow key={item.no_akun} className="hover:bg-zinc-50 border-none transition-colors">
                  <TableCell className="pl-6 py-1">{item.nama_akun}</TableCell>
                  <TableCell className="text-right pr-6 py-1 w-1/3 whitespace-nowrap">
                    {formatRupiah(item.saldo)}
                  </TableCell>
                </TableRow>
              ))}

              {/* ========================================================= */}
              {/* SUB TOTAL BEBAN & PENYUSUTAN */}
              {/* ========================================================= */}
              <TableRow className="hover:bg-transparent border-none mt-2">
                <TableCell className="font-bold pl-6 py-3">Sub Total Beban</TableCell>
                <TableCell className="text-right font-bold pr-6 py-3 w-1/3 whitespace-nowrap">
                  <span className="border-b-4 border-double border-black pb-0.5 block w-full text-right">
                    {formatRupiah(data?.subTotalBeban || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {data?.bebanPenyusutan.map((item) => (
                <TableRow key={item.no_akun} className="hover:bg-zinc-50 border-none transition-colors">
                  <TableCell className="pl-6 py-1">{item.nama_akun}</TableCell>
                  <TableCell className="text-right pr-6 py-1 w-1/3 whitespace-nowrap">
                    {formatRupiah(item.saldo)}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="hover:bg-transparent border-none">
                <TableCell className="pl-6 py-2">Total Beban Usaha</TableCell>
                <TableCell className="text-right font-bold pr-6 pt-2 w-1/3 whitespace-nowrap">
                  <span className="border-b-4 border-double border-black pb-0.5 block w-full text-right">
                    {formatRupiah(data?.totalBebanUsaha || 0)}
                  </span>
                </TableCell>
              </TableRow>

              {/* ========================================================= */}
              {/* PNBP & PAJAK TERHUTANG */}
              {/* ========================================================= */}
              {data?.pnbpDanPajak.map((item) => (
                <TableRow key={item.no_akun} className="hover:bg-zinc-50 border-none transition-colors">
                  <TableCell className="pl-6 py-1.5">{item.nama_akun}</TableCell>
                  <TableCell className="text-right pr-6 py-1.5 w-1/3 whitespace-nowrap">
                    {formatRupiah(item.saldo)}
                  </TableCell>
                </TableRow>
              ))}

              {/* ========================================================= */}
              {/* LABA BERSIH SESUDAH PAJAK */}
              {/* ========================================================= */}
              <TableRow className="hover:bg-transparent border-none">
                <TableCell className="font-bold text-[14px] pl-6 pt-3 pb-6">
                  Laba Bersih Sesudah Pajak
                </TableCell>
                <TableCell className="text-right font-bold text-[14px] pr-6 pt-3 pb-6 w-1/3 whitespace-nowrap">
                  <span className="border-b-4 border-double border-black pb-1 block w-full text-right">
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