"use client"

import React, { useEffect, useState, useMemo } from "react"
import { getNeracaData, NeracaData } from "@/app/actions/neraca"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, RefreshCw, Scale } from "lucide-react"

interface AccountItem {
  no_akun: string
  nama_akun: string
  saldo: number
}

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

  // Gabungkan seluruh item akun untuk kemudahan query berdasarkan no_akun
  const allAccounts = useMemo(() => {
    if (!data) return []
    const combined: AccountItem[] = [
      ...(data.aktivaLancar || []),
      ...(data.hartaTetap || []),
      ...(data.kewajiban || []),
      ...(data.ekuitas || []),
      // Jika backend Anda sudah menyertakan investasi langsung di data:
      ...((data as any).investasi || [])
    ]
    return combined
  }, [data])

  // Helper pencarian saldo per akun
  const getAccount = (noAkun: string, fallbackName: string): AccountItem => {
    const found = allAccounts.find(
      (acc) => String(acc.no_akun).trim() === String(noAkun).trim()
    )
    return {
      no_akun: noAkun,
      nama_akun: found?.nama_akun || fallbackName,
      saldo: found ? Number(found.saldo) : 0
    }
  }

  // --- PEMETAAN SISI KIRI (AKTIVA) ---
  // A. Aset Lancar (Kas/Bank & Piutang)
  const asetLancarList = useMemo(() => [
    getAccount("11300", "Bank Pasif"),
    getAccount("11200", "Bank Aktif"),
    getAccount("11100", "Kas (Petty Cash)"),
    getAccount("12100", "Piutang Usaha"),
    getAccount("12102", "Piutang Pegawai"),
    getAccount("12103", "Piutang Pihak Berelasi")
  ], [allAccounts])

  // B. Harta Tetap (Akumulasi & Aset Tetap)
  const hartaTetapList = useMemo(() => {
    // 15105: Akumulasi Penyusutan (bersifat kontra-aset/mengurangi nilai)
    const penyusutan = getAccount("15105", "Akumulasi Penyusutan Aset Tetap")
    
    // Gabungan nilai aset tetap berwujud/peralatan/kendaraan/furniture
    const asetTetapAccounts = ["15200", "15300", "15400", "15500"]
    const totalNilaiAset = allAccounts
      .filter((a) => asetTetapAccounts.includes(String(a.no_akun).trim()))
      .reduce((sum, item) => sum + Number(item.saldo || 0), 0)

    return [
      {
        no_akun: "15000-GRP",
        nama_akun: "Aset Tetap",
        saldo: totalNilaiAset
      },
      {
        ...penyusutan,
        nama_akun: "Penyusutan Aset",
        // Nilai penyusutan umumnya mengurangi aset
        saldo: penyusutan.saldo > 0 ? -penyusutan.saldo : penyusutan.saldo
      }
    ]
  }, [allAccounts])

  // C. Investasi
  const investasiList = useMemo(() => [
    getAccount("16100", "Investasi Properti"),
    getAccount("16101", "Investasi Logam Mulia")
  ], [allAccounts])

  // --- PEMETAAN SISI KANAN (PASIVA) ---
  // A. Kewajiban / Utang
  const kewajibanList = useMemo(() => {
    // Utang Usaha (21100 Utang Vendor, 33-0001 Utang Belum Dibayar)
    const akunUtangUsaha = ["21100", "33-0001"]
    const totalUtangUsaha = allAccounts
      .filter((a) => akunUtangUsaha.includes(String(a.no_akun).trim()))
      .reduce((sum, item) => sum + Number(item.saldo || 0), 0)

    // Utang Pajak (22100, 22101, 22102, 22103, 22104)
    const totalUtangPajak = allAccounts
      .filter((a) => String(a.no_akun).startsWith("221"))
      .reduce((sum, item) => sum + Number(item.saldo || 0), 0)

    return [
      {
        no_akun: "21000-GRP",
        nama_akun: "Utang Usaha",
        saldo: totalUtangUsaha
      },
      {
        no_akun: "22000-GRP",
        nama_akun: "Utang Pajak",
        saldo: totalUtangPajak
      }
    ]
  }, [allAccounts])

  // B. Modal / Ekuitas
  const modalList = useMemo(() => [
    getAccount("13001", "Modal"),
    getAccount("13003", "Laba Tahun Berjalan"),
    getAccount("13002", "Laba Ditahan"),
    {
      ...getAccount("31101", "Dividen"),
      // Saldo dividen bersifat pengurang ekuitas
      saldo: getAccount("31101", "Dividen").saldo > 0 
        ? -getAccount("31101", "Dividen").saldo 
        : getAccount("31101", "Dividen").saldo
    }
  ], [allAccounts])

  // Perhitungan Subtotal dan Grand Total
  const totalAsetLancar = asetLancarList.reduce((acc, curr) => acc + curr.saldo, 0)
  const totalHartaTetap = hartaTetapList.reduce((acc, curr) => acc + curr.saldo, 0)
  const totalInvestasi = investasiList.reduce((acc, curr) => acc + curr.saldo, 0)
  const totalAktiva = totalAsetLancar + totalHartaTetap + totalInvestasi

  const totalKewajiban = kewajibanList.reduce((acc, curr) => acc + curr.saldo, 0)
  const totalModal = modalList.reduce((acc, curr) => acc + curr.saldo, 0)
  const totalPasiva = totalKewajiban + totalModal

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

        <div className="flex items-center gap-3">
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(e.target.value)}
            className="h-9 px-3 text-xs font-black bg-white border border-zinc-300 rounded-sm outline-none focus:border-black cursor-pointer uppercase"
          >
            <option value="2026">Tahun Buku 2026</option>
            <option value="2025">Tahun Buku 2025</option>
          </select>

          <Button variant="outline" onClick={fetchData} className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50">
            <RefreshCw className="h-4 w-4 text-zinc-500" /> RELOAD
          </Button>
          
          <Button className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
            <FileSpreadsheet className="h-4 w-4" /> EKSPOR EXCEL
          </Button>
        </div>
      </div>

      {/* AREA KERTAS DATA NERACA */}
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
                  {asetLancarList.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2 text-zinc-700 font-medium">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2 text-zinc-500 italic font-medium">Total Aset Lancar</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">
                      {formatRupiah(totalAsetLancar)}
                    </TableCell>
                  </TableRow>

                  {/* B. HARTA TETAP */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-4 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      B. HARTA TETAP
                    </TableCell>
                  </TableRow>
                  {hartaTetapList.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2 text-zinc-700 font-medium">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2 text-zinc-500 italic font-medium">Total Harta Tetap</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">
                      {formatRupiah(totalHartaTetap)}
                    </TableCell>
                  </TableRow>

                  {/* C. INVESTASI */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-4 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      C. INVESTASI
                    </TableCell>
                  </TableRow>
                  {investasiList.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2 text-zinc-700 font-medium">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2 text-zinc-500 italic font-medium">Total Investasi</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">
                      {formatRupiah(totalInvestasi)}
                    </TableCell>
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

                  {/* A. KEWAJIBAN */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-3 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      A. KEWAJIBAN / UTANG
                    </TableCell>
                  </TableRow>
                  {kewajibanList.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2 text-zinc-700 font-medium">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-100 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2 text-zinc-500 italic font-medium">Total Kewajiban</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">
                      {formatRupiah(totalKewajiban)}
                    </TableCell>
                  </TableRow>

                  {/* B. EKUITAS / MODAL */}
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="pl-6 pt-4 text-zinc-900 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      B. MODAL
                    </TableCell>
                  </TableRow>
                  {modalList.map((item) => (
                    <TableRow key={item.no_akun} className="hover:bg-zinc-50/30 border-none transition-colors">
                      <TableCell className="pl-12 py-2 text-zinc-700 font-medium">
                        {item.nama_akun}
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-900 pr-8 text-sm">
                        {formatRupiah(item.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b border-zinc-200 bg-zinc-50/30">
                    <TableCell className="pl-8 py-2 text-zinc-500 italic font-medium">Total Modal & Ekuitas</TableCell>
                    <TableCell className="text-right font-mono text-zinc-700 pr-8 font-black text-sm">
                      {formatRupiah(totalModal)}
                    </TableCell>
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
                {formatRupiah(totalAktiva)}
              </span>
            </div>
            <div className="flex items-center justify-between py-4 px-6">
              <span className="uppercase tracking-widest text-[10px]">TOTAL PASIVA (KEWAJIBAN & EKUITAS)</span>
              <span className="font-mono text-emerald-400 text-base border-b-4 border-double border-emerald-400 pb-0.5">
                {formatRupiah(totalPasiva)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FOOTER TIMESTAMPS */}
      <div className="text-[9px] font-bold text-zinc-400 flex justify-between px-2 uppercase italic tracking-wider">
        <p>* Sistem Neraca Terintegrasi</p>
        <p>Status Neraca: {totalAktiva === totalPasiva ? "Balanced Statement" : "Unbalanced Statement"}</p>
      </div>
    </div>
  )
}