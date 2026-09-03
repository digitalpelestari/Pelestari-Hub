"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Save, X, FileText, ArrowLeft, Search, RotateCcw } from "lucide-react"
import { createJurnalDenganReferensiInvoiceOnly, generateNoRegistrasiOtomatis, getAkunByKelompok } from "@/app/actions/jurnal"
import { getAkunList } from "@/app/actions/akun"
import { lookupReferensi, type ReferensiMatch } from "@/app/actions/referensi"
import Link from "next/link"
import { swal } from "@/lib/sweetalert"

interface JournalItem {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  kredit: number;
  keterangan: string;
}

interface JournalForm {
  tanggal: string;
  noRegistrasi: string;
  noReferensi: string;
  penerima: string;
  keterangan: string;
  items: JournalItem[];
}

function makeEmptyItems(): JournalItem[] {
  return [
    { accountCode: "", accountName: "", accountType: "", debit: 0, kredit: 0, keterangan: "" },
    { accountCode: "", accountName: "", accountType: "", debit: 0, kredit: 0, keterangan: "" },
  ];
}

export default function KasirJurnalPage() {
  const [akunList, setAkunList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<JournalForm>({
    tanggal: new Date().toISOString().split("T")[0],
    noRegistrasi: "",
    noReferensi: "",
    penerima: "",
    keterangan: "",
    items: makeEmptyItems(),
  })

  const [referensiMatch, setReferensiMatch] = useState<ReferensiMatch>({ found: null })
  const [isLooking, setIsLooking] = useState(false)
  const [templateApplied, setTemplateApplied] = useState(false)
  const lastQueriedRef = useRef<string>("")

  useEffect(() => {
    async function loadAkun() {
      const data = await getAkunList()
      setAkunList(data)
    }
    loadAkun()
  }, [])

  const totalDebit = form.items.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)
  const totalKredit = form.items.reduce((sum, item) => sum + (Number(item.kredit) || 0), 0)
  const isBalanced = totalDebit === totalKredit && totalDebit > 0

  // Generator manual saat tombol +BK / +BD / +KK diklik
  const handleGenerateManual = async (tipe: "BK" | "BD" | "KK") => {
    const res = await generateNoRegistrasiOtomatis(tipe as any);
    if (res.success && res.code) {
      setForm(prev => ({ ...prev, noRegistrasi: res.code }));
    }
  };

  // Tentukan kelompok Kas/Bank berdasarkan prefix noRegistrasi (BK/BD/KK)
  const resolveKelompokKasBank = (noReg: string): string | null => {
    const prefix = (noReg || "").trim().split(/[_\/\s-]/)[0].toUpperCase();
    if (prefix === "KK") return "KAS";
    if (prefix === "BK" || prefix === "BD") return "BANK";
    return null;
  };

  // Auto-fill baris jurnal dari hasil lookup referensi
  const applyTemplate = useCallback(
    async (m: ReferensiMatch) => {
      if (m.found === null) {
        setTemplateApplied(false);
        return;
      }

      const kelompokKasBank = resolveKelompokKasBank(form.noRegistrasi);
      if (!kelompokKasBank) {
        setTemplateApplied(false);
        return;
      }

      const [akunKasBank, akunPiutang, akunHutang] = await Promise.all([
        getAkunByKelompok(kelompokKasBank),
        getAkunByKelompok("PIUTANG"),
        getAkunByKelompok("HUTANG"),
      ]);

      if (!akunKasBank) {
        setTemplateApplied(false);
        return;
      }

      // INVOICE
      if (m.found === "invoice") {
        const inv = m.data;
        const adaBayaran = inv.bayar_1 > 0 || inv.status === "Lunas";
        if (!adaBayaran) {
          setTemplateApplied(false);
          return;
        }
        if (!akunPiutang) {
          setTemplateApplied(false);
          return;
        }
        const nominal = inv.status === "Lunas" ? inv.total : inv.bayar_1;
        if (!nominal || nominal <= 0) {
          setTemplateApplied(false);
          return;
        }
        const fase = inv.status === "Lunas" ? "Pelunasan" : "Pembayaran DP";
        setForm(prev => ({
          ...prev,
          penerima: inv.perusahaan_tujuan,
          keterangan: `${fase} invoice ${inv.nomor} - ${inv.perusahaan_tujuan}`,
          items: [
            {
              accountCode: akunKasBank.no_akun,
              accountName: akunKasBank.nama_akun,
              accountType: akunKasBank.nama_kelompok,
              debit: nominal,
              kredit: 0,
              keterangan: `${fase} via ${kelompokKasBank}`,
            },
            {
              accountCode: akunPiutang.no_akun,
              accountName: akunPiutang.nama_akun,
              accountType: akunPiutang.nama_kelompok,
              debit: 0,
              kredit: nominal,
              keterangan: `Pelunasan piutang invoice ${inv.nomor}`,
            },
          ],
        }));
        setTemplateApplied(true);
        return;
      }

      // PO
      if (m.found === "po") {
        const po = m.data;
        if (po.status_pembayaran === "SUDAH BAYAR") {
          setTemplateApplied(false);
          return;
        }
        if (!akunHutang) {
          setTemplateApplied(false);
          return;
        }
        if (!po.total_harga || po.total_harga <= 0) {
          setTemplateApplied(false);
          return;
        }
        setForm(prev => ({
          ...prev,
          penerima: po.vendor_nama,
          keterangan: `Pembayaran PO ${po.nomor} - ${po.vendor_nama}`,
          items: [
            {
              accountCode: akunHutang.no_akun,
              accountName: akunHutang.nama_akun,
              accountType: akunHutang.nama_kelompok,
              debit: po.total_harga,
              kredit: 0,
              keterangan: `Hutang atas PO ${po.nomor}`,
            },
            {
              accountCode: akunKasBank.no_akun,
              accountName: akunKasBank.nama_akun,
              accountType: akunKasBank.nama_kelompok,
              debit: 0,
              kredit: po.total_harga,
              keterangan: `Pembayaran PO ${po.nomor} via ${kelompokKasBank}`,
            },
          ],
        }));
        setTemplateApplied(true);
      }
    },
    [form.noRegistrasi]
  );

  // Debounce lookup noReferensi ~400ms
  useEffect(() => {
    const noRef = (form.noReferensi || "").trim();
    if (noRef.length < 3) {
      setReferensiMatch({ found: null });
      setIsLooking(false);
      setTemplateApplied(false);
      lastQueriedRef.current = "";
      return;
    }
    if (noRef === lastQueriedRef.current) return;

    setIsLooking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await lookupReferensi(noRef);
        lastQueriedRef.current = noRef;
        setReferensiMatch(result);
        await applyTemplate(result);
      } catch (e) {
        setReferensiMatch({ found: null });
      } finally {
        setIsLooking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.noReferensi, applyTemplate]);

  // Reset template (kembalikan ke baris kosong)
  const handleResetTemplate = () => {
    setForm(prev => ({ ...prev, items: makeEmptyItems() }));
    setTemplateApplied(false);
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Handler nominal murni tanpa side effect ke nomor registrasi
  const handleItemChange = (index: number, field: keyof JournalItem, value: string | number) => {
    const updatedItems = [...form.items]

    if (field === "accountCode") {
      updatedItems[index].accountCode = value as string
      const targetAkun = akunList.find(a => a.no_akun === value)
      updatedItems[index].accountName = targetAkun ? targetAkun.nama_akun : ""
      updatedItems[index].accountType = targetAkun ? (targetAkun.nama_kelompok || "General Parameter") : ""
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value }
    }

    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { accountCode: "", accountName: "", accountType: "", debit: 0, kredit: 0, keterangan: "" }],
    }))
  }

  const removeRow = (index: number) => {
    if (form.items.length <= 2) {
      swal.warning("Jurnal umum minimal harus memiliki 2 baris (Debit & Kredit).")
      return
    }
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isBalanced) return swal.warning("Total Debit dan Kredit harus seimbang (Balanced)!")

    setLoading(true)
    const res = await createJurnalDenganReferensiInvoiceOnly(form) 
    
    if (res.success) {
      swal.success(res.message)
      setForm({
        tanggal: new Date().toISOString().split("T")[0],
        noRegistrasi: "",
        noReferensi: "",
        penerima: "",
        keterangan: "",
        items: makeEmptyItems(),
      })
      setReferensiMatch({ found: null })
      setTemplateApplied(false)
      lastQueriedRef.current = ""
    } else {
      swal.error("Gagal Simpan: " + res.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* HEADER BAR UTAMA */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Buat Jurnal Umum Baru
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            Double-Entry Accounting Input System
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance/pos/jurnal">
            <Button variant="outline" className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50">
              <ArrowLeft className="h-4 w-4 text-zinc-500" /> LIHAT RIWAYAT JURNAL
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* HEADER TRANSAKSI (5 KOLOM RESPONSIF) */}
        <Card className="border shadow-sm bg-zinc-50/50 rounded-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
            
            {/* 1. TANGGAL */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1">Tanggal Transaksi *</label>
              <Input type="date" name="tanggal" value={form.tanggal} onChange={handleHeaderChange} required className="h-10 font-bold bg-white border-zinc-300 rounded-sm" />
            </div>
            
            {/* 2. NO. REGISTRASI + 3 BADGE (BK / BD / KK) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1 flex items-center justify-between">
                <span>No. Registrasi / Bukti</span>
              </label>
              <div className="relative">
                <Input 
                  placeholder="BK/BD/KK" 
                  name="noRegistrasi" 
                  value={form.noRegistrasi} 
                  onChange={handleHeaderChange} 
                  className="h-10 font-bold bg-white border-zinc-300 rounded-sm pr-24 font-mono text-zinc-700" 
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Badge 
                    onClick={() => handleGenerateManual("BK")} 
                    className="cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[8px] font-bold rounded-[2px] px-1 py-0.5"
                    title="Bank Keluar"
                  >
                    +BK
                  </Badge>
                  <Badge 
                    onClick={() => handleGenerateManual("BD")} 
                    className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[8px] font-bold rounded-[2px] px-1 py-0.5"
                    title="Bank Masuk / Debet"
                  >
                    +BD
                  </Badge>
                  <Badge 
                    onClick={() => handleGenerateManual("KK")} 
                    className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[8px] font-bold rounded-[2px] px-1 py-0.5"
                    title="Kas Keluar"
                  >
                    +KK
                  </Badge>
                </div>
              </div>
            </div>

            {/* 3. NO. REFERENSI */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1 flex items-center justify-between">
                <span>No. Referensi / Nota Asli</span>
                {templateApplied && (
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="text-[9px] font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
                    title="Reset baris debit/kredit ke kosong"
                  >
                    <RotateCcw className="h-3 w-3" /> RESET TEMPLATE
                  </button>
                )}
              </label>
              <div className="relative">
                <Input
                  placeholder="Contoh: 001/INV/VIII/2026/G atau 001/PO-GA/..."
                  name="noReferensi"
                  value={form.noReferensi}
                  onChange={handleHeaderChange}
                  className="h-10 font-bold bg-white border-zinc-300 rounded-sm pr-10"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isLooking ? (
                    <Search className="h-4 w-4 text-zinc-400 animate-pulse" />
                  ) : referensiMatch.found ? (
                    <Search className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Search className="h-4 w-4 text-zinc-300" />
                  )}
                </div>
              </div>
              {/* BADGE STATUS REFERENSI */}
              <div className="min-h-[20px] flex flex-wrap items-center gap-1.5 pt-1">
                {isLooking && (
                  <Badge variant="outline" className="text-[9px] font-bold rounded-[2px] border-zinc-300 text-zinc-500">
                    <Search className="h-3 w-3 mr-1 animate-pulse" /> Mencari referensi...
                  </Badge>
                )}
                {!isLooking && referensiMatch.found === "invoice" && (
                  <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-bold rounded-[2px] px-2 py-1">
                    ✓ INVOICE: {referensiMatch.data.nomor} — {referensiMatch.data.perusahaan_tujuan}
                    <span className="ml-1 font-mono">
                      (Sisa Rp {referensiMatch.data.sisa_tagihan.toLocaleString("id-ID")})
                    </span>
                  </Badge>
                )}
                {!isLooking && referensiMatch.found === "po" && (
                  <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold rounded-[2px] px-2 py-1">
                    ✓ PO: {referensiMatch.data.nomor} — {referensiMatch.data.vendor_nama}
                    <span className="ml-1 font-mono">
                      (Total Rp {referensiMatch.data.total_harga.toLocaleString("id-ID")})
                    </span>
                  </Badge>
                )}
                {!isLooking &&
                  referensiMatch.found === null &&
                  form.noReferensi.trim().length >= 3 && (
                    <Badge variant="outline" className="text-[9px] font-bold rounded-[2px] border-zinc-300 text-zinc-500">
                      Referensi bebas — tidak terhubung ke invoice/PO
                    </Badge>
                  )}
                {!isLooking &&
                  referensiMatch.found === "invoice" &&
                  referensiMatch.data.bayar_1 === 0 &&
                  referensiMatch.data.status !== "Lunas" && (
                    <Badge variant="outline" className="text-[9px] font-bold rounded-[2px] border-amber-300 text-amber-700 bg-amber-50">
                      ⚠ Invoice belum ada pembayaran — isi jurnal manual
                    </Badge>
                  )}
                {!isLooking &&
                  referensiMatch.found === "po" &&
                  referensiMatch.data.status_pembayaran === "SUDAH BAYAR" && (
                    <Badge variant="outline" className="text-[9px] font-bold rounded-[2px] border-rose-300 text-rose-700 bg-rose-50">
                      ⚠ PO sudah dibayar — tidak dibuat jurnal otomatis
                    </Badge>
                  )}
              </div>
            </div>

            {/* 4. PENERIMA / VENDOR */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1">Penerima</label>
              <Input placeholder="Nama Toko / Penerima..." name="penerima" value={form.penerima} onChange={handleHeaderChange} className="h-10 font-bold bg-white border-zinc-300 rounded-sm" />
            </div>
            
            {/* 5. KETERANGAN */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1">Keterangan Umum</label>
              <Input placeholder="Deskripsi ringkas transaksi..." name="keterangan" value={form.keterangan} onChange={handleHeaderChange} className="h-10 font-bold bg-white border-zinc-300 rounded-sm" />
            </div>
          </CardContent>
        </Card>

        {/* TABLE DATA ITEM */}
        <div className="border border-zinc-300 rounded-sm overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-zinc-100">
              <TableRow className="hover:bg-zinc-100 border-b border-zinc-300 text-[10px] font-black uppercase">
                <TableHead className="w-[160px] text-zinc-800 border-r py-4 px-3 font-black">Kode Akun</TableHead>
                <TableHead className="text-zinc-800 border-r px-3 font-black">Nama Akun</TableHead>
                <TableHead className="w-[180px] text-zinc-800 border-r px-3 font-black">Tipe Akun (Kelompok)</TableHead>
                <TableHead className="text-zinc-800 border-r px-3 font-black">Keterangan</TableHead>
                <TableHead className="w-[160px] text-zinc-800 border-r text-right px-3 font-black">Debit (Rp)</TableHead>
                <TableHead className="w-[160px] text-zinc-800 border-r text-right px-3 font-black">Kredit (Rp)</TableHead>
                <TableHead className="w-[50px] text-zinc-800 text-center font-black">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.items.map((item, index) => (
                <TableRow key={index} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <TableCell className="p-1 border-r">
                    <Input 
                      list={`coa-codes-${index}`}
                      placeholder="Ketik/Pilih Kode..." 
                      value={item.accountCode} 
                      onChange={(e) => handleItemChange(index, "accountCode", e.target.value)} 
                      required
                      className="h-9 text-xs font-mono font-bold bg-transparent border-none shadow-none focus-visible:ring-0"
                    />
                    <datalist id={`coa-codes-${index}`}>
                      {akunList.map((a) => (
                        <option key={a.id} value={a.no_akun}>
                          {`${a.nama_akun} (${a.nama_kelompok || "General Parameter"})`}
                        </option>
                      ))}
                    </datalist>
                  </TableCell>
                  <TableCell className="p-1 border-r">
                    <Input readOnly placeholder="Nama Akun otomatis..." value={item.accountName} className="h-9 text-xs font-bold bg-zinc-50/50 text-zinc-500 border-none shadow-none" />
                  </TableCell>
                  <TableCell className="px-3 border-r">
                    {item.accountType ? (
                      <Badge variant="outline" className="rounded-sm font-black text-[9px] bg-zinc-50 border-zinc-200 text-zinc-500 px-2 py-0.5 uppercase italic">
                        {item.accountType}
                      </Badge>
                    ) : (
                      <span className="text-zinc-300 text-[10px] italic">Belum dipilih</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1 border-r">
                    <Input
                      placeholder="Keterangan..."
                      value={item.keterangan || ""}
                      onChange={(e) => handleItemChange(index, "keterangan", e.target.value)}
                      className="h-9 text-xs font-medium bg-transparent border-none shadow-none focus-visible:ring-0"
                    />
                  </TableCell>
                  <TableCell className="p-1 border-r">
                    <Input type="number" min="0" placeholder="0" value={item.debit || ""} onChange={(e) => handleItemChange(index, "debit", Number(e.target.value))} className="h-9 text-xs text-right font-mono font-bold bg-transparent border-none shadow-none focus-visible:ring-0" />
                  </TableCell>
                  <TableCell className="p-1 border-r">
                    <Input type="number" min="0" placeholder="0" value={item.kredit || ""} onChange={(e) => handleItemChange(index, "kredit", Number(e.target.value))} className="h-9 text-xs text-right font-mono font-bold bg-transparent border-none shadow-none focus-visible:ring-0" />
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-600 rounded-sm" onClick={() => removeRow(index)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* CONTROL BOTTOM */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-100/50 p-3 rounded-sm border border-zinc-200">
          <Button type="button" variant="outline" onClick={addRow} className="w-full sm:w-auto h-9 text-xs font-black border-zinc-300 rounded-sm bg-white">
            <Plus className="mr-1 h-3.5 w-3.5" /> TAMBAH BARIS AKUN
          </Button>
          <div className="text-xs font-bold text-center">
            {totalDebit === 0 && totalKredit === 0 ? (
              <span className="text-zinc-400 italic">Nilai debit dan kredit kosong.</span>
            ) : isBalanced ? (
              <div className="flex items-center gap-6">
                <span className="text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-[4px] border border-emerald-200 uppercase text-[9px] font-black tracking-wider">✓ SEIMBANG (BALANCE)</span>
                <span className="font-mono text-zinc-600">Total: Rp {totalDebit.toLocaleString("id-ID")},00</span>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <span className="text-rose-700 bg-rose-100/80 px-3 py-1 rounded-[4px] border border-rose-200 uppercase text-[9px] font-black tracking-wider">⚠️ BELUM BALANCED</span>
                <span className="font-mono text-rose-600">Selisih: Rp {Math.abs(totalDebit - totalKredit).toLocaleString("id-ID")},00</span>
              </div>
            )}
          </div>
        </div>

        {/* BUTTON SIMPAN */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <Button type="submit" disabled={!isBalanced || loading} className={`h-10 text-xs font-black italic rounded-sm px-8 shadow-sm ${isBalanced ? "bg-black text-white hover:bg-zinc-800" : "bg-zinc-200 text-zinc-400 cursor-not-allowed"}`}>
            <Save className="mr-1.5 h-4 w-4" /> {loading ? "SEDANG MENYIMPAN..." : "SIMPAN JURNAL UMUM"}
          </Button>
        </div>
      </form>
    </div>
  )
}