"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  FileText,
  MapPin,
  Calendar,
  FilterX,
  Loader2,
  X,
  ChevronDown,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  getKaryawanAction,
  getPerjalananListAction,
  getPerjalananDetailAction,
  createPerjalananAction,
  updatePerjalananAction,
  deletePerjalananAction,
} from "@/app/actions/perjalanan-dinas"

interface KaryawanItem {
  nip: string
  nama: string
  divisi: string
}

interface AnggotaItem {
  nip: string
  nama: string
  divisi: string
}

interface PerjalananItem {
  nomor: string
  manager_nip: string
  manager_nama: string
  manager_divisi: string
  keperluan: string
  tujuan: string
  tempat: string
  start_date: string
  end_date: string
  anggota: AnggotaItem[]
  user_nama?: string
  id_user?: string
}

export default function PerjalananDinasPage() {
  const [loading, setLoading] = useState(false)
  const [karyawanList, setKaryawanList] = useState<KaryawanItem[]>([])
  const [perjalananList, setPerjalananList] = useState<PerjalananItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedPerjalanan, setSelectedPerjalanan] =
    useState<PerjalananItem | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [karyawanDropdownOpen, setKaryawanDropdownOpen] = useState(false)
  const karyawanDropdownRef = useRef<HTMLDivElement>(null)
  const { data: session } = useSession()

  const [formData, setFormData] = useState({
    nomor: "",
    manager_nip: "",
    keperluan: "",
    tujuan: "",
    tempat: "",
    start_date: "",
    end_date: "",
    karyawan: [] as string[],
  })

  useEffect(() => {
    fetchKaryawan()
    fetchPerjalanan()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        karyawanDropdownRef.current &&
        !karyawanDropdownRef.current.contains(event.target as Node)
      ) {
        setKaryawanDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchKaryawan = async () => {
    try {
      const result = await getKaryawanAction()
      if (result.success && result.data) {
        setKaryawanList(result.data)
      }
    } catch (err) {
      console.error("Gagal mengambil data karyawan", err)
    }
  }

  const fetchPerjalanan = async () => {
    setLoading(true)
    try {
      const result = await getPerjalananListAction()
      if (result.success && result.data) {
        setPerjalananList(result.data)
      }
    } catch (err) {
      console.error("Gagal mengambil data perjalanan dinas", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    return perjalananList.filter((p) => {
      const matchesSearch =
        p.tujuan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tempat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.keperluan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.manager_nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.anggota.some((a) =>
          a.nama.toLowerCase().includes(searchQuery.toLowerCase())
        )
      let matchesDate = true
      if (p.start_date) {
        if (startDate && p.start_date < startDate) matchesDate = false
        if (endDate && p.start_date > endDate) matchesDate = false
      } else if (startDate || endDate) {
        matchesDate = false
      }
      return matchesSearch && matchesDate
    })
  }, [perjalananList, searchQuery, startDate, endDate])

  const ringkasan = useMemo(() => {
    const total = perjalananList.length
    return { total }
  }, [perjalananList])

  const resetForm = () => {
    setFormData({
      nomor: "",
      manager_nip: "",
      keperluan: "",
      tujuan: "",
      tempat: "",
      start_date: "",
      end_date: "",
      karyawan: [],
    })
    setEditMode(false)
  }

  const handleOpenModal = (perjalanan?: PerjalananItem) => {
    if (perjalanan) {
      console.log("start_date asli:", perjalanan.start_date) // tambahin ini
      console.log("end_date asli:", perjalanan.end_date) // tambahin ini
      setEditMode(true)
      setFormData({
        nomor: perjalanan.nomor,
        manager_nip: perjalanan.manager_nip,
        keperluan: perjalanan.keperluan,
        tujuan: perjalanan.tujuan,
        tempat: perjalanan.tempat,
        start_date: perjalanan.start_date
          ? new Date(perjalanan.start_date).toISOString().split("T")[0]
          : "",
        end_date: perjalanan.end_date
          ? new Date(perjalanan.end_date).toISOString().split("T")[0]
          : "",
        karyawan: perjalanan.anggota.map((a) => a.nip),
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editMode) {
        const result = await updatePerjalananAction(formData.nomor, {
          manager_nip: formData.manager_nip,
          keperluan: formData.keperluan,
          tujuan: formData.tujuan,
          tempat: formData.tempat,
          start_date: formData.start_date,
          end_date: formData.end_date,
          karyawan: formData.karyawan,
        })

        if (!result.success) {
          throw new Error(result.message || "Gagal memperbarui SPPD")
        }

        await fetchPerjalanan()
        setIsModalOpen(false)
        resetForm()
      } else {
        const result = await createPerjalananAction({
          nomor: formData.nomor,
          manager_nip: formData.manager_nip,
          keperluan: formData.keperluan,
          tujuan: formData.tujuan,
          tempat: formData.tempat,
          start_date: formData.start_date,
          end_date: formData.end_date,
          karyawan: formData.karyawan,
        })

        if (!result.success) {
          throw new Error(result.message || "Gagal membuat SPPD")
        }

        await fetchPerjalanan()
        setIsModalOpen(false)
        resetForm()
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (nomor: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus SPPD ini?")) return

    try {
      const result = await deletePerjalananAction(nomor)
      if (!result.success) {
        throw new Error(result.message || "Gagal menghapus SPPD")
      }

      await fetchPerjalanan()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleViewDetail = async (perjalanan: PerjalananItem) => {
    try {
      const result = await getPerjalananDetailAction(perjalanan.nomor)
      if (result.success && result.data) {
        setSelectedPerjalanan(result.data)
        setIsDetailOpen(true)
      }
    } catch (err) {
      console.error("Gagal mengambil detail SPPD", err)
    }
  }

  const resetFilters = () => {
    setSearchQuery("")
    setStartDate("")
    setEndDate("")
  }

  const toggleKaryawan = (nip: string) => {
    setFormData((prev) => ({
      ...prev,
      karyawan: prev.karyawan.includes(nip)
        ? prev.karyawan.filter((k) => k !== nip)
        : [...prev.karyawan, nip],
    }))
  }

  const selectedKaryawanNames = formData.karyawan
    .map((nip) => karyawanList.find((k) => k.nip === nip))
    .filter(Boolean)

  const managerName = karyawanList.find((k) => k.nip === formData.manager_nip)
    ? `${karyawanList.find((k) => k.nip === formData.manager_nip)!.nama} - ${karyawanList.find((k) => k.nip === formData.manager_nip)!.nip}`
    : ""

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <MapPin className="h-6 w-6 text-blue-600" /> Perjalanan Dinas
          </h1>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="h-9 rounded-sm bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Ajukan Perjalanan Baru
        </Button>
      </div>

      {/* RINGKASAN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Perjalanan
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
              Semua perjalanan dinas
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
                placeholder="Cari nomor, tujuan, tempat, manager, atau anggota..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

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

            {(searchQuery || startDate || endDate) && (
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
                      Nomor SPPD
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Tujuan
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Tempat
                    </TableHead>
                    <TableHead className="border-r text-center font-bold text-zinc-700">
                      Periode
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Manager
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Anggota
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
                        key={p.nomor}
                        className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      >
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-500">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-900">
                          {p.nomor}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-900">
                          {p.tujuan}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-zinc-700">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-zinc-400" />
                            {p.tempat}
                          </div>
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-center text-zinc-700">
                          <div className="text-[11px]">
                            {new Date(p.start_date).toLocaleDateString(
                              "id-ID",
                              { day: "numeric", month: "short" }
                            )}
                            {" - "}
                            {new Date(p.end_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-zinc-700">
                          <div className="text-[11px] font-medium">
                            {p.manager_nama}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {p.manager_nip}
                          </div>
                        </TableCell>
                        <TableCell className="border-r px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            {p.anggota.slice(0, 2).map((a, i) => (
                              <span
                                key={i}
                                className="text-[11px] font-medium text-zinc-700"
                              >
                                • {a.nama}
                              </span>
                            ))}
                            {p.anggota.length > 2 && (
                              <span className="text-[10px] text-zinc-400 italic">
                                +{p.anggota.length - 2} anggota
                              </span>
                            )}
                          </div>
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
                              onClick={() => handleDelete(p.nomor)}
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
                        Tidak ada data perjalanan dinas yang ditemukan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL FORM TAMBAH/EDIT PERJALANAN */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-3xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              {editMode
                ? "Edit Perjalanan Dinas"
                : "Form Pengajuan Perjalanan Dinas"}
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
                  Nomor SPPD
                </Label>
                <Input
                  required
                  disabled={editMode}
                  value={formData.nomor}
                  onChange={(e) =>
                    setFormData({ ...formData, nomor: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                  placeholder="Contoh: SPPD-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Manager
                </Label>
                <Select
                  value={formData.manager_nip}
                  onValueChange={(val) =>
                    setFormData({ ...formData, manager_nip: val ?? "" })
                  }
                  required
                >
                  <SelectTrigger className="h-9 rounded-sm border-zinc-300 text-xs">
                    <SelectValue placeholder="Pilih Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {karyawanList.map((k) => (
                      <SelectItem key={k.nip} value={k.nip}>
                        {k.nama} - {k.nip}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Tujuan Perjalanan
                </Label>
                <Input
                  required
                  value={formData.tujuan}
                  onChange={(e) =>
                    setFormData({ ...formData, tujuan: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                  placeholder="Contoh: Pelatihan ISO 9001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Tempat
                </Label>
                <Input
                  required
                  value={formData.tempat}
                  onChange={(e) =>
                    setFormData({ ...formData, tempat: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                  placeholder="Contoh: Hotel Santika, Bandung"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Tanggal Mulai
                </Label>
                <Input
                  required
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Tanggal Selesai
                </Label>
                <Input
                  required
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold text-zinc-700 uppercase">
                  Keperluan
                </Label>
                <Textarea
                  required
                  value={formData.keperluan}
                  onChange={(e) =>
                    setFormData({ ...formData, keperluan: e.target.value })
                  }
                  className="resize-none rounded-sm border-zinc-300 text-xs"
                  rows={2}
                  placeholder="Jelaskan keperluan perjalanan dinas..."
                />
              </div>
            </div>

            <div className="space-y-3 rounded-sm border border-zinc-200 bg-zinc-50/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-zinc-700 uppercase">
                  Daftar Karyawan
                </span>
              </div>

              <div className="relative" ref={karyawanDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKaryawanDropdownOpen(!karyawanDropdownOpen)}
                  className="h-9 w-full justify-between rounded-sm border-zinc-300 text-xs font-semibold"
                >
                  <span>
                    {formData.karyawan.length === 0
                      ? "Pilih Karyawan"
                      : `${formData.karyawan.length} karyawan dipilih`}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {karyawanDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-zinc-200 bg-white shadow-lg">
                    {karyawanList.map((k) => (
                      <div
                        key={k.nip}
                        className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-0 hover:bg-zinc-50"
                        onClick={() => toggleKaryawan(k.nip)}
                      >
                        <Checkbox
                          checked={formData.karyawan.includes(k.nip)}
                          onCheckedChange={() => toggleKaryawan(k.nip)}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-zinc-800">
                            {k.nama}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {k.nip} • {k.divisi}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formData.karyawan.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedKaryawanNames.map((k) => (
                    <span
                      key={k!.nip}
                      className="inline-flex items-center gap-1 rounded-sm bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700"
                    >
                      {k!.nama}
                      <button
                        type="button"
                        onClick={() => toggleKaryawan(k!.nip)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                disabled={submitting}
                className="h-9 rounded-sm bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
              >
                {submitting
                  ? "Menyimpan..."
                  : editMode
                    ? "Simpan Perubahan"
                    : "Kirim Pengajuan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL PERJALANAN */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-full max-w-2xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              Detail Perjalanan Dinas
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {selectedPerjalanan && (
            <div className="space-y-4 px-1">
              <div className="space-y-2 rounded-sm border border-zinc-200 bg-zinc-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Nomor SPPD
                  </span>
                  <span className="font-bold text-zinc-900">
                    {selectedPerjalanan.nomor}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Manager
                  </span>
                  <div className="text-right">
                    <span className="block font-bold text-zinc-900">
                      {selectedPerjalanan.manager_nama}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {selectedPerjalanan.manager_nip} •{" "}
                      {selectedPerjalanan.manager_divisi}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Tujuan
                  </span>
                  <span className="font-bold text-zinc-900">
                    {selectedPerjalanan.tujuan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Tempat
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {selectedPerjalanan.tempat}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Periode
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {new Date(selectedPerjalanan.start_date).toLocaleDateString(
                      "id-ID"
                    )}{" "}
                    -{" "}
                    {new Date(selectedPerjalanan.end_date).toLocaleDateString(
                      "id-ID"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Keperluan
                  </span>
                  <span className="max-w-md text-right font-semibold text-zinc-800">
                    {selectedPerjalanan.keperluan}
                  </span>
                </div>
               {(session?.user as any)?.role === "Admin" && (
  <div className="flex justify-between">
    <span className="font-bold text-zinc-500 uppercase">
      Dibuat Oleh
    </span>
    <span className="font-semibold text-zinc-800">
      {selectedPerjalanan.user_nama || "-"}
    </span>
  </div>
)}
              </div>

              <div className="overflow-hidden rounded-sm border border-zinc-300 text-xs">
                <div className="border-b border-zinc-300 bg-zinc-200 p-2 font-bold text-zinc-800">
                  Daftar Karyawan
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100 text-[11px] font-bold text-zinc-700">
                      <th className="w-12 border-r border-zinc-200 p-2 text-center">
                        No
                      </th>
                      <th className="border-r border-zinc-200 p-2">Nama</th>
                      <th className="border-r border-zinc-200 p-2">NIP</th>
                      <th className="border-r border-zinc-200 p-2">Divisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {selectedPerjalanan.anggota.map((a, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="border-r border-zinc-200 p-2 text-center font-bold text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="border-r border-zinc-200 p-2 font-medium text-zinc-800">
                          {a.nama}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-zinc-600">
                          {a.nip}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-zinc-600">
                          {a.divisi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
