"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ArrowLeft,
  Save,
  Loader2,
  UploadCloud,
  FileText,
  Trash2,
  Plus,
  Receipt,
  ExternalLink,
  Users,
  Percent,
} from "lucide-react"
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
    jenis_kegiatan: "pelatihan",
    tanggal_jatuhtempo: "",
    perusahaan_tujuan: "",
    npwp: "",
    alamat_perusahaan: "",
    file_faktur: "",
    cl: "",
    items: [
      {
        item_deskripsi: "",
        item_jumlah: 1,
        item_harga: 0,
      },
    ],
    is_dpp: false,
    is_pph23: false,
    is_ppn11: false,
    is_pnbp: false,
    status: "Belum Lunas",
  })

  useEffect(() => {
    const syncInvoiceNumber = async () => {
      try {
        const nextId = await getNextInvoiceNumber()
        const now = new Date()
        const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
        const romanMonth = roman[now.getMonth()]
        const year = now.getFullYear()
        const formattedNumber = nextId.toString().padStart(3, "0")
        const fullInvoiceString = `${formattedNumber}/INV/${romanMonth}/${year}/G`
        setFormData((prev) => ({ ...prev, nomor_invoice: fullInvoiceString }))
      } catch (err) {
        console.error("Gagal generate invoice number", err)
      }
    }
    syncInvoiceNumber()
  }, [])

  const calculation = useMemo(() => {
    const subtotalDasar = formData.items.reduce(
      (total, item) => total + (Number(item.item_jumlah) || 0) * (Number(item.item_harga) || 0),
      0
    )

    const totalPesertaAll = formData.items.reduce(
      (total, item) => total + (Number(item.item_jumlah) || 0),
      0
    )

    // DPP Nilai Lain: (11/12) x subtotal
    const dppNilai = formData.is_dpp ? (11 / 12) * subtotalDasar : subtotalDasar

    // PPh 23: 2% dari DPP jika DPP aktif, atau dari subtotal dasar jika tidak aktif
    const basisPajak = formData.is_dpp ? dppNilai : subtotalDasar
    const pph = formData.is_pph23 ? basisPajak * 0.02 : 0
    const ppn = formData.is_ppn11 ? subtotalDasar * 0.11 : 0
    const nominal_pnbp = formData.is_pnbp ? totalPesertaAll * 600000 : 0
    const totalAkhir = subtotalDasar + ppn + nominal_pnbp - pph

    return {
      subtotalDasar,
      dpp: dppNilai,
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
      maximumFractionDigits: 2,
    }).format(amount || 0)
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
        swal.success("File Confirmation Letter berhasil diunggah!")
      } else {
        swal.error(res.message || "Gagal mengunggah file CL")
      }
    } catch (err: any) {
      swal.error("Terjadi kesalahan saat upload: " + err.message)
    } finally {
      setUploadingCL(false)
    }
  }

  const handleRemoveCL = () => {
    setFormData((prev) => ({ ...prev, cl: "" }))
    setClFileName("")
  }

  const tambahItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_deskripsi: "",
          item_jumlah: 1,
          item_harga: 0,
        },
      ],
    }))
  }

  const updateItem = (
    index: number,
    field: "item_deskripsi" | "item_jumlah" | "item_harga",
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  const hapusItem = (index: number) => {
    if (formData.items.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.perusahaan_tujuan.trim() ||
      !formData.tanggal_jatuhtempo ||
      formData.items.length === 0 ||
      formData.items.some(
        (item) => !item.item_deskripsi.trim() || Number(item.item_jumlah) <= 0 || Number(item.item_harga) <= 0
      )
    ) {
      swal.warning("Pastikan Perusahaan, Jatuh Tempo, dan minimal 1 layanan dengan harga valid telah diisi!")
      return
    }

    setLoading(true)

    const payload = {
      ...formData,
      items: formData.items.map((it) => ({
        ...it,
        item_jumlah: Number(it.item_jumlah) || 0,
        item_harga: Number(it.item_harga) || 0, // Nilai float murni tanpa Math.round atau parseInt
      })),
      nominal_pnbp: calculation.pnbp,
      total: calculation.totalAkhir,
    }

    const res = await createInvoice(payload)

    if (res.success) {
      swal.success("Invoice Berhasil Diterbitkan!")
      router.push("/dashboard/finance/invoices")
      router.refresh()
    } else {
      swal.error("Gagal Menerbitkan: " + res.error)
    }

    setLoading(false)
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER SECTION */}
      <div className="mb-8 flex items-center justify-between border-b border-zinc-200/80 pb-6 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/invoices">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-zinc-200 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Buat Invoice Baru
            </h1>
            <p className="text-sm text-zinc-500">
              Isi parameter tagihan, rincian biaya pelatihan, dan kelengkapan administrasi.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* KOLOM FORM KIRI */}
        <div className="space-y-6 lg:col-span-8">
          {/* IDENTITAS DOKUMEN & KEGIATAN */}
          <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Identitas Dokumen
              </CardTitle>
              <CardDescription>
                Nomor registrasi invoice dan klasifikasi jenis kegiatan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Nomor Invoice
                  </Label>
                  <Input
                    value={formData.nomor_invoice}
                    readOnly
                    className="h-10 bg-zinc-50 font-mono text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Nomor Batch
                  </Label>
                  <Input
                    placeholder="Contoh: 01"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Jenis Kegiatan
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "pelatihan", label: "Pelatihan" },
                    { id: "konsultan", label: "Konsultan" },
                  ].map((item) => {
                    const isActive = formData.jenis_kegiatan === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, jenis_kegiatan: item.id })}
                        className={`flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-all ${
                          isActive
                            ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Tanggal Terbit
                  </Label>
                  <Input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Jatuh Tempo <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={formData.tanggal_jatuhtempo}
                    onChange={(e) =>
                      setFormData({ ...formData, tanggal_jatuhtempo: e.target.value })
                    }
                    className="h-10 border-zinc-200 focus-visible:ring-zinc-950"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* INFORMASI PERUSAHAAN TUJUAN */}
          <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Penerima Tagihan
              </CardTitle>
              <CardDescription>
                Detail entitas atau perusahaan yang menjadi target invoice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Nama Perusahaan / Instansi <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="PT / CV..."
                    value={formData.perusahaan_tujuan}
                    onChange={(e) =>
                      setFormData({ ...formData, perusahaan_tujuan: e.target.value })
                    }
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    NPWP Perusahaan
                  </Label>
                  <Input
                    placeholder="00.000.000.0-000.000"
                    value={formData.npwp}
                    onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                    className="h-10 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Alamat Lengkap
                </Label>
                <Textarea
                  placeholder="Gedung, Jalan, Kota, Kode Pos"
                  value={formData.alamat_perusahaan}
                  onChange={(e) =>
                    setFormData({ ...formData, alamat_perusahaan: e.target.value })
                  }
                  className="min-h-[85px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* RINCIAN ITEM / LAYANAN */}
          <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Rincian Layanan & Tarif
                </CardTitle>
                <CardDescription>
                  Daftar jasa/pelatihan yang ditagihkan dalam invoice ini.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={tambahItem}
                className="h-9 gap-1.5 rounded-lg border-zinc-200 text-xs font-medium dark:border-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Layanan
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.items.map((item, index) => {
                const itemSubtotal = (Number(item.item_jumlah) || 0) * (Number(item.item_harga) || 0)
                return (
                  <div
                    key={index}
                    className="group relative rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500">
                        Item #{index + 1}
                      </span>
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => hapusItem(index)}
                          className="h-7 w-7 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Input
                          placeholder="Deskripsi layanan (cth: Training K3 Umum Sertifikasi Kemnaker)"
                          value={item.item_deskripsi}
                          onChange={(e) =>
                            updateItem(index, "item_deskripsi", e.target.value)
                          }
                          className="h-10 bg-white dark:bg-zinc-950"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-3">
                          <Label className="text-[11px] font-medium text-zinc-500">
                            Peserta / Qty
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={item.item_jumlah || ""}
                            onChange={(e) =>
                              updateItem(
                                index,
                                "item_jumlah",
                                e.target.value === "" ? 0 : parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-10 bg-white dark:bg-zinc-950"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <Label className="text-[11px] font-medium text-zinc-500">
                            Harga Satuan (Rp)
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.item_harga !== undefined && item.item_harga !== null ? item.item_harga : ""}
                            placeholder="0"
                            onChange={(e) => {
                              // Ganti koma jadi titik agar valid float JS
                              const val = e.target.value.replace(",", ".")
                              // Hanya menerima angka dan satu titik desimal
                              if (/^\d*\.?\d*$/.test(val)) {
                                updateItem(
                                  index,
                                  "item_harga",
                                  val === "" || val === "." ? 0 : parseFloat(val)
                                )
                              }
                            }}
                            className="h-10 bg-white font-mono text-sm dark:bg-zinc-950"
                          />
                        </div>

                        <div className="flex flex-col justify-end sm:col-span-4">
                          <div className="flex h-10 items-center justify-between rounded-lg border border-zinc-200/60 bg-white px-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950">
                            <span className="text-zinc-400">Subtotal:</span>
                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                              {formatIDR(itemSubtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* LAMPIRAN CLOUDFLARE R2 */}
          <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Lampiran Confirmation Letter (CL)
              </CardTitle>
              <CardDescription>
                Unggah berkas konfirmasi resmi untuk diverifikasi oleh klien.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!formData.cl ? (
                <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/40 p-6 text-center transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/20">
                  <input
                    type="file"
                    id="cl_input"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    disabled={uploadingCL}
                    onChange={handleFileUploadCL}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                  {uploadingCL ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-7 w-7 animate-spin text-zinc-600" />
                      <p className="text-xs font-medium text-zinc-600">Mengunggah berkas ke R2...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-full bg-zinc-100 p-3 text-zinc-500 dark:bg-zinc-800">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                          Pilih berkas atau seret ke area ini
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Mendukung PDF, DOCX, atau Gambar (Maks. 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-950 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-500 p-2 text-white">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {clFileName || "Confirmation-Letter.pdf"}
                      </p>
                      <a
                        href={formData.cl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Lihat dokumen <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveCL}
                    className="h-8 w-8 text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KOLOM KANAN: RINGKASAN DINAMIS & TOMBOL AKSI */}
        <div className="space-y-6 lg:col-span-4">
          <div className="sticky top-6 space-y-4">
            {/* OPSI PAJAK & PNBP */}
            <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Ketentuan Pajak & PNBP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 1. CHECKBOX DPP */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200/70 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="dpp"
                      checked={formData.is_dpp}
                      onCheckedChange={(c) => setFormData({ ...formData, is_dpp: !!c })}
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        DPP Nilai Lain
                      </span>
                      <p className="text-[10px] text-zinc-400">11/12 × Jumlah Layanan</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    11/12
                  </Badge>
                </label>

                {/* 2. CHECKBOX PPH 23 */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200/70 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="pph"
                      checked={formData.is_pph23}
                      onCheckedChange={(c) => setFormData({ ...formData, is_pph23: !!c })}
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        PPh 23 (2%)
                      </span>
                      <p className="text-[10px] text-zinc-400">Pemotongan pajak jasa</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    - 2%
                  </Badge>
                </label>

                {/* 3. CHECKBOX PPN 11% */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200/70 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="ppn"
                      checked={formData.is_ppn11}
                      onCheckedChange={(c) => setFormData({ ...formData, is_ppn11: !!c })}
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        PPN (11%)
                      </span>
                      <p className="text-[10px] text-zinc-400">Pajak Pertambahan Nilai</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    + 11%
                  </Badge>
                </label>

                {/* 4. CHECKBOX PNBP */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-blue-200/70 bg-blue-50/40 p-3 transition hover:bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="pnbp"
                      checked={formData.is_pnbp}
                      onCheckedChange={(c) => setFormData({ ...formData, is_pnbp: !!c })}
                    />
                    <div>
                      <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                        Biaya PNBP
                      </span>
                      <p className="text-[10px] text-blue-600/80 dark:text-blue-400">
                        Rp 600.000 / peserta
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600 text-[10px] text-white">Sertifikasi</Badge>
                </label>
              </CardContent>
            </Card>

            {/* RINGKASAN TAGIHAN */}
            <Card className="border-zinc-200/80 bg-zinc-900 text-white shadow-lg dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-400" />
                    <CardTitle className="text-sm font-semibold tracking-wide text-zinc-100">
                      Ringkasan Tagihan
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-zinc-700 font-mono text-[10px] text-zinc-400"
                  >
                    {formData.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-zinc-500" />
                    <div className="leading-tight">
                      <p className="text-[10px] text-zinc-500">Total Peserta</p>
                      <p className="font-mono text-xs font-semibold text-zinc-200">
                        {calculation.totalPesertaAll} Orang
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Percent className="h-3.5 w-3.5 text-zinc-500" />
                    <div className="leading-tight">
                      <p className="text-[10px] text-zinc-500">Total Item</p>
                      <p className="font-mono text-xs font-semibold text-zinc-200">
                        {formData.items.length} Baris
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3">
                  <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                    Rincian Item Layanan
                  </p>
                  <div className="divide-y divide-zinc-800/60">
                    {formData.items.map((item, index) => {
                      const itemSubtotal = (Number(item.item_jumlah) || 0) * (Number(item.item_harga) || 0)
                      return (
                        <div
                          key={index}
                          className={`flex items-start justify-between gap-3 text-xs ${
                            index !== 0 ? "pt-2" : ""
                          } pb-1.5`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-zinc-200">
                              {item.item_deskripsi.trim() || `Layanan #${index + 1}`}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono">
                              {item.item_jumlah || 0} peserta × {formatIDR(Number(item.item_harga) || 0)}
                            </p>
                          </div>
                          <span className="font-mono font-medium text-zinc-200 whitespace-nowrap">
                            {formatIDR(itemSubtotal)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-400">
                  <div className="flex justify-between border-t border-zinc-800/80 pt-2.5">
                    <span className="font-medium text-zinc-300">Subtotal Dasar</span>
                    <span className="font-mono font-semibold text-zinc-200">
                      {formatIDR(calculation.subtotalDasar)}
                    </span>
                  </div>

                  {formData.is_dpp && (
                    <div className="flex justify-between text-amber-400">
                      <span>DPP Nilai Lain (11/12)</span>
                      <span className="font-mono font-medium">{formatIDR(calculation.dpp)}</span>
                    </div>
                  )}

                  {formData.is_pph23 && (
                    <div className="flex justify-between text-rose-400">
                      <span>PPh 23 (2%{formData.is_dpp ? " dari DPP" : ""})</span>
                      <span className="font-mono font-medium">- {formatIDR(calculation.pph)}</span>
                    </div>
                  )}

                  {formData.is_ppn11 && (
                    <div className="flex justify-between text-blue-400">
                      <span>PPN 11%</span>
                      <span className="font-mono font-medium">+ {formatIDR(calculation.ppn)}</span>
                    </div>
                  )}

                  {formData.is_pnbp && (
                    <div className="flex justify-between text-emerald-400">
                      <span>PNBP ({calculation.totalPesertaAll} Peserta)</span>
                      <span className="font-mono font-medium">
                        + {formatIDR(calculation.pnbp)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-400">Total Tagihan Akhir</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
                      Net Amount
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-white">
                    {formatIDR(calculation.totalAkhir)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={loading || uploadingCL}
                className="h-12 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Simpan & Terbitkan Invoice
              </Button>

              <Link href="/dashboard/finance/invoices" className="block w-full">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Batal & Kembali
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}