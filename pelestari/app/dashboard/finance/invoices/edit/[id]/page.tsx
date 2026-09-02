"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Save,
  Loader2,
  Calculator,
  Hash,
  List,
  Building2,
} from "lucide-react"
import Link from "next/link"
import { getInvoiceById, updateInvoice } from "@/app/actions/invoice"
import { swal } from "@/lib/sweetalert"

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()

  const invoiceId = useMemo(() => {
    if (!params?.id) return 0
    const raw = Array.isArray(params.id) ? params.id[0] : params.id
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [params?.id])

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
    status: "Belum Lunas",
  })

  // 1. Load Data dari Database saat halaman dibuka
  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return
      try {
        setLoading(true)
        const res = await getInvoiceById(invoiceId)
        if (res) {
          setFormData({
            ...res,
            // Format tanggal SQL ke format input date (YYYY-MM-DD)
            tanggal: res.tanggal
              ? new Date(res.tanggal).toISOString().split("T")[0]
              : "",
            tanggal_jatuhtempo: res.tanggal_jatuhtempo
              ? new Date(res.tanggal_jatuhtempo).toISOString().split("T")[0]
              : "",
            is_pph23: res.is_pph23 === 1,
            is_ppn11: res.is_ppn11 === 1,
            is_pnbp: res.is_pnbp === 1,
            status: res.status ?? "Belum Lunas",
          })
        }
      } catch (error) {
        console.error("Gagal memuat data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadInvoice()
  }, [invoiceId])

  // 2. Kalkulasi Otomatis Berdasarkan Perubahan (Baris 1 + Baris 2)
  const calculation = useMemo(() => {
    const sub1 = (formData.jumlah_peserta || 0) * (formData.harga_peserta || 0)
    const sub2 =
      (formData.jumlah_peserta_2 || 0) * (formData.harga_peserta_2 || 0)
    const subtotalDasar = sub1 + sub2
    const totalPesertaAll =
      (formData.jumlah_peserta || 0) + (formData.jumlah_peserta_2 || 0)

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
    const val = value.replace(/\D/g, "")
    setFormData({ ...formData, [key]: val === "" ? 0 : parseInt(val) })
  }

  // PERBAIKAN UTAMA: Handler khusus untuk memanipulasi perubahan status select secara aman dari TS-Check
  const handleStatusChange = (val: string) => {
    setFormData((prev) => ({ ...prev, status: val as any }))
  }

  // 3. Update Data ke Server
  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!invoiceId) return

    setUpdating(true)

    const payload = {
      ...formData,
      nominal_pnbp: calculation.pnbp,
      total: calculation.totalAkhir,
    }

    const res = await updateInvoice(invoiceId, payload)
    if (res.success) {
      swal.success("Invoice berhasil diperbarui!")
      router.push("/dashboard/finance/invoices")
      router.refresh()
    } else {
      swal.error(res.message || "Gagal memperbarui invoice.")
    }
    setUpdating(false)
  }

  if (loading)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-300" />
        <p className="font-sans text-xs font-black tracking-widest text-zinc-400 uppercase italic">
          Sinkronisasi Database...
        </p>
      </div>
    )

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-8 bg-zinc-50/20 p-6 font-sans text-zinc-900">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/invoices">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-white shadow-sm hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">
              Edit Arsip Invoice
            </h1>
            <p className="mt-1 text-[10px] font-bold tracking-widest text-blue-600 uppercase italic">
              Mode Penyuntingan Data Aktif
            </p>
          </div>
        </div>
        <Button
          onClick={() => handleUpdate()}
          disabled={updating}
          className="h-14 rounded-2xl bg-black px-12 font-black text-white italic shadow-2xl transition-all hover:bg-zinc-800 active:scale-95"
        >
          {updating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          SIMPAN PERUBAHAN
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* KOLOM KIRI: INPUT FORM */}
        <div className="space-y-6 lg:col-span-2">
          {/* INFORMASI DOKUMEN & STATUS */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="border-b bg-zinc-50/50 py-3 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <Hash className="mr-1 inline h-3 w-3" /> Kontrol Dokumen
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-zinc-400 uppercase italic">
                    No. Invoice (Read-Only)
                  </Label>
                  <Input
                    value={formData.nomor_invoice}
                    readOnly
                    className="h-11 border-dashed bg-zinc-100 font-mono font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">
                    Ubah Status
                  </Label>

                  {/* PERBAIKAN: Menggunakan handleStatusChange untuk meloloskan validasi type-check */}
                  <Select
                    value={formData.status || "Belum Lunas"}
                    // PERBAIKAN INLINE: Terima parameter string | null, lalu gunakan operator ??
                    onValueChange={(val: string | null) =>
                      setFormData({
                        ...formData,
                        status: (val ?? "Belum Lunas") as any,
                      })
                    }
                  >
                    <SelectTrigger className="h-11 bg-white font-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-sans font-bold">
                      <SelectItem value="Belum Lunas">
                        🔴 BELUM LUNAS
                      </SelectItem>
                      <SelectItem value="Lunas">🟢 LUNAS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase italic">
                    Batch
                  </Label>
                  <Input
                    value={formData.batch}
                    onChange={(e) =>
                      setFormData({ ...formData, batch: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-red-500 uppercase italic underline">
                    Batas Jatuh Tempo
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
                    className="h-11 border-red-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DATA PERUSAHAAN */}
          <Card className="border-none shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="border-b bg-zinc-50/50 py-3 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
              <Building2 className="mr-1 inline h-3 w-3" /> Data Client
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase italic">
                  Perusahaan Tujuan
                </Label>
                <Input
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
                  NPWP
                </Label>
                <Input
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

          {/* RINCIAN MULTI-ITEM (KETERANGAN 1 & 2) */}
          <Card className="overflow-hidden border-l-8 border-none border-l-black shadow-sm ring-1 ring-zinc-200">
            <CardHeader className="flex items-center gap-2 border-b bg-zinc-50/50 py-4 text-[10px] font-black tracking-widest text-black uppercase">
              <List className="h-4 w-4" /> Edit Rincian Layanan
            </CardHeader>
            <CardContent className="space-y-8 p-6">
              {/* ITEM 1 */}
              <div className="relative space-y-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
                <Badge className="rounded-md bg-black px-3 text-[9px] font-black text-white uppercase italic hover:bg-black">
                  Baris Utama
                </Badge>
                <Input
                  placeholder="Layanan 1"
                  value={formData.keterangan}
                  onChange={(e) =>
                    setFormData({ ...formData, keterangan: e.target.value })
                  }
                  className="h-11"
                />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">
                      Peserta
                    </Label>
                    <Input
                      type="text"
                      value={formData.jumlah_peserta || ""}
                      onChange={(e) =>
                        handleNumericChange("jumlah_peserta", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">
                      Harga Satuan
                    </Label>
                    <Input
                      type="text"
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
                  className="rounded-md bg-white px-3 text-[9px] font-black text-zinc-400 uppercase italic"
                >
                  Baris Tambahan
                </Badge>
                <Input
                  placeholder="Layanan 2 (Opsional)"
                  value={formData.keterangan_2}
                  onChange={(e) =>
                    setFormData({ ...formData, keterangan_2: e.target.value })
                  }
                  className="h-11"
                />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-30">
                      Peserta 2
                    </Label>
                    <Input
                      type="text"
                      value={formData.jumlah_peserta_2 || ""}
                      onChange={(e) =>
                        handleNumericChange("jumlah_peserta_2", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-30">
                      Harga Satuan 2
                    </Label>
                    <Input
                      type="text"
                      value={formData.harga_peserta_2 || ""}
                      onChange={(e) =>
                        handleNumericChange("harga_peserta_2", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* TOGGLE PAJAK */}
              <div className="flex flex-wrap gap-4 rounded-3xl border border-zinc-300 bg-zinc-100 p-5">
                <div className="flex items-center space-x-2 rounded-2xl border border-zinc-200 bg-white p-3">
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
                    PPH 23
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-2xl border border-zinc-200 bg-white p-3">
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
                    PPN 11%
                  </Label>
                </div>
                <div className="ml-auto flex items-center space-x-2 rounded-2xl bg-blue-600 p-4 text-white shadow-xl">
                  <Checkbox
                    id="pnbp"
                    checked={formData.is_pnbp}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, is_pnbp: !!c })
                    }
                    className="border-white"
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

        {/* RINGKASAN & ACTION */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 overflow-hidden rounded-[2.5rem] border-none bg-zinc-900 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] ring-4 ring-white">
            <CardContent className="space-y-6 p-8">
              <h2 className="text-[10px] font-black tracking-[0.4em] uppercase italic opacity-30">
                Kalkulasi Penyuntingan
              </h2>

              <div className="space-y-4 border-t border-zinc-800 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-bold uppercase opacity-40">
                    Subtotal Baru
                  </span>
                  <span className="font-mono font-bold">
                    {formatIDR(calculation.subtotalDasar)}
                  </span>
                </div>
                {formData.is_pnbp && (
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span className="text-[10px] font-bold uppercase">
                      PNBP ({calculation.totalPesertaAll} org)
                    </span>
                    <span className="font-mono">
                      +{formatIDR(calculation.pnbp)}
                    </span>
                  </div>
                )}
                {formData.is_pph23 && (
                  <div className="flex justify-between text-sm text-rose-400 italic">
                    <span className="text-[10px] font-bold">PPH 2%</span>
                    <span>-{formatIDR(calculation.pph)}</span>
                  </div>
                )}
                {formData.is_ppn11 && (
                  <div className="flex justify-between text-sm text-blue-400 italic">
                    <span className="text-[10px] font-bold">PPN 11%</span>
                    <span>+{formatIDR(calculation.ppn)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-10 leading-none">
                <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase italic">
                  Grand Total Rekalkulasi
                </span>
                <h2 className="mt-2 text-4xl font-black tracking-tighter text-white italic tabular-nums">
                  {formatIDR(calculation.totalAkhir)}
                </h2>
              </div>

              <Button
                onClick={() => handleUpdate()}
                disabled={updating}
                className="mt-6 h-16 w-full rounded-3xl bg-emerald-500 text-lg font-black text-black italic shadow-xl transition-all hover:bg-emerald-400 active:scale-95"
              >
                {updating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "KONFIRMASI UPDATE"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
