"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { 
  ArrowLeft, Calculator, Hash, 
  Building2, Printer, Loader2, List 
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
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-300" />
        <p className="text-xs font-black uppercase tracking-widest text-zinc-400 font-sans">Menarik Data Database...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center italic text-zinc-500 font-sans uppercase font-black py-20">
        Data Invoice Tidak Ditemukan.
      </div>
    )
  }

  // Hitung subtotal untuk ringkasan (Baris 1 + Baris 2 jika ada)
  const subtotal1 = (data.jumlah_peserta || 0) * (data.harga_peserta || 0);
  const subtotal2 = (data.jumlah_peserta_2 || 0) * (data.harga_peserta_2 || 0);
  const subtotalTotal = subtotal1 + subtotal2;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 font-sans bg-zinc-50/20 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-200 pb-8">
        <div className="flex items-center gap-5">
          {/* PERBAIKAN 2: Sesuaikan rute kembali agar mengarah ke dashboard finance */}
          <Link href="/dashboard/finance/invoices">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm bg-white hover:bg-zinc-100 border-zinc-200 h-12 w-12">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-zinc-900 italic leading-none">Arsip Invoice</h1>
            <div className="flex items-center gap-3 mt-3">
               <Badge className={`rounded-lg px-4 py-1 text-[10px] font-black tracking-widest ${data.status === 'Lunas' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {data.status ? data.status.toUpperCase() : "BELUM LUNAS"}
               </Badge>
               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">System ID: {data.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => window.print()}
            className="bg-black text-white hover:bg-zinc-800 shadow-2xl px-10 h-14 rounded-2xl font-black italic transition-all active:scale-95 uppercase tracking-tighter"
          >
            <Printer className="mr-3 h-5 w-5 stroke-[3]" /> Cetak PDF / Nota
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Identitas Dokumen */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200 rounded-[1.5rem] overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b py-4 flex flex-row items-center gap-2">
              <Hash className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 font-mono">Identitas Penagihan</span>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">Nomor Invoice</Label>
                <p className="font-mono font-black text-2xl text-blue-900 tracking-tighter">{data.nomor_invoice}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">Batch Kerja</Label>
                <p className="font-black text-lg text-zinc-800">{data.batch || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">Tanggal Terbit</Label>
                <p className="font-bold text-zinc-700">{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { dateStyle: 'long' }) : "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic text-rose-500">Batas Jatuh Tempo</Label>
                <p className="font-black text-rose-600 underline decoration-2 underline-offset-4 decoration-rose-200">
                  {data.tanggal_jatuhtempo ? new Date(data.tanggal_jatuhtempo).toLocaleDateString('id-ID', { dateStyle: 'long' }) : "-"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Data Perusahaan */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200 rounded-[1.5rem] overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b py-4 flex flex-row items-center gap-2 font-black text-[10px] uppercase tracking-widest text-zinc-400 font-mono">
              <Building2 className="h-4 w-4" /> Tujuan Penagihan (Client)
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase italic opacity-40">Nama Perusahaan</Label>
                <p className="font-black text-2xl uppercase italic text-zinc-900 leading-tight">{data.perusahaan_tujuan}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">NPWP Perusahaan</Label>
                  <p className="font-mono font-bold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-md w-fit">{data.npwp || "Tidak Terdaftar"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">Alamat Korespondensi</Label>
                  <p className="text-sm font-bold leading-relaxed text-zinc-500 uppercase italic">{data.alamat_perusahaan || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Rincian Pekerjaan (Multi Baris) */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200 border-l-8 border-l-black rounded-[1.5rem] overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b py-4 font-black text-[10px] uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-2">
              <List className="h-4 w-4" /> Rincian Pekerjaan & Biaya Layanan
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              
              {/* BARIS PERTAMA */}
              <div className="space-y-4 p-6 bg-zinc-50 rounded-[1.5rem] border border-zinc-200 relative">
                <Badge className="bg-black text-[9px] font-black italic uppercase rounded-md px-3 absolute -top-3 left-6 text-white hover:bg-black">Baris Utama</Badge>
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase italic opacity-40">Deskripsi Layanan 1</Label>
                  <p className="font-black text-xl leading-tight uppercase italic text-zinc-800">{data.keterangan}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase italic opacity-30">Peserta</Label>
                    <p className="text-2xl font-black">{data.jumlah_peserta} <span className="text-[10px] text-zinc-400">PAX</span></p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase italic opacity-30">Harga Satuan</Label>
                    <p className="text-2xl font-black font-mono tracking-tighter">{formatIDR(data.harga_peserta)}</p>
                  </div>
                </div>
              </div>

              {/* BARIS KEDUA (Hanya Muncul Jika Keterangan 2 Diisi) */}
              {data.keterangan_2 && data.keterangan_2 !== "-" && (
                <div className="space-y-4 p-6 bg-zinc-50/50 rounded-[1.5rem] border border-dashed border-zinc-300 relative">
                  <Badge variant="outline" className="text-[9px] font-black italic uppercase rounded-md px-3 text-zinc-400 absolute -top-3 left-6 bg-white">Baris Tambahan</Badge>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-black uppercase italic opacity-40">Deskripsi Layanan 2</Label>
                    <p className="font-black text-xl leading-tight uppercase italic text-zinc-600">{data.keterangan_2}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[10px] font-black uppercase italic opacity-30">Peserta</Label>
                      <p className="text-2xl font-black text-zinc-600">{data.jumlah_peserta_2} <span className="text-[10px] text-zinc-400">PAX</span></p>
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase italic opacity-30">Harga Satuan</Label>
                      <p className="text-2xl font-black font-mono tracking-tighter text-zinc-600">{formatIDR(data.harga_peserta_2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Pajak yang Aktif */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-dashed border-zinc-200">
                <div className="text-[10px] font-black uppercase opacity-30 w-full mb-1 italic">Status Perpajakan Terpilih:</div>
                {data.is_pph23 === 1 && <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-black uppercase text-[10px] px-4 py-1 hover:bg-rose-50">PPH 23 (2%) AKTIF</Badge>}
                {data.is_ppn11 === 1 && <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-black uppercase text-[10px] px-4 py-1 hover:bg-blue-50">PPN 11% AKTIF</Badge>}
                {data.is_pnbp === 1 && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black uppercase text-[10px] px-4 py-1 hover:bg-emerald-50">PNBP AKTIF</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary: Kalkulasi Final */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-none shadow-[0_40px_80px_-15px_rgba(0,0,0,0.4)] rounded-[3rem] bg-zinc-900 text-white overflow-hidden ring-4 ring-white ring-offset-4 ring-offset-zinc-50">
            <CardContent className="p-10 space-y-8">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.5em] font-black opacity-30">Nota Tagihan</span>
                  <span className="text-[9px] font-bold text-emerald-500 uppercase mt-1 italic tracking-widest">Verified by Pelestari</span>
                </div>
                <Calculator className="h-6 w-6 text-zinc-700" />
              </div>
              
              <div className="space-y-5 font-sans">
                <div className="flex justify-between text-sm">
                  <span className="opacity-40 font-bold uppercase tracking-widest text-[10px]">Subtotal Dasar</span>
                  <span className="font-mono font-bold tracking-tight text-zinc-300">{formatIDR(subtotalTotal)}</span>
                </div>
                
                {data.is_pnbp === 1 && (
                  <div className="flex justify-between text-sm text-emerald-400 font-medium">
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-[10px]">Biaya PNBP Total</span>
                      <span className="text-[8px] opacity-50 italic">({(data.jumlah_peserta + (data.jumlah_peserta_2 || 0))} Peserta)</span>
                    </div>
                    <span className="font-mono">+ {formatIDR(data.nominal_pnbp)}</span>
                  </div>
                )}

                {data.is_pph23 === 1 && (
                   <div className="flex justify-between text-sm text-rose-400 font-medium">
                      <span className="font-bold uppercase text-[10px]">PPH 23 Terpotong</span>
                      <span className="font-mono">- {formatIDR(subtotalTotal * 0.02)}</span>
                   </div>
                )}

                {data.is_ppn11 === 1 && (
                   <div className="flex justify-between text-sm text-blue-400 font-medium">
                      <span className="font-bold uppercase text-[10px]">PPN Tambahan</span>
                      <span className="font-mono">+ {formatIDR(subtotalTotal * 0.11)}</span>
                   </div>
                )}
              </div>

              <div className="pt-10 border-t border-zinc-800 flex flex-col gap-3 leading-none">
                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] italic">Total Tagihan Bersih</span>
                <h2 className="text-4xl font-black tabular-nums tracking-tighter leading-none italic underline underline-offset-8 decoration-emerald-500/20 text-white">
                  {formatIDR(data.total)}
                </h2>
              </div>

              <div className="mt-8 flex flex-col gap-2">
                <div className="flex items-center gap-3 p-4 bg-zinc-800/40 rounded-2xl border border-zinc-700/50">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Record Status: {data.status}</p>
                </div>
              </div>

              <p className="text-[9px] text-center opacity-20 font-bold uppercase tracking-[0.3em] mt-6 leading-relaxed">
                DATA INI ADALAH SALINAN RESMI DARI DATABASE PELESTARI INDONESIA VERSI 2026.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}