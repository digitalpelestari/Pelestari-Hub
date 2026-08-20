"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2, Banknote, Calculator, Hash } from "lucide-react"
import Link from "next/link"
import { getInvoiceById, updatePayment } from "@/app/actions/invoice"
import { Badge } from "@/components/ui/badge"
import { swal } from "@/lib/sweetalert"

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  
  // Ambil ID secara aman sebagai string (mengatasi string | string[] dari Next.js)
  const invoiceId = useMemo(() => {
    if (!params?.id) return ""
    return Array.isArray(params.id) ? params.id[0] : params.id
  }, [params?.id])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any>(null)

  const [form, setPayForm] = useState({
    bayar_1: 0,
    tanggal_bayar_1: "",
    bayar_2: 0,
    tanggal_bayar_2: ""
  })

  useEffect(() => {
    async function load() {
      if (!invoiceId) return
      
      // PERBAIKAN 1: Hapus fungsi Number(), langsung kirim sebagai string UUID
      const res = await getInvoiceById(invoiceId)
      if (res) {
        setData(res)
        setPayForm({
          bayar_1: res.bayar_1 || 0,
          tanggal_bayar_1: res.tanggal_bayar_1 ? new Date(res.tanggal_bayar_1).toISOString().split('T')[0] : "",
          bayar_2: res.bayar_2 || 0,
          tanggal_bayar_2: res.tanggal_bayar_2 ? new Date(res.tanggal_bayar_2).toISOString().split('T')[0] : ""
        })
      }
      setLoading(false)
    }
    load()
  }, [invoiceId])

  const calc = useMemo(() => {
    if (!data) return { sisa: 0, status: "" }
    const totalMasuk = Number(form.bayar_1) + Number(form.bayar_2)
    const sisa = data.total - totalMasuk
    return { sisa, status: sisa <= 0 ? "Lunas" : "Belum Lunas" }
  }, [form, data])

  const handleSave = async () => {
    if (!invoiceId) return
    
    setSaving(true)
    // PERBAIKAN 2: Hapus fungsi Number(), kirim invoiceId string UUID murni ke backend action
    const res = await updatePayment(invoiceId, { ...form, status: calc.status })
    if (res.success) {
      swal.success("Pembayaran Berhasil Diupdate!")
      router.push("/dashboard/finance/invoices")
      router.refresh()
    } else {
      swal.error("Gagal memperbarui pembayaran: " + (res.message || ""))
    }
    setSaving(false)
  }

  if (loading) return <div className="p-20 text-center font-black animate-pulse">MEMUAT DATA...</div>

  const formatIDR = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 font-sans bg-zinc-50/20 min-h-screen">
      <div className="flex justify-between items-center border-b pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/invoices">
            <Button variant="outline" size="icon" className="rounded-full">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900">Input Pembayaran</h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 h-14 rounded-2xl font-black shadow-xl italic">
          {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} SIMPAN STATUS BAYAR
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="bg-zinc-50/50 border-b py-3 font-black text-[10px] uppercase text-zinc-400 tracking-widest flex items-center gap-2">
              <Hash className="w-3 h-3" /> Ringkasan Invoice
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase text-zinc-400 italic">Perusahaan Tujuan</p>
              <h2 className="text-xl font-black uppercase text-blue-900">{data?.perusahaan_tujuan}</h2>
              <div className="mt-4 p-4 bg-zinc-900 text-white rounded-2xl flex justify-between items-center">
                 <span className="text-xs font-bold uppercase tracking-widest opacity-50">Total Tagihan</span>
                 <span className="text-2xl font-black italic">{formatIDR(data?.total || 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden">
            <CardHeader className="bg-emerald-50/50 border-b py-3 font-black text-[10px] uppercase text-emerald-700 tracking-widest flex items-center gap-2">
               <Banknote className="w-3 h-3" /> Detail Pembayaran
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black">1</div>
                  <span className="text-[10px] font-black uppercase italic">Pembayaran Pertama (DP)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input value={form.bayar_1} onChange={(e) => setPayForm({...form, bayar_1: Number(e.target.value)})} className="h-12 font-black text-lg" />
                  <Input type="date" value={form.tanggal_bayar_1} onChange={(e) => setPayForm({...form, tanggal_bayar_1: e.target.value})} className="h-12" />
                </div>
              </div>
              
              <div className="space-y-4 pt-6 border-t border-dashed">
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-black">2</div>
                  <span className="text-[10px] font-black uppercase italic">Pembayaran Kedua (Pelunasan)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input value={form.bayar_2} onChange={(e) => setPayForm({...form, bayar_2: Number(e.target.value)})} className="h-12 font-black text-lg" />
                  <Input type="date" value={form.tanggal_bayar_2} onChange={(e) => setPayForm({...form, tanggal_bayar_2: e.target.value})} className="h-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-zinc-900 text-white rounded-[2rem] overflow-hidden border-none shadow-2xl p-8 sticky top-6">
             <div className="flex justify-between items-center opacity-30 font-black text-[10px] uppercase mb-8">
               <span>Kalkulasi Akhir</span>
               <Calculator className="w-5 h-5" />
             </div>
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-zinc-400 italic">Sisa Tagihan</p>
                <h2 className="text-2xl font-black tracking-tighter italic text-rose-400">
                  {calc.sisa <= 0 ? <span className="text-emerald-400 uppercase not-italic">Lunas</span> : formatIDR(calc.sisa)}
                </h2>
             </div>
             <Badge className={`w-full justify-center h-10 mt-10 font-black uppercase tracking-widest ${calc.status === 'Lunas' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}>
                {calc.status}
             </Badge>
          </Card>
        </div>
      </div>
    </div>
  )
}