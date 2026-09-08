"use client"

import React, { useEffect, useState } from "react"
import {
  FileText,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Factory,
  Loader2,
  GraduationCap,
  Briefcase,
  Sigma,
  ArrowDownCircle,
  Clock,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// TODO: ganti dengan server action asli, mis. getDashboardSummary(), getBiayaBulanan(), getCashflowBulanan()
// Struktur di bawah ini contoh (dummy) supaya UI bisa langsung dilihat.

interface BiayaBulanan {
  bulan: string
  biaya: number
}

interface CashflowBulanan {
  bulan: string
  masuk: number
  keluar: number
}

const DUMMY_BIAYA: BiayaBulanan[] = [
  { bulan: "Jan", biaya: 42000000 },
  { bulan: "Feb", biaya: 38500000 },
  { bulan: "Mar", biaya: 51200000 },
  { bulan: "Apr", biaya: 47800000 },
  { bulan: "Mei", biaya: 39900000 },
  { bulan: "Jun", biaya: 55300000 },
  { bulan: "Jul", biaya: 48700000 },
  { bulan: "Agu", biaya: 43200000 },
  { bulan: "Sep", biaya: 60100000 },
]

const DUMMY_CASHFLOW: CashflowBulanan[] = [
  { bulan: "Jan", masuk: 65000000, keluar: 42000000 },
  { bulan: "Feb", masuk: 58000000, keluar: 38500000 },
  { bulan: "Mar", masuk: 72000000, keluar: 51200000 },
  { bulan: "Apr", masuk: 61000000, keluar: 47800000 },
  { bulan: "Mei", masuk: 55000000, keluar: 39900000 },
  { bulan: "Jun", masuk: 80000000, keluar: 55300000 },
  { bulan: "Jul", masuk: 69000000, keluar: 48700000 },
  { bulan: "Agu", masuk: 63000000, keluar: 43200000 },
  { bulan: "Sep", masuk: 88000000, keluar: 60100000 },
]

const DUMMY_TOTAL_PRODUKSI_TAHUNAN = 1284 // contoh: jumlah peserta/unit produksi tahun berjalan
const DUMMY_TOTAL_UTANG_OUTSTANDING = 214500000 // contoh: sisa piutang/utang belum tertagih

// TODO: ganti dengan hasil query asli (mis. SUM nilai invoice per kategori tahun berjalan)
const DUMMY_PELATIHAN = 10 // contoh: total nilai invoice kategori Pelatihan
const DUMMY_KONSULTAN = 4 // contoh: total nilai invoice kategori Konsultan

// TODO: ganti dengan hasil query asli (mis. SUM nominal Rupiah invoice per kategori tahun berjalan)
const DUMMY_NILAI_PELATIHAN = 420000000 // contoh: total nominal invoice kategori Pelatihan
const DUMMY_NILAI_KONSULTAN = 168000000 // contoh: total nominal invoice kategori Konsultan

// TODO: ganti dengan hasil query asli (mis. SUM pembayaran yang sudah diterima tahun berjalan)
const DUMMY_UANG_MASUK = 350000000 // contoh: total uang yang sudah masuk/dibayarkan dari invoice

export default function Page() {
  const { data: session } = useSession()
  const [isBlurred, setIsBlurred] = useState(false)

  // TODO: state ini nantinya diisi dari server action asli
  const [loadingRingkasan, setLoadingRingkasan] = useState(false)
  const [biayaBulanan, setBiayaBulanan] = useState<BiayaBulanan[]>(DUMMY_BIAYA)
  const [cashflowBulanan, setCashflowBulanan] =
    useState<CashflowBulanan[]>(DUMMY_CASHFLOW)
  const [totalProduksiTahunan, setTotalProduksiTahunan] = useState(
    DUMMY_TOTAL_PRODUKSI_TAHUNAN
  )
  const [totalUtangOutstanding, setTotalUtangOutstanding] = useState(
    DUMMY_TOTAL_UTANG_OUTSTANDING
  )
  const [invoicePelatihan, setInvoicePelatihan] = useState(DUMMY_PELATIHAN)
  const [invoiceKonsultan, setInvoiceKonsultan] = useState(DUMMY_KONSULTAN)
  const [nilaiInvoicePelatihan, setNilaiInvoicePelatihan] = useState(
    DUMMY_NILAI_PELATIHAN
  )
  const [nilaiInvoiceKonsultan, setNilaiInvoiceKonsultan] = useState(
    DUMMY_NILAI_KONSULTAN
  )
  const [uangMasuk, setUangMasuk] = useState(DUMMY_UANG_MASUK)

  // Dihitung otomatis, tidak perlu state terpisah
  const totalInvoice = invoicePelatihan + invoiceKonsultan
  const totalNilaiInvoice = nilaiInvoicePelatihan + nilaiInvoiceKonsultan
  const sisaTagihan = totalNilaiInvoice - uangMasuk

  useEffect(() => {
    // 1. Mencegah Klik Kanan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // 2. Mencegah Shortcut Screenshot, Print, dan Inspect Element
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen: kosongkan clipboard
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText("")
      }

      // Blokir Ctrl+P (Print) / Ctrl+S (Save) / Ctrl+U (View Source)
      if (
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "u"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault()
      }

      // Blokir F12 dan Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          ["i", "j", "c"].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault()
      }
    }

    // 3. Auto-Blur saat Snipping Tool / window kehilangan fokus
    const handleBlur = () => setIsBlurred(true)
    const handleFocus = () => setIsBlurred(false)

    document.addEventListener("contextmenu", handleContextMenu)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  // TODO: fetch data ringkasan dashboard dari server action asli
  // useEffect(() => {
  //   const loadRingkasan = async () => {
  //     setLoadingRingkasan(true)
  //     const res = await getDashboardSummary()
  //     if (res.success && res.data) {
  //       setBiayaBulanan(res.data.biayaBulanan)
  //       setCashflowBulanan(res.data.cashflowBulanan)
  //       setTotalProduksiTahunan(res.data.totalProduksiTahunan)
  //       setTotalUtangOutstanding(res.data.totalUtangOutstanding)
  //       setInvoicePelatihan(res.data.invoicePelatihan)
  //       setInvoiceKonsultan(res.data.invoiceKonsultan)
  //       setUangMasuk(res.data.uangMasuk)
  //     }
  //     setLoadingRingkasan(false)
  //   }
  //   loadRingkasan()
  // }, [])

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatCompact = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      notation: "compact",
      compactDisplay: "short",
    }).format(amount)
  }

  const sopList = [
    {
      title: "SOP Penagihan",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-penagihan.pdf",
    },
    {
      title: "SOP Perbendaharaan",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-perbendaharaan.pdf",
    },
    {
      title: "SOP Perpajakan",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-perpajakan.pdf",
    },
  ]

  const userName = session?.user?.name || "Karyawan PT Pelestari"

  return (
    <div
      className={`relative flex flex-1 flex-col font-sans transition-all duration-150 select-none ${
        isBlurred ? "pointer-events-none blur-md" : ""
      }`}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {/* Overlay Watermark Dinamis */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden opacity-[0.07]">
        <div className="grid -rotate-12 grid-cols-2 gap-24 text-center font-mono text-xs tracking-widest text-black uppercase select-none md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i}>
              <p>{userName}</p>
              <p className="text-[10px]">Confidential Document</p>
            </div>
          ))}
        </div>
      </div>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header Dashboard */}
          <div className="mb-2 px-4 lg:px-6">
            <h1 className="text-xl leading-tight font-bold text-black">
              Dashboard Manajemen Invoice
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Selamat datang kembali,{" "}
              <span className="font-bold text-black">{userName}</span> • Anda
              masuk sebagai{" "}
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 uppercase">
                {(session?.user as any)?.role || "Staff"}
              </span>
            </p>
          </div>

          {/* Kumpulan Dokumen SOP */}
          <div className="my-2 px-4 lg:px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {sopList.map((sop, idx) => (
                <a
                  key={idx}
                  href={sop.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block w-full"
                >
                  <div className="flex h-full cursor-pointer items-center justify-between rounded-sm border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-black hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-sm bg-red-50 p-2.5 text-red-600 transition-colors group-hover:bg-red-100">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="m-0 p-0 text-xs leading-none font-black tracking-tight text-black uppercase">
                          {sop.title}
                        </h3>
                        <p className="mt-1.5 text-[10px] leading-none font-bold tracking-wider text-zinc-400 uppercase">
                          {sop.subtitle}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-black" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* RINGKASAN: 2 CARD BESAR BERDAMPINGAN DALAM 1 BARIS */}
          <div className="px-4 lg:px-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* CARD KIRI: Invoice Pelatihan & Konsultan + Total */}
              <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                    Invoice Pelatihan & Konsultan
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Pelatihan */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-amber-50 p-1.5">
                        <GraduationCap className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-zinc-500 uppercase italic">
                          Invoice Pelatihan
                        </p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">
                          Total kategori pelatihan
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-[18px] font-black text-zinc-900">
                        {loadingRingkasan ? (
                          <Loader2 className="ml-auto h-5 w-5 animate-spin text-zinc-300" />
                        ) : (
                          invoicePelatihan
                        )}
                      </div>
                      {!loadingRingkasan && (
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-zinc-400">
                          {formatIDR(nilaiInvoicePelatihan)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Konsultan */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-sky-50 p-1.5">
                        <Briefcase className="h-4 w-4 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-zinc-500 uppercase italic">
                          Invoice Konsultan
                        </p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">
                          Total kategori konsultan
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-[18px] font-black text-zinc-900">
                        {loadingRingkasan ? (
                          <Loader2 className="ml-auto h-5 w-5 animate-spin text-zinc-300" />
                        ) : (
                          invoiceKonsultan
                        )}
                      </div>
                      {!loadingRingkasan && (
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-zinc-400">
                          {formatIDR(nilaiInvoiceKonsultan)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-emerald-100 p-1.5">
                        <Sigma className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-emerald-600 uppercase italic">
                          Total
                        </p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase">
                          Pelatihan + Konsultan
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-[18px] font-black text-emerald-600">
                        {loadingRingkasan ? (
                          <Loader2 className="ml-auto h-5 w-5 animate-spin text-zinc-300" />
                        ) : (
                          totalInvoice
                        )}
                      </div>
                      {!loadingRingkasan && (
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-emerald-500/70">
                          {formatIDR(totalNilaiInvoice)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CARD KANAN: Uang Masuk + Sisa Tagihan + Total Invoice */}
              <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                    Ringkasan Pembayaran
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Uang Masuk */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-emerald-100 p-1.5">
                        <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-emerald-600 uppercase italic">
                          Uang Masuk
                        </p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase">
                          Total pembayaran yang sudah diterima
                        </p>
                      </div>
                    </div>

                    <div className="font-mono text-[18px] font-black text-emerald-600">
                      {loadingRingkasan ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                      ) : (
                        formatIDR(uangMasuk)
                      )}
                    </div>
                  </div>

                  {/* Sisa Tagihan */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-rose-100 p-1.5">
                        <Clock className="h-4 w-4 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-rose-600 uppercase italic">
                          Sisa Tagihan
                        </p>
                        <p className="text-[9px] font-bold text-rose-500 uppercase">
                          Total invoice dikurangi uang masuk
                        </p>
                      </div>
                    </div>

                    <div className="font-mono text-[18px] font-black text-rose-600">
                      {loadingRingkasan ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                      ) : (
                        formatIDR(sisaTagihan)
                      )}
                    </div>
                  </div>

                  {/* Total Invoice */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-zinc-100 p-1.5">
                        <Sigma className="h-4 w-4 text-zinc-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                          Total Invoice
                        </p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">
                          Uang masuk + sisa tagihan
                        </p>
                      </div>
                    </div>

                    <div className="font-mono text-[18px] font-black text-zinc-900">
                      {loadingRingkasan ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                      ) : (
                        formatIDR(totalNilaiInvoice)
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* GRAFIK BIAYA & CASHFLOW */}
          <div className="px-4 lg:px-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* Grafik Biaya */}
              <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                      Grafik Biaya Bulanan
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-zinc-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRingkasan ? (
                    <div className="flex h-[260px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={biayaBulanan}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                        <XAxis
                          dataKey="bulan"
                          tick={{ fontSize: 10, fill: "#71717a" }}
                          axisLine={{ stroke: "#e4e4e7" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#71717a" }}
                          tickFormatter={(v) => formatCompact(v)}
                          axisLine={{ stroke: "#e4e4e7" }}
                        />
                        <Tooltip
                          formatter={(value) => formatIDR(Number(value ?? 0))}
                          contentStyle={{
                            fontSize: "11px",
                            borderRadius: "4px",
                            border: "1px solid #e4e4e7",
                          }}
                        />
                        <Bar
                          dataKey="biaya"
                          fill="#18181b"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Cashflow */}
              <Card className="rounded-sm border border-zinc-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
                      Cashflow Bulanan
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-zinc-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRingkasan ? (
                    <div className="flex h-[260px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={cashflowBulanan}>
                        <defs>
                          <linearGradient
                            id="colorMasuk"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#059669"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="#059669"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorKeluar"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#e11d48"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="#e11d48"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                        <XAxis
                          dataKey="bulan"
                          tick={{ fontSize: 10, fill: "#71717a" }}
                          axisLine={{ stroke: "#e4e4e7" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#71717a" }}
                          tickFormatter={(v) => formatCompact(v)}
                          axisLine={{ stroke: "#e4e4e7" }}
                        />
                        <Tooltip
                          formatter={(value) => formatIDR(Number(value ?? 0))}
                          contentStyle={{
                            fontSize: "11px",
                            borderRadius: "4px",
                            border: "1px solid #e4e4e7",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "10px", fontWeight: 700 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="masuk"
                          name="Uang Masuk"
                          stroke="#059669"
                          fill="url(#colorMasuk)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="keluar"
                          name="Uang Keluar"
                          stroke="#e11d48"
                          fill="url(#colorKeluar)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
