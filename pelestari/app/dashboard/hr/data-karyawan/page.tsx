"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Users,
  Briefcase,
  Loader2,
  X,
  FilterX,
  Building2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  getKaryawanListAction,
  createKaryawanAction,
  updateKaryawanAction,
  deleteKaryawanAction,
  KaryawanData,
} from "@/app/actions/karyawan"
import { swal } from "@/lib/sweetalert"

const initialForm: KaryawanData = {
  nip: "",
  nama: "",
  jabatan: "Staff",
  divisi: "IT",
  email: "",
  nik: "",
  no_rekening: "",
  nama_bank: "BCA",
  tempat_lahir: "",
  tanggal_lahir: "",
  alamat: "",
  no_hp: "",
  no_bpjs_kesehatan: "",
  no_bpjs_ketenagakerjaan: "",
  tanggal_masuk: "",
}

// Helper untuk format tanggal input form (YYYY-MM-DD)
const formatDateForInput = (dateString?: string) => {
  if (!dateString) return ""
  try {
    const d = new Date(dateString)
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

// Helper untuk tampilan tabel (contoh: 06 Jan 2020)
const formatDateForView = (dateString?: string) => {
  if (!dateString) return "-"
  try {
    const d = new Date(dateString)
    return isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
  } catch {
    return "-"
  }
}

export default function KaryawanPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [karyawanList, setKaryawanList] = useState<KaryawanData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDivisi, setFilterDivisi] = useState("ALL")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedKaryawan, setSelectedKaryawan] = useState<KaryawanData | null>(null)
  const [formData, setFormData] = useState<KaryawanData>(initialForm)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getKaryawanListAction()
      if (res.success && res.data) {
        setKaryawanList(res.data)
      } else {
        setKaryawanList([])
      }
    } catch (err) {
      console.error("Gagal mengambil data karyawan:", err)
      setKaryawanList([])
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    return (karyawanList || []).filter((k) => {
      const matchSearch =
        (k.nama || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.nip || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.jabatan || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.nik || "").includes(searchQuery)

      const matchDivisi = filterDivisi === "ALL" || k.divisi === filterDivisi
      return matchSearch && matchDivisi
    })
  }, [karyawanList, searchQuery, filterDivisi])

  const divisions = useMemo(() => {
    return Array.from(new Set((karyawanList || []).map((k) => k.divisi))).filter(Boolean)
  }, [karyawanList])

  const handleOpenForm = (item?: KaryawanData) => {
    if (item) {
      setEditMode(true)
      setFormData({
        ...item,
        tanggal_lahir: formatDateForInput(item.tanggal_lahir),
        tanggal_masuk: formatDateForInput(item.tanggal_masuk),
      })
    } else {
      setEditMode(false)
      setFormData(initialForm)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editMode) {
        const res = await updateKaryawanAction(formData.nip, formData)
        if (!res.success) throw new Error(res.message)
        swal.success("Data karyawan berhasil diperbarui")
      } else {
        const res = await createKaryawanAction(formData)
        if (!res.success) throw new Error(res.message)
        swal.success("Data karyawan berhasil ditambahkan")
      }
      await fetchData()
      setIsModalOpen(false)
    } catch (err: any) {
      swal.error(err.message || "Terjadi kesalahan")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (nip: string) => {
    if (!(await swal.confirm(`Hapus data karyawan dengan NIP ${nip}?`))) return
    try {
      const res = await deleteKaryawanAction(nip)
      if (!res.success) throw new Error(res.message)
      await fetchData()
    } catch (err: any) {
      swal.error(err.message || "Gagal menghapus karyawan")
    }
  }

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <Users className="h-6 w-6 text-blue-600" /> Data Karyawan
          </h1>
          <p className="text-xs text-zinc-500">
            Kelola master data karyawan langsung tersinkronisasi dengan database.
          </p>
        </div>
        <Button
          onClick={() => handleOpenForm()}
          className="h-9 rounded-sm bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Karyawan
        </Button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Karyawan
            </CardTitle>
            <Users className="h-4 w-4 text-zinc-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-zinc-900">
              {karyawanList.length}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Manager
            </CardTitle>
            <Briefcase className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-blue-600">
              {karyawanList.filter((k) => k.jabatan === "Manager").length}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Divisi
            </CardTitle>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-zinc-900">
              {divisions.length}
            </div>
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
                placeholder="Cari NIP, NIK, nama, jabatan, email..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={filterDivisi}
              onValueChange={(val) => setFilterDivisi(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-sm border-zinc-200 bg-white text-xs shadow-sm">
                <SelectValue placeholder="Semua Divisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Divisi</SelectItem>
                {divisions.map((div) => (
                  <SelectItem key={div} value={div}>
                    {div}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || filterDivisi !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setFilterDivisi("ALL")
                }}
                className="h-9 rounded-sm border border-dashed border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                <FilterX className="mr-2 h-3.5 w-3.5" /> Reset Filter
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0 text-[13px]">
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
                    <TableHead className="border-r px-4 py-3 font-bold text-zinc-700">No</TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">NIP & Nama</TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">Jabatan & Divisi</TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">Kontak</TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">Bank & Rekening</TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">Tgl Masuk</TableHead>
                    <TableHead className="text-center font-bold text-zinc-700">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length > 0 ? (
                    filteredData.map((k, idx) => (
                      <TableRow key={k.nip} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                        <TableCell className="border-r px-4 py-3 font-bold text-zinc-500">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="border-r px-4 py-3">
                          <div className="font-bold text-zinc-900">{k.nama}</div>
                          <div className="font-mono text-[11px] text-zinc-400">NIP: {k.nip} • NIK: {k.nik}</div>
                        </TableCell>
                        <TableCell className="border-r px-4 py-3">
                          <div className="font-semibold text-zinc-800">{k.jabatan}</div>
                          <div className="text-[11px] text-zinc-500">{k.divisi}</div>
                        </TableCell>
                        <TableCell className="border-r px-4 py-3">
                          <div className="text-zinc-800">{k.email}</div>
                          <div className="text-[11px] text-zinc-500">{k.no_hp}</div>
                        </TableCell>
                        <TableCell className="border-r px-4 py-3">
                          <div className="font-medium text-zinc-800">{k.nama_bank}</div>
                          <div className="font-mono text-[11px] text-zinc-500">{k.no_rekening}</div>
                        </TableCell>
                        <TableCell className="border-r px-4 py-3 text-zinc-600">
                          {formatDateForView(k.tanggal_masuk)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                setSelectedKaryawan(k)
                                setIsDetailOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-amber-50 hover:text-amber-600"
                              onClick={() => handleOpenForm(k)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDelete(k.nip)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-zinc-400 italic">
                        Data karyawan tidak ditemukan di database.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL FORM (TAMBAH / EDIT) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-3xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              {editMode ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto px-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">NIP *</Label>
                <Input
                  required
                  disabled={editMode}
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  placeholder="Contoh: 1001"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">NIK KTP *</Label>
                <Input
                  required
                  value={formData.nik}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  placeholder="16 digit NIK"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase">Nama Lengkap *</Label>
                <Input
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Nama Lengkap Karyawan"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              {/* JABATAN */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Jabatan *</Label>
                <Input
                  required
                  value={formData.jabatan}
                  onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  placeholder="Manager / Staff"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              {/* DIVISI */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Divisi *</Label>
                <Input
                  required
                  value={formData.divisi}
                  onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                  placeholder="IT / Finance / Human Resources"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Email *</Label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@gmail.com"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">No. HP / WA *</Label>
                <Input
                  required
                  value={formData.no_hp}
                  onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  placeholder="081234567801"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Tempat Lahir</Label>
                <Input
                  value={formData.tempat_lahir || ""}
                  onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
                  placeholder="Contoh: Bandung"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={formData.tanggal_lahir || ""}
                  onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Nama Bank</Label>
                <Input
                  value={formData.nama_bank || ""}
                  onChange={(e) => setFormData({ ...formData, nama_bank: e.target.value })}
                  placeholder="BCA / BRI / Mandiri / BNI"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">No. Rekening</Label>
                <Input
                  value={formData.no_rekening || ""}
                  onChange={(e) => setFormData({ ...formData, no_rekening: e.target.value })}
                  placeholder="Nomor rekening"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">No. BPJS Kesehatan</Label>
                <Input
                  value={formData.no_bpjs_kesehatan || ""}
                  onChange={(e) => setFormData({ ...formData, no_bpjs_kesehatan: e.target.value })}
                  placeholder="13 digit BPJS Kesehatan"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">No. BPJS Ketenagakerjaan</Label>
                <Input
                  value={formData.no_bpjs_ketenagakerjaan || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, no_bpjs_ketenagakerjaan: e.target.value })
                  }
                  placeholder="11 digit BPJS Ketenagakerjaan"
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase">Tanggal Masuk</Label>
                <Input
                  type="date"
                  value={formData.tanggal_masuk || ""}
                  onChange={(e) => setFormData({ ...formData, tanggal_masuk: e.target.value })}
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase">Alamat Domisili</Label>
                <Textarea
                  value={formData.alamat || ""}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Jl. Merdeka No. 10, Bandung"
                  rows={2}
                  className="resize-none rounded-sm border-zinc-300 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 rounded-sm border-zinc-300 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 rounded-sm bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
              >
                {submitting ? "Menyimpan..." : editMode ? "Simpan Perubahan" : "Simpan Data"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-full max-w-2xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              Detail Lengkap Karyawan
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {selectedKaryawan && (
            <div className="space-y-3 px-1 text-xs">
              <div className="grid grid-cols-1 gap-3 rounded-sm border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">NIP</span>
                  <span className="font-mono font-bold text-zinc-900">{selectedKaryawan.nip}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">NIK KTP</span>
                  <span className="font-semibold text-zinc-800">{selectedKaryawan.nik}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Nama Lengkap</span>
                  <span className="font-bold text-zinc-900">{selectedKaryawan.nama}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Jabatan & Divisi</span>
                  <span className="font-semibold text-zinc-800">
                    {selectedKaryawan.jabatan} ({selectedKaryawan.divisi})
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Email</span>
                  <span className="text-zinc-700">{selectedKaryawan.email}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">No. HP</span>
                  <span className="text-zinc-700">{selectedKaryawan.no_hp}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Tempat, Tanggal Lahir</span>
                  <span className="text-zinc-700">
                    {selectedKaryawan.tempat_lahir || "-"}, {formatDateForView(selectedKaryawan.tanggal_lahir)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Tanggal Masuk</span>
                  <span className="text-zinc-700">
                    {formatDateForView(selectedKaryawan.tanggal_masuk)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Rekening Bank</span>
                  <span className="font-mono text-zinc-700">
                    {selectedKaryawan.nama_bank} - {selectedKaryawan.no_rekening}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">BPJS Kesehatan</span>
                  <span className="font-mono text-zinc-700">{selectedKaryawan.no_bpjs_kesehatan || "-"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">BPJS Ketenagakerjaan</span>
                  <span className="font-mono text-zinc-700">{selectedKaryawan.no_bpjs_ketenagakerjaan || "-"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">Alamat Domisili</span>
                  <span className="text-zinc-700">{selectedKaryawan.alamat || "-"}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setIsDetailOpen(false)}
                  className="h-8 rounded-sm bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800"
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