"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Printer,
  FileText,
  Package,
  Calendar,
  FilterX,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Download,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface BarangItem {
  namaBarang: string
  kategori: string
  quantity: number
  satuan: string
  estimasiHarga: number
}

interface PengajuanItem {
  id: number
  tanggal: string
  pemohon: string
  items: BarangItem[]
  totalEstimasi: number
  status: string
  catatan: string
  prioritas: string
}

export default function PengajuanBarangPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PengajuanItem | null>(null)
  const [editMode, setEditMode] = useState(false)

  const [formData, setFormData] = useState({
    id: 0,
    pemohon: "",
    catatan: "",
    prioritas: "Sedang",
    status: "Menunggu",
    items: [
      {
        namaBarang: "",
        kategori: "ATK",
        quantity: 1,
        satuan: "Pcs",
        estimasiHarga: 0,
      },
    ] as BarangItem[],
  })

  const [pengajuanList, setPengajuanList] = useState<PengajuanItem[]>([
    {
      id: 1,
      tanggal: "2025-07-15",
      pemohon: "Ahmad Rizki",
      items: [
        {
          namaBarang: "Kertas A4",
          kategori: "ATK",
          quantity: 5,
          satuan: "Rim",
          estimasiHarga: 75000,
        },
        {
          namaBarang: "Penghapus",
          kategori: "ATK",
          quantity: 10,
          satuan: "Pcs",
          estimasiHarga: 25000,
        },
      ],
      totalEstimasi: 100000,
      status: "Disetujui",
      catatan: "Untuk keperluan administrasi bulan ini",
      prioritas: "Sedang",
    },
    {
      id: 2,
      tanggal: "2025-07-20",
      pemohon: "Siti Nurhaliza",
      items: [
        {
          namaBarang: "Laptop",
          kategori: "Elektronik",
          quantity: 1,
          satuan: "Unit",
          estimasiHarga: 8500000,
        },
      ],
      totalEstimasi: 8500000,
      status: "Menunggu",
      catatan: "Pengganti laptop yang rusak",
      prioritas: "Tinggi",
    },
    {
      id: 3,
      tanggal: "2025-08-01",
      pemohon: "Budi Santoso",
      items: [
        {
          namaBarang: "Sapu",
          kategori: "Peralatan Kebersihan",
          quantity: 3,
          satuan: "Pcs",
          estimasiHarga: 45000,
        },
        {
          namaBarang: "Peligi",
          kategori: "Peralatan Kebersihan",
          quantity: 2,
          satuan: "Pcs",
          estimasiHarga: 30000,
        },
      ],
      totalEstimasi: 75000,
      status: "Ditolak",
      catatan: "Stok masih tersedia di gudang",
      prioritas: "Rendah",
    },
    {
      id: 4,
      tanggal: "2025-08-05",
      pemohon: "Dewi Anggraini",
      items: [
        {
          namaBarang: "Printer Cartridge",
          kategori: "ATK",
          quantity: 2,
          satuan: "Pcs",
          estimasiHarga: 350000,
        },
      ],
      totalEstimasi: 350000,
      status: "Disetujui",
      catatan: "Untuk printer di ruang meeting",
      prioritas: "Sedang",
    },
  ])

  const filteredData = useMemo(() => {
    return pengajuanList.filter((p) => {
      const matchesSearch =
        p.pemohon.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.items.some((item) =>
          item.namaBarang.toLowerCase().includes(searchQuery.toLowerCase())
        )
      const matchesStatus = filterStatus === "ALL" || p.status === filterStatus
      let matchesDate = true
      if (p.tanggal) {
        if (startDate && p.tanggal < startDate) matchesDate = false
        if (endDate && p.tanggal > endDate) matchesDate = false
      } else if (startDate || endDate) {
        matchesDate = false
      }
      return matchesSearch && matchesStatus && matchesDate
    })
  }, [pengajuanList, searchQuery, filterStatus, startDate, endDate])

  const ringkasan = useMemo(() => {
    const total = pengajuanList.length
    const menunggu = pengajuanList.filter((p) => p.status === "Menunggu").length
    const disetujui = pengajuanList.filter(
      (p) => p.status === "Disetujui"
    ).length
    const ditolak = pengajuanList.filter((p) => p.status === "Ditolak").length
    return { total, menunggu, disetujui, ditolak }
  }, [pengajuanList])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const resetForm = () => {
    setFormData({
      id: 0,
      pemohon: "",
      catatan: "",
      prioritas: "Sedang",
      status: "Menunggu",
      items: [
        {
          namaBarang: "",
          kategori: "ATK",
          quantity: 1,
          satuan: "Pcs",
          estimasiHarga: 0,
        },
      ],
    })
    setEditMode(false)
  }

  const handleOpenModal = (pengajuan?: PengajuanItem) => {
    if (pengajuan) {
      setEditMode(true)
      setFormData({
        id: pengajuan.id,
        pemohon: pengajuan.pemohon,
        catatan: pengajuan.catatan,
        prioritas: pengajuan.prioritas,
        status: pengajuan.status,
        items: JSON.parse(JSON.stringify(pengajuan.items)),
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  const handleItemChange = (
    index: number,
    field: keyof BarangItem,
    value: any
  ) => {
    const updatedItems = [...formData.items] as BarangItem[]
    if (field === "quantity" || field === "estimasiHarga") {
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: Number(value) || 0,
      }
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      }
    }
    setFormData({ ...formData, items: updatedItems })
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          namaBarang: "",
          kategori: "ATK",
          quantity: 1,
          satuan: "Pcs",
          estimasiHarga: 0,
        },
      ],
    })
  }

  const handleRemoveItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const totalEstimasi = formData.items.reduce(
      (acc, item) => acc + item.estimasiHarga,
      0
    )

    if (editMode) {
      setPengajuanList((prev) =>
        prev.map((p) =>
          p.id === formData.id
            ? {
                ...p,
                pemohon: formData.pemohon,
                items: formData.items,
                totalEstimasi,
                status: formData.status,
                catatan: formData.catatan,
                prioritas: formData.prioritas,
              }
            : p
        )
      )
    } else {
      const newId = Math.max(...pengajuanList.map((p) => p.id), 0) + 1
      setPengajuanList((prev) => [
        ...prev,
        {
          id: newId,
          tanggal: new Date().toISOString().split("T")[0],
          pemohon: formData.pemohon,
          items: formData.items,
          totalEstimasi,
          status: formData.status,
          catatan: formData.catatan,
          prioritas: formData.prioritas,
        },
      ])
    }

    setLoading(false)
    setIsModalOpen(false)
    resetForm()
  }

  const handleDelete = (id: number) => {
    setPengajuanList((prev) => prev.filter((p) => p.id !== id))
  }

  const handleViewDetail = (pengajuan: PengajuanItem) => {
    setSelectedPengajuan(pengajuan)
    setIsDetailOpen(true)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setFilterStatus("ALL")
    setStartDate("")
    setEndDate("")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Disetujui":
        return (
          <Badge className="border border-emerald-200 bg-emerald-50 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Disetujui
          </Badge>
        )
      case "Ditolak":
        return (
          <Badge className="border border-rose-200 bg-rose-50 text-[10px] font-bold tracking-wider text-rose-700 uppercase">
            <AlertCircle className="mr-1 h-3 w-3" /> Ditolak
          </Badge>
        )
      case "Menunggu":
        return (
          <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-bold tracking-wider text-amber-700 uppercase">
            <Clock className="mr-1 h-3 w-3" /> Menunggu
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            {status}
          </Badge>
        )
    }
  }

  const getPrioritasBadge = (prioritas: string) => {
    switch (prioritas) {
      case "Tinggi":
        return (
          <Badge className="border border-red-200 bg-red-50 text-[10px] font-bold text-red-700">
            Tinggi
          </Badge>
        )
      case "Sedang":
        return (
          <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700">
            Sedang
          </Badge>
        )
      case "Rendah":
        return (
          <Badge className="border border-zinc-200 bg-zinc-100 text-[10px] font-bold text-zinc-600">
            Rendah
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            {prioritas}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <Package className="h-6 w-6 text-blue-600" /> Pengajuan Barang
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Selamat datang kembali,{" "}
            <span className="font-bold text-black">
              {session?.user?.name || "Karyawan PT Pelestari"}
            </span>{" "}
            • Anda masuk sebagai{" "}
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 uppercase">
              {(session?.user as any)?.role || "Staff"}
            </span>
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="h-9 rounded-sm bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Ajukan Barang Baru
        </Button>
      </div>

      {/* RINGKASAN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Pengajuan
            </CardTitle>
            <div className="rounded-sm bg-zinc-100 p-1.5">
              <FileText className="h-4 w-4 text-zinc-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-zinc-900">
              {ringkasan.total}
            </div>
            <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
              Semua pengajuan barang
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Menunggu
            </CardTitle>
            <div className="rounded-sm bg-amber-100 p-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-amber-700">
              {ringkasan.menunggu}
            </div>
            <p className="mt-1 text-[9px] font-bold text-amber-600/80 uppercase">
              Menunggu persetujuan
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Disetujui
            </CardTitle>
            <div className="rounded-sm bg-emerald-100 p-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-emerald-700">
              {ringkasan.disetujui}
            </div>
            <p className="mt-1 text-[9px] font-bold text-emerald-600/80 uppercase">
              Pengajuan disetujui
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Ditolak
            </CardTitle>
            <div className="rounded-sm bg-rose-100 p-1.5">
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-rose-600">
              {ringkasan.ditolak}
            </div>
            <p className="mt-1 text-[9px] font-bold text-rose-500 uppercase">
              Pengajuan ditolak
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & SEARCH */}
      <Card className="overflow-hidden rounded-sm border-zinc-200 shadow-md">
        <CardHeader className="space-y-4 border-b bg-zinc-50/50 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Cari nama barang atau pemohon..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={filterStatus}
              onValueChange={(val) => setFilterStatus(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-sm border-zinc-200 bg-white text-xs font-semibold focus:ring-1 focus:ring-black">
                <div className="flex items-center gap-2">
                  <FilterX className="h-3.5 w-3.5 text-zinc-400" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="Menunggu" className="text-amber-600">
                  Menunggu
                </SelectItem>
                <SelectItem value="Disetujui" className="text-emerald-600">
                  Disetujui
                </SelectItem>
                <SelectItem value="Ditolak" className="text-rose-600">
                  Ditolak
                </SelectItem>
              </SelectContent>
            </Select>

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

            {(searchQuery ||
              filterStatus !== "ALL" ||
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
              <p className="italic">Mengambil data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-100/80">
                  <TableRow className="border-b border-zinc-200 text-xs tracking-wider uppercase">
                    <TableHead className="border-r px-6 py-4 font-bold text-zinc-700">
                      No
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Tanggal
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Pemohon
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Daftar Barang
                    </TableHead>
                    <TableHead className="border-r text-center font-bold text-zinc-700">
                      Prioritas
                    </TableHead>
                    <TableHead className="border-r text-right font-bold text-zinc-700">
                      Estimasi
                    </TableHead>
                    <TableHead className="border-r text-center font-bold text-zinc-700">
                      Status
                    </TableHead>
                    <TableHead className="text-center font-bold text-zinc-700">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length > 0 ? (
                    filteredData.map((p, idx) => (
                      <TableRow
                        key={p.id}
                        className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      >
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-500">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-zinc-700">
                          {new Date(p.tanggal).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-900">
                          {p.pemohon}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {p.items.slice(0, 2).map((item, i) => (
                              <div
                                key={i}
                                className="text-[11px] font-medium text-zinc-700"
                              >
                                • {item.namaBarang} x{item.quantity}{" "}
                                {item.satuan}
                              </div>
                            ))}
                            {p.items.length > 2 && (
                              <span className="text-[10px] text-zinc-400 italic">
                                +{p.items.length - 2} item lainnya
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-center">
                          {getPrioritasBadge(p.prioritas)}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-right font-black text-zinc-900">
                          {formatIDR(p.totalEstimasi)}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-center">
                          {getStatusBadge(p.status)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                              title="Detail"
                              onClick={() => handleViewDetail(p)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-amber-50 hover:text-amber-600"
                              title="Edit"
                              onClick={() => handleOpenModal(p)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-red-50 hover:text-red-600"
                              title="Hapus"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-24 text-center font-sans text-zinc-400 italic"
                      >
                        Tidak ada data pengajuan barang yang ditemukan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL FORM TAMBAH/EDIT PENGAJUAN */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-3xl rounded-sm border-none shadow-2xl">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              {editMode
                ? "Edit Pengajuan Barang"
                : "Form Pengajuan Barang Baru"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="max-h-[70vh] space-y-4 overflow-y-auto px-1"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Nama Pemohon
                </Label>
                <Input
                  required
                  value={formData.pemohon}
                  onChange={(e) =>
                    setFormData({ ...formData, pemohon: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                  placeholder="Nama pemohon"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Prioritas
                </Label>
                <Select
                  value={formData.prioritas}
                  onValueChange={(val) =>
                    setFormData({ ...formData, prioritas: val ?? "Rendah" })
                  }
                >
                  <SelectTrigger className="h-9 rounded-sm border-zinc-300 text-xs">
                    <SelectValue placeholder="Pilih Prioritas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rendah">Rendah</SelectItem>
                    <SelectItem value="Sedang">Sedang</SelectItem>
                    <SelectItem value="Tinggi">Tinggi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Catatan / Alasan Pengajuan
                </Label>
                <Textarea
                  value={formData.catatan}
                  onChange={(e) =>
                    setFormData({ ...formData, catatan: e.target.value })
                  }
                  className="resize-none rounded-sm border-zinc-300 text-xs"
                  rows={2}
                  placeholder="Jelaskan alasan pengajuan..."
                />
              </div>
            </div>

            <div className="space-y-3 rounded-sm border border-zinc-200 bg-zinc-50/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-zinc-700 uppercase">
                  Daftar Barang
                </span>
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="h-7 rounded-sm bg-zinc-900 text-[10px] font-bold text-white hover:bg-zinc-800"
                >
                  + Tambah Barang
                </Button>
              </div>

              <div className="space-y-2">
                {formData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-end gap-2 rounded-sm border border-zinc-200 bg-white p-2"
                  >
                    <div className="col-span-12 space-y-1 md:col-span-4">
                      <Label className="text-[10px] font-bold text-zinc-600">
                        Nama Barang
                      </Label>
                      <Input
                        required
                        value={item.namaBarang}
                        onChange={(e) =>
                          handleItemChange(idx, "namaBarang", e.target.value)
                        }
                        className="h-8 rounded-sm border-zinc-300 text-xs"
                        placeholder="Nama barang"
                      />
                    </div>
                    <div className="col-span-6 space-y-1 md:col-span-2">
                      <Label className="text-[10px] font-bold text-zinc-600">
                        Kategori
                      </Label>
                      <Select
                        value={item.kategori}
                        onValueChange={(val) =>
                          handleItemChange(idx, "kategori", val)
                        }
                      >
                        <SelectTrigger className="h-8 rounded-sm border-zinc-300 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ATK">ATK</SelectItem>
                          <SelectItem value="Elektronik">Elektronik</SelectItem>
                          <SelectItem value="Peralatan Kebersihan">
                            Kebersihan
                          </SelectItem>
                          <SelectItem value="Furnitur">Furnitur</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] font-bold text-zinc-600">
                        Qty
                      </Label>
                      <Input
                        required
                        type="number"
                        min={1}
                        value={item.quantity || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", e.target.value)
                        }
                        className="h-8 rounded-sm border-zinc-300 text-center text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] font-bold text-zinc-600">
                        Estimasi (Rp)
                      </Label>
                      <Input
                        required
                        type="number"
                        min={0}
                        value={item.estimasiHarga || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "estimasiHarga", e.target.value)
                        }
                        className="h-8 rounded-sm border-zinc-300 text-right text-xs"
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 rounded-sm text-red-500 hover:bg-red-50 hover:text-red-700"
                        disabled={formData.items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-zinc-200 pt-2">
                <div className="text-xs font-bold text-zinc-700">
                  Total Estimasi:{" "}
                  <span className="text-sm text-blue-700">
                    {formatIDR(
                      formData.items.reduce(
                        (acc, item) => acc + item.estimasiHarga,
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 rounded-sm border-zinc-300 text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 rounded-sm bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
              >
                {loading
                  ? "Menyimpan..."
                  : editMode
                    ? "Simpan Perubahan"
                    : "Kirim Pengajuan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL PENGAJUAN */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-full max-w-2xl rounded-sm border-none shadow-2xl">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              Detail Pengajuan Barang
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {selectedPengajuan && (
            <div className="space-y-4 px-1">
              <div className="space-y-2 rounded-sm border border-zinc-200 bg-zinc-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    No. Pengajuan
                  </span>
                  <span className="font-bold text-zinc-900">
                    #{String(selectedPengajuan.id).padStart(4, "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Pemohon
                  </span>
                  <span className="font-bold text-zinc-900">
                    {selectedPengajuan.pemohon}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Tanggal
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {new Date(selectedPengajuan.tanggal).toLocaleDateString(
                      "id-ID"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Prioritas
                  </span>
                  {getPrioritasBadge(selectedPengajuan.prioritas)}
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Status
                  </span>
                  {getStatusBadge(selectedPengajuan.status)}
                </div>
              </div>

              <div className="overflow-hidden rounded-sm border border-zinc-300 text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-200 font-bold text-zinc-800">
                      <th className="w-12 border-r border-zinc-300 p-2 text-center">
                        No
                      </th>
                      <th className="border-r border-zinc-300 p-2">
                        Nama Barang
                      </th>
                      <th className="border-r border-zinc-300 p-2 text-center">
                        Kategori
                      </th>
                      <th className="border-r border-zinc-300 p-2 text-center">
                        Qty
                      </th>
                      <th className="border-r border-zinc-300 p-2 text-right">
                        Estimasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {selectedPengajuan.items.map((item, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="border-r border-zinc-200 p-2 text-center font-bold text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="border-r border-zinc-200 p-2 font-medium text-zinc-800">
                          {item.namaBarang}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-center text-zinc-600">
                          {item.kategori}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-center font-bold">
                          {item.quantity} {item.satuan}
                        </td>
                        <td className="p-2 text-right font-semibold text-zinc-900">
                          {formatIDR(item.estimasiHarga)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 rounded-sm border border-zinc-200 bg-zinc-50 p-3 text-xs">
                <span className="font-bold text-zinc-700 uppercase">
                  Catatan:
                </span>
                <p className="text-zinc-600 italic">
                  {selectedPengajuan.catatan || "-"}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setIsDetailOpen(false)}
                  className="h-9 rounded-sm bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
