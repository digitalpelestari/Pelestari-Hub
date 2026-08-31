"use client"

import React, { useMemo, useState } from "react"
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

interface Penghasilan {
  gajiPokok: number
  tunjanganJabatan: number
  tunjanganTransportTetap: number
  tunjanganPengabdian: number
  tunjanganTransportTidakTetap: number
  uangSaku: number
  lemburOvertime: number
  lainLain: number
  bpjsTkJht: number
}

interface Potongan {
  potonganAlphaIjin: number
  potonganUangTransport: number
  potonganUangSaku: number
  bpjsTkJhtPerusahaan: number
  bpjsTkJhtKaryawan: number
  pph21: number
  pinjamanLainnya: number
}

interface AbsensiCuti {
  sakit: number
  alpaIjin: number
  cutiTahunan: number
  cutiKhusus: number
  sisaCuti: number
  masaBerlakuCutiMulai: string | null
  masaBerlakuCutiSelesai: string | null
}

interface GajiItem {
  id: number
  nip: string

  tanggalMulai: string
  tanggalSelesai: string

  statusPembayaran: string
  tanggalPembayaran: string | null

  penghasilan: Penghasilan
  potongan: Potongan
  absensiCuti?: AbsensiCuti
}

const karyawan = {
  nama: "Ahmad Rizki",
  nip: "260201017",
  jabatan: "Staff Finance",
}

export default function GajianPage() {
  const [loading] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterBulan, setFilterBulan] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGaji, setSelectedGaji] = useState<GajiItem | null>(null)

  /*
   * DATA SEMENTARA
   * Nantinya diganti dengan data dari API.
   */
  const [gajiList] = useState<GajiItem[]>([
    {
      id: 1,
      nip: "260201017",

      tanggalMulai: "2026-06-26",
      tanggalSelesai: "2026-07-25",

      statusPembayaran: "sudah_dibayar",
      tanggalPembayaran: "2026-07-25",

      penghasilan: {
        gajiPokok: 5000000,
        tunjanganJabatan: 500000,
        tunjanganTransportTetap: 300000,
        tunjanganPengabdian: 100000,
        tunjanganTransportTidakTetap: 100000,
        uangSaku: 0,
        lemburOvertime: 200000,
        lainLain: 0,
        bpjsTkJht: 100000,
      },

      potongan: {
        potonganAlphaIjin: 0,
        potonganUangTransport: 50000,
        potonganUangSaku: 0,
        bpjsTkJhtPerusahaan: 100000,
        bpjsTkJhtKaryawan: 50000,
        pph21: 100000,
        pinjamanLainnya: 0,
      },

      absensiCuti: {
        sakit: 0,
        alpaIjin: 0,
        cutiTahunan: 1,
        cutiKhusus: 0,
        sisaCuti: 11,
        masaBerlakuCutiMulai: "2026-01-01",
        masaBerlakuCutiSelesai: "2026-12-31",
      },
    },

    {
      id: 2,
      nip: "260201017",

      tanggalMulai: "2026-07-26",
      tanggalSelesai: "2026-08-25",

      statusPembayaran: "sudah_dibayar",
      tanggalPembayaran: "2026-08-25",

      penghasilan: {
        gajiPokok: 5000000,
        tunjanganJabatan: 500000,
        tunjanganTransportTetap: 300000,
        tunjanganPengabdian: 100000,
        tunjanganTransportTidakTetap: 150000,
        uangSaku: 100000,
        lemburOvertime: 250000,
        lainLain: 0,
        bpjsTkJht: 100000,
      },

      potongan: {
        potonganAlphaIjin: 0,
        potonganUangTransport: 50000,
        potonganUangSaku: 0,
        bpjsTkJhtPerusahaan: 100000,
        bpjsTkJhtKaryawan: 50000,
        pph21: 100000,
        pinjamanLainnya: 250000,
      },

      absensiCuti: {
        sakit: 0,
        alpaIjin: 0,
        cutiTahunan: 0,
        cutiKhusus: 0,
        sisaCuti: 12,
        masaBerlakuCutiMulai: "2026-01-01",
        masaBerlakuCutiSelesai: "2026-12-31",
      },
    },

    {
      id: 3,
      nip: "260201017",

      tanggalMulai: "2026-08-26",
      tanggalSelesai: "2026-09-25",

      statusPembayaran: "menunggu",
      tanggalPembayaran: null,

      penghasilan: {
        gajiPokok: 5000000,
        tunjanganJabatan: 500000,
        tunjanganTransportTetap: 300000,
        tunjanganPengabdian: 100000,
        tunjanganTransportTidakTetap: 100000,
        uangSaku: 100000,
        lemburOvertime: 0,
        lainLain: 0,
        bpjsTkJht: 100000,
      },

      potongan: {
        potonganAlphaIjin: 0,
        potonganUangTransport: 0,
        potonganUangSaku: 0,
        bpjsTkJhtPerusahaan: 100000,
        bpjsTkJhtKaryawan: 50000,
        pph21: 100000,
        pinjamanLainnya: 250000,
      },

      absensiCuti: {
        sakit: 0,
        alpaIjin: 0,
        cutiTahunan: 0,
        cutiKhusus: 0,
        sisaCuti: 12,
        masaBerlakuCutiMulai: "2026-01-01",
        masaBerlakuCutiSelesai: "2026-12-31",
      },
    },
  ])

  const getTotalPenerimaan = (penghasilan: Penghasilan) => {
    return (
      penghasilan.gajiPokok +
      penghasilan.tunjanganJabatan +
      penghasilan.tunjanganTransportTetap +
      penghasilan.tunjanganPengabdian +
      penghasilan.tunjanganTransportTidakTetap +
      penghasilan.uangSaku +
      penghasilan.lemburOvertime +
      penghasilan.lainLain +
      penghasilan.bpjsTkJht
    )
  }

  const getTotalTunjangan = (penghasilan: Penghasilan) => {
    return (
      penghasilan.tunjanganJabatan +
      penghasilan.tunjanganTransportTetap +
      penghasilan.tunjanganPengabdian +
      penghasilan.tunjanganTransportTidakTetap +
      penghasilan.uangSaku +
      penghasilan.lemburOvertime +
      penghasilan.lainLain +
      penghasilan.bpjsTkJht
    )
  }

  const getTotalPotongan = (potongan: Potongan) => {
    return (
      potongan.potonganAlphaIjin +
      potongan.potonganUangTransport +
      potongan.potonganUangSaku +
      potongan.bpjsTkJhtPerusahaan +
      potongan.bpjsTkJhtKaryawan +
      potongan.pph21 +
      potongan.pinjamanLainnya
    )
  }

  const getJumlahDiterima = (gaji: GajiItem) => {
    return (
      getTotalPenerimaan(gaji.penghasilan) -
      getTotalPotongan(gaji.potongan)
    )
  }

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatTanggal = (date: string | null) => {
    if (!date) return "-"

    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getPeriodeLabel = (gaji: GajiItem) => {
    return `${formatTanggal(gaji.tanggalMulai)} - ${formatTanggal(
      gaji.tanggalSelesai
    )}`
  }

  const getBulan = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      month: "long",
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "sudah_dibayar":
        return "Sudah Dibayar"
      case "belum_dibayar":
        return "Belum Dibayar"
      case "menunggu":
        return "Menunggu"
      default:
        return status
    }
  }

  const filteredData = useMemo(() => {
    return gajiList.filter((g) => {
      const periode = getPeriodeLabel(g)

      const matchesSearch = periode
        .toLowerCase()
        .includes(searchQuery.toLowerCase())

      const matchesBulan =
        filterBulan === "ALL" ||
        getBulan(g.tanggalMulai) === filterBulan

      const matchesStatus =
        filterStatus === "ALL" ||
        getStatusLabel(g.statusPembayaran) === filterStatus

      return matchesSearch && matchesBulan && matchesStatus
    })
  }, [gajiList, searchQuery, filterBulan, filterStatus])

  const ringkasan = useMemo(() => {
    let totalGajiPokok = 0
    let totalTunjangan = 0
    let totalPotongan = 0

    filteredData.forEach((g) => {
      totalGajiPokok += g.penghasilan.gajiPokok
      totalTunjangan += getTotalTunjangan(g.penghasilan)
      totalPotongan += getTotalPotongan(g.potongan)
    })

    return {
      totalGajiPokok,
      totalTunjangan,
      totalPotongan,
    }
  }, [filteredData])

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
      case "sudah_dibayar":
        return (
          <Badge className="border border-emerald-200 bg-emerald-50 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Sudah Dibayar
          </Badge>
        )

      case "belum_dibayar":
        return (
          <Badge className="border border-rose-200 bg-rose-50 text-[10px] font-bold tracking-wider text-rose-700 uppercase">
            <AlertCircle className="mr-1 h-3 w-3" />
            Belum Dibayar
          </Badge>
        )

      case "menunggu":
        return (
          <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-bold tracking-wider text-amber-700 uppercase">
            <Clock className="mr-1 h-3 w-3" />
            Menunggu
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
            <FileText className="h-6 w-6 text-blue-600" />
            Riwayat Gaji
          </h1>

          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {karyawan.nama} &middot; {karyawan.jabatan}
          </p>
        </div>
      </div>

      {/* RINGKASAN */}
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

      {/* FILTER */}
      <Card className="overflow-hidden rounded-sm border-zinc-200 shadow-md">
        <CardHeader className="space-y-4 border-b bg-zinc-50/50 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />

              <Input
                placeholder="Cari periode..."
                className="h-9 rounded-sm border-zinc-200 bg-white pl-10 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={filterBulan}
              onValueChange={(val) => setFilterBulan(val ?? "ALL")}
            >
              <SelectTrigger className="h-9 w-[140px] rounded-sm border-zinc-200 bg-white text-xs font-semibold">
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
              <SelectTrigger className="h-9 w-[150px] rounded-sm border-zinc-200 bg-white text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <FilterX className="h-3.5 w-3.5 text-zinc-400" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>

                <SelectItem value="Sudah Dibayar">
                  Sudah Dibayar
                </SelectItem>

                <SelectItem value="Belum Dibayar">
                  Belum Dibayar
                </SelectItem>

                <SelectItem value="Menunggu">
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
                <FilterX className="mr-2 h-3.5 w-3.5" />
                Reset Filter
              </Button>
            )}
          </div>
        </CardHeader>

        {/* TABLE */}
        <CardContent className="p-0 font-sans text-[13px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Loader2 className="mb-2 h-8 w-8 animate-spin" />

              <p className="italic">
                Mengambil data dari database...
              </p>
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

                    <TableHead className="border-r text-right font-bold text-zinc-700">
                      Diterima
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
                          {getPeriodeLabel(g)}
                        </TableCell>

                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-zinc-900">
                          {formatIDR(g.penghasilan.gajiPokok)}
                        </TableCell>

                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-emerald-700">
                          {formatIDR(
                            getTotalTunjangan(g.penghasilan)
                          )}
                        </TableCell>

                        <TableCell className="border-r px-6 py-4 text-right font-semibold text-rose-600">
                          {formatIDR(getTotalPotongan(g.potongan))}
                        </TableCell>

                        <TableCell className="border-r px-6 py-4 text-right font-black text-blue-700">
                          {formatIDR(getJumlahDiterima(g))}
                        </TableCell>

                        <TableCell className="border-r px-6 py-4 text-center">
                          {getStatusBadge(g.statusPembayaran)}
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
                        colSpan={8}
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

      {/* DETAIL SLIP */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm border-none shadow-2xl [&>button]:hidden">
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

              {/* IDENTITAS */}
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
                    NIP
                  </span>

                  <span className="font-semibold text-zinc-800">
                    {karyawan.nip}
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

                <div className="flex justify-between gap-4">
                  <span className="font-bold text-zinc-500 uppercase">
                    Periode
                  </span>

                  <span className="text-right font-semibold text-zinc-800">
                    {getPeriodeLabel(selectedGaji)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="font-bold text-zinc-500 uppercase">
                    Status
                  </span>

                  <span>
                    {getStatusBadge(
                      selectedGaji.statusPembayaran
                    )}
                  </span>
                </div>

                {selectedGaji.tanggalPembayaran && (
                  <div className="flex justify-between">
                    <span className="font-bold text-zinc-500 uppercase">
                      Tanggal Bayar
                    </span>

                    <span className="font-semibold text-zinc-800">
                      {formatTanggal(
                        selectedGaji.tanggalPembayaran
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* PENGHASILAN */}
              <div>
                <h3 className="mb-2 text-xs font-black tracking-wider text-zinc-700 uppercase">
                  Penghasilan
                </h3>

                <div className="overflow-hidden rounded-sm border border-zinc-300 text-xs">
                  {[
                    ["Gaji Pokok", selectedGaji.penghasilan.gajiPokok],
                    [
                      "Tunjangan Jabatan",
                      selectedGaji.penghasilan.tunjanganJabatan,
                    ],
                    [
                      "Tunjangan Transport Tetap",
                      selectedGaji.penghasilan.tunjanganTransportTetap,
                    ],
                    [
                      "Tunjangan Pengabdian",
                      selectedGaji.penghasilan.tunjanganPengabdian,
                    ],
                    [
                      "Tunjangan Transport Tidak Tetap",
                      selectedGaji.penghasilan.tunjanganTransportTidakTetap,
                    ],
                    ["Uang Saku", selectedGaji.penghasilan.uangSaku],
                    [
                      "Lembur / Overtime",
                      selectedGaji.penghasilan.lemburOvertime,
                    ],
                    ["Lain-lain", selectedGaji.penghasilan.lainLain],
                    [
                      "BPJS TK JHT",
                      selectedGaji.penghasilan.bpjsTkJht,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between border-b border-zinc-200 bg-zinc-50/50 p-2.5 last:border-b-0"
                    >
                      <span className="font-bold text-zinc-600">
                        {label}
                      </span>

                      <span className="font-semibold text-zinc-900">
                        {formatIDR(value as number)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between bg-emerald-50 p-3">
                    <span className="font-black text-emerald-700 uppercase">
                      Jumlah Penerimaan
                    </span>

                    <span className="font-black text-emerald-700">
                      {formatIDR(
                        getTotalPenerimaan(
                          selectedGaji.penghasilan
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* POTONGAN */}
              <div>
                <h3 className="mb-2 text-xs font-black tracking-wider text-zinc-700 uppercase">
                  Potongan
                </h3>

                <div className="overflow-hidden rounded-sm border border-zinc-300 text-xs">
                  {[
                    [
                      "Alpha / Ijin",
                      selectedGaji.potongan.potonganAlphaIjin,
                    ],
                    [
                      "Uang Transport",
                      selectedGaji.potongan.potonganUangTransport,
                    ],
                    [
                      "Uang Saku",
                      selectedGaji.potongan.potonganUangSaku,
                    ],
                    [
                      "BPJS TK JHT Perusahaan",
                      selectedGaji.potongan.bpjsTkJhtPerusahaan,
                    ],
                    [
                      "BPJS TK JHT Karyawan",
                      selectedGaji.potongan.bpjsTkJhtKaryawan,
                    ],
                    ["PPh 21", selectedGaji.potongan.pph21],
                    [
                      "Pinjaman Lainnya",
                      selectedGaji.potongan.pinjamanLainnya,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between border-b border-zinc-200 bg-zinc-50/50 p-2.5 last:border-b-0"
                    >
                      <span className="font-bold text-zinc-600">
                        {label}
                      </span>

                      <span className="font-semibold text-rose-600">
                        {formatIDR(value as number)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between bg-rose-50 p-3">
                    <span className="font-black text-rose-700 uppercase">
                      Jumlah Potongan
                    </span>

                    <span className="font-black text-rose-700">
                      {formatIDR(
                        getTotalPotongan(
                          selectedGaji.potongan
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* TOTAL */}
              <div className="rounded-sm bg-zinc-900 p-4 text-white">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-zinc-400 uppercase">
                    Jumlah Penerimaan
                  </span>

                  <span className="font-semibold">
                    {formatIDR(
                      getTotalPenerimaan(
                        selectedGaji.penghasilan
                      )
                    )}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-bold text-zinc-400 uppercase">
                    Jumlah Potongan
                  </span>

                  <span className="font-semibold text-rose-400">
                    {formatIDR(
                      getTotalPotongan(
                        selectedGaji.potongan
                      )
                    )}
                  </span>
                </div>

                <div className="mt-3 flex justify-between border-t border-zinc-700 pt-3">
                  <span className="font-black uppercase">
                    Jumlah Yang Diterima
                  </span>

                  <span className="font-black text-emerald-400">
                    {formatIDR(
                      getJumlahDiterima(selectedGaji)
                    )}
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