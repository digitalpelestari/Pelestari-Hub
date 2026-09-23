"use client"

import React, { useState, useEffect, useCallback } from "react"
import { getPreviewIkhtisar, executeTwoStepClosing } from "@/app/actions/closing-simple"
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
  Scale
} from "lucide-react"

const BULAN_OPTIONS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
]

export default function SimpleClosingPage() {
  const [year, setYear] = useState<string>("2026")
  const [month, setMonth] = useState<string>("9")
  const [labaBersih, setLabaBersih] = useState<number>(0)
  const [saldo13004, setSaldo13004] = useState<number>(0)
  const [saldo13003, setSaldo13003] = useState<number>(0)
  
  const [loading, setLoading] = useState<boolean>(true)
  const [processing, setProcessing] = useState<boolean>(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const formatRupiah = (num: number) => {
    const isNeg = num < 0
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(Math.abs(num))
    return isNeg ? `(${formatted})` : formatted
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await getPreviewIkhtisar(year, month)

    if (res.success && res.data) {
      setLabaBersih(res.data.labaBersih)
      setSaldo13004(res.data.saldo13004)
      setSaldo13003(res.data.saldo13003)
    }

    setLoading(false)
  }, [year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGenerate = async () => {
    const selectedBulanName = BULAN_OPTIONS.find((b) => b.value === month)?.label
    const confirm = window.confirm(
      `Jalankan Closing Bulanan ${selectedBulanName} ${year}?\n\n1. Total L/R (${formatRupiah(labaBersih)}) masuk ke 13004 (Ikhtisar L/R)\n2. Dipindahkan ke 13003 (Laba Tahun Berjalan)\n3. Saldo 13004 dikosongkan kembali (Rp 0).`
    )
    if (!confirm) return

    setProcessing(true)
    setAlert(null)

    const res = await executeTwoStepClosing(year, month)
    if (res.success) {
      setAlert({ type: "success", text: res.message })
      await loadData()
    } else {
      setAlert({ type: "error", text: res.message })
    }
    setProcessing(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 font-sans text-zinc-900">
      
      {/* 1. KOTAK EKSEKUSI CLOSING 2 TAHAP */}
      <Card className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <CardHeader className="border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-zinc-900">
                Closing Bulanan Otomatis
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Akumulasi Laba Rugi ke <b>13004 (Ikhtisar L/R)</b> &rarr; dialokasikan ke <b>13003 (Laba Tahun Berjalan)</b> dalam satu klik.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          
          {/* FILTER & BUTTON */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {/* Dropdown Bulan */}
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={processing}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold sm:w-48"
            >
              {BULAN_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>

            {/* Dropdown Tahun */}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={processing}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold sm:w-28"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>

            {/* Total Laba Bersih yang siap ditutup */}
            <div className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 sm:w-auto sm:flex-1">
              <span className="text-[11px] font-medium text-zinc-500">Hasil L/R:</span>
              <span className={`font-mono text-xs font-bold ${labaBersih >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {loading ? "..." : formatRupiah(labaBersih)}
              </span>
            </div>

            {/* Tombol Eksekusi 2-in-1 */}
            <Button
              onClick={handleGenerate}
              disabled={processing || loading || labaBersih === 0}
              className="h-10 w-full shrink-0 gap-2 rounded-md bg-zinc-900 px-5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
            >
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Closing
            </Button>
          </div>

          {/* DIAGRAM ALUR PROSES */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Alur Eksekusi dalam Sekali Klik:
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Badge variant="outline" className="text-[10px] bg-white">Laba Rugi</Badge>
                <span>{formatRupiah(labaBersih)}</span>
              </div>
              
              <div className="flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                <span>(Tahap 1)</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-800" />
              </div>

              <div className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Badge variant="outline" className="text-[10px] bg-white text-blue-700 border-blue-200">13004 Ikhtisar L/R</Badge>
                <span className="text-[10px] text-zinc-400 italic">(Dibersihkan ke Rp 0)</span>
              </div>

              <div className="flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                <span>(Tahap 2)</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-800" />
              </div>

              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <Badge className="text-[10px] bg-emerald-700 text-white">13003 Laba Berjalan</Badge>
                <span>Neraca +{formatRupiah(labaBersih)}</span>
              </div>
            </div>
          </div>

          {/* STATUS SALDO AKUN NERACA SAAT INI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-600">
                <Scale className="h-4 w-4 text-zinc-400" />
                <span>Saldo <b>13004 (Ikhtisar)</b>:</span>
              </div>
              <span className="font-mono font-bold text-zinc-900">
                {formatRupiah(saldo13004)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-dashed border-emerald-300 bg-emerald-50/30 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>Saldo <b>13003 (Laba Berjalan)</b>:</span>
              </div>
              <span className={`font-mono font-bold ${saldo13003 < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {formatRupiah(saldo13003)}
              </span>
            </div>
          </div>

          {/* NOTIFIKASI HASIL */}
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