"use client"

import React, { useEffect, useState } from "react"
import {
  Landmark,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react"

import {
  getSaldoAkun,
  simpanRekonsiliasi,
  getRekonsiliasi,
} from "@/app/actions/rekonsiliasi"
import { swal } from "@/lib/sweetalert"

const NO_AKUN_BANK_AKTIF = "11200"

type DataSaldoAkun = {
  id: number
  noAkun: string
  namaAkun: string
  saldo: number
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function RekonsiliasiBankHarian() {
  const [tanggal, setTanggal] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
  })

  const [data, setData] = useState<DataSaldoAkun | null>(null)
  const [saldoRekeningKoran, setSaldoRekeningKoran] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!data) return

    loadRekonsiliasi()
  }, [tanggal, data?.id])

  async function loadRekonsiliasi() {
    if (!data) return

    try {
      const result = await getRekonsiliasi(tanggal, data.id)

      if (result.success && result.data) {
        setSaldoRekeningKoran(String(result.data.saldoRekeningKoran))
      } else {
        setSaldoRekeningKoran("")
      }
    } catch (error) {
      console.error("Gagal mengambil rekonsiliasi:", error)
      setSaldoRekeningKoran("")
    }
  }

  async function loadData() {
    setLoading(true)

    try {
      const result = await getSaldoAkun(NO_AKUN_BANK_AKTIF)

      if (result.success && result.data) {
        setData(result.data)
      } else {
        setData(null)

        if (result.message) {
          await swal.error(result.message)
        }
      }
    } catch (error) {
      console.error("Gagal mengambil saldo akun:", error)
      setData(null)
      await swal.error("Gagal mengambil saldo akun.")
    } finally {
      setLoading(false)
    }
  }
  const saldoAkun = data?.saldo ?? 0

  const saldoBank =
    saldoRekeningKoran === "" ? null : Number(saldoRekeningKoran)

  const sudahDiisi = saldoBank !== null && !Number.isNaN(saldoBank)
  const selisih = sudahDiisi ? saldoBank - saldoAkun : null
  const sudahBalance = selisih === 0

  function handleSaldoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const angka = event.target.value.replace(/\D/g, "")

    setSaldoRekeningKoran(angka)
  }

  async function handleSimpan() {
    if (!data) {
      await swal.warning("Data saldo akun belum tersedia.")
      return
    }

    if (!sudahDiisi || saldoBank === null) {
      await swal.warning(
        "Silakan masukkan saldo rekening koran terlebih dahulu."
      )
      return
    }

    if (!sudahBalance) {
      await swal.warning(
        "Saldo belum balance. Rekonsiliasi belum dapat disimpan."
      )
      return
    }

    setSaving(true)

    try {
      const result = await simpanRekonsiliasi({
        tanggal,
        akunId: data.id,
        saldoRekeningKoran: saldoBank,
      })

      if (!result.success) {
        await swal.error(result.message ?? "Gagal menyimpan rekonsiliasi.")
        return
      }

      await swal.success(result.message)
    } catch (error) {
      console.error("Gagal menyimpan rekonsiliasi:", error)
      await swal.error("Gagal menyimpan rekonsiliasi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Landmark size={22} />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Rekonsiliasi Bank
            </h1>
            <p className="text-sm text-zinc-500">
              Cocokkan saldo akun dengan saldo rekening koran.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* KOLOM KIRI: INPUT */}
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm lg:col-span-3">
          {/* Info rekening */}
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-6 py-4">
            <div>
              <p className="text-xs text-zinc-500">Rekening</p>
              <p className="font-semibold text-zinc-900">
                {data?.noAkun ?? NO_AKUN_BANK_AKTIF}
                {" - "}
                {data?.namaAkun ?? "Bank Aktif"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-zinc-500">Saldo akun</p>
              <p className="text-lg font-bold text-zinc-900">
                {loading ? "Memuat..." : formatRupiah(saldoAkun)}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5 p-6">
            <div>
              <label
                htmlFor="tanggal"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Tanggal rekonsiliasi
              </label>

              <input
                id="tanggal"
                type="date"
                value={tanggal}
                onChange={(event) => setTanggal(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm transition outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 sm:w-56"
              />
            </div>

            <div>
              <label
                htmlFor="saldo-rekening-koran"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Saldo rekening koran
              </label>

              <div className="relative">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-sm font-semibold text-zinc-500">
                  Rp
                </span>

                <input
                  id="saldo-rekening-koran"
                  type="text"
                  inputMode="numeric"
                  value={
                    saldoRekeningKoran === ""
                      ? ""
                      : Number(saldoRekeningKoran).toLocaleString("id-ID")
                  }
                  onChange={handleSaldoChange}
                  placeholder="0"
                  className="w-full rounded-xl border border-zinc-300 py-3.5 pr-4 pl-12 text-xl font-bold text-zinc-900 tabular-nums transition outline-none placeholder:text-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
                />
              </div>

              <p className="mt-1.5 text-xs text-zinc-500">
                Isi dengan saldo akhir pada tanggal rekonsiliasi. Contoh:
                108.000.000
              </p>
            </div>
          </div>
        </section>

        {/* KOLOM KANAN: HASIL */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <h2 className="border-b border-zinc-100 px-6 py-4 font-semibold text-zinc-900">
              Perbandingan saldo
            </h2>

            <dl className="divide-y divide-zinc-100 text-sm">
              <div className="flex items-center justify-between gap-4 px-6 py-3.5">
                <dt className="text-zinc-600">Saldo akun</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">
                  {formatRupiah(saldoAkun)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 px-6 py-3.5">
                <dt className="text-zinc-600">Saldo rekening koran</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">
                  {sudahDiisi ? formatRupiah(saldoBank) : "-"}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 bg-zinc-50 px-6 py-3.5">
                <dt className="font-semibold text-zinc-700">Selisih</dt>
                <dd
                  className={`font-bold tabular-nums ${
                    selisih === null
                      ? "text-zinc-400"
                      : sudahBalance
                        ? "text-green-600"
                        : "text-red-600"
                  }`}
                >
                  {selisih === null ? "-" : formatRupiah(Math.abs(selisih))}
                </dd>
              </div>
            </dl>
          </section>

          {/* STATUS */}
          {sudahDiisi ? (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                sudahBalance
                  ? "border-green-200 bg-green-50"
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  sudahBalance
                    ? "bg-green-100 text-green-600"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                {sudahBalance ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>

              <div>
                <p
                  className={`font-semibold ${
                    sudahBalance ? "text-green-800" : "text-orange-800"
                  }`}
                >
                  {sudahBalance ? "Saldo balance" : "Saldo belum balance"}
                </p>

                <p
                  className={`mt-0.5 text-sm ${
                    sudahBalance ? "text-green-700" : "text-orange-700"
                  }`}
                >
                  {sudahBalance
                    ? "Saldo akun sama dengan saldo rekening koran."
                    : "Ada perbedaan antara saldo akun dan rekening koran."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
              Masukkan saldo rekening koran untuk melihat hasil.
            </div>
          )}

          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving || !sudahDiisi || !sudahBalance}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "Menyimpan..." : "Simpan rekonsiliasi"}
          </button>
        </aside>
      </div>
    </div>
  )
}
