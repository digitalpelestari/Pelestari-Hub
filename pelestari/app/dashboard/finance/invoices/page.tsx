"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Printer,
  CreditCard,
  Users,
  Clock,
  ChevronDown,
  Layers,
  FilterX,
  Loader2,
  CheckCircle2,
  FileText,
  Wallet,
  AlertCircle,
  FileUp,
  FileDown,
  Paperclip,
  Calendar,
  ExternalLink,
  UploadCloud,
  FileCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import {
  deleteInvoice,
  getInvoices,
  importInvoices,
  updateInvoiceFile,
} from "@/app/actions/invoice"
import { uploadFileToR2Action } from "@/app/actions/upload-r2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

import { InvoicePrint } from "@/components/invoice-print"
import ExportInvoiceButton from "@/components/ExportInvoiceButton"
import * as XLSX from "xlsx"
import { swal } from "@/lib/sweetalert"

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

  // State penanda proses upload
  const [uploadingFakturId, setUploadingFakturId] = useState<string | null>(
    null
  )
  const [uploadingCLId, setUploadingCLId] = useState<string | null>(null)

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
      raw_tanggal: inv.tanggal ? inv.tanggal : null,
      tanggal: inv.tanggal
        ? new Date(inv.tanggal).toLocaleDateString("id-ID")
        : "-",
      tanggal_jatuh_tempo: inv.tanggal_jatuhtempo
        ? new Date(inv.tanggal_jatuhtempo).toLocaleDateString("id-ID")
        : "-",
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
      cl: inv.cl || null, // Field CL dari Cloudflare R2
    }))

    setInvoices(formattedData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handlePrint = (inv: any) => {
    setPrintData(inv)
    setTimeout(() => {
      window.print()
    }, 200)
  }

  const handleDelete = async (id: string) => {
    const res = await deleteInvoice(id)
    if (res.success) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id))
      swal.success("Invoice berhasil dihapus!")
    } else {
      swal.error("Gagal menghapus data: " + (res.message || ""))
    }
  }

  // HANDLER UPLOAD FAKTUR
  const handleUploadFakturClick = (invoiceId: string) => {
    const el = document.getElementById(
      `faktur-input-${invoiceId}`
    ) as HTMLInputElement
    if (el) el.click()
  }

  const handleFakturFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    invoiceId: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      swal.warning("Format berkas faktur harus berupa PDF!")
      return
    }

    setUploadingFakturId(invoiceId)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const resR2 = await uploadFileToR2Action(formData)

      if (resR2.success && resR2.url) {
        await updateInvoiceFile(invoiceId, "file_faktur", resR2.url)
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, file_faktur: resR2.url } : inv
          )
        )
        swal.success("Faktur PDF berhasil diunggah!")
      } else {
        swal.error(resR2.message || "Gagal mengunggah faktur")
      }
    } catch (err) {
      swal.error("Terjadi kesalahan sistem saat mengunggah.")
    } finally {
      setUploadingFakturId(null)
    }
  }

  // HANDLER UPLOAD CL (CLOUDFLARE R2)
  const handleUploadCLClick = (invoiceId: string) => {
    const el = document.getElementById(
      `cl-input-${invoiceId}`
    ) as HTMLInputElement
    if (el) el.click()
  }

  const handleCLFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    invoiceId: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCLId(invoiceId)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const resR2 = await uploadFileToR2Action(formData)

      if (resR2.success && resR2.url) {
        await updateInvoiceFile(invoiceId, "cl", resR2.url)
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, cl: resR2.url } : inv
          )
        )
        swal.success("File Confirmation Letter (CL) berhasil disimpan!")
      } else {
        swal.error(resR2.message || "Gagal mengunggah file CL")
      }
    } catch (err) {
      swal.error("Terjadi kesalahan sistem saat mengunggah.")
    } finally {
      setUploadingCLId(null)
    }
  }

  const uniqueBatches = useMemo(() => {
    return Array.from(new Set(invoices.map((inv) => inv.batch).filter(Boolean)))
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const nomerInv = inv.nomor_invoice ? inv.nomor_invoice.toLowerCase() : ""
      const ptTujuan = inv.perusahaan_tujuan
        ? inv.perusahaan_tujuan.toLowerCase()
        : ""
      const ket = inv.keterangan ? inv.keterangan.toLowerCase() : ""
      const targetCari = searchQuery.toLowerCase()

      const matchesSearch =
        nomerInv.includes(targetCari) ||
        ptTujuan.includes(targetCari) ||
        ket.includes(targetCari)

      const matchesStatus =
        !filterStatus || filterStatus === "ALL" || inv.status === filterStatus
      const matchesBatch =
        !filterBatch || filterBatch === "ALL" || inv.batch === filterBatch

      let matchesDateRange = true
      if (inv.raw_tanggal) {
        const invDateStr = new Date(inv.raw_tanggal).toISOString().split("T")[0]
        if (startDate && invDateStr < startDate) matchesDateRange = false
        if (endDate && invDateStr > endDate) matchesDateRange = false
      } else if (startDate || endDate) {
        matchesDateRange = false
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
      uangMasuk += dp + pelunasan
      sisaTagihan += totalNilai - (dp + pelunasan)
    })

    return { totalInvoice, uangMasuk, sisaTagihan }
  }, [filteredInvoices])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setFilterStatus("ALL")
    setFilterBatch("ALL")
    setStartDate("")
    setEndDate("")
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData: any[] = XLSX.utils.sheet_to_json(ws)

        if (rawData.length === 0) {
          swal.warning("File Excel kosong!")
          setIsImporting(false)
          return
        }

        const res = await importInvoices(rawData)
        if (res.success) {
          swal.success(res.message)
          loadData()
        } else {
          swal.error("Gagal impor: " + res.message)
        }
      } catch (error) {
        swal.error("Terjadi kesalahan saat membaca file.")
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="space-y-6 p-6">
      {/* TITLE HEADER */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
            Daftar Invoice Pelestari
          </h1>
          <p className="text-[12px] tracking-wide text-muted-foreground italic">
            Data sinkron otomatis dengan database MySQL & Cloudflare R2.
          </p>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto print:hidden">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
            disabled={isImporting}
          />

          <Button
            variant="outline"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 rounded-sm border-zinc-300 text-xs font-semibold uppercase text-zinc-700 shadow-sm hover:bg-zinc-100"
          >
            {isImporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileUp className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isImporting ? "Mengimpor..." : "Import Excel"}
          </Button>

          <ExportInvoiceButton data={filteredInvoices} />

          <Link href="/dashboard/finance/invoices/create">
            <Button className="h-9 rounded-sm bg-black px-4 text-xs uppercase font-semibold text-white shadow-sm hover:bg-zinc-800">
              <Plus className="mr-1.5 h-4 w-4" /> Tambah Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="hidden print:block">
        {printData && <InvoicePrint data={printData} />}
      </div>

      <div className="space-y-6 print:hidden">
        {/* RESUME CARD PANEL */}
        <div className="grid grid-cols-1 gap-4 font-sans md:grid-cols-3">
          <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                Total Invoice Dibuat
              </CardTitle>
              <div className="rounded-sm bg-zinc-100 p-1.5">
                <FileText className="h-4 w-4 text-zinc-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-[16px] font-black text-zinc-900">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                ) : (
                  formatIDR(ringkasanKeuangan.totalInvoice)
                )}
              </div>
              <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
                Akumulasi nilai kotor piutang dagang
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border border-emerald-200 bg-emerald-50/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black tracking-wider text-emerald-600 uppercase italic">
                Total Uang Masuk
              </CardTitle>
              <div className="rounded-sm bg-emerald-100 p-1.5">
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-[16px] font-black text-emerald-700">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                ) : (
                  formatIDR(ringkasanKeuangan.uangMasuk)
                )}
              </div>
              <p className="mt-1 text-[9px] font-bold text-emerald-600/80 uppercase">
                Total Cash-In Terbayar (DP & Pelunasan)
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border border-rose-200 bg-rose-50/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black tracking-wider text-rose-600 uppercase italic">
                Total Sisa Tagihan
              </CardTitle>
              <div className="rounded-sm bg-rose-100 p-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-[16px] font-black text-rose-600">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                ) : (
                  formatIDR(ringkasanKeuangan.sisaTagihan)
                )}
              </div>
              <p className="mt-1 text-[9px] font-bold text-rose-500 uppercase">
                Sisa outstanding piutang belum tertagih
              </p>
            </CardContent>
          </Card>
        </div>

        {/* DATA FILTER SEARCH & TABLE CARD */}
        <Card className="overflow-hidden rounded-sm border-zinc-200 shadow-md">
          <CardHeader className="space-y-4 border-b bg-zinc-50/50 pb-4 font-sans">
            <div className="flex flex-wrap items-center gap-3">
              {/* Pencarian Teks */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Cari No. Invoice, Perusahaan, atau Layanan..."
                  className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* INPUT RANGE KALENDER TANGGAL */}
              <div className="flex items-center gap-2 rounded-sm border border-zinc-200 bg-white p-1.5 shadow-sm">
                <div className="flex items-center gap-1 px-1 text-[10px] font-black tracking-wide text-zinc-400 uppercase">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" /> Dari:
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-28 cursor-pointer bg-transparent text-xs font-semibold text-zinc-800 focus:outline-none"
                />
                <div className="px-0.5 font-light text-zinc-300">|</div>
                <div className="text-[10px] font-black tracking-wide text-zinc-400 uppercase">
                  Sampai:
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-28 cursor-pointer bg-transparent text-xs font-semibold text-zinc-800 focus:outline-none"
                />
              </div>

              <Select
                value={filterBatch}
                onValueChange={(val) => setFilterBatch(val ?? "ALL")}
              >
                <SelectTrigger className="h-9 w-[130px] rounded-sm border-zinc-200 bg-white text-xs font-semibold focus:ring-1 focus:ring-black">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-zinc-400" />
                    <SelectValue placeholder="Batch" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Batch</SelectItem>
                  {uniqueBatches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterStatus}
                onValueChange={(val) => setFilterStatus(val ?? "ALL")}
              >
                <SelectTrigger className="h-9 w-[140px] rounded-sm border-zinc-200 bg-white text-xs font-semibold focus:ring-1 focus:ring-black">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="Lunas" className="text-emerald-600">
                    Lunas
                  </SelectItem>
                  <SelectItem value="Belum Lunas" className="text-rose-600">
                    Belum Lunas
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* RESET BUTTON */}
              {(searchQuery ||
                filterStatus !== "ALL" ||
                filterBatch !== "ALL" ||
                startDate ||
                endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 rounded-sm border border-dashed border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  <FilterX className="mr-2 h-3.5 w-3.5" /> Reset Filter
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 font-sans text-[13px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <Loader2 className="mb-2 h-8 w-8 animate-spin" />
                <p className="italic">Mengambil data dari database...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-100/80">
                    <TableRow className="border-b border-zinc-200 text-xs tracking-wider uppercase">
                      <TableHead className="border-r px-6 py-4 font-bold text-zinc-700">
                        No. Invoice
                      </TableHead>
                      <TableHead className="w-[90px] border-r text-center font-bold text-zinc-700">
                        Batch
                      </TableHead>
                      <TableHead className="w-[120px] border-r font-bold text-zinc-700">
                        Jatuh Tempo
                      </TableHead>
                      <TableHead className="border-r font-bold text-zinc-700">
                        Tujuan
                      </TableHead>
                      <TableHead className="border-r font-bold text-zinc-700">
                        Layanan
                      </TableHead>
                      <TableHead className="w-[150px] border-r font-bold text-zinc-700">
                        Tagihan
                      </TableHead>
                      <TableHead className="w-[150px] border-r font-bold text-zinc-700">
                        Sisa Tagihan
                      </TableHead>
                      <TableHead className="w-[120px] border-r text-center font-bold text-zinc-700">
                        Berkas
                      </TableHead>
                      <TableHead className="w-[110px] border-r text-center font-bold text-zinc-700">
                        Status
                      </TableHead>
                      <TableHead className="sticky right-0 z-20 w-[180px] bg-zinc-100 text-center font-bold text-zinc-700 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                        {" "}
                        Opsi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((inv) => (
                        <TableRow
                          key={inv.id}
                          className="group border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                        >
                          <TableCell className="border-r bg-blue-50/10 px-6 py-5 font-mono text-xs font-black text-blue-900">
                            {inv.nomor_invoice}
                            <div className="mt-1 text-[10px] font-normal tracking-tighter text-zinc-400 uppercase">
                              Mulai: {inv.tanggal}
                            </div>
                            <div className="mt-1 text-[10px] font-normal tracking-tighter text-zinc-400 uppercase">
                              Umur Piutang:{" "}
                              {inv.status === "Lunas"
                                ? "Lunas"
                                : `${inv.umur_piutang} Hari`}
                            </div>
                          </TableCell>

                          <TableCell className="border-r py-5 text-center font-bold text-zinc-700">
                            <Badge
                              variant="outline"
                              className="rounded-sm border-zinc-200 bg-white font-semibold"
                            >
                              {inv.batch}
                            </Badge>
                          </TableCell>

                          <TableCell className="border-r py-5">
                            <div className="flex w-fit items-center gap-1.5 rounded border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-extrabold text-red-600 shadow-sm">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{inv.tanggal_jatuh_tempo}</span>
                            </div>
                          </TableCell>

                          <TableCell className="border-r py-5">
                            <div className="mb-1 text-[12px] font-bold text-zinc-900">
                              {inv.perusahaan_tujuan}
                            </div>
                            <div className="text-[10px] font-medium tracking-tight text-zinc-400">
                              NPWP: {inv.npwp}
                            </div>
                          </TableCell>

                          <TableCell className="border-r bg-zinc-50/30 py-5">
                            <div className="flex flex-col gap-2">
                              <div className="space-y-0.5">
                                <span className="line-clamp-1 text-[11px] leading-relaxed font-medium text-zinc-600 italic">
                                  {inv.keterangan}
                                </span>
                                <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
                                  <Users className="h-2.5 w-2.5" />{" "}
                                  {inv.jumlah_peserta} Peserta
                                </div>
                              </div>
                              {inv.keterangan_2 && inv.keterangan_2 !== "-" && (
                                <div className="space-y-0.5 border-t border-zinc-200 pt-1">
                                  <span className="line-clamp-1 text-[11px] leading-relaxed font-medium text-zinc-600 italic">
                                    {inv.keterangan_2}
                                  </span>
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
                                    <Users className="h-2.5 w-2.5" />{" "}
                                    {inv.jumlah_peserta_2} Peserta
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell
                            className={`border-r px-6 py-5 text-right text-[12px] font-black ${inv.status === "Lunas" ? "text-emerald-600 italic" : "text-zinc-900"}`}
                          >
                            {inv.status === "Lunas"
                              ? formatIDR(0)
                              : formatIDR(inv.total_asli)}
                          </TableCell>

                          <TableCell className="border-r bg-rose-50/10 px-6 py-5 text-right text-[12px] font-black text-rose-600 italic">
                            {formatIDR(
                              inv.total -
                                ((inv.bayar_1 || 0) + (inv.bayar_2 || 0))
                            )}
                            <div className="mt-1 text-[10px] font-bold tracking-tighter text-zinc-400 uppercase not-italic">
                              {inv.status === "Lunas" ? (
                                <span className="text-emerald-600">
                                  Lunas:{" "}
                                  {inv.tanggal_bayar_2
                                    ? new Date(
                                        inv.tanggal_bayar_2
                                      ).toLocaleDateString("id-ID")
                                    : "-"}
                                </span>
                              ) : inv.bayar_1 > 0 ? (
                                <span>
                                  DP:{" "}
                                  {inv.tanggal_bayar_1
                                    ? new Date(
                                        inv.tanggal_bayar_1
                                      ).toLocaleDateString("id-ID")
                                    : "-"}
                                </span>
                              ) : (
                                <span>Belum ada bayar</span>
                              )}
                            </div>
                          </TableCell>

                          {/* KOLOM BERKAS (FAKTUR & CL) */}
                          <TableCell className="border-r px-2 py-5 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {/* 1. Berkas Faktur */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="file"
                                  id={`faktur-input-${inv.id}`}
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) =>
                                    handleFakturFileChange(e, inv.id)
                                  }
                                />
                                {inv.file_faktur ? (
                                  <a
                                    href={inv.file_faktur}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Buka Faktur"
                                  >
                                    <Badge
                                      variant="outline"
                                      className="flex cursor-pointer items-center gap-1 rounded-sm border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 hover:bg-blue-100"
                                    >
                                      <FileDown className="h-3 w-3" /> Faktur
                                    </Badge>
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={uploadingFakturId === inv.id}
                                    onClick={() =>
                                      handleUploadFakturClick(inv.id)
                                    }
                                    className="flex items-center gap-1 text-[9px] font-semibold text-zinc-400 hover:text-blue-600 hover:underline"
                                    title="Upload Faktur"
                                  >
                                    {uploadingFakturId === inv.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Paperclip className="h-3 w-3" />
                                    )}
                                    + Faktur
                                  </button>
                                )}
                              </div>

                              {/* 2. Berkas CL (Confirmation Letter) */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="file"
                                  id={`cl-input-${inv.id}`}
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                  className="hidden"
                                  onChange={(e) =>
                                    handleCLFileChange(e, inv.id)
                                  }
                                />
                                {inv.cl ? (
                                  <a
                                    href={inv.cl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Buka File CL"
                                  >
                                    <Badge
                                      variant="outline"
                                      className="flex cursor-pointer items-center gap-1 rounded-sm border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100"
                                    >
                                      <FileCheck className="h-3 w-3" /> CL
                                    </Badge>
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={uploadingCLId === inv.id}
                                    onClick={() => handleUploadCLClick(inv.id)}
                                    className="flex items-center gap-1 text-[9px] font-semibold text-zinc-400 hover:text-emerald-600 hover:underline"
                                    title="Upload File CL"
                                  >
                                    {uploadingCLId === inv.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <UploadCloud className="h-3 w-3" />
                                    )}
                                    + CL
                                  </button>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="border-r py-5 text-center">
                            <Badge
                              className={`h-7 rounded-sm px-2.5 text-[9px] font-black tracking-wider uppercase shadow-none ${
                                inv.status === "Lunas"
                                  ? "bg-emerald-500 text-white"
                                  : inv.bayar_1 > 0
                                    ? "bg-amber-400 text-black"
                                    : "bg-rose-500 text-white"
                              }`}
                            >
                              {inv.status === "Lunas" ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />{" "}
                                  Lunas
                                </>
                              ) : inv.bayar_1 > 0 ? (
                                <>
                                  <Clock className="mr-1 h-3 w-3" /> Sebagian
                                </>
                              ) : (
                                <>
                                  <Clock className="mr-1 h-3 w-3" /> Belum Lunas
                                </>
                              )}
                            </Badge>
                          </TableCell>

                          <TableCell className="sticky right-0 z-10 bg-white px-4 py-5 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] group-hover:bg-zinc-50">
                            {" "}
                            <div className="flex items-center justify-center gap-0.5 text-zinc-400">
                              <Link
                                href={`/dashboard/finance/invoices/${inv.id}/bayar`}
                              >
                                <Button
                                  size="sm"
                                  className="h-8 rounded-sm bg-emerald-600 px-2.5 text-[10px] font-black text-white italic hover:bg-emerald-700"
                                >
                                  <CreditCard className="mr-1 h-3 w-3" /> BAYAR
                                </Button>
                              </Link>

                              <Link
                                href={`/dashboard/finance/invoices/${inv.id}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>

                              <Link
                                href={`/dashboard/finance/invoices/edit/${inv.id}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-sm hover:text-amber-600"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-sm hover:text-blue-600"
                                title="Print"
                                onClick={() => handlePrint(inv)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-sm p-0 text-zinc-500 hover:text-red-600"
                                    title="Hapus"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>

                                <AlertDialogContent className="rounded-sm border-none shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black tracking-tighter uppercase italic">
                                      Hapus Invoice?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs font-medium">
                                      Tindakan ini tidak dapat dibatalkan. Data
                                      invoice{" "}
                                      <span className="font-bold text-black">
                                        {inv.nomor_invoice}
                                      </span>{" "}
                                      akan dihapus permanen dari database MySQL.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-sm border-none bg-zinc-100 text-xs font-bold">
                                      BATAL
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(inv.id)}
                                      className="rounded-sm bg-red-600 text-xs font-black text-white hover:bg-red-700"
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
                        <TableCell
                          colSpan={10}
                          className="py-24 text-center font-sans text-zinc-400 italic"
                        >
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
        <div className="flex justify-between px-2 text-[10px] text-zinc-400 italic">
          <p>
            * Menampilkan {filteredInvoices.length} data invoice dari database
            Pelestari.
          </p>
          <p>Last Sync: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  )
}
