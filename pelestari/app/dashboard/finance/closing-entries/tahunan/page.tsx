"use client"

import React, { useState, useEffect, useCallback } from "react"

import {
  getPreviewClosingTahunan,
  executeAnnualClosing,
} from "@/app/actions/closing-simple"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Scale,
  CalendarDays,
} from "lucide-react"

const TAHUN_OPTIONS = [
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
]

export default function TahunanClosingPage() {
  const [year, setYear] = useState("2026")

  const [saldo13002, setSaldo13002] = useState(0)
  const [saldo13003, setSaldo13003] = useState(0)

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const [alert, setAlert] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // ============================================================
  // FORMAT RUPIAH
  // ============================================================

  const formatRupiah = (num: number) => {
    const isNeg = num < 0

    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Math.abs(num))

    return isNeg ? `(${formatted})` : formatted
  }

  // ============================================================
  // LOAD PREVIEW
  // ============================================================

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getPreviewClosingTahunan(year)

      if (res.success && res.data) {
        setSaldo13002(Number(res.data.saldo13002 || 0))
        setSaldo13003(Number(res.data.saldo13003 || 0))
      } else {
        setSaldo13002(0)
        setSaldo13003(0)
      }
    } catch (error) {
      console.error("Gagal memuat preview closing tahunan:", error)

      setSaldo13002(0)
      setSaldo13003(0)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ============================================================
  // EXECUTE CLOSING TAHUNAN
  // ============================================================

  const handleGenerate = async () => {
    if (saldo13003 === 0) {
      setAlert({
        type: "error",
        text: `Saldo 13003 Laba Tahun Berjalan untuk tahun ${year} adalah Rp0. Tidak ada yang perlu ditutup.`,
      })

      return
    }

    const isProfit = saldo13003 > 0

    const confirm = window.confirm(
      `Jalankan Closing Tahunan ${year}?\n\n` +
        `Saldo 13003 Laba Tahun Berjalan: ${formatRupiah(saldo13003)}\n\n` +
        (isProfit
          ? `Jurnal yang akan dibuat:\n` +
            `Dr 13003 Laba Tahun Berjalan\n` +
            `Cr 13002 Laba Ditahan\n\n`
          : `Jurnal yang akan dibuat:\n` +
            `Dr 13002 Laba Ditahan\n` +
            `Cr 13003 Laba Tahun Berjalan\n\n`) +
        `Setelah closing:\n` +
        `13003 akan menjadi Rp0.\n` +
        `Saldo akan dipindahkan ke 13002 Laba Ditahan.\n\n` +
        `Pastikan seluruh closing bulanan tahun ${year} sudah selesai.`
    )

    if (!confirm) {
      return
    }

    setProcessing(true)
    setAlert(null)

    try {
      const res = await executeAnnualClosing(year)

      if (res.success) {
        setAlert({
          type: "success",
          text: res.message,
        })

        await loadData()
      } else {
        setAlert({
          type: "error",
          text: res.message,
        })
      }
    } catch (error: any) {
      setAlert({
        type: "error",
        text:
          error?.message ||
          "Terjadi kesalahan saat menjalankan closing tahunan.",
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 font-sans text-zinc-900">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <Card className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <CardHeader className="border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <CalendarDays className="h-4 w-4" />
            </div>

            <div>
              <CardTitle className="text-base font-bold text-zinc-900">
                Closing Tahunan
              </CardTitle>

              <p className="text-xs text-zinc-500">
                Memindahkan laba tahun berjalan ke laba ditahan.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          {/* ==================================================
              FILTER
          ================================================== */}

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
                setAlert(null)
              }}
              disabled={processing}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold sm:w-32"
            >
              {TAHUN_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <div className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 sm:flex-1">
              <span className="text-[11px] font-medium text-zinc-500">
                Laba Tahun Berjalan {year}:
              </span>

              <span
                className={`font-mono text-xs font-bold ${
                  saldo13003 >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {loading ? "..." : formatRupiah(saldo13003)}
              </span>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={processing || loading || saldo13003 === 0}
              className="h-10 w-full shrink-0 gap-2 rounded-md bg-zinc-900 px-5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
            >
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Closing Tahunan
            </Button>
          </div>

          {/* ==================================================
              WARNING
          ================================================== */}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

              <div>
                <p className="text-xs font-bold text-amber-800">
                  Perhatian Closing Tahunan
                </p>

                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  Pastikan seluruh transaksi tahun {year} sudah selesai
                  diposting dan seluruh closing bulanan tahun {year}
                  sudah dilakukan sebelum menjalankan closing tahunan.
                </p>
              </div>
            </div>
          </div>

          {/* ==================================================
              FLOW
          ================================================== */}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
            <div className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Alur Closing Tahunan
            </div>

            <div className="flex flex-col items-center justify-between gap-2 text-xs sm:flex-row">
              {/* 13003 */}

              <div className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-white text-[10px] text-emerald-700"
                >
                  13003 Laba Tahun Berjalan
                </Badge>

                <span
                  className={
                    saldo13003 < 0
                      ? "font-mono text-rose-700"
                      : "font-mono text-emerald-700"
                  }
                >
                  {loading ? "..." : formatRupiah(saldo13003)}
                </span>
              </div>

              {/* Arrow */}

              <div className="flex items-center gap-1 text-zinc-400">
                <span className="font-mono text-[10px]">CLOSING</span>

                <ArrowRight className="h-3.5 w-3.5 text-zinc-800" />
              </div>

              {/* 13002 */}

              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-white text-[10px] text-blue-700"
                >
                  13002 Laba Ditahan
                </Badge>

                <span className="font-mono text-blue-700">
                  {loading ? "..." : formatRupiah(saldo13002)}
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================
              SALDO
          ================================================== */}

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            {/* 13003 */}

            <div className="flex items-center justify-between rounded-lg border border-dashed border-emerald-300 bg-emerald-50/30 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />

                <span>
                  Saldo <b>13003</b>:
                </span>
              </div>

              <span
                className={`font-mono font-bold ${
                  saldo13003 < 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {loading ? "..." : formatRupiah(saldo13003)}
              </span>
            </div>

            {/* 13002 */}

            <div className="flex items-center justify-between rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-3 text-xs">
              <div className="flex items-center gap-2 text-blue-800">
                <Scale className="h-4 w-4 text-blue-600" />

                <span>
                  Saldo <b>13002</b>:
                </span>
              </div>

              <span className="font-mono font-bold text-blue-700">
                {loading ? "..." : formatRupiah(saldo13002)}
              </span>
            </div>
          </div>

          {/* ==================================================
              EXPECTED RESULT
          ================================================== */}

          <div className="rounded-lg border border-zinc-200 bg-white p-3.5">
            <div className="mb-3 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Setelah Closing Tahunan
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-[10px] text-zinc-500">
                  13003 Laba Tahun Berjalan
                </div>

                <div className="mt-1 font-mono text-sm font-bold text-zinc-900">
                  Rp0
                </div>
              </div>

              <div className="rounded-md bg-blue-50 p-3">
                <div className="text-[10px] text-blue-600">
                  13002 Laba Ditahan
                </div>

                <div className="mt-1 font-mono text-sm font-bold text-blue-800">
                  {loading ? "..." : formatRupiah(saldo13002 + saldo13003)}
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              ALERT
          ================================================== */}

          {alert && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-xs ${
                alert.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {alert.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}

              <span>{alert.text}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
