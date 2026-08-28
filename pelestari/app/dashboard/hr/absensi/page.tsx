"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  ClipboardList,
  Clock,
  Loader2,
  X,
  FilterX,
  CalendarDays,
  UserCheck,
  UserX,
  CalendarRange,
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
  getAbsensiHarian,
  getAbsensiHarianById,
  createAbsensiHarian,
  updateAbsensiHarian,
  deleteAbsensiHarian,
  AbsensiHarianData,
  CreateAbsensiHarianPayload,
  UpdateAbsensiHarianPayload,
} from "@/app/actions/absensi-harian"
import {
  getPeriodeAbsensi,
  PeriodeAbsensiData,
} from "@/app/actions/periode-absensi"
import {
  getStatusKehadiran,
  StatusKehadiranData,
} from "@/app/actions/status-kehadiran"
import { getKaryawanListAction, KaryawanData } from "@/app/actions/karyawan"
import { swal } from "@/lib/sweetalert"

const initialForm: CreateAbsensiHarianPayload & {
  nip?: string
  nama?: string
  jabatan?: string
  nama_status?: string
} = {
  karyawan_nip: "",
  periode_id: 0,
  tanggal: "",
  jam_masuk: "",
  jam_keluar: "",
  status_id: 0,
  keterangan: "",
}

const formatDateForInput = (dateString?: string) => {
  if (!dateString) return ""
  try {
    const d = new Date(dateString)
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

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

export default function AbsensiPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [absensiList, setAbsensiList] = useState<AbsensiHarianData[]>([])
  const [karyawanList, setKaryawanList] = useState<KaryawanData[]>([])
  const [periodeList, setPeriodeList] = useState<PeriodeAbsensiData[]>([])
  const [statusList, setStatusList] = useState<StatusKehadiranData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterBulan, setFilterBulan] = useState("ALL")
  const [filterPeriode, setFilterPeriode] = useState("ALL")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedAbsensi, setSelectedAbsensi] =
    useState<AbsensiHarianData | null>(null)
  const [formData, setFormData] = useState(initialForm)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [absensiRes, karyawanRes, periodeRes, statusRes] =
        await Promise.all([
          getAbsensiHarian(),
          getKaryawanListAction(),
          getPeriodeAbsensi(),
          getStatusKehadiran(),
        ])

      if (absensiRes.success && absensiRes.data) {
        setAbsensiList(absensiRes.data)
      } else {
        setAbsensiList([])
      }

      if (karyawanRes.success && karyawanRes.data) {
        setKaryawanList(karyawanRes.data)
      }

      if (periodeRes.success && periodeRes.data) {
        setPeriodeList(periodeRes.data)
      }

      if (statusRes.success && statusRes.data) {
        setStatusList(statusRes.data)
      }
    } catch (err) {
      console.error("Gagal mengambil data absensi:", err)
      setAbsensiList([])
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    return (absensiList || []).filter((a) => {
      const matchSearch =
        (a.nama || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.nip || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.divisi || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.jabatan || "").toLowerCase().includes(searchQuery.toLowerCase())

      const matchStatus =
        filterStatus === "ALL" || a.nama_status === filterStatus

      const matchBulan =
        filterBulan === "ALL" ||
        (a.tanggal && a.tanggal.substring(0, 7) === filterBulan)

      const matchPeriode =
        filterPeriode === "ALL" || String(a.periode_id) === filterPeriode

      return matchSearch && matchStatus && matchBulan && matchPeriode
    })
  }, [absensiList, searchQuery, filterStatus, filterBulan, filterPeriode])

  const months = useMemo(() => {
    const set = new Set(
      (absensiList || []).map((a) => a.tanggal?.substring(0, 7)).filter(Boolean)
    )
    return Array.from(set).sort().reverse()
  }, [absensiList])

  const statusColor = (namaStatus?: string) => {
    switch (namaStatus) {
      case "Hadir":
        return "bg-emerald-100 text-emerald-700"
      case "Izin":
        return "bg-amber-100 text-amber-700"
      case "Sakit":
        return "bg-blue-100 text-blue-700"
      case "Alpha":
        return "bg-red-100 text-red-700"
      default:
        return "bg-zinc-100 text-zinc-700"
    }
  }

  const handleOpenForm = (item?: AbsensiHarianData) => {
    if (item) {
      setEditMode(true)
      setFormData({
        karyawan_nip: item.karyawan_nip,
        periode_id: item.periode_id,
        tanggal: item.tanggal,
        jam_masuk: item.jam_masuk || "",
        jam_keluar: item.jam_keluar || "",
        status_id: item.status_id,
        keterangan: item.keterangan || "",
        nip: item.nip,
        nama: item.nama,
        jabatan: item.jabatan,
        nama_status: item.nama_status,
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
      if (editMode && selectedAbsensi) {
        const payload: UpdateAbsensiHarianPayload = {
          karyawan_nip: formData.karyawan_nip,
          periode_id: formData.periode_id,
          tanggal: formData.tanggal,
          jam_masuk: formData.jam_masuk || null,
          jam_keluar: formData.jam_keluar || null,
          status_id: formData.status_id,
          keterangan: formData.keterangan || null,
        }
        const res = await updateAbsensiHarian(selectedAbsensi.id, payload)
        if (!res.success) throw new Error(res.message)
        swal.success("Data absensi berhasil diperbarui")
      } else {
        const payload: CreateAbsensiHarianPayload = {
          karyawan_nip: formData.karyawan_nip,
          periode_id: Number(formData.periode_id),
          tanggal: formData.tanggal,
          jam_masuk: formData.jam_masuk || null,
          jam_keluar: formData.jam_keluar || null,
          status_id: Number(formData.status_id),
          keterangan: formData.keterangan || null,
        }
        const res = await createAbsensiHarian(payload)
        if (!res.success) throw new Error(res.message)
        swal.success("Data absensi berhasil ditambahkan")
      }
      await fetchData()
      setIsModalOpen(false)
    } catch (err: any) {
      swal.error(err.message || "Terjadi kesalahan")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await swal.confirm("Hapus data absensi ini?"))) return
    try {
      const res = await deleteAbsensiHarian(id)
      if (!res.success) throw new Error(res.message)
      await fetchData()
      swal.success("Data absensi berhasil dihapus")
    } catch (err: any) {
      swal.error(err.message || "Gagal menghapus data")
    }
  }

  const totalHadir = absensiList.filter((a) => a.nama_status === "Hadir").length
  const totalIzin = absensiList.filter((a) => a.nama_status === "Izin").length
  const totalSakit = absensiList.filter((a) => a.nama_status === "Sakit").length
  const totalAlpha = absensiList.filter((a) => a.nama_status === "Alpha").length

  const selectedPeriode = periodeList.find(
    (p) => String(p.id) === String(formData.periode_id)
  )

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Data Absensi
          </h1>
          <p className="text-xs text-zinc-500">
            Kelola data kehadiran karyawan langsung tersinkronisasi dengan
            database.
          </p>
        </div>
        <Button
          onClick={() => handleOpenForm()}
          className="h-9 rounded-sm bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Absensi
        </Button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Hadir
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-emerald-600">
              {totalHadir}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Izin
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-amber-600">
              {totalIzin}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Sakit
            </CardTitle>
            <UserX className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-blue-600">
              {totalSakit}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Alpha
            </CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-red-600">
              {totalAlpha}
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
                placeholder="Cari NIP, nama, jabatan..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={filterPeriode}
              onValueChange={(val) => setFilterPeriode(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-sm border-zinc-200 bg-white text-xs shadow-sm">
                <SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Periode</SelectItem>
                {periodeList.map((p) => (
                  <SelectItem key={p.id} value={String(p.nama_periode)}>
                    {p.nama_periode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(val) => setFilterStatus(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[160px] rounded-sm border-zinc-200 bg-white text-xs shadow-sm">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                {statusList.map((s) => (
                  <SelectItem key={s.id} value={s.nama_status}>
                    {s.nama_status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterBulan}
              onValueChange={(val) => setFilterBulan(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[160px] rounded-sm border-zinc-200 bg-white text-xs shadow-sm">
                <SelectValue placeholder="Semua Bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Bulan</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery ||
              filterStatus !== "ALL" ||
              filterBulan !== "ALL" ||
              filterPeriode !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setFilterStatus("ALL")
                  setFilterBulan("ALL")
                  setFilterPeriode("ALL")
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
                    <TableHead className="border-r px-4 py-3 font-bold text-zinc-700">
                      No
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      NIP & Nama
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Jabatan
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Periode
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Tanggal
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Jam Masuk
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Jam Pulang
                    </TableHead>
                    <TableHead className="border-r font-bold text-zinc-700">
                      Status
                    </TableHead>
                    <TableHead className="text-center font-bold text-zinc-700">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length > 0 ? (
                    filteredData.map((a, idx) => {
                      const periode = periodeList.find(
                        (p) => p.id === a.periode_id
                      )
                      return (
                        <TableRow
                          key={a.id}
                          className="border-b border-zinc-100 hover:bg-zinc-50/80"
                        >
                          <TableCell className="border-r px-4 py-3 font-bold text-zinc-500">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3">
                            <div className="font-bold text-zinc-900">
                              {a.nama}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-400">
                              NIP: {a.nip}
                            </div>
                          </TableCell>
                          <TableCell className="border-r px-4 py-3">
                            <div className="text-zinc-800">{a.jabatan}</div>
                          </TableCell>
                          <TableCell className="border-r px-4 py-3">
                            <div className="text-zinc-800">
                              {periode?.nama_periode || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="border-r px-4 py-3 text-zinc-600">
                            {formatDateForView(a.tanggal)}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3 font-mono text-zinc-600">
                            {a.jam_masuk || "-"}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3 font-mono text-zinc-600">
                            {a.jam_keluar || "-"}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3">
                            <span
                              className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(a.nama_status)}`}
                            >
                              {a.nama_status}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                                onClick={() => {
                                  setSelectedAbsensi(a)
                                  setIsDetailOpen(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-sm hover:bg-amber-50 hover:text-amber-600"
                                onClick={() => handleOpenForm(a)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-sm hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDelete(a.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-16 text-center text-zinc-400 italic"
                      >
                        Data absensi tidak ditemukan di database.
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
        <DialogContent className="w-full max-w-2xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              {editMode ? "Edit Data Absensi" : "Tambah Absensi Baru"}
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
            className="max-h-[75vh] space-y-4 overflow-y-auto px-1"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Karyawan *
                </Label>
                <Select
                  value={
                    formData.karyawan_nip
                      ? String(formData.karyawan_nip)
                      : undefined
                  }
                  onValueChange={(val) => {
                    const karyawan = karyawanList.find(
                      (k) => String(k.nip) === val
                    )
                    setFormData({
                      ...formData,
                      karyawan_nip: String(val),
                      nip: karyawan?.nip || "",
                      nama: karyawan?.nama || "",
                      jabatan: karyawan?.jabatan || "",
                    })
                  }}
                  disabled={editMode}
                >
                  <SelectTrigger className="h-9 w-full rounded-sm border-zinc-300 text-xs">
                    <SelectValue placeholder="Pilih Karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    {karyawanList.map((k) => (
                      <SelectItem key={k.nip} value={k.nip}>
                        {k.nip} - {k.nama} ({k.jabatan})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Periode *
                </Label>
                <Select
                  value={
                    formData.periode_id
                      ? String(formData.periode_id)
                      : undefined
                  }
                  onValueChange={(val) =>
                    setFormData({ ...formData, periode_id: Number(val) })
                  }
                >
                  <SelectTrigger className="h-9 w-full rounded-sm border-zinc-300 text-xs">
                    <SelectValue placeholder="Pilih Periode" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodeList.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nama_periode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Tanggal *
                </Label>
                <Input
                  type="date"
                  required
                  value={formData.tanggal}
                  onChange={(e) =>
                    setFormData({ ...formData, tanggal: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
                {selectedPeriode && formData.tanggal && (
                  <p className="text-[10px] text-zinc-500">
                    Rentang periode:{" "}
                    {formatDateForView(selectedPeriode.tanggal_mulai)} -{" "}
                    {formatDateForView(selectedPeriode.tanggal_selesai)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Status *
                </Label>
                <Select
                  value={
                    formData.status_id ? String(formData.status_id) : undefined
                  }
                  onValueChange={(val) =>
                    setFormData({ ...formData, status_id: Number(val) })
                  }
                >
                  <SelectTrigger className="h-9 w-full rounded-sm border-zinc-300 text-xs">
                    <SelectValue placeholder="Pilih Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusList.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nama_status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Jam Masuk
                </Label>
                <Input
                  type="time"
                  value={formData.jam_masuk || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, jam_masuk: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">
                  Jam Pulang
                </Label>
                <Input
                  type="time"
                  value={formData.jam_keluar || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, jam_keluar: e.target.value })
                  }
                  className="h-9 rounded-sm border-zinc-300 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase">
                  Keterangan
                </Label>
                <Textarea
                  value={formData.keterangan || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, keterangan: e.target.value })
                  }
                  placeholder="Keterangan tambahan (opsional)"
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
                {submitting
                  ? "Menyimpan..."
                  : editMode
                    ? "Simpan Perubahan"
                    : "Simpan Data"}
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
              Detail Absensi Karyawan
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {selectedAbsensi && (
            <div className="space-y-3 px-1 text-xs">
              <div className="grid grid-cols-1 gap-3 rounded-sm border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    NIP
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {selectedAbsensi.nip}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Nama
                  </span>
                  <span className="font-bold text-zinc-900">
                    {selectedAbsensi.nama}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Jabatan
                  </span>
                  <span className="text-zinc-700">
                    {selectedAbsensi.jabatan}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Divisi
                  </span>
                  <span className="text-zinc-700">
                    {selectedAbsensi.divisi}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Periode
                  </span>
                  <span className="text-zinc-700">
                    {periodeList.find(
                      (p) => p.id === selectedAbsensi.periode_id
                    )?.nama_periode || "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Tanggal
                  </span>
                  <span className="text-zinc-700">
                    {formatDateForView(selectedAbsensi.tanggal)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Jam Masuk
                  </span>
                  <span className="font-mono text-zinc-700">
                    {selectedAbsensi.jam_masuk || "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Jam Pulang
                  </span>
                  <span className="font-mono text-zinc-700">
                    {selectedAbsensi.jam_keluar || "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Status
                  </span>
                  <span
                    className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(selectedAbsensi.nama_status)}`}
                  >
                    {selectedAbsensi.nama_status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Kategori
                  </span>
                  <span className="text-zinc-700">
                    {selectedAbsensi.kategori}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase">
                    Keterangan
                  </span>
                  <span className="text-zinc-700">
                    {selectedAbsensi.keterangan || "-"}
                  </span>
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
