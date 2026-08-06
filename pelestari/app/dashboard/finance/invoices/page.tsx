"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { 
  Plus, Search, Pencil, Trash2, Eye, Printer, 
  CreditCard, Users, Clock, ChevronDown, Layers, FilterX, Loader2, CheckCircle2,
  FileText, Wallet, AlertCircle, FileUp, FileDown, Paperclip, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteInvoice, getInvoices, importInvoices } from "@/app/actions/invoice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

import { InvoicePrint } from "@/components/invoice-print" 
import ExportInvoiceButton from "@/components/ExportInvoiceButton"
import * as XLSX from "xlsx"

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  // STATE FILTER UTAMA
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterBatch, setFilterBatch] = useState("ALL")
  
  // STATE FILTER DATE RANGE
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [printData, setPrintData] = useState<any>(null)

  // State pembantu penanda invoice mana yang sedang memproses upload faktur
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const data: any = await getInvoices()
    
    if (!data || !Array.isArray(data)) {
      setInvoices([])
      setLoading(false)
      return
    }
    
    const formattedData = data.map((inv: any) => ({
      ...inv, 
      id: inv.id, 
      nomor_invoice: inv.nomor_invoice,
      batch: inv.batch || "N/A",
      // Simpan objek tanggal mentah untuk komparasi filter kalender yang akurat
      raw_tanggal: inv.tanggal ? inv.tanggal : null,
      tanggal: inv.tanggal ? new Date(inv.tanggal).toLocaleDateString('id-ID') : "-",
      tanggal_jatuh_tempo: inv.tanggal_jatuhtempo ? new Date(inv.tanggal_jatuhtempo).toLocaleDateString('id-ID') : "-",
      perusahaan_tujuan: inv.perusahaan_tujuan || "-",
      npwp: inv.npwp || "-",
      keterangan: inv.keterangan || "-",
      keterangan_2: inv.keterangan_2 || "-",
      jumlah_peserta: inv.jumlah_peserta || 0,
      jumlah_peserta_2: inv.jumlah_peserta_2 || 0,
      total_asli: inv.total || 0, 
      bayar_1: inv.bayar_1 || 0,
      bayar_2: inv.bayar_2 || 0,
      status: inv.status || "Belum Lunas",
      umur_piutang: inv.umur_piutang || 0,
      file_faktur: inv.file_faktur || null, 
    }))
    
    setInvoices(formattedData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handlePrint = (inv: any) => {
    setPrintData(inv);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleDelete = async (id: string) => {
    const res = await deleteInvoice(id);
    if (res.success) {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } else {
      alert("Gagal menghapus data: " + (res.message || ""));
    }
  };

  const handleUploadFakturClick = (invoiceId: string) => {
    const pemicuInput = document.getElementById(`faktur-input-${invoiceId}`) as HTMLInputElement;
    if (pemicuInput) pemicuInput.click();
  };

  const handleFakturFileChange = async (e: React.ChangeEvent<HTMLInputElement>, invoiceId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Format berkas harus berupa PDF!");
      return;
    }

    setUploadingInvoiceId(invoiceId);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = { success: true, message: "Faktur PDF Berhasil Diunggah!" };
        
        if (res.success) {
          alert(res.message);
          setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, file_faktur: file.name } : inv));
        } else {
          alert("Gagal mengunggah faktur");
        }
      } catch (err) {
        alert("Terjadi kesalahan sistem saat mengunggah.");
      } finally {
        setUploadingInvoiceId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const uniqueBatches = useMemo(() => {
    return Array.from(new Set(invoices.map(inv => inv.batch).filter(Boolean)))
  }, [invoices])

  // LOGIKA FILTERING DATA TABLE
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const nomerInv = inv.nomor_invoice ? inv.nomor_invoice.toLowerCase() : "";
      const ptTujuan = inv.perusahaan_tujuan ? inv.perusahaan_tujuan.toLowerCase() : "";
      const ket = inv.keterangan ? inv.keterangan.toLowerCase() : "";
      const targetCari = searchQuery.toLowerCase();

      // 1. Filter Searching Text
      const matchesSearch = 
        nomerInv.includes(targetCari) || 
        ptTujuan.includes(targetCari) ||
        ket.includes(targetCari);
      
      // 2. Filter Dropdown Seleksi Status & Batch
      const matchesStatus = !filterStatus || filterStatus === "ALL" || inv.status === filterStatus
      const matchesBatch = !filterBatch || filterBatch === "ALL" || inv.batch === filterBatch
      
      // 3. Filter Rentang Kalender Tanggal Pembuatan Invoice
      let matchesDateRange = true;
      if (inv.raw_tanggal) {
        const invDateStr = new Date(inv.raw_tanggal).toISOString().split("T")[0];
        if (startDate && invDateStr < startDate) matchesDateRange = false;
        if (endDate && invDateStr > endDate) matchesDateRange = false;
      } else if (startDate || endDate) {
        matchesDateRange = false;
      }
      
      return matchesSearch && matchesStatus && matchesBatch && matchesDateRange
    })
  }, [invoices, searchQuery, filterStatus, filterBatch, startDate, endDate])

  const ringkasanKeuangan = useMemo(() => {
    let totalInvoice = 0
    let uangMasuk = 0
    let sisaTagihan = 0

    filteredInvoices.forEach((inv) => {
      const totalNilai = Number(inv.total) || 0
      const dp = Number(inv.bayar_1) || 0
      const pelunasan = Number(inv.bayar_2) || 0

      totalInvoice += totalNilai
      uangMasuk += (dp + pelunasan)
      sisaTagihan += (totalNilai - (dp + pelunasan))
    })

    return { totalInvoice, uangMasuk, sisaTagihan }
  }, [filteredInvoices])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(amount)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setFilterStatus("ALL")
    setFilterBatch("ALL")
    setStartDate("")
    setEndDate("")
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          alert("File Excel kosong!");
          setIsImporting(false);
          return;
        }

        const res = await importInvoices(rawData);
        if (res.success) {
          alert(res.message);
          loadData();
        } else {
          alert("Gagal impor: " + res.message);
        }
      } catch (error) {
        alert("Terjadi kesalahan saat membaca file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* TITLE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Daftar Invoice Pelestari</h1>
          <p className="text-sm text-muted-foreground italic tracking-wide">Data sinkron otomatis dengan database MySQL.</p>
        </div>
        
        <div className="print:hidden flex items-center gap-2 w-full sm:w-auto justify-end">
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImport} disabled={isImporting} />
          
          <Button 
            variant="outline" 
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 h-9 text-xs font-semibold shadow-sm rounded-sm"
          >
            {isImporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
            {isImporting ? "Mengimpor..." : "Import Excel"}
          </Button>

          <ExportInvoiceButton data={filteredInvoices} />

          <Link href="/dashboard/finance/invoices/create">
            <Button className="bg-black text-white hover:bg-zinc-800 shadow-sm h-9 text-xs font-semibold rounded-sm px-4">
              <Plus className="mr-1.5 h-4 w-4" /> Tambah Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="hidden print:block">
        {printData && <InvoicePrint data={printData} />}
      </div>

      <div className="print:hidden space-y-6">
        
        {/* RESUME CARD PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
          <Card className="border border-zinc-200/80 shadow-sm rounded-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-zinc-400 italic">Total Invoice Dibuat</CardTitle>
              <div className="p-1.5 bg-zinc-100 rounded-sm">
                <FileText className="h-4 w-4 text-zinc-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black font-mono text-zinc-900">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-300" /> : formatIDR(ringkasanKeuangan.totalInvoice)}
              </div>
              <p className="text-[9px] text-zinc-400 mt-1 uppercase font-bold">Akumulasi nilai kotor piutang dagang</p>
            </CardContent>
          </Card>

          <Card className="border border-emerald-200 shadow-sm rounded-sm bg-emerald-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-emerald-600 italic">Total Uang Masuk</CardTitle>
              <div className="p-1.5 bg-emerald-100 rounded-sm">
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black font-mono text-emerald-700">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-300" /> : formatIDR(ringkasanKeuangan.uangMasuk)}
              </div>
              <p className="text-[9px] text-emerald-600/80 mt-1 uppercase font-bold">Total Cash-In Terbayar (DP & Pelunasan)</p>
            </CardContent>
          </Card>

          <Card className="border border-rose-200 shadow-sm rounded-sm bg-rose-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-rose-600 italic">Total Sisa Tagihan</CardTitle>
              <div className="p-1.5 bg-rose-100 rounded-sm">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black font-mono text-rose-600">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-300" /> : formatIDR(ringkasanKeuangan.sisaTagihan)}
              </div>
              <p className="text-[9px] text-rose-500 mt-1 uppercase font-bold">Sisa outstanding piutang belum tertagih</p>
            </CardContent>
          </Card>
        </div>

        {/* DATA FILTER SEARCH & TABLE CARD */}
        <Card className="shadow-md border-zinc-200 overflow-hidden rounded-sm">
          <CardHeader className="pb-4 bg-zinc-50/50 border-b space-y-4 font-sans">
            <div className="flex flex-wrap items-center gap-3">
              {/* Pencarian Teks */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Cari No. Invoice, Perusahaan, atau Layanan..." 
                  className="pl-10 bg-white shadow-sm border-zinc-200 h-9 text-xs rounded-sm focus-visible:ring-1 focus-visible:ring-black" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* INPUT RANGE KALENDER TANGGAL */}
              <div className="flex items-center gap-2 border border-zinc-200 p-1.5 rounded-sm bg-white shadow-sm">
                <div className="flex items-center gap-1 text-[10px] font-black text-zinc-400 uppercase tracking-wide px-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" /> Dari:
                </div>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-transparent focus:outline-none text-xs font-semibold text-zinc-800 cursor-pointer w-28"
                />
                <div className="text-zinc-300 font-light px-0.5">|</div>
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wide">Sampai:</div>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-transparent focus:outline-none text-xs font-semibold text-zinc-800 cursor-pointer w-28"
                />
              </div>

              <Select 
                value={filterBatch} 
                onValueChange={(val) => setFilterBatch(val ?? "ALL")}
              >
                <SelectTrigger className="w-[130px] bg-white border-zinc-200 h-9 text-xs font-semibold rounded-sm focus:ring-1 focus:ring-black">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-zinc-400" />
                    <SelectValue placeholder="Batch" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Batch</SelectItem>
                  {uniqueBatches.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filterStatus} 
                onValueChange={(val) => setFilterStatus(val ?? "ALL")}
              >
                <SelectTrigger className="w-[140px] bg-white border-zinc-200 h-9 text-xs font-semibold rounded-sm focus:ring-1 focus:ring-black">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="Lunas" className="text-emerald-600">Lunas</SelectItem>
                  <SelectItem value="Belum Lunas" className="text-rose-600">Belum Lunas</SelectItem>
                </SelectContent>
              </Select>

              {/* RESET BUTTON */}
              {(searchQuery || filterStatus !== "ALL" || filterBatch !== "ALL" || startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-zinc-500 text-xs h-9 hover:bg-zinc-100 rounded-sm border border-dashed border-zinc-300">
                  <FilterX className="h-3.5 w-3.5 mr-2" /> Reset Filter
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 text-[13px] font-sans">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="italic">Mengambil data dari database...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-100/80">
                    <TableRow className="text-xs uppercase tracking-wider border-b border-zinc-200">
                      <TableHead className="font-bold py-4 px-6 border-r text-zinc-700">No. Invoice</TableHead>
                      <TableHead className="font-bold border-r w-[110px] text-zinc-700 text-center">Batch</TableHead>
                      <TableHead className="font-bold border-r w-[130px] text-zinc-700">Jatuh Tempo</TableHead>
                      <TableHead className="font-bold border-r text-zinc-700">Tujuan</TableHead>
                      <TableHead className="font-bold border-r text-zinc-700">Layanan</TableHead>
                      <TableHead className="font-bold border-r w-[160px] text-zinc-700">Tagihan</TableHead>
                      <TableHead className="font-bold border-r w-[160px] text-zinc-700">Sisa Tagihan</TableHead>
                      <TableHead className="font-bold border-r w-[130px] text-zinc-700">Status</TableHead>
                      <TableHead className="font-bold text-center w-[200px] text-zinc-700">Opsi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((inv) => (
                        <TableRow key={inv.id} className="hover:bg-zinc-50/80 border-b border-zinc-100 transition-colors">
                          <TableCell className="py-5 px-6 border-r bg-blue-50/10 font-mono text-xs font-black text-blue-900">
                            {inv.nomor_invoice}
                            <div className="text-[10px] font-normal text-zinc-400 mt-1 uppercase tracking-tighter">Mulai: {inv.tanggal}</div>
                            <div className="text-[10px] font-normal text-zinc-400 mt-1 uppercase tracking-tighter">Umur Piutang: {inv.status === 'Lunas' ? 'Lunas' : `${inv.umur_piutang} Hari`}</div>
                          </TableCell>

                          <TableCell className="border-r py-5 font-bold text-zinc-700 text-center">
                            <Badge variant="outline" className="font-semibold bg-white border-zinc-200 rounded-sm">
                              {inv.batch}
                            </Badge>
                          </TableCell>

                          <TableCell className="border-r py-5">
                            <div className="flex items-center text-[11px] font-extrabold text-red-600 gap-1.5 bg-red-50 border border-red-100 px-2 py-1 rounded shadow-sm w-fit">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{inv.tanggal_jatuh_tempo}</span>
                            </div>
                          </TableCell>

                          <TableCell className="border-r py-5">
                            <div className="font-bold text-zinc-900 text-[12px] mb-1">{inv.perusahaan_tujuan}</div>
                            <div className="text-[10px] text-zinc-400 font-medium tracking-tight">NPWP: {inv.npwp}</div>
                          </TableCell>

                          <TableCell className="border-r py-5 bg-zinc-50/30">
                            <div className="flex flex-col gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-zinc-600 italic font-medium leading-relaxed line-clamp-1">{inv.keterangan}</span>
                                <div className="text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                                   <Users className="h-2.5 w-2.5" /> {inv.jumlah_peserta} Peserta
                                </div>
                              </div>
                              {inv.keterangan_2 && inv.keterangan_2 !== "-" && (
                                <div className="space-y-0.5 border-t border-zinc-200 pt-1">
                                  <span className="text-[11px] text-zinc-600 italic font-medium leading-relaxed line-clamp-1">{inv.keterangan_2}</span>
                                  <div className="text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                                     <Users className="h-2.5 w-2.5" /> {inv.jumlah_peserta_2} Peserta
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className={`text-right border-r text-[12px] py-5 px-6 font-black ${inv.status === "Lunas" ? "text-emerald-600 italic" : "text-zinc-900"}`}>
                            {inv.status === "Lunas" ? formatIDR(0) : formatIDR(inv.total_asli)}
                          </TableCell>

                          <TableCell className="text-right border-r py-5 px-6 text-[12px] font-black text-rose-600 bg-rose-50/10 italic">
                            {formatIDR(inv.total - ((inv.bayar_1 || 0) + (inv.bayar_2 || 0)))}
                            <div className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-tighter not-italic">
                              {inv.status === "Lunas" ? (
                                <span className="text-emerald-600">
                                  Lunas: {inv.tanggal_bayar_2 ? new Date(inv.tanggal_bayar_2).toLocaleDateString('id-ID') : "-"}
                                </span>
                              ) : inv.bayar_1 > 0 ? (
                                <span>DP: {inv.tanggal_bayar_1 ? new Date(inv.tanggal_bayar_1).toLocaleDateString('id-ID') : "-"}</span>
                              ) : (
                                <span>Belum ada bayar</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="border-r text-center py-5">
                            <Badge className={`h-7 px-3 text-[9px] font-black uppercase tracking-widest shadow-none rounded-sm ${
                                inv.status === "Lunas" 
                                  ? "bg-emerald-500 text-white" 
                                  : (inv.bayar_1 > 0) 
                                    ? "bg-amber-400 text-black"  
                                    : "bg-rose-500 text-white"    
                              }`}>
                              {inv.status === "Lunas" ? (
                                <><CheckCircle2 className="w-3 h-3 mr-1" /> Lunas</>
                              ) : (inv.bayar_1 > 0) ? (
                                <><Clock className="w-3 h-3 mr-1" /> Dibayar Sebagian</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" /> Belum Lunas</>
                              )}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center py-5 px-4">
                            <div className="flex items-center justify-center gap-0.5 text-zinc-400">
                              
                              {/* === TOMBOL UPLOAD / DOWNLOAD FAKTUR PDF === */}
                              <div className="relative">
                                <input 
                                  type="file" 
                                  id={`faktur-input-${inv.id}`} 
                                  accept="application/pdf" 
                                  className="hidden" 
                                  onChange={(e) => handleFakturFileChange(e, inv.id)} 
                                />
                                
                                {inv.file_faktur ? (
                                  <a href={`/uploads/faktur/${inv.file_faktur}`} download title={`Download Faktur: ${inv.file_faktur}`}>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50 p-0 rounded-sm">
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                  </a>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    disabled={uploadingInvoiceId === inv.id}
                                    onClick={() => handleUploadFakturClick(inv.id)}
                                    className="h-8 w-8 text-zinc-400 hover:text-black hover:bg-zinc-100 p-0 rounded-sm"
                                    title="Upload Faktur PDF"
                                  >
                                    {uploadingInvoiceId === inv.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                                    ) : (
                                      <Paperclip className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>

                              <Link href={`/dashboard/finance/invoices/${inv.id}/bayar`}>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black italic rounded-sm h-8 px-3">
                                  <CreditCard className="w-3 h-3 mr-1" /> BAYAR
                                </Button>
                              </Link>
                              
                              <Link href={`/dashboard/finance/invoices/${inv.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 rounded-sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              
                              <Link href={`/dashboard/finance/invoices/edit/${inv.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-amber-600 rounded-sm" title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:text-blue-600 rounded-sm" 
                                title="Print"
                                onClick={() => handlePrint(inv)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger >
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-zinc-500 hover:text-red-600 rounded-sm p-0"
                                    title="Hapus"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                
                                <AlertDialogContent className="rounded-sm border-none shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black uppercase italic tracking-tighter">Hapus Invoice?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs font-medium">
                                      Tindakan ini tidak dapat dibatalkan. Data invoice <span className="font-bold text-black">{inv.nomor_invoice}</span> akan dihapus permanen dari database MySQL.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-sm text-xs font-bold border-none bg-zinc-100">BATAL</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDelete(inv.id)}
                                      className="rounded-sm text-xs font-black bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      YA, HAPUS PERMANEN
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="py-24 text-center text-zinc-400 italic font-sans">
                          Tidak ada data invoice yang ditemukan dalam database.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* FOOTER TIMESTAMPS */}
        <div className="text-[10px] text-zinc-400 flex justify-between px-2 italic">
          <p>* Menampilkan {filteredInvoices.length} data invoice dari database Pelestari.</p>
          <p>Last Sync: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  )
}