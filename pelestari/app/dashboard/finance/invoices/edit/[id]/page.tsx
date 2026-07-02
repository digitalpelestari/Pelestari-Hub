"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge" 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2, Calculator, Hash, List, Building2 } from "lucide-react"
import Link from "next/link"
import { getInvoiceById, updateInvoice } from "@/app/actions/invoice"

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  
  const [formData, setFormData] = useState({
    nomor_invoice: "",
    batch: "",
    tanggal: "",
    tanggal_jatuhtempo: "",
    perusahaan_tujuan: "",
    npwp: "",
    alamat_perusahaan: "",
    // BARIS 1
    keterangan: "",
    jumlah_peserta: 0,
    harga_peserta: 0,
    // BARIS 2
    keterangan_2: "",
    jumlah_peserta_2: 0,
    harga_peserta_2: 0,
    // STATUS & PAJAK
    is_pph23: false,
    is_ppn11: false,
    is_pnbp: false,
    status: "Belum Lunas"
  })

  // 1. Load Data dari Database saat halaman dibuka
  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await getInvoiceById(Number(params.id))
        if (res) {
          setFormData({
            ...res,
            // Format tanggal SQL ke format input date (YYYY-MM-DD)
            tanggal: res.tanggal ? new Date(res.tanggal).toISOString().split('T')[0] : "",
            tanggal_jatuhtempo: res.tanggal_jatuhtempo ? new Date(res.tanggal_jatuhtempo).toISOString().split('T')[0] : "",
            is_pph23: res.is_pph23 === 1,
            is_ppn11: res.is_ppn11 === 1,
            is_pnbp: res.is_pnbp === 1,
          })
        }
      } catch (error) {
        console.error("Gagal memuat data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadInvoice()
  }, [params.id])

  // 2. Kalkulasi Otomatis Berdasarkan Perubahan (Baris 1 + Baris 2)
  const calculation = useMemo(() => {
    const sub1 = formData.jumlah_peserta * formData.harga_peserta;
    const sub2 = formData.jumlah_peserta_2 * formData.harga_peserta_2;
    const subtotalDasar = sub1 + sub2;
    const totalPesertaAll = formData.jumlah_peserta + formData.jumlah_peserta_2;

    let pph = formData.is_pph23 ? subtotalDasar * 0.02 : 0;
    let ppn = formData.is_ppn11 ? subtotalDasar * 0.11 : 0;
    const nominal_pnbp = formData.is_pnbp ? (totalPesertaAll * 600000) : 0;

    const totalAkhir = (subtotalDasar + ppn + nominal_pnbp) - pph;
    
    return { subtotalDasar, pph, ppn, pnbp: nominal_pnbp, totalAkhir, totalPesertaAll };
  }, [formData]);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
    }).format(amount)
  }

  const handleNumericChange = (key: string, value: string) => {
    const val = value.replace(/\D/g, "");
    setFormData({ ...formData, [key]: val === "" ? 0 : parseInt(val) });
  };

  // 3. Update Data ke Server
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    
    const payload = {
      ...formData,
      nominal_pnbp: calculation.pnbp,
      total: calculation.totalAkhir
    };

    const res = await updateInvoice(Number(params.id), payload);
    if (res.success) {
      alert("Invoice berhasil diperbarui!");
      router.push("/dashboard/invoices");
      router.refresh();
    } else {
      alert(res.message || "Gagal memperbarui invoice.");
    }
    setUpdating(false);
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-zinc-300" />
      <p className="text-xs font-black uppercase tracking-widest text-zinc-400 font-sans italic">Sinkronisasi Database...</p>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 font-sans bg-zinc-50/20 min-h-screen text-zinc-900">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm bg-white hover:bg-zinc-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Edit Arsip Invoice</h1>
            <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase mt-1 italic">
               Mode Penyuntingan Data Aktif
            </p>
          </div>
        </div>
        <Button 
          onClick={handleUpdate} 
          disabled={updating} 
          className="bg-black text-white hover:bg-zinc-800 shadow-2xl px-12 h-14 rounded-2xl font-black transition-all active:scale-95 italic"
        >
          {updating ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
          SIMPAN PERUBAHAN
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI: INPUT FORM */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* INFORMASI DOKUMEN & STATUS */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="bg-zinc-50/50 border-b py-3 font-black text-[10px] uppercase tracking-widest text-zinc-400">
               <Hash className="inline h-3 w-3 mr-1"/> Kontrol Dokumen
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic text-zinc-400">No. Invoice (Read-Only)</Label>
                  <Input value={formData.nomor_invoice} readOnly className="font-mono font-bold bg-zinc-100 h-11 border-dashed" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">Ubah Status</Label>
                  <Select 
  value={formData.status || ""} 
  onValueChange={(val) => setFormData({ ...formData, status: val as string })}
>
                    <SelectTrigger className="h-11 font-black bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-sans font-bold">
                      <SelectItem value="Belum Lunas">🔴 BELUM LUNAS</SelectItem>
                      <SelectItem value="Lunas">🟢 LUNAS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">Batch</Label>
                  <Input value={formData.batch} onChange={(e) => setFormData({...formData, batch: e.target.value})} className="h-11 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic text-red-500 underline">Batas Jatuh Tempo</Label>
                  <Input type="date" value={formData.tanggal_jatuhtempo} onChange={(e) => setFormData({...formData, tanggal_jatuhtempo: e.target.value})} className="h-11 border-red-200" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DATA PERUSAHAAN */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="bg-zinc-50/50 border-b py-3 font-black text-[10px] uppercase tracking-widest text-zinc-400">
               <Building2 className="inline h-3 w-3 mr-1"/> Data Client
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">Perusahaan Tujuan</Label>
                <Input value={formData.perusahaan_tujuan} onChange={(e) => setFormData({...formData, perusahaan_tujuan: e.target.value})} className="h-11 font-black uppercase" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">NPWP</Label>
                <Input value={formData.npwp} onChange={(e) => setFormData({...formData, npwp: e.target.value})} className="h-11 font-mono font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">Alamat Lengkap</Label>
                <Textarea value={formData.alamat_perusahaan} onChange={(e) => setFormData({...formData, alamat_perusahaan: e.target.value})} className="min-h-[100px] font-bold" />
              </div>
            </CardContent>
          </Card>

          {/* RINCIAN MULTI-ITEM (KETERANGAN 1 & 2) */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200 border-l-8 border-l-black overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b py-4 font-black text-[10px] uppercase tracking-widest text-black flex items-center gap-2">
               <List className="h-4 w-4" /> Edit Rincian Layanan
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              
              {/* ITEM 1 */}
              <div className="space-y-4 p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-200 relative">
                <Badge className="bg-black text-[9px] font-black italic uppercase rounded-md px-3">Baris Utama</Badge>
                <Input placeholder="Layanan 1" value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} className="h-12 font-bold italic uppercase" />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Peserta</Label>
                    <Input type="text" value={formData.jumlah_peserta || ""} onChange={(e) => handleNumericChange("jumlah_peserta", e.target.value)} className="h-11 font-black text-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Harga Satuan</Label>
                    <Input type="text" value={formData.harga_peserta || ""} onChange={(e) => handleNumericChange("harga_peserta", e.target.value)} className="h-11 font-mono font-black text-lg" />
                  </div>
                </div>
              </div>

              {/* ITEM 2 */}
              <div className="space-y-4 p-5 bg-zinc-50/50 rounded-[1.5rem] border border-dashed border-zinc-300 relative">
                <Badge variant="outline" className="text-[9px] font-black italic uppercase rounded-md px-3 text-zinc-400">Baris Tambahan</Badge>
                <Input placeholder="Layanan 2 (Opsional)" value={formData.keterangan_2} onChange={(e) => setFormData({...formData, keterangan_2: e.target.value})} className="h-12 font-bold italic uppercase" />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-30">Peserta 2</Label>
                    <Input type="text" value={formData.jumlah_peserta_2 || ""} onChange={(e) => handleNumericChange("jumlah_peserta_2", e.target.value)} className="h-11 font-bold text-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-30">Harga Satuan 2</Label>
                    <Input type="text" value={formData.harga_peserta_2 || ""} onChange={(e) => handleNumericChange("harga_peserta_2", e.target.value)} className="h-11 font-mono font-bold text-lg" />
                  </div>
                </div>
              </div>

              {/* TOGGLE PAJAK */}
              <div className="flex flex-wrap gap-4 p-5 bg-zinc-100 rounded-3xl border border-zinc-300">
                <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-zinc-200">
                  <Checkbox id="pph" checked={formData.is_pph23} onCheckedChange={(c) => setFormData({...formData, is_pph23: !!c})} />
                  <Label htmlFor="pph" className="text-xs font-black cursor-pointer uppercase italic">PPH 23</Label>
                </div>
                <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-zinc-200">
                  <Checkbox id="ppn" checked={formData.is_ppn11} onCheckedChange={(c) => setFormData({...formData, is_ppn11: !!c})} />
                  <Label htmlFor="ppn" className="text-xs font-black cursor-pointer uppercase italic">PPN 11%</Label>
                </div>
                <div className="flex items-center space-x-2 bg-blue-600 p-4 rounded-2xl text-white shadow-xl ml-auto">
                  <Checkbox id="pnbp" checked={formData.is_pnbp} onCheckedChange={(c) => setFormData({...formData, is_pnbp: !!c})} className="border-white" />
                  <Label htmlFor="pnbp" className="text-xs font-black cursor-pointer uppercase italic">PNBP (600rb/org)</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RINGKASAN & ACTION */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden ring-4 ring-white">
            <CardContent className="p-8 space-y-6">
              <h2 className="text-[10px] uppercase tracking-[0.4em] font-black opacity-30 italic">Kalkulasi Penyuntingan</h2>
              
              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="opacity-40 font-bold uppercase text-[10px]">Subtotal Baru</span>
                  <span className="font-mono font-bold">{formatIDR(calculation.subtotalDasar)}</span>
                </div>
                {formData.is_pnbp && (
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span className="font-bold uppercase text-[10px]">PNBP ({calculation.totalPesertaAll} org)</span>
                    <span className="font-mono">+{formatIDR(calculation.pnbp)}</span>
                  </div>
                )}
                {formData.is_pph23 && <div className="flex justify-between text-rose-400 text-sm italic"><span className="text-[10px] font-bold">PPH 2%</span><span>-{formatIDR(calculation.pph)}</span></div>}
                {formData.is_ppn11 && <div className="flex justify-between text-blue-400 text-sm italic"><span className="text-[10px] font-bold">PPN 11%</span><span>+{formatIDR(calculation.ppn)}</span></div>}
              </div>

              <div className="pt-10 border-t border-zinc-800 leading-none">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Grand Total Rekalkulasi</span>
                <h2 className="text-4xl font-black tabular-nums tracking-tighter mt-2 italic">{formatIDR(calculation.totalAkhir)}</h2>
              </div>

              <Button 
                onClick={handleUpdate} 
                disabled={updating} 
                className="w-full bg-emerald-500 text-black hover:bg-emerald-400 h-20 text-2xl font-black rounded-3xl mt-6 active:scale-95 transition-all shadow-xl italic"
              >
                {updating ? <Loader2 className="animate-spin" /> : "KONFIRMASI UPDATE"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}