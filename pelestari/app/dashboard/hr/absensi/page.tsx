"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Plus,
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
  getAbsensiByTanggal,
  createAbsensiHarian,
  updateAbsensiHarian,
  deleteAbsensiHarian,
  AbsensiHarianData,
  CreateAbsensiHarianPayload,
  UpdateAbsensiHarianPayload,
} from "@/app/actions/absensi-harian"
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
  tanggal: "",
  jam_masuk: "",
  jam_keluar: "",
  status_id: 0,
}

interface BatchEntry {
  karyawan_nip: string
  nama: string
  jabatan: string
  jam_masuk: string
  jam_keluar: string
  status_id: number
  existingId?: number | null
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
  const [statusList, setStatusList] = useState<StatusKehadiranData[]>([])
  const [filterDari, setFilterDari] = useState("")
  const [filterSampai, setFilterSampai] = useState("")
  const [isFiltering, setIsFiltering] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedAbsensi, setSelectedAbsensi] =
    useState<AbsensiHarianData | null>(null)
  const [formData, setFormData] = useState(initialForm)
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([])
  const [batchDate, setBatchDate] = useState("")
  const [existingBatchAbsensi, setExistingBatchAbsensi] = useState<
    AbsensiHarianData[]
  >([])

  const getDefaultFilterRange = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const day = today.getDate()

    let dari: Date
    let sampai: Date

    if (day >= 26) {
      dari = new Date(year, month, 26)
      sampai = new Date(year, month + 1, 25)
    } else {
      dari = new Date(year, month - 1, 26)
      sampai = new Date(year, month, 25)
    }

    return {
      dari: `${dari.getFullYear()}-${String(dari.getMonth() + 1).padStart(2, "0")}-${String(dari.getDate()).padStart(2, "0")}`,
      sampai: `${sampai.getFullYear()}-${String(sampai.getMonth() + 1).padStart(2, "0")}-${String(sampai.getDate()).padStart(2, "0")}`,
    }
  }

  const getDefaultDari = () => getDefaultFilterRange().dari
  const getDefaultSampai = () => getDefaultFilterRange().sampai

  useEffect(() => {
    const { dari, sampai } = getDefaultFilterRange()
    setFilterDari(dari)
    setFilterSampai(sampai)
    setIsFiltering(false)
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [absensiRes, karyawanRes, statusRes] = await Promise.all([
        getAbsensiHarian(),
        getKaryawanListAction(),
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
    const defaultRange = getDefaultFilterRange()
    const isDefaultRange =
      filterDari === defaultRange.dari && filterSampai === defaultRange.sampai

    if (
      !isDefaultRange &&
      (filterDari !== defaultRange.dari || filterSampai !== defaultRange.sampai)
    ) {
      setIsFiltering(true)
    } else if (isDefaultRange) {
      setIsFiltering(false)
    }

    return (absensiList || []).filter((a) => {
      const matchTanggal =
        (!filterDari || a.tanggal >= filterDari) &&
        (!filterSampai || a.tanggal <= filterSampai)

      return matchTanggal
    })
  }, [absensiList, filterDari, filterSampai])

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

  const getDayName = (dateString: string) => {
    const d = new Date(dateString + "T00:00:00")
    return d.toLocaleDateString("id-ID", { weekday: "long" })
  }

  const getDateRange = (start: string, end: string) => {
    if (!start || !end) return []
    const dates: string[] = []
    const current = new Date(start + "T00:00:00")
    const last = new Date(end + "T00:00:00")
    while (current <= last) {
      dates.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
      )
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const formatPeriode = (dari: string, sampai: string) => {
    if (!dari || !sampai) return ""
    const start = new Date(dari + "T00:00:00")
    const end = new Date(sampai + "T00:00:00")
    const fmt = (d: Date) =>
      d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    return `Periode ${fmt(start)} - ${fmt(end)}`
  }

  const groupedAbsensi = useMemo(() => {
    const defaultRange = getDefaultFilterRange()
    const dateRange = getDateRange(
      filterDari || defaultRange.dari,
      filterSampai || defaultRange.sampai
    )

    const grouped = new Map<
      string,
      {
        karyawan_nip: string
        nama: string
        nip: string
        divisi: string
        absensi: Record<
          string,
          {
            jam_masuk: string | null
            jam_keluar: string | null
            status_id: number
            id: number
          }
        >
      }
    >()

    filteredData.forEach((a) => {
      if (!grouped.has(a.karyawan_nip)) {
        grouped.set(a.karyawan_nip, {
          karyawan_nip: a.karyawan_nip,
          nama: a.nama,
          nip: a.nip,
          divisi: a.divisi,
          absensi: {},
        })
      }
      const group = grouped.get(a.karyawan_nip)!
      group.absensi[a.tanggal] = {
        jam_masuk: a.jam_masuk,
        jam_keluar: a.jam_keluar,
        status_id: a.status_id,
        id: a.id,
      }
    })

    return {
      grouped: Array.from(grouped.values()),
      dateRange,
    }
  }, [filteredData, filterDari, filterSampai])

  const loadExistingAbsensi = async (tanggal: string) => {
    let existing: AbsensiHarianData[] = []
    try {
      const res = await getAbsensiByTanggal(tanggal)
      if (res.success && res.data) {
        existing = res.data
      }
    } catch (err) {
      console.error("Gagal mengambil data absensi existing:", err)
    }
    setExistingBatchAbsensi(existing)

    const existingMap = new Map(existing.map((e) => [e.nip, e]))
    setBatchEntries((prev) =>
      prev.map((entry) => {
        const existingData = existingMap.get(entry.karyawan_nip)
        return {
          ...entry,
          jam_masuk: existingData?.jam_masuk || "",
          jam_keluar: existingData?.jam_keluar || "",
          status_id: existingData?.status_id || 0,
          existingId: existingData?.id ?? null,
        }
      })
    )
  }

  const handleOpenForm = async (item?: AbsensiHarianData) => {
    if (item) {
      setEditMode(true)
      setFormData({
        karyawan_nip: item.karyawan_nip,
        tanggal: item.tanggal,
        jam_masuk: item.jam_masuk || "",
        jam_keluar: item.jam_keluar || "",
        status_id: item.status_id,
        nip: item.nip,
        nama: item.nama,
        jabatan: item.jabatan,
        nama_status: item.nama_status,
      })
      setIsModalOpen(true)
    } else {
      setEditMode(false)
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      setBatchDate(todayStr)

      const entries: BatchEntry[] = karyawanList.map((k) => ({
        karyawan_nip: String(k.nip),
        nama: k.nama,
        jabatan: k.jabatan,
        jam_masuk: "",
        jam_keluar: "",
        status_id: 0,
        existingId: null,
      }))
      setBatchEntries(entries)

      await loadExistingAbsensi(todayStr)
      setIsModalOpen(true)
    }
  }

  const handleBatchDateChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newDate = e.target.value
    setBatchDate(newDate)

    if (!newDate || editMode) return
    await loadExistingAbsensi(newDate)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editMode && selectedAbsensi) {
        const payload: UpdateAbsensiHarianPayload = {
          karyawan_nip: formData.karyawan_nip,
          tanggal: formData.tanggal,
          jam_masuk: formData.jam_masuk || null,
          jam_keluar: formData.jam_keluar || null,
          status_id: formData.status_id,
        }
        const res = await updateAbsensiHarian(selectedAbsensi.id, payload)
        if (!res.success) throw new Error(res.message)
        swal.success("Data absensi berhasil diperbarui")
      } else {
        const validEntries = batchEntries.filter((e) => e.status_id > 0)
        if (validEntries.length === 0) {
          throw new Error("Pilih minimal satu status karyawan")
        }

        const promises: Promise<any>[] = []

        validEntries
          .filter((e) => e.existingId != null)
          .forEach((entry) => {
            promises.push(
              updateAbsensiHarian(entry.existingId!, {
                karyawan_nip: entry.karyawan_nip,
                tanggal: batchDate,
                jam_masuk: entry.jam_masuk || null,
                jam_keluar: entry.jam_keluar || null,
                status_id: Number(entry.status_id),
              })
            )
          })

        validEntries
          .filter((e) => e.existingId == null)
          .forEach((entry) => {
            promises.push(
              createAbsensiHarian({
                karyawan_nip: entry.karyawan_nip,
                tanggal: batchDate,
                jam_masuk: entry.jam_masuk || null,
                jam_keluar: entry.jam_keluar || null,
                status_id: Number(entry.status_id),
              })
            )
          })

        const results = await Promise.allSettled(promises)
        const succeeded = results.filter(
          (r) => r.status === "fulfilled" && r.value.success
        ).length
        const failed = results.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" && !r.value.success)
        )

        if (succeeded === 0) {
          const errorMessages = failed
            .map((r) =>
              r.status === "rejected" ? r.reason?.message : r.value?.message
            )
            .filter(Boolean)
          throw new Error(errorMessages[0] || "Gagal menyimpan data absensi")
        }

        if (failed.length > 0) {
          swal.warning(
            `${succeeded} data berhasil, ${failed.length} data gagal`
          )
        } else {
          swal.success(`${succeeded} data absensi berhasil disimpan`)
        }
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

  const totalHadir = filteredData.filter(
    (a) => a.nama_status === "Hadir"
  ).length
  const totalIzin = filteredData.filter((a) => a.nama_status === "Izin").length
  const totalSakit = filteredData.filter(
    (a) => a.nama_status === "Sakit"
  ).length
  const totalAlpha = filteredData.filter(
    (a) => a.nama_status === "Alpha"
  ).length

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

      {/* FILTER TANGGAL */}
      <Card className="overflow-hidden rounded-sm border-zinc-200 shadow-md">
        <CardHeader className="space-y-4 border-b bg-zinc-50/50 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] space-y-1">
              <span className="block text-[10px] font-semibold text-zinc-500 uppercase">
                Dari Tanggal
              </span>
              <Input
                type="date"
                className="h-9 rounded-sm border-zinc-200 bg-white text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={filterDari}
                onChange={(e) => {
                  setFilterDari(e.target.value)
                  setIsFiltering(true)
                }}
              />
            </div>

            <div className="min-w-[160px] space-y-1">
              <span className="block text-[10px] font-semibold text-zinc-500 uppercase">
                Sampai Tanggal
              </span>
              <Input
                type="date"
                className="h-9 rounded-sm border-zinc-200 bg-white text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={filterSampai}
                onChange={(e) => {
                  setFilterSampai(e.target.value)
                  setIsFiltering(true)
                }}
              />
            </div>

            {(filterDari !== getDefaultFilterRange().dari ||
              filterSampai !== getDefaultFilterRange().sampai) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const { dari, sampai } = getDefaultFilterRange()
                  setFilterDari(dari)
                  setFilterSampai(sampai)
                  setIsFiltering(false)
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
                  <TableRow className="border-b border-zinc-200 text-xs">
                    <TableHead
                      colSpan={4 + groupedAbsensi.dateRange.length * 2}
                      className="border-r px-4 py-2 text-center text-lg font-bold text-zinc-600"
                    >
                      {formatPeriode(filterDari, filterSampai)}
                    </TableHead>
                  </TableRow>
                  <TableRow className="border-b border-zinc-200 text-xs">
                    <TableHead
                      rowSpan={3}
                      className="border-r px-4 py-3 font-bold text-zinc-700"
                    >
                      No
                    </TableHead>
                    <TableHead
                      rowSpan={3}
                      className="border-r px-4 py-3 font-bold text-zinc-700"
                    >
                      Nama
                    </TableHead>
                    <TableHead
                      rowSpan={3}
                      className="border-r px-4 py-3 font-bold text-zinc-700"
                    >
                      NIP
                    </TableHead>
                    <TableHead
                      rowSpan={3}
                      className="border-r px-4 py-3 font-bold text-zinc-700"
                    >
                      Divisi
                    </TableHead>
                    {groupedAbsensi.dateRange.map((tanggal) => (
                      <TableHead
                        key={tanggal}
                        colSpan={2}
                        className="border-r px-2 py-2 text-center font-bold text-zinc-700"
                      >
                        <div className="text-sm leading-none">
                          {new Date(tanggal + "T00:00:00").getDate()}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="border-b border-zinc-200 text-xs">
                    {groupedAbsensi.dateRange.map((tanggal) => (
                      <TableHead
                        key={tanggal}
                        colSpan={2}
                        className="border-r px-2 py-2 text-center font-bold text-zinc-700"
                      >
                        <div className="text-xs font-bold">
                          {getDayName(tanggal)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="border-b border-zinc-200 text-xs tracking-wider uppercase">
                    {groupedAbsensi.dateRange.map((tanggal) => (
                      <React.Fragment key={tanggal}>
                        <TableHead
                          key={tanggal + "-masuk"}
                          className="border-r px-2 py-2 font-bold text-zinc-700"
                        >
                          Masuk
                        </TableHead>
                        <TableHead
                          key={tanggal + "-keluar"}
                          className="border-r px-2 py-2 font-bold text-zinc-700"
                        >
                          Keluar
                        </TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedAbsensi.grouped.length > 0 ? (
                    groupedAbsensi.grouped.map((group, idx) => {
                      const firstRecord =
                        group.absensi[groupedAbsensi.dateRange[0]]
                      const recordId = firstRecord?.id
                      return (
                        <TableRow
                          key={group.karyawan_nip}
                          className="border-b border-zinc-100 hover:bg-zinc-50/80"
                        >
                          <TableCell className="border-r px-4 py-3 font-bold text-zinc-500">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3">
                            <div className="font-bold text-zinc-900">
                              {group.nama}
                            </div>
                          </TableCell>
                          <TableCell className="border-r px-4 py-3 font-mono text-zinc-600">
                            {group.nip}
                          </TableCell>
                          <TableCell className="border-r px-4 py-3 text-zinc-600">
                            {group.divisi}
                          </TableCell>
                          {groupedAbsensi.dateRange.map((tanggal) => {
                            const data = group.absensi[tanggal]
                            return (
                              <React.Fragment key={tanggal}>
                                <TableCell className="border-r px-2 py-3 font-mono text-zinc-600">
                                  {data?.jam_masuk || "-"}
                                </TableCell>
                                <TableCell className="border-r px-2 py-3 font-mono text-zinc-600">
                                  {data?.jam_keluar || "-"}
                                </TableCell>
                              </React.Fragment>
                            )
                          })}
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4 + groupedAbsensi.dateRange.length * 2}
                        className="py-16 text-center text-zinc-400 italic"
                      >
                        {isFiltering
                          ? "Data absensi tidak ditemukan untuk filter yang dipilih."
                          : "Belum ada absensi hari ini."}
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
        <DialogContent
          style={{ width: "95vw", maxWidth: "95vw" }}
          className="rounded-sm border-none shadow-2xl [&>button]:hidden"
        >
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
            className="max-h-[75vh] space-y-4 overflow-y-auto px-2"
          >
            {editMode ? (
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
                    disabled
                  >
                    <SelectTrigger
                      className="h-9 w-full rounded-sm border-zinc-300 text-xs"
                      disabled
                    >
                      {formData.karyawan_nip ? (
                        <span className="text-xs">{formData.nama}</span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          Pilih Karyawan
                        </span>
                      )}
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
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase">
                    Status *
                  </Label>
                  <Select
                    value={
                      formData.status_id
                        ? String(formData.status_id)
                        : undefined
                    }
                    onValueChange={(val) =>
                      setFormData({ ...formData, status_id: Number(val) })
                    }
                  >
                    <SelectTrigger className="h-9 w-full rounded-sm border-zinc-300 text-xs">
                      {formData.status_id ? (
                        <span className="text-xs">
                          {
                            statusList.find((s) => s.id === formData.status_id)
                              ?.nama_status
                          }
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          Pilih Status
                        </span>
                      )}
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
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase">
                      Tanggal *
                    </Label>
                    <Input
                      type="date"
                      required
                      value={batchDate}
                      onChange={handleBatchDateChange}
                      className="h-9 rounded-sm border-zinc-300 text-xs"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-sm border border-zinc-200">
                  <Table>
                    <TableHeader className="bg-zinc-100/80">
                      <TableRow className="border-b border-zinc-200 text-[11px] tracking-wider uppercase">
                        <TableHead className="w-10 border-r px-2 py-2 font-bold text-zinc-700">
                          No
                        </TableHead>
                        <TableHead className="border-r px-2 py-2 font-bold text-zinc-700">
                          Nama Karyawan
                        </TableHead>
                        <TableHead className="w-28 border-r px-2 py-2 font-bold text-zinc-700">
                          Jam Masuk
                        </TableHead>
                        <TableHead className="w-28 border-r px-2 py-2 font-bold text-zinc-700">
                          Jam Keluar
                        </TableHead>
                        <TableHead className="w-32 border-r px-2 py-2 font-bold text-zinc-700">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchEntries.map((entry, idx) => (
                        <TableRow
                          key={entry.karyawan_nip}
                          className={`border-b text-xs ${entry.existingId != null ? "bg-blue-50/40" : "border-zinc-100"}`}
                        >
                          <TableCell className="border-r px-2 py-2 text-center font-bold text-zinc-500">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="border-r px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-bold text-zinc-900">
                                  {entry.nama}
                                </div>
                                <div className="font-mono text-[10px] text-zinc-400">
                                  NIP: {entry.karyawan_nip}
                                </div>
                              </div>
                              {entry.existingId != null && (
                                <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                                  Update
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border-r px-2 py-2">
                            <Input
                              type="time"
                              value={entry.jam_masuk}
                              onChange={(e) => {
                                const newEntries = [...batchEntries]
                                newEntries[idx] = {
                                  ...newEntries[idx],
                                  jam_masuk: e.target.value,
                                }
                                setBatchEntries(newEntries)
                              }}
                              className="h-8 rounded-sm border-zinc-300 text-xs"
                            />
                          </TableCell>
                          <TableCell className="border-r px-2 py-2">
                            <Input
                              type="time"
                              value={entry.jam_keluar}
                              onChange={(e) => {
                                const newEntries = [...batchEntries]
                                newEntries[idx] = {
                                  ...newEntries[idx],
                                  jam_keluar: e.target.value,
                                }
                                setBatchEntries(newEntries)
                              }}
                              className="h-8 rounded-sm border-zinc-300 text-xs"
                            />
                          </TableCell>
                          <TableCell className="border-r px-2 py-2">
                            <Select
                              value={
                                entry.status_id
                                  ? String(entry.status_id)
                                  : undefined
                              }
                              onValueChange={(val) => {
                                const newEntries = [...batchEntries]
                                newEntries[idx] = {
                                  ...newEntries[idx],
                                  status_id: Number(val),
                                }
                                setBatchEntries(newEntries)
                              }}
                            >
                              <SelectTrigger className="h-8 w-full rounded-sm border-zinc-300 text-xs">
                                <span className="text-xs">
                                  {entry.status_id
                                    ? statusList.find(
                                        (s) => s.id === entry.status_id
                                      )?.nama_status || "Pilih Status"
                                    : "Pilih Status"}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {statusList.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.nama_status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

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
                    : `Simpan Semua (${batchEntries.filter((e) => e.status_id > 0).length})`}
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
