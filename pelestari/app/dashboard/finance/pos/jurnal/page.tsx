"use client"

import React, { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
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
import { Badge } from "@/components/ui/badge"

import {
  Plus,
  Search,
  Calendar,
  Landmark,
  Hash,
  Bookmark,
  User,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
  Trash2,
  FileText,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import {
  getJurnalList,
  updateJurnalItem,
  deleteJurnalByHeader,
  exportJurnalToExcel,
  generateNoRegistrasiOtomatis,
} from "@/app/actions/jurnal"
import { getAkunList } from "@/app/actions/akun"
import Link from "next/link"
import { swal } from "@/lib/sweetalert"

export default function JurnalUmumListPage() {
  const pathname = usePathname()
  const [jurnalList, setJurnalList] = useState<any[]>([])
  const [akunList, setAkunList] = useState<any[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const pageSizeOptions = [10, 20, 50, 100, 200]
  const [totalPages, setTotalPages] = useState(0)
  const [totalData, setTotalData] = useState(0)
  const [totalAccumulasi, setTotalAccumulasi] = useState({
    debit: 0,
    kredit: 0,
    isBalanced: false,
  })

  const [editingJurnalId, setEditingJurnalId] = useState<number | null>(null)
  const [editHeaderForm, setEditHeaderForm] = useState<any>({})
  const [editItemsForm, setEditItemsForm] = useState<any[]>([])
  const totalItems = totalData
  const totalPagesSafe = Math.max(1, totalPages)

  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, totalItems)

  const requestIdRef = useRef(0)

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPagesSafe) return
    setCurrentPage(page)
  }

  const pageNumbers = React.useMemo(() => {
    const pages: (number | "...")[] = []
    const delta = 1

    for (let i = 1; i <= totalPagesSafe; i++) {
      if (
        i === 1 ||
        i === totalPagesSafe ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...")
      }
    }

    return pages
  }, [totalPagesSafe, currentPage])

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
      setCurrentPage(1)
    }, 400)

    return () => clearTimeout(handler)
  }, [searchInput])

  const loadData = async () => {
    const thisRequestId = ++requestIdRef.current
    setLoading(true)

    try {
      const startParam = startDate || undefined
      const endParam = endDate || undefined

      const dataJurnal = await getJurnalList(
        startParam,
        endParam,
        currentPage,
        pageSize,
        searchQuery
      )
      const dataAkun = await getAkunList()

      if (thisRequestId !== requestIdRef.current) {
        return
      }

      if (!dataJurnal.success) {
        throw new Error(dataJurnal.message || "Gagal mengambil data jurnal")
      }

      setJurnalList(dataJurnal.data || [])
      setTotalPages(dataJurnal.pagination?.totalPages || 0)
      setTotalData(dataJurnal.pagination?.total || 0)
      setTotalAccumulasi({
        debit: Number(dataJurnal.summary?.totalDebit || 0),
        kredit: Number(dataJurnal.summary?.totalKredit || 0),
        isBalanced: dataJurnal.summary?.isBalanced || false,
      })

      setAkunList(Array.isArray(dataAkun) ? dataAkun : dataAkun.data || [])
    } catch (error: any) {
      if (thisRequestId !== requestIdRef.current) {
        return
      }

      console.error("Gagal memuat data pembukuan:", error)
      setJurnalList([])
      setAkunList([])
      swal.error(error.message || "Gagal memuat data jurnal")
    } finally {
      if (thisRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate, currentPage, pageSize, searchQuery, pathname])

  const startEditJurnal = (jurnal: any) => {
    setEditingJurnalId(jurnal.id)
    setEditHeaderForm({
      tanggal: jurnal.tanggal
        ? new Date(jurnal.tanggal).toISOString().split("T")[0]
        : "",
      no_registrasi: jurnal.no_registrasi || "",
      no_referensi: jurnal.no_referensi || "",
      penerima: jurnal.penerima || "",
      keterangan: jurnal.keterangan || "",
    })
    setEditItemsForm(JSON.parse(JSON.stringify(jurnal.items || [])))
  }

  const cancelEditJurnal = () => {
    setEditingJurnalId(null)
    setEditHeaderForm({})
    setEditItemsForm([])
  }

  const handleHeaderChange = (field: string, value: string) => {
    setEditHeaderForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleChangePrefixEdit = async (type: "BD" | "BK") => {
    const res = await generateNoRegistrasiOtomatis(type)
    if (res.success && res.code) {
      setEditHeaderForm((prev: any) => ({ ...prev, no_registrasi: res.code }))
    }
  }

  const handleItemChange = (itemIndex: number, field: string, value: any) => {
    setEditItemsForm((prev) => {
      const updated = [...prev]
      updated[itemIndex] = { ...updated[itemIndex] }

      if (field === "no_akun") {
        updated[itemIndex].no_akun = value
        const targetAkun = akunList.find((a) => a.no_akun === value)
        updated[itemIndex].nama_akun = targetAkun ? targetAkun.nama_akun : ""
        updated[itemIndex].nama_kelompok = targetAkun
          ? targetAkun.kelompok_biaya || targetAkun.nama_kelompok || "General"
          : ""
      } else {
        updated[itemIndex][field] = value
      }

      return updated
    })
  }

  const saveEditJurnal = async (jurnalId: number) => {
    let totalDebitJurnal = 0
    let totalKreditJurnal = 0

    editItemsForm.forEach((item) => {
      totalDebitJurnal += Number(item.debit) || 0
      totalKreditJurnal += Number(item.kredit) || 0
    })

    if (totalDebitJurnal !== totalKreditJurnal) {
      swal.error(
        `Gagal Simpan: Transaksi Jurnal TIDAK BALANCE!\nTotal Debit: Rp ${totalDebitJurnal.toLocaleString("id-ID")}\nTotal Kredit: Rp ${totalKreditJurnal.toLocaleString("id-ID")}`
      )
      return
    }

    setLoading(true)
    try {
      for (const item of editItemsForm) {
        if (!item.id) {
          throw new Error("ID baris transaksi hilang.")
        }

        await updateJurnalItem(item.id, {
          jurnal_id: jurnalId,
          tanggal: editHeaderForm.tanggal,
          no_registrasi: editHeaderForm.no_registrasi,
          no_referensi: editHeaderForm.no_referensi,
          penerima: editHeaderForm.penerima,
          keterangan_umum: editHeaderForm.keterangan,
          no_akun: item.no_akun,
          debit: Number(item.debit) || 0,
          kredit: Number(item.kredit) || 0,
        })
      }

      swal.success("Perubahan seluruh kolom jurnal berhasil disimpan!")
      setEditingJurnalId(null)
      await loadData()
    } catch (err: any) {
      swal.error("Gagal menyimpan perubahan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveJurnalUtah = async (jurnalId: number, noRegis: string) => {
    if (
      !(await swal.confirm(
        `Apakah Anda yakin ingin menghapus seluruh transaksi No. Registrasi: ${noRegis}?`
      ))
    )
      return

    setLoading(true)
    const res = await deleteJurnalByHeader(jurnalId)
    if (res.success) {
      swal.success(res.message)
      await loadData()
    } else {
      swal.error("Gagal menghapus transaksi: " + res.message)
    }
    setLoading(false)
  }

  const handleDownloadExcel = async () => {
    setIsExporting(true)
    try {
      const startParam = startDate ? startDate : undefined
      const endParam = endDate ? endDate : undefined

      const res = await exportJurnalToExcel(startParam, endParam)
      if (!res.success || !res.base64) {
        swal.error(
          res.message || "Terjadi kesalahan sistem saat mengekspor data."
        )
        return
      }

      const byteCharacters = atob(res.base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = res.fileName || "Jurnal_Umum.xlsx"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      swal.error("Gagal mengunduh file Excel: " + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleResetFilterTanggal = () => {
    setStartDate("")
    setEndDate("")
  }

  return (
    <div className="min-h-screen w-full space-y-6 bg-zinc-50/50 p-6 font-sans text-zinc-900">
      {/* HEADER BAR UTAMA */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Jurnal Umum Pembukuan
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            Kelola, pantau, dan audit seluruh rekaman transaksi buku besar secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting || loading}
            variant="outline"
            className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            {isExporting ? "MENGONVERSI..." : "EKSPOR EXCEL"}
          </Button>

          <Link href="/dashboard/finance/pos/kasir">
            <Button className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
              <Plus className="h-4 w-4" /> BUAT JURNAL BARU
            </Button>
          </Link>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex w-full flex-col items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:flex-row">
        <div className="relative w-full md:w-80">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Cari No. Regis, Referensi, Penerima, atau Memo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 rounded-lg border-zinc-200 bg-zinc-50/50 pl-9 text-xs focus-visible:ring-1 focus-visible:ring-zinc-900"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">
              Dari:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="cursor-pointer bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>

          <span className="font-medium text-zinc-300">/</span>

          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">
              Sampai:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="cursor-pointer bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>

          {(startDate || endDate) && (
            <Button
              variant="ghost"
              onClick={handleResetFilterTanggal}
              className="h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* TABEL DATA JURNAL */}
      <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[1100px] border-collapse">
            <TableHeader className="border-b border-zinc-200 bg-zinc-50/70">
              <TableRow className="text-[11px] font-bold tracking-wider text-zinc-600 uppercase">
                <TableHead className="w-[110px] px-4 py-3.5">Tanggal</TableHead>
                <TableHead className="w-[160px] px-4 py-3.5">
                  No. Registrasi
                </TableHead>
                <TableHead className="w-[130px] px-4 py-3.5">
                  No. Referensi
                </TableHead>
                <TableHead className="w-[140px] px-4 py-3.5">
                  Penerima
                </TableHead>
                <TableHead className="w-[200px] px-4 py-3.5">
                  Keterangan (Memo)
                </TableHead>
                <TableHead className="w-[90px] px-4 py-3.5">Kode Akun</TableHead>
                <TableHead className="w-[150px] px-4 py-3.5">Nama Akun</TableHead>
                <TableHead className="w-[120px] px-4 py-3.5">Tipe Akun</TableHead>
                <TableHead className="w-[120px] px-4 py-3.5 text-right">
                  Debit (Rp)
                </TableHead>
                <TableHead className="w-[120px] px-4 py-3.5 text-right">
                  Kredit (Rp)
                </TableHead>
                <TableHead className="w-[90px] px-4 py-3.5 text-center">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-100 text-xs font-medium text-zinc-700">
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-40 text-center text-zinc-400 italic"
                  >
                    Memuat data transaksi dari server...
                  </TableCell>
                </TableRow>
              ) : jurnalList.length > 0 ? (
                jurnalList.map((jurnal) => {
                  const itemsArray = Array.isArray(jurnal.items)
                    ? jurnal.items
                    : []
                  const totalItems =
                    itemsArray.length > 0 ? itemsArray.length : 1
                  const isJurnalEditing = editingJurnalId === jurnal.id

                  const itemsToRender =
                    itemsArray.length > 0
                      ? itemsArray
                      : [
                          {
                            no_akun: "-",
                            nama_akun: "Detail kosong",
                            debit: 0,
                            kredit: 0,
                          },
                        ]

                  return itemsToRender.map((item: any, idx: number) => {
                    return (
                      <TableRow
                        key={`${jurnal.id}-${idx}`}
                        className="transition-colors hover:bg-zinc-50/60"
                      >
                        {idx === 0 && (
                          <>
                            {/* TANGGAL */}
                            <TableCell
                              rowSpan={totalItems}
                              className="border-r border-zinc-100 bg-zinc-50/30 px-4 py-4 align-top font-mono !text-sm text-zinc-600"
                            >
                              {isJurnalEditing ? (
                                <Input
                                  type="date"
                                  value={editHeaderForm.tanggal || ""}
                                  onChange={(e) =>
                                    handleHeaderChange("tanggal", e.target.value)
                                  }
                                  className="h-8 rounded-md border-zinc-300 bg-white font-mono !text-xs"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 !text-xs whitespace-nowrap">
                                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.tanggal
                                    ? new Date(jurnal.tanggal).toLocaleDateString("id-ID")
                                    : "-"}
                                </div>
                              )}
                            </TableCell>

                            {/* NO. REGISTRASI */}
                            <TableCell
                              rowSpan={totalItems}
                              className="border-r border-zinc-100 bg-zinc-50/30 px-4 py-4 align-top font-mono !text-sm font-semibold text-blue-600"
                            >
                              {isJurnalEditing ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleChangePrefixEdit("BD")}
                                      className="h-6 px-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                                      title="Generate BD Baru"
                                    >
                                      + BD
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleChangePrefixEdit("BK")}
                                      className="h-6 px-1.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                                      title="Generate BK Baru"
                                    >
                                      + BK
                                    </Button>
                                  </div>
                                  <Input
                                    type="text"
                                    placeholder="Ketik manual..."
                                    value={editHeaderForm.no_registrasi || ""}
                                    onChange={(e) =>
                                      handleHeaderChange(
                                        "no_registrasi",
                                        e.target.value
                                      )
                                    }
                                    className="h-8 rounded-md border-zinc-300 bg-white font-mono text-xs"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 !text-xs whitespace-nowrap">
                                  <Hash className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.no_registrasi || "-"}
                                </div>
                              )}
                            </TableCell>

                            {/* NO. REFERENSI */}
                            <TableCell
                              rowSpan={totalItems}
                              className="border-r border-zinc-100 bg-zinc-50/30 px-4 py-4 align-top font-mono text-emerald-600"
                            >
                              {isJurnalEditing ? (
                                <Input
                                  type="text"
                                  value={editHeaderForm.no_referensi || ""}
                                  onChange={(e) =>
                                    handleHeaderChange(
                                      "no_referensi",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 rounded-md border-zinc-300 bg-white font-mono !text-xs"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Bookmark className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.no_referensi || "-"}
                                </div>
                              )}
                            </TableCell>

                            {/* PENERIMA */}
                            <TableCell
                              rowSpan={totalItems}
                              className="border-r border-zinc-100 bg-zinc-50/30 px-4 py-4 align-top text-xs text-zinc-700"
                            >
                              {isJurnalEditing ? (
                                <Input
                                  type="text"
                                  placeholder="Nama Penerima..."
                                  value={editHeaderForm.penerima || ""}
                                  onChange={(e) =>
                                    handleHeaderChange(
                                      "penerima",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 rounded-md border-zinc-300 bg-white font-mono !text-xs"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                  <span className="font-semibold text-zinc-800 uppercase break-words">
                                    {jurnal.penerima || "-"}
                                  </span>
                                </div>
                              )}
                            </TableCell>

                            {/* KETERANGAN */}
                            <TableCell
                              rowSpan={totalItems}
                              className="w-[200px] max-w-[200px] min-w-0 border-r border-zinc-100 bg-zinc-50/30 px-4 py-4 align-top text-xs text-zinc-600"
                            >
                              {isJurnalEditing ? (
                                <Input
                                  type="text"
                                  value={editHeaderForm.keterangan || ""}
                                  onChange={(e) =>
                                    handleHeaderChange(
                                      "keterangan",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 rounded-md border-zinc-300 bg-white font-mono text-xs"
                                />
                              ) : (
                                <div className="flex w-full min-w-0 items-start gap-1.5">
                                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                  <span className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere] break-words whitespace-normal uppercase">
                                    {jurnal.keterangan || "-"}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                          </>
                        )}

                        {/* DETAIL BARIS AKUN */}
                        <TableCell className="border-r border-zinc-100 px-4 py-3 font-mono whitespace-nowrap text-zinc-600">
                          {isJurnalEditing ? (
                            <>
                              <Input
                                type="text"
                                list={`edit-coa-${jurnal.id}-${idx}`}
                                value={editItemsForm[idx]?.no_akun ?? ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "no_akun",
                                    e.target.value
                                  )
                                }
                                className="h-8 rounded-md border-zinc-300 bg-white font-mono !text-xs"
                              />
                              <datalist id={`edit-coa-${jurnal.id}-${idx}`}>
                                {akunList.map((a) => (
                                  <option key={a.id} value={a.no_akun}>
                                    {a.nama_akun}
                                  </option>
                                ))}
                              </datalist>
                            </>
                          ) : (
                            item.no_akun
                          )}
                        </TableCell>

                        <TableCell
                          className={`border-r border-zinc-100 px-4 py-3 font-medium uppercase ${
                            item.kredit > 0
                              ? "pl-8 text-zinc-500 italic"
                              : "text-zinc-900"
                          }`}
                        >
                          {isJurnalEditing ? (
                            <Input
                              readOnly
                              type="text"
                              value={editItemsForm[idx]?.nama_akun ?? ""}
                              className="h-8 cursor-not-allowed rounded-md border-zinc-200 bg-zinc-100 text-xs text-zinc-400 uppercase"
                            />
                          ) : (
                            item.nama_akun
                          )}
                        </TableCell>

                        <TableCell className="border-r border-zinc-100 px-4 py-3 whitespace-nowrap">
                          {isJurnalEditing ? (
                            <Input
                              readOnly
                              type="text"
                              value={
                                editItemsForm[idx]?.nama_kelompok ?? "General"
                              }
                              className="h-8 cursor-not-allowed rounded-md border-zinc-200 bg-zinc-100 text-xs text-zinc-400 uppercase"
                            />
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-md border-zinc-200 bg-zinc-50 px-2 py-0.5 !text-xs font-medium text-zinc-600"
                            >
                              {item.nama_kelompok || "General"}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="border-r border-zinc-100 px-4 py-3 text-right font-mono whitespace-nowrap text-zinc-900">
                          {isJurnalEditing ? (
                            <Input
                              type="number"
                              value={editItemsForm[idx]?.debit ?? 0}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "debit",
                                  Number(e.target.value)
                                )
                              }
                              className="h-8 rounded-md border-zinc-300 bg-white text-right font-mono !text-xs"
                            />
                          ) : item.debit > 0 ? (
                            new Intl.NumberFormat("id-ID", {
                              minimumFractionDigits: 2,
                            }).format(item.debit)
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell className="border-r border-zinc-100 px-4 py-3 text-right font-mono whitespace-nowrap text-zinc-900">
                          {isJurnalEditing ? (
                            <Input
                              type="number"
                              value={editItemsForm[idx]?.kredit ?? 0}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "kredit",
                                  Number(e.target.value)
                                )
                              }
                              className="h-8 rounded-md border-zinc-300 bg-white text-right font-mono !text-xs"
                            />
                          ) : item.kredit > 0 ? (
                            new Intl.NumberFormat("id-ID", {
                              minimumFractionDigits: 2,
                            }).format(item.kredit)
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        {idx === 0 && (
                          <TableCell
                            rowSpan={totalItems}
                            className="bg-zinc-50/30 px-3 py-3 text-center align-middle whitespace-nowrap"
                          >
                            {isJurnalEditing ? (
                              <div className="mx-auto flex w-24 flex-col gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => saveEditJurnal(jurnal.id)}
                                  disabled={loading}
                                  className="h-7 gap-1 rounded-md bg-emerald-600 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700"
                                >
                                  <Check className="h-3 w-3" /> SIMPAN
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditJurnal}
                                  disabled={loading}
                                  className="h-7 rounded-md text-[10px] font-bold text-zinc-500 hover:bg-zinc-200"
                                >
                                  Batal
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startEditJurnal(jurnal)}
                                  disabled={loading}
                                  className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                  title="Edit Jurnal"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    handleRemoveJurnalUtah(
                                      jurnal.id,
                                      jurnal.no_registrasi
                                    )
                                  }
                                  disabled={loading}
                                  className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                  title="Hapus Jurnal"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-32 text-center text-zinc-400 italic"
                  >
                    Tidak ada rekaman transaksi jurnal pada rentang waktu ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* PAGINATION */}
      {!loading && totalItems > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              Menampilkan{" "}
              <span className="font-semibold text-zinc-700">{startRow}</span>–
              <span className="font-semibold text-zinc-700">{endRow}</span> dari{" "}
              <span className="font-semibold text-zinc-700">{totalItems}</span>{" "}
              data
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                Baris:
              </span>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-8 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-xs text-zinc-400"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(p as number)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs ${
                    p === currentPage
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border-zinc-200 text-zinc-700"
                  }`}
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPagesSafe}
              className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(totalPagesSafe)}
              disabled={currentPage === totalPagesSafe}
              className="h-8 w-8 rounded-lg border-zinc-200 disabled:opacity-40"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* FOOTER SUMMARY */}
      {!loading && jurnalList.length > 0 && (
        <div className="flex w-full flex-col items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:flex-row">
          <div className="flex items-center gap-3">
            {totalAccumulasi.isBalanced ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold tracking-wide text-emerald-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> TOTAL
                BALANCE
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold tracking-wide text-rose-700">
                <AlertTriangle className="h-4 w-4 text-rose-600" /> TIDAK
                BALANCE
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-600">
            <div className="space-y-0.5 text-right">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase">
                Total Debit
              </p>
              <p className="font-mono text-sm font-bold text-zinc-900">
                Rp{" "}
                {new Intl.NumberFormat("id-ID", {
                  minimumFractionDigits: 2,
                }).format(totalAccumulasi.debit)}
              </p>
            </div>

            <div className="hidden h-8 w-px bg-zinc-200 sm:block"></div>

            <div className="space-y-0.5 text-right">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase">
                Total Kredit
              </p>
              <p className="font-mono text-sm font-bold text-zinc-900">
                Rp{" "}
                {new Intl.NumberFormat("id-ID", {
                  minimumFractionDigits: 2,
                }).format(totalAccumulasi.kredit)}
              </p>
            </div>

            {!totalAccumulasi.isBalanced && (
              <>
                <div className="hidden h-8 w-px bg-zinc-200 sm:block"></div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] font-semibold text-rose-500 uppercase">
                    Selisih (Variance)
                  </p>
                  <p className="font-mono text-sm font-bold text-rose-600">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID", {
                      minimumFractionDigits: 2,
                    }).format(
                      Math.abs(totalAccumulasi.debit - totalAccumulasi.kredit)
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}