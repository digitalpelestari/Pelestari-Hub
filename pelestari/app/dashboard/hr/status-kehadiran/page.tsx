"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  FilterX,
  UserCheck,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  getStatusKehadiranList,
  createStatusKehadiran,
  updateStatusKehadiran,
  deleteStatusKehadiran,
  StatusKehadiranData,
  CreateStatusKehadiranPayload,
  UpdateStatusKehadiranPayload,
} from "@/app/actions/status-kehadiran"
import { swal } from "@/lib/sweetalert"

const initialForm: CreateStatusKehadiranPayload = {
  nama_status: "",
  warna_kolom: "#6b7280",
}

export default function StatusKehadiranPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusList, setStatusList] = useState<StatusKehadiranData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedStatus, setSelectedStatus] =
    useState<StatusKehadiranData | null>(null)
  const [formData, setFormData] =
    useState<CreateStatusKehadiranPayload>(initialForm)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getStatusKehadiranList(
        searchQuery || undefined,
        currentPage,
        pageSize
      )
      if (res.success && res.data) {
        setStatusList(res.data)
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages)
          setTotalItems(res.pagination.total)
        }
      } else {
        setStatusList([])
        setTotalPages(1)
        setTotalItems(0)
      }
    } catch (err) {
      console.error("Gagal mengambil data status kehadiran:", err)
      setStatusList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [searchQuery, currentPage, pageSize])

  const handleOpenForm = (item?: StatusKehadiranData) => {
    if (item) {
      setEditMode(true)
      setSelectedStatus(item)
      setFormData({
        nama_status: item.nama_status,
        warna_kolom: item.warna_kolom,
      })
    } else {
      setEditMode(false)
      setSelectedStatus(null)
      setFormData(initialForm)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editMode && selectedStatus) {
        const payload: UpdateStatusKehadiranPayload = {
          nama_status: formData.nama_status,
          warna_kolom: formData.warna_kolom,
        }
        const res = await updateStatusKehadiran(selectedStatus.id, payload)
        if (!res.success) throw new Error(res.message)
        swal.success("Status kehadiran berhasil diperbarui")
      } else {
        const payload: CreateStatusKehadiranPayload = {
          nama_status: formData.nama_status,
          warna_kolom: formData.warna_kolom,
        }
        const res = await createStatusKehadiran(payload)
        if (!res.success) throw new Error(res.message)
        swal.success("Status kehadiran berhasil ditambahkan")
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
    if (!(await swal.confirm("Hapus status kehadiran ini?"))) return
    try {
      const res = await deleteStatusKehadiran(id)
      if (!res.success) throw new Error(res.message)
      await fetchData()
      swal.success("Status kehadiran berhasil dihapus")
    } catch (err: any) {
      swal.error(err.message || "Gagal menghapus status kehadiran")
    }
  }

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <UserCheck className="h-6 w-6 text-blue-600" /> Status Kehadiran
          </h1>
          <p className="text-xs text-zinc-500">
            Kelola master data status kehadiran karyawan.
          </p>
        </div>
        <Button
          onClick={() => handleOpenForm()}
          className="h-9 rounded-sm bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Status
        </Button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              Total Status Kehadiran
            </CardTitle>
            <UserCheck className="h-4 w-4 text-zinc-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-zinc-900">
              {totalItems}
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
                placeholder="Cari nama status..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setCurrentPage(1)
                }}
                className="h-9 rounded-sm border border-dashed border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                <FilterX className="mr-2 h-3.5 w-3.5" /> Reset
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
                      Nama Status
                    </TableHead>
                    <TableHead className="text-center font-bold text-zinc-700">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusList.length > 0 ? (
                    statusList.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        className="border-b border-zinc-100 hover:bg-zinc-50/80"
                      >
                        <TableCell className="border-r px-4 py-3 font-bold text-zinc-500">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </TableCell>
                        <TableCell className="border-r px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-zinc-200"
                              style={{ backgroundColor: s.warna_kolom }}
                            />
                            <div className="font-bold text-zinc-900">
                              {s.nama_status}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-amber-50 hover:text-amber-600"
                              onClick={() => handleOpenForm(s)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDelete(s.id)}
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
                        colSpan={4}
                        className="py-16 text-center text-zinc-400 italic"
                      >
                        Data status kehadiran tidak ditemukan di database.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PAGINATION */}
      {!loading && statusList.length > 0 && (
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
          <div className="text-xs text-zinc-500">
            Menampilkan {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, totalItems)} dari {totalItems}{" "}
            data
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-sm border-zinc-300 text-xs"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-bold text-zinc-700">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-sm border-zinc-300 text-xs"
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* MODAL FORM (TAMBAH / EDIT) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-xl rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              {editMode ? "Edit Status Kehadiran" : "Tambah Status Kehadiran"}
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
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase">
                Nama Status *
              </Label>
              <Input
                required
                value={formData.nama_status}
                onChange={(e) =>
                  setFormData({ ...formData, nama_status: e.target.value })
                }
                placeholder="Contoh: Hadir, Sakit, Izin, Alpha"
                className="h-9 rounded-sm border-zinc-300 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase">
                Warna Kolom
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={formData.warna_kolom}
                  onChange={(e) =>
                    setFormData({ ...formData, warna_kolom: e.target.value })
                  }
                  className="h-9 w-16 rounded-sm border-zinc-300 p-1 text-xs"
                />
                <span className="font-mono text-xs text-zinc-500">
                  {formData.warna_kolom}
                </span>
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
    </div>
  )
}
