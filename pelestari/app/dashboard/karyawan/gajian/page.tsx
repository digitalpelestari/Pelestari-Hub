"use client"

import React, { useState, useMemo } from "react"
import {
  Search,
  Eye,
  Printer,
  FileText,
  Download,
  Calendar,
  FilterX,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
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

interface GajiItem {
  id: number
  bulan: string
  tahun: string
  gajiPokok: number
  tunjangan: number
  potongan: number
  status: string
  tanggalBayar: string
}

// Data identitas karyawan yang sedang login (nantinya bisa diganti fetch dari session/API)
const karyawan = {
  nama: "Ahmad Rizki",
  jabatan: "Staff Finance",
}

export default function GajianPage() {
  const [loading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterBulan, setFilterBulan] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGaji, setSelectedGaji] = useState<GajiItem | null>(null)

  // Riwayat gaji milik karyawan ini saja
  const [gajiList] = useState<GajiItem[]>([
    {
      id: 1,
      bulan: "Juli",
      tahun: "2025",
      gajiPokok: 5000000,
      tunjangan: 1000000,
      potongan: 350000,
      status: "Sudah Dibayar",
      tanggalBayar: "2025-07-30",
    },
    {
      id: 2,
      bulan: "Agustus",
      tahun: "2025",
      gajiPokok: 5000000,
      tunjangan: 1000000,
      potongan: 350000,
      status: "Sudah Dibayar",
      tanggalBayar: "2025-08-30",
    },
    {
      id: 3,
      bulan: "September",
      tahun: "2025",
      gajiPokok: 5000000,
      tunjangan: 1100000,
      potongan: 350000,
      status: "Menunggu",
      tanggalBayar: "",
    },
  ])

  const filteredData = useMemo(() => {
    return gajiList.filter((g) => {
      const matchesSearch = `${g.bulan} ${g.tahun}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesBulan = filterBulan === "ALL" || g.bulan === filterBulan
      const matchesStatus = filterStatus === "ALL" || g.status === filterStatus
      return matchesSearch && matchesBulan && matchesStatus
    })
  }, [gajiList, searchQuery, filterBulan, filterStatus])

  const ringkasan = useMemo(() => {
    let totalGajiPokok = 0
    let totalTunjangan = 0
    let totalPotongan = 0
    filteredData.forEach((g) => {
      totalGajiPokok += g.gajiPokok
      totalTunjangan += g.tunjangan
      totalPotongan += g.potongan
    })
    return { totalGajiPokok, totalTunjangan, totalPotongan }
  }, [filteredData])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleViewDetail = (gaji: GajiItem) => {
    setSelectedGaji(gaji)
    setIsDetailOpen(true)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setFilterBulan("ALL")
    setFilterStatus("ALL")
  }

  const bulanList = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Sudah Dibayar":
        return (
          <Badge className="border border-emerald-200 bg-emerald-50 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Sudah Dibayar
          </Badge>
        )
      case "Belum Dibayar":
        return (
          <Badge className="border border-rose-200 bg-rose-50 text-[10px] font-bold tracking-wider text-rose-700 uppercase">
            <AlertCircle className="mr-1 h-3 w-3" /> Belum Dibayar
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

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-black uppercase">
            <FileText className="h-6 w-6 text-blue-600" /> Riwayat Gaji
          </h1>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {karyawan.nama} &middot; {karyawan.jabatan}
          </p>
        </div>
      </div>

      {/* RINGKASAN KEUANGAN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Gaji Pokok
            </CardTitle>
            <div className="rounded-sm bg-zinc-100 p-1.5">
              <FileText className="h-4 w-4 text-zinc-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-zinc-900">
              {formatIDR(ringkasan.totalGajiPokok)}
            </div>
            <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
              Akumulasi gaji pokok
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Tunjangan
            </CardTitle>
            <div className="rounded-sm bg-emerald-100 p-1.5">
              <Download className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-emerald-700">
              {formatIDR(ringkasan.totalTunjangan)}
            </div>
            <p className="mt-1 text-[9px] font-bold text-emerald-600/80 uppercase">
              Total uang tunjangan
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-zinc-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Total Potongan
            </CardTitle>
            <div className="rounded-sm bg-rose-100 p-1.5">
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-black text-rose-600">
              {formatIDR(ringkasan.totalPotongan)}
            </div>
            <p className="mt-1 text-[9px] font-bold text-rose-500 uppercase">
              Total potongan gaji
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
                placeholder="Cari periode (mis. Juli 2025)..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={filterBulan}
              onValueChange={(val) => setFilterBulan(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[140px] rounded-sm border-zinc-200 bg-white text-xs font-semibold focus:ring-1 focus:ring-black">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  <SelectValue placeholder="Bulan" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Bulan</SelectItem>
                {bulanList.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                <SelectItem value="Sudah Dibayar" className="text-emerald-600">
                  Sudah Dibayar
                </SelectItem>
                <SelectItem value="Belum Dibayar" className="text-rose-600">
                  Belum Dibayar
                </SelectItem>
                <SelectItem value="Menunggu" className="text-amber-600">
                  Menunggu
                </SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery ||
              filterBulan !== "ALL" ||
              filterStatus !== "ALL") && (
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
              <p className="italic">Mengambil data dari database...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-100/80">
                  <TableRow className="border-b border-zinc-200 text-xs tracking-wider uppercase">
                    <TableHead className="border-r px-6 py-4 font-bold text-zinc-700">
                      No
                    </TableHead>
                    <TableHead className="border-r text-center font-bold text-zinc-700">
                      Periode
                    </TableHead>
                    <TableHead className="border-r text-right font-bold text-zinc-700">
                      Gaji Pokok
                    </TableHead>
                    <TableHead className="border-r text-right font-bold text-zinc-700">
                      Tunjangan
                    </TableHead>
                    <TableHead className="border-r text-right font-bold text-zinc-700">
                      Potongan
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
                    filteredData.map((g, idx) => (
                      <TableRow
                        key={g.id}
                        className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      >
                        <TableCell className="border-r px-6 py-4 font-bold text-zinc-500">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-center font-bold text-zinc-900">
                          {g.bulan} {g.tahun}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-zinc-900">
                          {formatIDR(g.gajiPokok)}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-emerald-700">
                          {formatIDR(g.tunjangan)}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-rose-600">
                          {formatIDR(g.potongan)}
                        </TableCell>
                        <TableCell className="border-r px-6 py-4 text-center">
                          {getStatusBadge(g.status)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                              title="Detail"
                              onClick={() => handleViewDetail(g)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                              title="Print Slip"
                              onClick={() =>
                                alert(
                                  "Mencetak slip gaji: " +
                                    g.bulan +
                                    " " +
                                    g.tahun
                                )
                              }
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-24 text-center font-sans text-zinc-400 italic"
                      >
                        Tidak ada data gaji yang ditemukan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DETAIL GAJI */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-full max-w-lg rounded-sm border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="-mx-6 -mt-6 mb-4 flex flex-row items-center justify-between bg-zinc-900 px-6 py-3 text-white">
            <DialogTitle className="text-xs font-bold tracking-wider uppercase">
              Detail Slip Gaji
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          {selectedGaji && (
            <div className="space-y-4 px-1">
              <div className="space-y-2 rounded-sm border border-zinc-200 bg-zinc-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Nama
                  </span>
                  <span className="font-bold text-zinc-900">
                    {karyawan.nama}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Jabatan
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {karyawan.jabatan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Periode
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {selectedGaji.bulan} {selectedGaji.tahun}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Status
                  </span>
                  <span>{getStatusBadge(selectedGaji.status)}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-sm border border-zinc-300 text-xs">
                <div className="flex justify-between border-b border-zinc-200 bg-zinc-50/50 p-2.5">
                  <span className="font-bold text-zinc-600">Gaji Pokok</span>
                  <span className="font-semibold text-zinc-900">
                    {formatIDR(selectedGaji.gajiPokok)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 bg-zinc-50/50 p-2.5">
                  <span className="font-bold text-zinc-600">Tunjangan</span>
                  <span className="font-semibold text-emerald-700">
                    {formatIDR(selectedGaji.tunjangan)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="font-bold text-zinc-600">Potongan</span>
                  <span className="font-semibold text-rose-600">
                    {formatIDR(selectedGaji.potongan)}
                  </span>
                </div>
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