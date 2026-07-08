"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge" 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft, Save, Loader2, Calculator, Hash, 
  AlertCircle, ShieldCheck, List, Building2, Landmark
} from "lucide-react"
import Link from "next/link"
import { createInvoice, getNextInvoiceNumber } from "@/app/actions/invoice"

export default function CreateInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // SEMUA KOLOM DATABASE ADA DI SINI
  const [formData, setFormData] = useState({
    nomor_invoice: "",
    batch: "",
    tanggal: new Date().toISOString().split('T')[0],
    jenis_kegiatan: "",
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

  // GENERATE NOMOR INVOICE OTOMATIS SAAT HALAMAN DIBUKA
  useEffect(() => {
    const syncInvoiceNumber = async () => {
      const nextId = await getNextInvoiceNumber(); 
      const now = new Date();
      const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      const romanMonth = roman[now.getMonth()];
      const year = now.getFullYear();
      const formattedNumber = nextId.toString().padStart(3, '0');
      const fullInvoiceString = `${formattedNumber}/INV/${romanMonth}/${year}/G`;
      setFormData(prev => ({ ...prev, nomor_invoice: fullInvoiceString }));
    };
    syncInvoiceNumber();
  }, []);

  // KALKULASI OTOMATIS (BARIS 1 + BARIS 2)
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
    const cleanValue = value.replace(/\D/g, "");
    setFormData({ ...formData, [key]: cleanValue === "" ? 0 : parseInt(cleanValue) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // VALIDASI MINIMAL
    if (!formData.perusahaan_tujuan || !formData.tanggal_jatuhtempo || !formData.keterangan) {
      return alert("KOLOM WAJIB: [Perusahaan, Jatuh Tempo, & Keterangan 1] Harus Diisi!");
    }
    
    setLoading(true);
    const payload = {
      ...formData,
      nominal_pnbp: calculation.pnbp,
      total: calculation.totalAkhir
    };

    const res = await createInvoice(payload);
    
    if (res.success) {
      alert("Invoice Berhasil Disimpan Ke Database!");
      router.push("/dashboard/finance/invoices");
      router.refresh();
    } else {
      alert("GAGAL SIMPAN: " + res.message);
    }
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 font-sans bg-zinc-50/20 min-h-screen text-zinc-900">
      
      {/* HEADER ACTION */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/invoices">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm bg-white hover:bg-zinc-100 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Tambah Invoice</h1>
            <p className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase flex items-center gap-1 mt-1 italic">
               Database Sync: Pelestari v3.0
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="bg-black text-white hover:bg-zinc-800 shadow-2xl px-12 h-14 rounded-2xl font-black italic transition-all active:scale-95"
        >
          {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
          TERBITKAN INVOICE
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI (INPUT DATA) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* INFORMASI INVOICE */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="bg-zinc-50/50 border-b py-3 font-black text-[10px] uppercase tracking-widest text-zinc-400">
               <Hash className="inline h-3 w-3 mr-1"/> Identitas Dokumen
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">Nomor Invoice</Label>
                  <Input value={formData.nomor_invoice} readOnly className="font-mono font-bold bg-zinc-100 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">Batch *</Label>
                  <Input placeholder="Contoh: 01" value={formData.batch} onChange={(e) => setFormData({...formData, batch: e.target.value})} className="font-bold h-11" />
                </div>
                <div className="grid grid-cols-2 gap-5 mt-5">
  <div className="space-y-2 col-span-2">
    <Label className="text-[11px] font-black uppercase italic">Jenis Kegiatan</Label>
    <div className="flex gap-3">
      {["Pelatihan", "Konsultan"].map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setFormData({ ...formData, jenis_kegiatan: item })}
          className={`flex-1 h-12 rounded-xl border-2 font-black italic uppercase transition-all ${
            formData.jenis_kegiatan === item
              ? "border-black bg-black text-white shadow-lg scale-[1.02]"
              : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  </div>
</div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic text-zinc-400">Tanggal Terbit</Label>
                  <Input type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic text-red-500 underline">Tanggal Jatuh Tempo *</Label>
                  <Input type="date" value={formData.tanggal_jatuhtempo} onChange={(e) => setFormData({...formData, tanggal_jatuhtempo: e.target.value})} className="h-11 border-red-200 shadow-sm bg-red-50/10" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TUJUAN PENAGIHAN */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="bg-zinc-50/50 border-b py-3 font-black text-[10px] uppercase tracking-widest text-zinc-400">
               <Building2 className="inline h-3 w-3 mr-1"/> Data Perusahaan
            </CardHeader>
            <CardContent className="p-6 space-y-5 text-zinc-800">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">Nama Perusahaan *</Label>
                <Input placeholder="Nama Perusahaan" value={formData.perusahaan_tujuan} onChange={(e) => setFormData({...formData, perusahaan_tujuan: e.target.value})} className="h-11 font-black uppercase" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">NPWP Perusahaan</Label>
                <Input placeholder="Nomor NPWP" value={formData.npwp} onChange={(e) => setFormData({...formData, npwp: e.target.value})} className="h-11 font-mono font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">Alamat Lengkap</Label>
                <Textarea placeholder="Alamat Perusahaan" value={formData.alamat_perusahaan} onChange={(e) => setFormData({...formData, alamat_perusahaan: e.target.value})} className="min-h-[100px] bg-zinc-50/30 font-bold" />
              </div>
            </CardContent>
          </Card>

          {/* RINCIAN MULTI-ITEM (KETERANGAN 1 & 2) */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200 border-l-8 border-l-black overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b py-4 font-black text-[10px] uppercase tracking-widest text-black flex flex-row items-center justify-between">
               <div className="flex items-center gap-2"><List className="h-4 w-4" /> Rincian Pekerjaan (Baris Tetap)</div>
               <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[8px] font-black italic shadow-sm"><ShieldCheck className="h-3 w-3"/> SQL SYNC READY</div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              
              {/* ITEM 1 */}
              <div className="space-y-4 p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-200 relative">
                <Badge className="bg-black text-[9px] font-black italic uppercase rounded-md px-3">Baris Pertama (Utama)</Badge>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase italic opacity-50">Keterangan Layanan 1 *</Label>
                  <Input placeholder="Contoh: Pelatihan ABB" value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} className="h-12 font-bold border-zinc-300" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-50">Jumlah Peserta</Label>
                    <Input type="text" inputMode="numeric" placeholder="0" value={formData.jumlah_peserta || ""} onChange={(e) => handleNumericChange("jumlah_peserta", e.target.value)} className="h-11 font-black text-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-50">Harga Satuan</Label>
                    <Input type="text" inputMode="numeric" placeholder="Rp 0" value={formData.harga_peserta || ""} onChange={(e) => handleNumericChange("harga_peserta", e.target.value)} className="h-11 font-mono font-black text-lg" />
                  </div>
                </div>
              </div>

              {/* ITEM 2 */}
              <div className="space-y-4 p-5 bg-zinc-50/50 rounded-[1.5rem] border border-dashed border-zinc-300 relative">
                <Badge variant="outline" className="text-[9px] font-black italic uppercase rounded-md px-3 text-zinc-400">Baris Kedua (Opsional)</Badge>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase italic opacity-30">Keterangan Layanan 2</Label>
                  <Input placeholder="Contoh: Pembinaan AKABB" value={formData.keterangan_2} onChange={(e) => setFormData({...formData, keterangan_2: e.target.value})} className="h-12 font-bold border-zinc-200" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-30">Jumlah Peserta 2</Label>
                    <Input type="text" inputMode="numeric" placeholder="0" value={formData.jumlah_peserta_2 || ""} onChange={(e) => handleNumericChange("jumlah_peserta_2", e.target.value)} className="h-11 font-black text-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-30">Harga Satuan 2</Label>
                    <Input type="text" inputMode="numeric" placeholder="Rp 0" value={formData.harga_peserta_2 || ""} onChange={(e) => handleNumericChange("harga_peserta_2", e.target.value)} className="h-11 font-mono font-black text-lg" />
                  </div>
                </div>
              </div>

              {/* TOGGLE PAJAK & PNBP */}
              <div className="flex flex-wrap gap-4 p-5 bg-zinc-100 rounded-3xl border border-dashed border-zinc-300">
                <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                  <Checkbox id="pph" checked={formData.is_pph23} onCheckedChange={(c) => setFormData({...formData, is_pph23: !!c})} />
                  <Label htmlFor="pph" className="text-xs font-black cursor-pointer uppercase italic">PPH 23 (2%)</Label>
                </div>
                <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                  <Checkbox id="ppn" checked={formData.is_ppn11} onCheckedChange={(c) => setFormData({...formData, is_ppn11: !!c})} />
                  <Label htmlFor="ppn" className="text-xs font-black cursor-pointer uppercase italic">PPN (11%)</Label>
                </div>
                <div className="flex items-center space-x-2 bg-blue-600 p-4 rounded-2xl text-white shadow-xl hover:bg-blue-700 transition-all ml-auto">
                  <Checkbox id="pnbp" checked={formData.is_pnbp} onCheckedChange={(c) => setFormData({...formData, is_pnbp: !!c})} className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600" />
                  <Label htmlFor="pnbp" className="text-xs font-black cursor-pointer uppercase italic">PNBP (600rb/org)</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KOLOM KANAN (RINGKASAN & TOTAL) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden ring-4 ring-white">
            <CardContent className="p-8 space-y-6 font-sans">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-[10px] uppercase tracking-[0.4em] font-black opacity-30">Nota Kalkulasi</CardTitle>
                <Calculator className="h-5 w-5 text-zinc-600" />
              </div>
              
              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="opacity-40 font-bold uppercase tracking-widest text-[10px]">Subtotal Dasar</span>
                  <span className="font-mono font-bold tracking-tight">{formatIDR(calculation.subtotalDasar)}</span>
                </div>
                {formData.is_pph23 && (
                  <div className="flex justify-between text-sm text-rose-400 font-medium italic">
                    <span className="font-bold uppercase text-[10px]">Potongan PPH 2%</span>
                    <span className="font-mono">- {formatIDR(calculation.pph)}</span>
                  </div>
                )}
                {formData.is_ppn11 && (
                  <div className="flex justify-between text-sm text-blue-400 font-medium italic">
                    <span className="font-bold uppercase text-[10px]">PPN 11%</span>
                    <span className="font-mono">+ {formatIDR(calculation.ppn)}</span>
                  </div>
                )}
                {formData.is_pnbp && (
                  <div className="flex justify-between text-sm text-emerald-400 font-medium italic">
                    <div className="flex flex-col text-right font-bold uppercase text-[10px]">
                      <span>Biaya PNBP</span>
                      <span className="text-[8px] opacity-40 italic">({calculation.totalPesertaAll} Peserta Total)</span>
                    </div>
                    <span className="font-mono">+ {formatIDR(calculation.pnbp)}</span>
                  </div>
                )}
              </div>

              <div className="pt-10 border-t border-zinc-800 flex flex-col gap-2 leading-none">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] italic">Total Tagihan Akhir</span>
                <h2 className="text-4xl font-black tabular-nums tracking-tighter leading-none italic">{formatIDR(calculation.totalAkhir)}</h2>
              </div>

              <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700 flex items-center gap-3 mt-4">
                 <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Status Invoice: {formData.status}</span>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="w-full bg-emerald-500 text-black hover:bg-emerald-400 h-20 text-2xl font-black rounded-[1.5rem] mt-6 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.3)] active:scale-95 italic uppercase tracking-tighter"
              >
                {loading ? <Loader2 className="animate-spin" /> : "KONFIRMASI"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}