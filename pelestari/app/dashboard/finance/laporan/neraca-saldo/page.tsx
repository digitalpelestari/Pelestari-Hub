"use client"

import { useEffect, useState } from "react"
import {
  FileSpreadsheet,
  RefreshCw,
  Scale,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

import {
  getNeracaSaldo,
  NeracaSaldoItem,
} from "@/app/actions/neraca-saldo"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

export default function NeracaSaldoPage() {
  const [data, setData] = useState<NeracaSaldoItem[]>([])
  const [loading, setLoading] = useState(true)

  const [tanggalMulai, setTanggalMulai] = useState("")
  const [tanggalSelesai, setTanggalSelesai] = useState("")

  const [error, setError] = useState("")

  async function loadData(
    mulai: string = tanggalMulai,
    selesai: string = tanggalSelesai
  ) {
    try {
      setLoading(true)
      setError("")

      const result = await getNeracaSaldo(
        mulai || undefined,
        selesai || undefined
      )

      if (!result.success) {
        setError(
          result.error || "Gagal mengambil data neraca saldo"
        )

        setData([])
        return
      }

      setData(result.data)
    } catch (error: any) {
      console.error("Gagal memuat neraca saldo:", error)

      setError(
        error?.message ||
          "Terjadi kesalahan saat mengambil data"
      )

      setData([])
    } finally {
      setLoading(false)
    }
  }

  /*
   * Load seluruh data ketika halaman pertama kali dibuka.
   */
  useEffect(() => {
    loadData("", "")
  }, [])

  /*
   * Filter otomatis ketika kedua tanggal sudah dipilih.
   */
  useEffect(() => {
    if (tanggalMulai && tanggalSelesai) {
      loadData(tanggalMulai, tanggalSelesai)
    }
  }, [tanggalMulai, tanggalSelesai])

  /*
   * Reset filter ke seluruh periode.
   */
  function handleReset() {
    setTanggalMulai("")
    setTanggalSelesai("")
    loadData("", "")
  }

  /*
   * Format angka menjadi Rupiah.
   */
  function formatRupiah(value: number) {
    const isNegative = value < 0

    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value))

    return isNegative ? `(${formatted})` : formatted
  }

  /*
   * Hanya tampilkan akun yang memiliki
   * transaksi debit atau kredit.
   */
  const filteredData = data.filter(
    (item) =>
      Number(item.debit || 0) !== 0 ||
      Number(item.kredit || 0) !== 0
  )

  /*
   * Total debit.
   */
  const totalDebit = data.reduce(
    (total, item) =>
      total + Number(item.debit || 0),
    0
  )

  /*
   * Total kredit.
   */
  const totalKredit = data.reduce(
    (total, item) =>
      total + Number(item.kredit || 0),
    0
  )

  /*
   * Selisih debit dan kredit.
   */
  const selisih = totalDebit - totalKredit

  const isBalance = selisih === 0

  /*
   * Loading.
   */
  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center gap-3 bg-white text-xs font-black tracking-widest text-zinc-400 uppercase italic">
        <RefreshCw className="h-4 w-4 animate-spin text-black" />
        Memuat Neraca Saldo...
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-6 font-sans text-zinc-900">

      {/* =====================================================
          HEADER UTAMA
      ===================================================== */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">

        <div className="space-y-1">
          <div className="flex items-center gap-2.5">

            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Scale className="h-5 w-5" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Neraca Saldo
            </h1>

          </div>

          <p className="pl-9 text-xs text-zinc-500">
            PT Peduli Lestari Indonesia Trial Balance Statement
          </p>
        </div>

        <div className="flex items-center gap-3">

          <Button
            variant="outline"
            onClick={() => loadData()}
            disabled={loading}
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <RefreshCw
              className={`h-4 w-4 text-zinc-500 ${
                loading ? "animate-spin" : ""
              }`}
            />

            RELOAD
          </Button>

          <Button
            className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800"
          >
            <FileSpreadsheet className="h-4 w-4" />
            EKSPOR EXCEL
          </Button>

        </div>
      </div>


      {/* =====================================================
          FILTER PERIODE
      ===================================================== */}
      <Card className="w-full rounded-sm border border-zinc-200 bg-white shadow-none">

        <CardHeader className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-4">

          <CardTitle className="text-xs font-black tracking-wider text-zinc-900 uppercase">
            Filter Periode Laporan
          </CardTitle>

        </CardHeader>

        <CardContent className="px-6 py-5">

          <div className="flex flex-col gap-4 md:flex-row md:items-end">

            {/* Tanggal Mulai */}
            <div className="w-full md:w-56">

              <label className="mb-2 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                Tanggal Mulai
              </label>

              <Input
                type="date"
                value={tanggalMulai}
                max={tanggalSelesai || undefined}
                onChange={(e) =>
                  setTanggalMulai(e.target.value)
                }
                className="h-10 rounded-sm border-zinc-300 text-xs"
              />

            </div>


            {/* Tanggal Selesai */}
            <div className="w-full md:w-56">

              <label className="mb-2 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                Tanggal Selesai
              </label>

              <Input
                type="date"
                value={tanggalSelesai}
                min={tanggalMulai || undefined}
                onChange={(e) =>
                  setTanggalSelesai(e.target.value)
                }
                className="h-10 rounded-sm border-zinc-300 text-xs"
              />

            </div>


            {/* Reset */}
            <Button
              variant="outline"
              onClick={handleReset}
              className="h-10 gap-2 rounded-sm border-zinc-300 px-5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCw className="h-4 w-4" />
              RESET
            </Button>

          </div>

          <p className="mt-3 text-[10px] text-zinc-400">
            Data akan diperbarui otomatis setelah tanggal mulai
            dan tanggal selesai dipilih.
          </p>

        </CardContent>
      </Card>


      {/* =====================================================
          STATUS / SUMMARY
      ===================================================== */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">

        {/* TOTAL DEBIT */}
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-none">

          <CardContent className="p-5">

            <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              Total Debit
            </p>

            <p className="mt-2 font-mono text-xl font-black text-zinc-900">
              {formatRupiah(totalDebit)}
            </p>

          </CardContent>
        </Card>


        {/* TOTAL KREDIT */}
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-none">

          <CardContent className="p-5">

            <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              Total Kredit
            </p>

            <p className="mt-2 font-mono text-xl font-black text-zinc-900">
              {formatRupiah(totalKredit)}
            </p>

          </CardContent>
        </Card>


        {/* STATUS */}
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-none">

          <CardContent className="p-5">

            <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              Status Neraca
            </p>

            <div className="mt-2 flex items-center gap-2">

              {isBalance ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                  <span className="text-sm font-black text-emerald-600 uppercase">
                    Balance
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />

                  <span className="text-sm font-black text-red-600 uppercase">
                    Tidak Balance
                  </span>
                </>
              )}

            </div>

            {!isBalance && (
              <p className="mt-1 font-mono text-[10px] font-bold text-zinc-500">
                Selisih: {formatRupiah(Math.abs(selisih))}
              </p>
            )}

          </CardContent>
        </Card>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}
      {error && (
        <Card className="rounded-sm border-red-200 bg-red-50 shadow-none">

          <CardContent className="flex items-center gap-3 p-4 text-red-600">

            <AlertCircle className="h-5 w-5" />

            <span className="text-xs font-semibold">
              {error}
            </span>

          </CardContent>

        </Card>
      )}


      {/* =====================================================
          LAPORAN NERACA SALDO
      ===================================================== */}
      <Card className="w-full overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-none">

        {/* Header laporan */}
        <CardHeader className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <CardTitle className="text-sm font-black tracking-tight text-zinc-900 uppercase">
                LAPORAN NERACA SALDO
              </CardTitle>

              <p className="mt-0.5 text-xs font-black tracking-wider text-blue-600 uppercase">
                PT PEDULI LESTARI INDONESIA
              </p>

            </div>

            <div className="text-left font-mono text-[10px] font-bold tracking-wider text-zinc-400 uppercase sm:text-right">

              {tanggalMulai && tanggalSelesai ? (
                <p>
                  PERIODE: {tanggalMulai} S/D {tanggalSelesai}
                </p>
              ) : (
                <p>
                  SELURUH PERIODE TRANSAKSI
                </p>
              )}

              <p className="mt-0.5">
                DENOMINASI NILAI: IDR (RUPIAH)
              </p>

            </div>

          </div>

        </CardHeader>


        <CardContent className="w-full p-0">

          <div className="w-full overflow-x-auto">

            <Table className="w-full">

              {/* Header tabel */}
              <TableHeader>

                <TableRow className="border-b border-zinc-300 bg-zinc-100/80 hover:bg-zinc-100/80">

                  <TableHead className="w-[140px] px-6 py-3 text-[10px] font-black tracking-wider text-zinc-900 uppercase">
                    No. Akun
                  </TableHead>

                  <TableHead className="px-6 py-3 text-[10px] font-black tracking-wider text-zinc-900 uppercase">
                    Nama Akun
                  </TableHead>

                  <TableHead className="w-[240px] px-6 py-3 text-right text-[10px] font-black tracking-wider text-zinc-900 uppercase">
                    Debit
                  </TableHead>

                  <TableHead className="w-[240px] px-6 py-3 text-right text-[10px] font-black tracking-wider text-zinc-900 uppercase">
                    Kredit
                  </TableHead>

                </TableRow>

              </TableHeader>


              <TableBody className="text-xs text-zinc-800">

                {filteredData.length === 0 ? (

                  <TableRow className="hover:bg-transparent">

                    <TableCell
                      colSpan={4}
                      className="h-40 text-center text-xs text-zinc-400 italic"
                    >
                      Tidak ada data neraca saldo.
                    </TableCell>

                  </TableRow>

                ) : (

                  filteredData.map((item) => (

                    <TableRow
                      key={item.no_akun}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50"
                    >

                      <TableCell className="px-6 py-3 font-mono text-xs font-bold text-zinc-700">
                        {item.no_akun}
                      </TableCell>

                      <TableCell className="px-6 py-3 font-medium text-zinc-700">
                        {item.nama_akun}
                      </TableCell>

                      <TableCell className="px-6 py-3 text-right font-mono text-sm font-semibold text-zinc-900">
                        {item.debit > 0
                          ? formatRupiah(item.debit)
                          : "-"}
                      </TableCell>

                      <TableCell className="px-6 py-3 text-right font-mono text-sm font-semibold text-zinc-900">
                        {item.kredit > 0
                          ? formatRupiah(item.kredit)
                          : "-"}
                      </TableCell>

                    </TableRow>

                  ))
                )}


                {/* TOTAL */}
                {filteredData.length > 0 && (

                  <TableRow className="border-t-2 border-zinc-800 bg-zinc-100 font-black hover:bg-zinc-100">

                    <TableCell
                      colSpan={2}
                      className="px-6 py-4 text-xs font-black tracking-widest text-zinc-900 uppercase"
                    >
                      TOTAL NERACA SALDO
                    </TableCell>

                    <TableCell className="px-6 py-4 text-right font-mono text-sm font-black text-zinc-900">
                      {formatRupiah(totalDebit)}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-right font-mono text-sm font-black text-zinc-900">
                      {formatRupiah(totalKredit)}
                    </TableCell>

                  </TableRow>

                )}

              </TableBody>

            </Table>

          </div>

        </CardContent>

      </Card>


      {/* =====================================================
          FOOTER
      ===================================================== */}
      <div className="flex justify-between px-2 text-[9px] font-bold tracking-wider text-zinc-400 uppercase">

        <p>
          * Sistem Neraca Saldo Terintegrasi
        </p>

        <div className="flex items-center gap-2">

          {isBalance ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />

              <span className="text-emerald-600">
                Trial Balance Balanced
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-red-600" />

              <span className="text-red-600">
                Trial Balance Not Balanced
              </span>
            </>
          )}

        </div>

      </div>

    </div>
  )
}
