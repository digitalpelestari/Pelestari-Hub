"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  ArrowLeft,
  Calculator,
  Hash,
  Building2,
  Printer,
  Loader2,
  List,
} from "lucide-react"
import Link from "next/link"
import { getInvoiceById } from "@/app/actions/invoice"

export default function InvoiceDetailPage() {
  const params = useParams()

  const invoiceId = useMemo(() => {
    if (!params?.id) return 0
    const raw = Array.isArray(params.id) ? params.id[0] : params.id
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [params?.id])

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return
      try {
        setLoading(true)
        const res = await getInvoiceById(invoiceId)
        setData(res)
      } catch (error) {
        console.error("Gagal memuat invoice:", error)
      } finally {
        setLoading(false)
      }
    }
    loadInvoice()
  }, [invoiceId])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-300" />
        <p className="font-sans text-xs font-black tracking-widest text-zinc-400 uppercase">
          Menarik Data Database...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 py-20 text-center font-sans font-black text-zinc-500 uppercase italic">
        Data Invoice Tidak Ditemukan.
      </div>
    )
  }

  // Hitung subtotal untuk ringkasan (Baris 1 + Baris 2 jika ada)
  const subtotal1 = (data.jumlah_peserta || 0) * (data.harga_peserta || 0)
  const subtotal2 = (data.jumlah_peserta_2 || 0) * (data.harga_peserta_2 || 0)
  const subtotalTotal = subtotal1 + subtotal2

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-8 bg-zinc-50/20 p-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-6 border-b border-zinc-200 pb-8 md:flex-row md:items-center">
        <div className="flex items-center gap-5">
          {/* PERBAIKAN 2: Sesuaikan rute kembali agar mengarah ke dashboard finance */}
          <Link href="/dashboard/finance/invoices">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-zinc-200 bg-white shadow-sm hover:bg-zinc-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl leading-none font-black tracking-tighter text-zinc-900 uppercase italic">
              Arsip Invoice
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <Badge
                className={`rounded-lg px-4 py-1 text-[10px] font-black tracking-widest ${data.status === "Lunas" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
              >
                {data.status ? data.status.toUpperCase() : "BELUM LUNAS"}
              </Badge>
              <span className="text-[10px] font-black tracking-[0.2em] text-zinc-400 uppercase italic">
                System ID: {data.id}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => window.print()}
            className="h-14 rounded-2xl bg-black px-10 font-black tracking-tighter text-white uppercase italic shadow-2xl transition-all hover:bg-zinc-800 active:scale-95"
          >
            <Printer className="mr-3 h-5 w-5 stroke-[3]" /> Cetak PDF / Nota
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1: Identitas Dokumen */}
          <Card className="overflow-hidden rounded-[1.5rem] border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex flex-row items-center gap-2 border-b bg-zinc-50/50 py-4">
              <Hash className="h-4 w-4 text-zinc-400" />
              <span className="font-mono text-[10px] font-black tracking-[0.3em] text-zinc-400 uppercase">
                Identitas Penagihan
              </span>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-8 p-8">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">
                  Nomor Invoice
                </Label>
                <p className="font-mono text-2xl font-black tracking-tighter text-blue-900">
                  {data.nomor_invoice}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">
                  Batch Kerja
                </Label>
                <p className="text-lg font-black text-zinc-800">
                  {data.batch || "-"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">
                  Tanggal Terbit
                </Label>
                <p className="font-bold text-zinc-700">
                  {data.tanggal
                    ? new Date(data.tanggal).toLocaleDateString("id-ID", {
                        dateStyle: "long",
                      })
                    : "-"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-rose-500 uppercase italic">
                  Batas Jatuh Tempo
                </Label>
                <p className="font-black text-rose-600 underline decoration-rose-200 decoration-2 underline-offset-4">
                  {data.tanggal_jatuhtempo
                    ? new Date(data.tanggal_jatuhtempo).toLocaleDateString(
                        "id-ID",
                        { dateStyle: "long" }
                      )
                    : "-"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Data Perusahaan */}
          <Card className="overflow-hidden rounded-[1.5rem] border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex flex-row items-center gap-2 border-b bg-zinc-50/50 py-4 font-mono text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <Building2 className="h-4 w-4" /> Tujuan Penagihan (Client)
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">
                  Nama Perusahaan
                </Label>
                <p className="text-2xl leading-tight font-black text-zinc-900 uppercase italic">
                  {data.perusahaan_tujuan}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">
                    NPWP Perusahaan
                  </Label>
                  <p className="w-fit rounded-md bg-zinc-100 px-3 py-1 font-mono font-bold text-zinc-700">
                    {data.npwp || "Tidak Terdaftar"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">
                    Alamat Korespondensi
                  </Label>
                  <p className="text-sm leading-relaxed font-bold text-zinc-500 uppercase italic">
                    {data.alamat_perusahaan || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Rincian Pekerjaan (Multi Baris) */}
          <Card className="overflow-hidden rounded-[1.5rem] border-l-8 border-none border-l-black shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex items-center gap-2 border-b bg-zinc-50/50 py-4 font-mono text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <List className="h-4 w-4" /> Rincian Pekerjaan & Biaya Layanan
            </CardHeader>
            <CardContent className="space-y-8 p-8">
              {/* BARIS PERTAMA */}
              <div className="relative space-y-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6">
                <Badge className="absolute -top-3 left-6 rounded-md bg-black px-3 text-[9px] font-black text-white uppercase italic hover:bg-black">
                  Baris Utama
                </Badge>
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">
                    Deskripsi Layanan 1
                  </Label>
                  <p className="text-xl leading-tight font-black text-zinc-800 uppercase italic">
                    {data.keterangan}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase italic opacity-30">
                      Peserta
                    </Label>
                    <p className="text-2xl font-black">
                      {data.jumlah_peserta}{" "}
                      <span className="text-[10px] text-zinc-400">PAX</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase italic opacity-30">
                      Harga Satuan
                    </Label>
                    <p className="font-mono text-2xl font-black tracking-tighter">
                      {formatIDR(data.harga_peserta)}
                    </p>
                  </div>
                </div>
              </div>

              {/* BARIS KEDUA (Hanya Muncul Jika Keterangan 2 Diisi) */}
              {data.keterangan_2 && data.keterangan_2 !== "-" && (
                <div className="relative space-y-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/50 p-6">
                  <Badge
                    variant="outline"
                    className="absolute -top-3 left-6 rounded-md bg-white px-3 text-[9px] font-black text-zinc-400 uppercase italic"
                  >
                    Baris Tambahan
                  </Badge>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-black uppercase italic opacity-40">
                      Deskripsi Layanan 2
                    </Label>
                    <p className="text-xl leading-tight font-black text-zinc-600 uppercase italic">
                      {data.keterangan_2}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[10px] font-black uppercase italic opacity-30">
                        Peserta
                      </Label>
                      <p className="text-2xl font-black text-zinc-600">
                        {data.jumlah_peserta_2}{" "}
                        <span className="text-[10px] text-zinc-400">PAX</span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase italic opacity-30">
                        Harga Satuan
                      </Label>
                      <p className="font-mono text-2xl font-black tracking-tighter text-zinc-600">
                        {formatIDR(data.harga_peserta_2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Pajak yang Aktif */}
              <div className="flex flex-wrap gap-3 border-t border-dashed border-zinc-200 pt-4">
                <div className="mb-1 w-full text-[10px] font-black uppercase italic opacity-30">
                  Status Perpajakan Terpilih:
                </div>
                {data.is_pph23 === 1 && (
                  <Badge className="border-rose-200 bg-rose-50 px-4 py-1 text-[10px] font-black text-rose-700 uppercase hover:bg-rose-50">
                    PPH 23 (2%) AKTIF
                  </Badge>
                )}
                {data.is_ppn11 === 1 && (
                  <Badge className="border-blue-200 bg-blue-50 px-4 py-1 text-[10px] font-black text-blue-700 uppercase hover:bg-blue-50">
                    PPN 11% AKTIF
                  </Badge>
                )}
                {data.is_pnbp === 1 && (
                  <Badge className="border-emerald-200 bg-emerald-50 px-4 py-1 text-[10px] font-black text-emerald-700 uppercase hover:bg-emerald-50">
                    PNBP AKTIF
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary: Kalkulasi Final */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 overflow-hidden rounded-[3rem] border-none bg-zinc-900 text-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.4)] ring-4 ring-white ring-offset-4 ring-offset-zinc-50">
            <CardContent className="space-y-8 p-10">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black tracking-[0.5em] uppercase opacity-30">
                    Nota Tagihan
                  </span>
                  <span className="mt-1 text-[9px] font-bold tracking-widest text-emerald-500 uppercase italic">
                    Verified by Pelestari
                  </span>
                </div>
                <Calculator className="h-6 w-6 text-zinc-700" />
              </div>

              <div className="space-y-5 font-sans">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">
                    Subtotal Dasar
                  </span>
                  <span className="font-mono font-bold tracking-tight text-zinc-300">
                    {formatIDR(subtotalTotal)}
                  </span>
                </div>

                {data.is_pnbp === 1 && (
                  <div className="flex justify-between text-sm font-medium text-emerald-400">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase">
                        Biaya PNBP Total
                      </span>
                      <span className="text-[8px] italic opacity-50">
                        ({data.jumlah_peserta + (data.jumlah_peserta_2 || 0)}{" "}
                        Peserta)
                      </span>
                    </div>
                    <span className="font-mono">
                      + {formatIDR(data.nominal_pnbp)}
                    </span>
                  </div>
                )}

                {data.is_pph23 === 1 && (
                  <div className="flex justify-between text-sm font-medium text-rose-400">
                    <span className="text-[10px] font-bold uppercase">
                      PPH 23 Terpotong
                    </span>
                    <span className="font-mono">
                      - {formatIDR(subtotalTotal * 0.02)}
                    </span>
                  </div>
                )}

                {data.is_ppn11 === 1 && (
                  <div className="flex justify-between text-sm font-medium text-blue-400">
                    <span className="text-[10px] font-bold uppercase">
                      PPN Tambahan
                    </span>
                    <span className="font-mono">
                      + {formatIDR(subtotalTotal * 0.11)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-10 leading-none">
                <span className="text-[11px] font-black tracking-[0.3em] text-emerald-500 uppercase italic">
                  Total Tagihan Bersih
                </span>
                <h2 className="text-4xl leading-none font-black tracking-tighter text-white italic tabular-nums underline decoration-emerald-500/20 underline-offset-8">
                  {formatIDR(data.total)}
                </h2>
              </div>

              <div className="mt-8 flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-4">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
                  <p className="text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase">
                    Record Status: {data.status}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-center text-[9px] leading-relaxed font-bold tracking-[0.3em] uppercase opacity-20">
                DATA INI ADALAH SALINAN RESMI DARI DATABASE PELESTARI INDONESIA
                VERSI 2026.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
