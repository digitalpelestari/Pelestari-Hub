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
  ArrowLeft,
  Save,
  Loader2,
  Calculator,
  Hash,
  ShieldCheck,
  List,
  Building2,
  UploadCloud,
  FileText,
  CheckCircle2,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { createInvoice, getNextInvoiceNumber } from "@/app/actions/invoice"
import { uploadFileToR2Action } from "@/app/actions/upload-r2"
import { swal } from "@/lib/sweetalert"

export default function CreateInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadingCL, setUploadingCL] = useState(false)
  const [clFileName, setClFileName] = useState("")

  const [formData, setFormData] = useState({
    nomor_invoice: "",
    batch: "",
    tanggal: new Date().toISOString().split("T")[0],
    jenis_kegiatan: "",
    tanggal_jatuhtempo: "",
    perusahaan_tujuan: "",
    npwp: "",
    alamat_perusahaan: "",
    file_faktur: "",
    cl: "", // Sesuai nama kolom di DB
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
    status: "Belum Lunas",
  })

  useEffect(() => {
    const syncInvoiceNumber = async () => {
      const nextId = await getNextInvoiceNumber()
      const now = new Date()
      const roman = [
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
        "XI",
        "XII",
      ]
      const romanMonth = roman[now.getMonth()]
      const year = now.getFullYear()
      const formattedNumber = nextId.toString().padStart(3, "0")
      const fullInvoiceString = `${formattedNumber}/INV/${romanMonth}/${year}/G`
      setFormData((prev) => ({ ...prev, nomor_invoice: fullInvoiceString }))
    }
    syncInvoiceNumber()
  }, [])

  const calculation = useMemo(() => {
    const sub1 = formData.jumlah_peserta * formData.harga_peserta
    const sub2 = formData.jumlah_peserta_2 * formData.harga_peserta_2
    const subtotalDasar = sub1 + sub2
    const totalPesertaAll = formData.jumlah_peserta + formData.jumlah_peserta_2

    let pph = formData.is_pph23 ? subtotalDasar * 0.02 : 0
    let ppn = formData.is_ppn11 ? subtotalDasar * 0.11 : 0
    const nominal_pnbp = formData.is_pnbp ? totalPesertaAll * 600000 : 0

    const totalAkhir = subtotalDasar + ppn + nominal_pnbp - pph

    return {
      subtotalDasar,
      pph,
      ppn,
      pnbp: nominal_pnbp,
      totalAkhir,
      totalPesertaAll,
    }
  }, [formData])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleNumericChange = (key: string, value: string) => {
    const cleanValue = value.replace(/\D/g, "")
    setFormData({
      ...formData,
      [key]: cleanValue === "" ? 0 : parseInt(cleanValue),
    })
  }

  const handleFileUploadCL = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCL(true)
    const form = new FormData()
    form.append("file", file)

    try {
      const res = await uploadFileToR2Action(form)
      if (res.success && res.url) {
        setFormData((prev) => ({ ...prev, cl: res.url }))
        setClFileName(res.fileName || file.name)
        swal.success("File CL berhasil diunggah ke Cloudflare R2!")
      } else {
        swal.error(res.message || "Gagal mengunggah file CL")
      }
    } catch (err: any) {
      swal.error("Terjadi error saat upload: " + err.message)
    } finally {
      setUploadingCL(false)
    }
  }

  const handleRemoveCL = () => {
    setFormData((prev) => ({ ...prev, cl: "" }))
    setClFileName("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.perusahaan_tujuan ||
      !formData.tanggal_jatuhtempo ||
      !formData.keterangan
    ) {
      swal.warning(
        "KOLOM WAJIB: [Perusahaan, Jatuh Tempo, & Keterangan 1] Harus Diisi!"
      )
      return
    }

    setLoading(true)
    const payload = {
      ...formData,
      nominal_pnbp: calculation.pnbp,
      total: calculation.totalAkhir,
    }

    const res = await createInvoice(payload)

    if (res.success) {
      swal.success("Invoice Berhasil Disimpan Ke Database!")
      router.push("/dashboard/finance/invoices")
      router.refresh()
    } else {
      swal.error("GAGAL SIMPAN: " + res.message)
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-8 bg-zinc-50/20 p-6 font-sans text-zinc-900">
      {/* HEADER ACTION */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/invoices">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-white shadow-sm transition-all hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">
              Tambah Invoice
            </h1>
            <p className="mt-1 flex items-center gap-1 text-[10px] font-bold tracking-widest text-zinc-400 uppercase italic">
              Database Sync: Pelestari v3.0
            </p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading || uploadingCL}
          className="h-14 rounded-2xl bg-black px-12 font-black text-white italic shadow-2xl transition-all hover:bg-zinc-800 active:scale-95"
        >
          {loading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          TERBITKAN INVOICE
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* KOLOM KIRI (INPUT DATA) */}
        <div className="space-y-6 lg:col-span-2">
          {/* INFORMASI INVOICE */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="border-b bg-zinc-50/50 py-3 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <Hash className="mr-1 inline h-3 w-3" /> Identitas Dokumen
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">
                    Nomor Invoice
                  </Label>
                  <Input
                    value={formData.nomor_invoice}
                    readOnly
                    className="h-11 bg-zinc-100 font-mono font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">
                    Batch *
                  </Label>
                  <Input
                    placeholder="Contoh: 01"
                    value={formData.batch}
                    onChange={(e) =>
                      setFormData({ ...formData, batch: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="col-span-2 mt-5 grid grid-cols-2 gap-5">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-[11px] font-black uppercase italic">
                      Jenis Kegiatan
                    </Label>
                    <div className="flex gap-3">
                      {["pelatihan", "konsultan"].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, jenis_kegiatan: item })
                          }
                          className={`h-12 flex-1 rounded-xl border-2 font-black uppercase italic transition-all ${
                            formData.jenis_kegiatan === item
                              ? "scale-[1.02] border-black bg-black text-white shadow-lg"
                              : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
                          }`}
                        >
                          {item.charAt(0).toUpperCase() + item.slice(1)}{" "}
                          {/* tampilan tetap kapital */}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-zinc-400 uppercase italic">
                    Tanggal Terbit
                  </Label>
                  <Input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) =>
                      setFormData({ ...formData, tanggal: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-red-500 uppercase italic underline">
                    Tanggal Jatuh Tempo *
                  </Label>
                  <Input
                    type="date"
                    value={formData.tanggal_jatuhtempo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tanggal_jatuhtempo: e.target.value,
                      })
                    }
                    className="h-11 border-red-200 bg-red-50/10 shadow-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TUJUAN PENAGIHAN */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="border-b bg-zinc-50/50 py-3 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <Building2 className="mr-1 inline h-3 w-3" /> Data Perusahaan
            </CardHeader>
            <CardContent className="space-y-5 p-6 text-zinc-800">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">
                  Nama Perusahaan *
                </Label>
                <Input
                  placeholder="Nama Perusahaan"
                  value={formData.perusahaan_tujuan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      perusahaan_tujuan: e.target.value,
                    })
                  }
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">
                  NPWP Perusahaan
                </Label>
                <Input
                  placeholder="Nomor NPWP"
                  value={formData.npwp}
                  onChange={(e) =>
                    setFormData({ ...formData, npwp: e.target.value })
                  }
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">
                  Alamat Lengkap
                </Label>
                <Textarea
                  placeholder="Alamat Perusahaan"
                  value={formData.alamat_perusahaan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alamat_perusahaan: e.target.value,
                    })
                  }
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* UPLOAD FILE CL (CLOUDFLARE R2) */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-zinc-50/50 py-3 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <div className="flex items-center gap-1.5">
                <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
                <span>Upload Confirmation Letter (CL)</span>
              </div>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700 italic">
                CLOUDFLARE R2
              </span>
            </CardHeader>
            <CardContent className="p-6">
              {!formData.cl ? (
                <div className="relative rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 p-6 text-center transition-colors hover:border-black">
                  <input
                    type="file"
                    id="cl_input"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    disabled={uploadingCL}
                    onChange={handleFileUploadCL}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    {uploadingCL ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <p className="text-xs font-bold text-zinc-600">
                          Mengunggah ke Cloudflare R2...
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-full border border-zinc-200 bg-white p-3 text-zinc-500 shadow-sm">
                          <UploadCloud className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-black tracking-tight text-zinc-800 uppercase">
                            Klik atau Drag file CL ke sini
                          </p>
                          <p className="text-[10px] font-medium text-zinc-400">
                            Format PDF, JPG, PNG, atau DOCX (Maks 10MB)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-500 p-2 text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-zinc-800">
                          {clFileName || "File CL Terunggah"}
                        </p>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <a
                        href={formData.cl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-blue-600 uppercase italic hover:underline"
                      >
                        Lihat File Tersimpan
                      </a>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCL}
                    className="h-8 w-8 rounded-full p-0 text-zinc-400 hover:bg-rose-100 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RINCIAN MULTI-ITEM (KETERANGAN 1 & 2) */}
          <Card className="overflow-hidden border-l-8 border-none border-l-black shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-zinc-50/50 py-4 text-[10px] font-black tracking-widest text-black uppercase">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4" /> Rincian Pekerjaan (Baris Tetap)
              </div>
              <div className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-700 italic shadow-sm">
                <ShieldCheck className="h-3 w-3" /> SQL SYNC READY
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-6">
              {/* ITEM 1 */}
              <div className="relative space-y-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
                <Badge className="rounded-md bg-black px-3 text-[9px] font-black uppercase italic">
                  Baris Pertama (Utama)
                </Badge>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase italic opacity-50">
                    Keterangan Layanan 1 *
                  </Label>
                  <Input
                    placeholder="Contoh: Pelatihan ABB"
                    value={formData.keterangan}
                    onChange={(e) =>
                      setFormData({ ...formData, keterangan: e.target.value })
                    }
                    className="h-11 border-zinc-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-50">
                      Jumlah Peserta
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.jumlah_peserta || ""}
                      onChange={(e) =>
                        handleNumericChange("jumlah_peserta", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-50">
                      Harga Satuan
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Rp 0"
                      value={formData.harga_peserta || ""}
                      onChange={(e) =>
                        handleNumericChange("harga_peserta", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* ITEM 2 */}
              <div className="relative space-y-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/50 p-5">
                <Badge
                  variant="outline"
                  className="rounded-md px-3 text-[9px] font-black text-zinc-400 uppercase italic"
                >
                  Baris Kedua (Opsional)
                </Badge>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase italic opacity-30">
                    Keterangan Layanan 2
                  </Label>
                  <Input
                    placeholder="Contoh: Pembinaan AKABB"
                    value={formData.keterangan_2}
                    onChange={(e) =>
                      setFormData({ ...formData, keterangan_2: e.target.value })
                    }
                    className="h-11 border-zinc-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-30">
                      Jumlah Peserta 2
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.jumlah_peserta_2 || ""}
                      onChange={(e) =>
                        handleNumericChange("jumlah_peserta_2", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase italic opacity-30">
                      Harga Satuan 2
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Rp 0"
                      value={formData.harga_peserta_2 || ""}
                      onChange={(e) =>
                        handleNumericChange("harga_peserta_2", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* TOGGLE PAJAK & PNBP */}
              <div className="flex flex-wrap gap-4 rounded-3xl border border-dashed border-zinc-300 bg-zinc-100 p-5">
                <div className="flex items-center space-x-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <Checkbox
                    id="pph"
                    checked={formData.is_pph23}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, is_pph23: !!c })
                    }
                  />
                  <Label
                    htmlFor="pph"
                    className="cursor-pointer text-xs font-black uppercase italic"
                  >
                    PPH 23 (2%)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <Checkbox
                    id="ppn"
                    checked={formData.is_ppn11}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, is_ppn11: !!c })
                    }
                  />
                  <Label
                    htmlFor="ppn"
                    className="cursor-pointer text-xs font-black uppercase italic"
                  >
                    PPN (11%)
                  </Label>
                </div>
                <div className="ml-auto flex items-center space-x-2 rounded-2xl bg-blue-600 p-4 text-white shadow-xl transition-all hover:bg-blue-700">
                  <Checkbox
                    id="pnbp"
                    checked={formData.is_pnbp}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, is_pnbp: !!c })
                    }
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                  />
                  <Label
                    htmlFor="pnbp"
                    className="cursor-pointer text-xs font-black uppercase italic"
                  >
                    PNBP (600rb/org)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KOLOM KANAN (RINGKASAN & TOTAL) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 overflow-hidden rounded-[2.5rem] border-none bg-zinc-900 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] ring-4 ring-white">
            <CardContent className="space-y-6 p-8 font-sans">
              <div className="mb-4 flex items-center justify-between">
                <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase opacity-30">
                  Nota Kalkulasi
                </CardTitle>
                <Calculator className="h-5 w-5 text-zinc-600" />
              </div>

              <div className="space-y-4 border-t border-zinc-800 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">
                    Subtotal Dasar
                  </span>
                  <span className="font-mono font-bold tracking-tight">
                    {formatIDR(calculation.subtotalDasar)}
                  </span>
                </div>
                {formData.is_pph23 && (
                  <div className="flex justify-between text-sm font-medium text-rose-400 italic">
                    <span className="text-[10px] font-bold uppercase">
                      Potongan PPH 2%
                    </span>
                    <span className="font-mono">
                      - {formatIDR(calculation.pph)}
                    </span>
                  </div>
                )}
                {formData.is_ppn11 && (
                  <div className="flex justify-between text-sm font-medium text-blue-400 italic">
                    <span className="text-[10px] font-bold uppercase">
                      PPN 11%
                    </span>
                    <span className="font-mono">
                      + {formatIDR(calculation.ppn)}
                    </span>
                  </div>
                )}
                {formData.is_pnbp && (
                  <div className="flex justify-between text-sm font-medium text-emerald-400 italic">
                    <div className="flex flex-col text-right text-[10px] font-bold uppercase">
                      <span>Biaya PNBP</span>
                      <span className="text-[8px] italic opacity-40">
                        ({calculation.totalPesertaAll} Peserta Total)
                      </span>
                    </div>
                    <span className="font-mono">
                      + {formatIDR(calculation.pnbp)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-zinc-800 pt-10 leading-none">
                <span className="text-[10px] font-black tracking-[0.2em] text-emerald-500 uppercase italic">
                  Total Tagihan Akhir
                </span>
                <h2 className="text-4xl leading-none font-black tracking-tighter italic tabular-nums">
                  {formatIDR(calculation.totalAkhir)}
                </h2>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase">
                  Status Invoice: {formData.status}
                </span>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || uploadingCL}
                className="mt-6 h-20 w-full rounded-[1.5rem] bg-emerald-500 text-2xl font-black tracking-tighter text-black uppercase italic shadow-[0_10px_20px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 active:scale-95"
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
