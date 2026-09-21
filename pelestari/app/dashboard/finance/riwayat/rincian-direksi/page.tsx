"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  RefreshCw,
  FileText,
  Wallet,
  CreditCard,
  Users,
  AlertCircle,
  FilterX,
  Calendar,
  CheckCircle2,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {
  createRincianDireksi,
  getRincianDireksi,
  updateRincianDireksi,
  deleteRincianDireksi,
} from "@/app/actions/rincian-direksi"
import Swal from "sweetalert2"

interface RincianDireksi {
  id: number
  nomer_register: string
  tanggal: string
  transfer_bank: string | null
  rekening: string | null
  user: string | null
  approval: string | null
  kelompok_biaya: string | null
  jenis_biaya: string | null
  keterangan: string | null
  penerima: string | null
  kredit: number
  total: number
}

interface FormData {
  nomerRegister: string
  tanggal: string
  transferBank: string
  rekening: string
  user: string
  approval: string
  kelompokBiaya: string
  jenisBiaya: string
  keterangan: string
  penerima: string
  kredit: string
  total: string
}

const initialForm: FormData = {
  nomerRegister: "",
  tanggal: "",
  transferBank: "",
  rekening: "",
  user: "",
  approval: "",
  kelompokBiaya: "",
  jenisBiaya: "",
  keterangan: "",
  penerima: "",
  kredit: "",
  total: "",
}

function formatRupiah(value: number | string | null | undefined) {
  const number = Number(value || 0)

  return `Rp ${number.toLocaleString("id-ID")}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"

  const stringValue = String(value)

  // Jika sudah YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    const [year, month, day] = stringValue.split("-")

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, Number(day)))
  }

  const date = new Date(stringValue)

  if (Number.isNaN(date.getTime())) return stringValue

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatDateForInput(value: string | null | undefined) {
  if (!value) return ""

  const stringValue = String(value)

  // Sudah sesuai format input date
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue
  }

  // Format datetime SQL
  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.substring(0, 10)
  }

  // Format ISO
  if (stringValue.includes("T")) {
    return stringValue.substring(0, 10)
  }

  return ""
}

function getTodayLocal() {
  const date = new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export default function RincianDireksiPage() {
  const [data, setData] = useState<RincianDireksi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [form, setForm] = useState<FormData>(initialForm)

  async function loadData() {
    setLoading(true)

    try {
      const result = await getRincianDireksi()

      if (result.success) {
        setData(result.data as RincianDireksi[])
      } else {
        alert(result.message || "Gagal mengambil data.")
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan saat mengambil data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim()

    return data.filter((item) => {
      const matchesSearch =
        !keyword ||
        [
          item.nomer_register,
          item.transfer_bank,
          item.rekening,
          item.user,
          item.approval,
          item.kelompok_biaya,
          item.jenis_biaya,
          item.keterangan,
          item.penerima,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))

      let matchesDateRange = true

      if (item.tanggal) {
        const dateString = String(item.tanggal).substring(0, 10)

        if (startDate && dateString < startDate) {
          matchesDateRange = false
        }

        if (endDate && dateString > endDate) {
          matchesDateRange = false
        }
      } else if (startDate || endDate) {
        matchesDateRange = false
      }

      return matchesSearch && matchesDateRange
    })
  }, [data, search, startDate, endDate])

  const totalKredit = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + Number(item.kredit || 0), 0)
  }, [filteredData])

  const totalNominal = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + Number(item.total || 0), 0)
  }, [filteredData])

  function openCreateModal() {
    setEditingId(null)

    setForm({
      ...initialForm,
      tanggal: getTodayLocal(),
    })

    setShowModal(true)
  }

  function openEditModal(item: RincianDireksi) {
    setEditingId(item.id)

    setForm({
      nomerRegister: item.nomer_register || "",
      tanggal: formatDateForInput(item.tanggal),
      transferBank: item.transfer_bank || "",
      rekening: item.rekening || "",
      user: item.user || "",
      approval: item.approval || "",
      kelompokBiaya: item.kelompok_biaya || "",
      jenisBiaya: item.jenis_biaya || "",
      keterangan: item.keterangan || "",
      penerima: item.penerima || "",
      kredit: String(item.kredit ?? ""),
      total: String(item.total ?? ""),
    })

    setShowModal(true)
  }

  function closeModal() {
    if (saving) return

    setShowModal(false)
    setEditingId(null)
    setForm(initialForm)
  }

  function updateForm(field: keyof FormData, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.nomerRegister.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Data Belum Lengkap",
        text: "Nomor register wajib diisi.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
      })
      return
    }

    if (!form.tanggal) {
      await Swal.fire({
        icon: "warning",
        title: "Data Belum Lengkap",
        text: "Tanggal wajib diisi.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
      })
      return
    }

    setSaving(true)

    const payload = {
      nomerRegister: form.nomerRegister.trim(),
      tanggal: form.tanggal,
      transferBank: form.transferBank.trim() || undefined,
      rekening: form.rekening.trim() || undefined,
      user: form.user.trim() || undefined,
      approval: form.approval.trim() || undefined,
      kelompokBiaya: form.kelompokBiaya.trim() || undefined,
      jenisBiaya: form.jenisBiaya.trim() || undefined,
      keterangan: form.keterangan.trim() || undefined,
      penerima: form.penerima.trim() || undefined,
      kredit: Number(form.kredit || 0),
      total: Number(form.total || 0),
    }

    try {
      const result =
        editingId !== null
          ? await updateRincianDireksi(editingId, payload)
          : await createRincianDireksi(payload)

      if (!result.success) {
        await Swal.fire({
          icon: "error",
          title: "Gagal",
          text: result.message || "Gagal menyimpan data.",
          confirmButtonText: "OK",
          confirmButtonColor: "#16a34a",
        })
        return
      }

      closeModal()

      await Swal.fire({
        icon: "success",
        title:
          editingId !== null ? "Berhasil Diperbarui" : "Berhasil Ditambahkan",
        text:
          result.message ||
          (editingId !== null
            ? "Rincian direksi berhasil diperbarui."
            : "Rincian direksi berhasil ditambahkan."),
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
        timer: 1800,
        timerProgressBar: true,
      })

      await loadData()
    } catch (error) {
      console.error(error)

      await Swal.fire({
        icon: "error",
        title: "Terjadi Kesalahan",
        text: "Terjadi kesalahan saat menyimpan data.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
      })
    } finally {
      setSaving(false)
    }
  }
  async function handleDelete(id: number) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus Data?",
      text: "Data rincian direksi yang dihapus tidak dapat dikembalikan.",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#71717a",
      reverseButtons: true,
    })

    if (!result.isConfirmed) return

    try {
      Swal.fire({
        title: "Menghapus...",
        text: "Mohon tunggu.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading()
        },
      })

      const deleteResult = await deleteRincianDireksi(id)

      if (!deleteResult.success) {
        await Swal.fire({
          icon: "error",
          title: "Gagal Menghapus",
          text: deleteResult.message || "Gagal menghapus data rincian direksi.",
          confirmButtonText: "OK",
          confirmButtonColor: "#16a34a",
        })
        return
      }

      setData((prev) => prev.filter((item) => item.id !== id))

      await Swal.fire({
        icon: "success",
        title: "Berhasil Dihapus",
        text: deleteResult.message || "Rincian direksi berhasil dihapus.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
        timer: 1800,
        timerProgressBar: true,
      })
    } catch (error) {
      console.error(error)

      await Swal.fire({
        icon: "error",
        title: "Terjadi Kesalahan",
        text: "Terjadi kesalahan saat menghapus data.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
      })
    }
  }

  function resetFilters() {
    setSearch("")
    setStartDate("")
    setEndDate("")
  }

  const hasFilter = Boolean(search || startDate || endDate)

  return (
    <div className="space-y-6 p-6">
      {/* ============================================================
          HEADER
      ============================================================ */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Rincian Direksi
            </h1>
          </div>

          <p className="pl-9 text-xs text-zinc-500">
            Kelola rincian transaksi dan biaya direksi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={loading}
            onClick={loadData}
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={openCreateModal}
            className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Tambah Data
          </Button>
        </div>
      </div>

      {/* ============================================================
          SUMMARY
      ============================================================ */}
      <div className="grid grid-cols-1 gap-4 font-sans md:grid-cols-3">
        {/* TOTAL DATA */}
        <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Data
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
                filteredData.length.toLocaleString("id-ID")
              )}
            </div>

            <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
              Jumlah rincian direksi
            </p>
          </CardContent>
        </Card>

        {/* TOTAL KREDIT */}
        <Card className="rounded-sm border border-emerald-200 bg-emerald-50/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-emerald-600 uppercase italic">
              Total Kredit
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
                formatRupiah(totalKredit)
              )}
            </div>

            <p className="mt-1 text-[9px] font-bold text-emerald-600/80 uppercase">
              Akumulasi nilai kredit
            </p>
          </CardContent>
        </Card>

        {/* TOTAL */}
        <Card className="rounded-sm border border-blue-200 bg-blue-50/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-blue-600 uppercase italic">
              Total Nominal
            </CardTitle>

            <div className="rounded-sm bg-blue-100 p-1.5">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="font-mono text-[16px] font-black text-blue-700">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
              ) : (
                formatRupiah(totalNominal)
              )}
            </div>

            <p className="mt-1 text-[9px] font-bold text-blue-600/80 uppercase">
              Akumulasi total transaksi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          FILTER + TABLE
      ============================================================ */}
      <Card className="overflow-hidden rounded-sm border-zinc-200 shadow-md">
        <CardHeader className="space-y-4 border-b bg-zinc-50/50 pb-4 font-sans">
          <div className="flex flex-wrap items-center gap-3">
            {/* SEARCH */}
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />

              <Input
                placeholder="Cari nomor register, penerima, biaya..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* DATE RANGE */}
            <div className="flex items-center gap-2 rounded-sm border border-zinc-200 bg-white p-1.5 shadow-sm">
              <div className="flex items-center gap-1 px-1 text-[10px] font-black tracking-wide text-zinc-400 uppercase">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                Dari:
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

            {/* RESET */}
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 rounded-sm border border-dashed border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                <FilterX className="mr-2 h-3.5 w-3.5" />
                Reset Filter
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
              <Table className="min-w-[1700px]">
                <TableHeader className="bg-zinc-100/80">
                  <TableRow className="border-b border-zinc-200 text-xs tracking-wider uppercase">
                    <TableHead className="w-[60px] border-r px-4 py-4 text-center font-bold text-zinc-700">
                      No
                    </TableHead>

                    <TableHead className="w-[160px] border-r px-4 py-4 font-bold text-zinc-700">
                      Nomor Register
                    </TableHead>

                    <TableHead className="w-[120px] border-r px-4 py-4 font-bold text-zinc-700">
                      Tanggal
                    </TableHead>

                    <TableHead className="w-[130px] border-r px-4 py-4 font-bold text-zinc-700">
                      Transfer Bank
                    </TableHead>

                    <TableHead className="w-[150px] border-r px-4 py-4 font-bold text-zinc-700">
                      Rekening
                    </TableHead>

                    <TableHead className="w-[130px] border-r px-4 py-4 font-bold text-zinc-700">
                      User
                    </TableHead>

                    <TableHead className="w-[130px] border-r px-4 py-4 font-bold text-zinc-700">
                      Approval
                    </TableHead>

                    <TableHead className="w-[160px] border-r px-4 py-4 font-bold text-zinc-700">
                      Kelompok Biaya
                    </TableHead>

                    <TableHead className="w-[160px] border-r px-4 py-4 font-bold text-zinc-700">
                      Jenis Biaya
                    </TableHead>

                    <TableHead className="w-[250px] border-r px-4 py-4 font-bold text-zinc-700">
                      Keterangan
                    </TableHead>

                    <TableHead className="w-[180px] border-r px-4 py-4 font-bold text-zinc-700">
                      Penerima
                    </TableHead>

                    <TableHead className="w-[150px] border-r px-4 py-4 text-right font-bold text-zinc-700">
                      Kredit
                    </TableHead>

                    <TableHead className="w-[150px] border-r px-4 py-4 text-right font-bold text-zinc-700">
                      Total
                    </TableHead>

                    <TableHead className="sticky right-0 z-20 w-[110px] bg-zinc-100 px-4 py-4 text-center font-bold text-zinc-700 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                      Opsi
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <TableRow
                        key={item.id}
                        className="group border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      >
                        {/* NO */}
                        <TableCell className="border-r px-4 py-5 text-center font-mono text-xs text-zinc-500">
                          {index + 1}
                        </TableCell>

                        {/* REGISTER */}
                        <TableCell className="border-r bg-blue-50/10 px-4 py-5 font-mono text-xs font-black text-blue-900">
                          {item.nomer_register}
                        </TableCell>

                        {/* TANGGAL */}
                        <TableCell className="border-r px-4 py-5 whitespace-nowrap">
                          <div className="flex w-fit items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-bold text-zinc-700">
                            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                            {formatDate(item.tanggal)}
                          </div>
                        </TableCell>

                        {/* TRANSFER BANK */}
                        <TableCell className="border-r px-4 py-5">
                          {item.transfer_bank || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* REKENING */}
                        <TableCell className="border-r px-4 py-5 font-mono text-xs">
                          {item.rekening || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* USER */}
                        <TableCell className="border-r px-4 py-5">
                          {item.user || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* APPROVAL */}
                        <TableCell className="border-r px-4 py-5">
                          {item.approval ? (
                            <Badge
                              variant="outline"
                              className="rounded-sm border-zinc-200 bg-white text-[9px] font-bold uppercase"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                              {item.approval}
                            </Badge>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* KELOMPOK BIAYA */}
                        <TableCell className="border-r px-4 py-5">
                          {item.kelompok_biaya || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* JENIS BIAYA */}
                        <TableCell className="border-r px-4 py-5">
                          {item.jenis_biaya || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* KETERANGAN */}
                        <TableCell className="max-w-[250px] border-r px-4 py-5">
                          <span
                            className="block truncate text-zinc-600"
                            title={item.keterangan || ""}
                          >
                            {item.keterangan || (
                              <span className="text-zinc-300">-</span>
                            )}
                          </span>
                        </TableCell>

                        {/* PENERIMA */}
                        <TableCell className="border-r px-4 py-5">
                          {item.penerima || (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>

                        {/* KREDIT */}
                        <TableCell className="border-r px-4 py-5 text-right">
                          <span className="font-mono text-[12px] font-black text-zinc-700">
                            {formatRupiah(item.kredit)}
                          </span>
                        </TableCell>

                        {/* TOTAL */}
                        <TableCell className="border-r px-4 py-5 text-right">
                          <span className="font-mono text-[12px] font-black text-zinc-900">
                            {formatRupiah(item.total)}
                          </span>
                        </TableCell>

                        {/* ACTION */}
                        <TableCell className="sticky right-0 z-10 bg-white px-4 py-5 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] group-hover:bg-zinc-50">
                          <div className="flex items-center justify-center gap-0.5 text-zinc-400">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-sm hover:bg-amber-50 hover:text-amber-600"
                              title="Edit"
                              onClick={() => openEditModal(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-sm hover:bg-red-50 hover:text-red-600"
                              title="Hapus"
                              onClick={() => handleDelete(item.id)}
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
                        colSpan={14}
                        className="py-24 text-center font-sans text-zinc-400 italic"
                      >
                        Tidak ada data rincian direksi yang ditemukan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <div className="flex justify-between px-2 text-[10px] text-zinc-400 italic">
        <p>
          * Menampilkan {filteredData.length} data rincian direksi dari database
          Pelestari.
        </p>

        <p>Last Sync: {new Date().toLocaleTimeString("id-ID")}</p>
      </div>

      {/* ============================================================
          MODAL
      ============================================================ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-sm bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="rounded-sm bg-zinc-900 p-1.5 text-white">
                    <FileText className="h-4 w-4" />
                  </div>

                  <h2 className="text-sm font-black tracking-tight text-zinc-900 uppercase">
                    {editingId !== null
                      ? "Edit Rincian Direksi"
                      : "Tambah Rincian Direksi"}
                  </h2>
                </div>

                <p className="mt-1 pl-8 text-[10px] text-zinc-400">
                  Lengkapi informasi transaksi dan biaya direksi.
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={closeModal}
                disabled={saving}
                className="h-8 w-8 rounded-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="max-h-[calc(90vh-80px)] overflow-y-auto"
            >
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                {/* NOMOR REGISTER */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Nomor Register *
                  </label>

                  <Input
                    value={form.nomerRegister}
                    onChange={(e) =>
                      updateForm("nomerRegister", e.target.value)
                    }
                    placeholder="Masukkan nomor register"
                    required
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* TANGGAL */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Tanggal *
                  </label>

                  <Input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => updateForm("tanggal", e.target.value)}
                    required
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* TRANSFER BANK */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Transfer Bank
                  </label>

                  <Input
                    value={form.transferBank}
                    onChange={(e) => updateForm("transferBank", e.target.value)}
                    placeholder="Contoh: BCA"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* REKENING */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Rekening
                  </label>

                  <Input
                    value={form.rekening}
                    onChange={(e) => updateForm("rekening", e.target.value)}
                    placeholder="Nomor rekening"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* USER */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    User
                  </label>

                  <Input
                    value={form.user}
                    onChange={(e) => updateForm("user", e.target.value)}
                    placeholder="Manajemen"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* APPROVAL */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Approval
                  </label>

                  <Input
                    value={form.approval}
                    onChange={(e) => updateForm("approval", e.target.value)}
                    placeholder="Manajer"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* KELOMPOK BIAYA */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Kelompok Biaya
                  </label>

                  <Input
                    value={form.kelompokBiaya}
                    onChange={(e) =>
                      updateForm("kelompokBiaya", e.target.value)
                    }
                    placeholder="Biaya Operasional Manajemen"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* JENIS BIAYA */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Jenis Biaya
                  </label>

                  <Input
                    value={form.jenisBiaya}
                    onChange={(e) => updateForm("jenisBiaya", e.target.value)}
                    placeholder="Operasional Manajemen"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* PENERIMA */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Penerima
                  </label>

                  <Input
                    value={form.penerima}
                    onChange={(e) => updateForm("penerima", e.target.value)}
                    placeholder="Nama penerima"
                    className="h-9 rounded-sm border-zinc-200 text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* KREDIT */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Kredit
                  </label>

                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={form.kredit}
                    onChange={(e) => updateForm("kredit", e.target.value)}
                    placeholder="0"
                    className="h-9 rounded-sm border-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* TOTAL */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Total
                  </label>

                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={form.total}
                    onChange={(e) => updateForm("total", e.target.value)}
                    placeholder="0"
                    className="h-9 rounded-sm border-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>

                {/* KETERANGAN */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                    Keterangan
                  </label>

                  <textarea
                    value={form.keterangan}
                    onChange={(e) => updateForm("keterangan", e.target.value)}
                    placeholder="Masukkan keterangan..."
                    rows={4}
                    className="flex w-full resize-none rounded-sm border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm outline-none placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-black"
                  />
                </div>
              </div>

              {/* ACTION */}
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-9 rounded-sm border-zinc-200 bg-white px-4 text-xs font-semibold"
                >
                  Batal
                </Button>

                <Button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-sm bg-zinc-900 px-5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}

                  {editingId !== null ? "Simpan Perubahan" : "Simpan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
