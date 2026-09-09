"use client"

import React, { useState, useMemo } from "react"
import { Landmark, BookOpen, Scale, Link2, CheckCircle2 } from "lucide-react"

interface Transaksi {
  id: string
  tanggal: string // Format YYYY-MM-DD
  deskripsi: string
  nominal: number
  tipe: "KREDIT" | "DEBET"
  status: "TERHUBUNG" | "BELUM_TERHUBUNG"
}

export default function RekonsiliasiBankHarian() {
  // State Tanggal Aktif (Default: Hari Ini / Tanggal Spesifik)
  const [tanggalAktif, setTanggalAktif] = useState<string>("2026-08-01")

  // Mock Data Rekening Koran (Bank)
  const [dataBank, setDataBank] = useState<Transaksi[]>([
    {
      id: "B1",
      tanggal: "2026-08-01",
      deskripsi: "TRANSFER M-BANKING MASUK",
      nominal: 5000000,
      tipe: "KREDIT",
      status: "BELUM_TERHUBUNG",
    },
    {
      id: "B2",
      tanggal: "2026-08-01",
      deskripsi: "BIAYA ADMINISTRASI BANK",
      nominal: 15000,
      tipe: "DEBET",
      status: "BELUM_TERHUBUNG",
    },
    {
      id: "B3",
      tanggal: "2026-08-02",
      deskripsi: "SETORAN TUNAI TOKO",
      nominal: 2000000,
      tipe: "KREDIT",
      status: "TERHUBUNG",
    },
  ])

  // Mock Data COA / Buku Besar (GL)
  const [dataGL, setDataGL] = useState<Transaksi[]>([
    {
      id: "G1",
      tanggal: "2026-08-01",
      deskripsi: "Penerimaan Piutang Toko A",
      nominal: 5000000,
      tipe: "KREDIT",
      status: "BELUM_TERHUBUNG",
    },
    {
      id: "G2",
      tanggal: "2026-08-01",
      deskripsi: "Pembayaran Operasional Kantor",
      nominal: 500000,
      tipe: "DEBET",
      status: "BELUM_TERHUBUNG",
    },
    {
      id: "G3",
      tanggal: "2026-08-02",
      deskripsi: "Setoran Kas Penjualan",
      nominal: 2000000,
      tipe: "KREDIT",
      status: "TERHUBUNG",
    },
  ])

  // State Pilihan Pemasangan
  const [pilihanBankId, setPilihanBankId] = useState<string | null>(null)
  const [pilihanGlId, setPilihanGlId] = useState<string | null>(null)

  // Navigasi Tanggal (Tambah / Kurang Hari)
  const ubahTanggal = (jumlahHari: number) => {
    const tgl = new Date(tanggalAktif)
    tgl.setDate(tgl.getDate() + jumlahHari)
    setTanggalAktif(tgl.toISOString().split("T")[0])
    setPilihanBankId(null)
    setPilihanGlId(null)
  }

  // Filter Data Berdasarkan Tanggal Aktif
  const bankHarian = useMemo(
    () => dataBank.filter((item) => item.tanggal === tanggalAktif),
    [dataBank, tanggalAktif]
  )

  const glHarian = useMemo(
    () => dataGL.filter((item) => item.tanggal === tanggalAktif),
    [dataGL, tanggalAktif]
  )

  // Eksekusi Pencocokan Manual
  const jalankanPencocokan = () => {
    if (!pilihanBankId || !pilihanGlId) return

    setDataBank((prev) =>
      prev.map((item) =>
        item.id === pilihanBankId ? { ...item, status: "TERHUBUNG" } : item
      )
    )
    setDataGL((prev) =>
      prev.map((item) =>
        item.id === pilihanGlId ? { ...item, status: "TERHUBUNG" } : item
      )
    )

    setPilihanBankId(null)
    setPilihanGlId(null)
  }

  // Kalkulasi Ringkasan Harian
  const formatIDR = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)

  const totalBankBelumTerhubung = bankHarian
    .filter((i) => i.status === "BELUM_TERHUBUNG")
    .reduce((acc, curr) => acc + curr.nominal, 0)

  const totalGlBelumTerhubung = glHarian
    .filter((i) => i.status === "BELUM_TERHUBUNG")
    .reduce((acc, curr) => acc + curr.nominal, 0)

  const selisihHarian = totalBankBelumTerhubung - totalGlBelumTerhubung

  return (
    <div className="flex min-h-screen flex-col justify-between bg-zinc-50 p-6 font-sans">
      {/* 1. HEADER BAR UTAMA */}
      <div className="mb-6 flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Rekonsiliasi Bank Pasif
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            Pencocokan transaksi mutasi bank dan buku besar untuk satu hari
            kerja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* NAVIGASI TANGGAL HARIAN */}
          <div className="flex items-center gap-2 rounded-sm border border-zinc-200 bg-white p-1.5 shadow-sm">
            <button
              onClick={() => ubahTanggal(-1)}
              className="h-8 rounded-sm border border-zinc-200 px-3 text-[11px] font-bold tracking-wide text-zinc-700 uppercase transition-all hover:bg-zinc-50"
            >
              &larr; Sebelumnya
            </button>
            <input
              type="date"
              value={tanggalAktif}
              onChange={(e) => {
                setTanggalAktif(e.target.value)
                setPilihanBankId(null)
                setPilihanGlId(null)
              }}
              className="h-8 rounded-sm border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-800 focus:outline-none"
            />
            <button
              onClick={() => ubahTanggal(1)}
              className="h-8 rounded-sm border border-zinc-200 px-3 text-[11px] font-bold tracking-wide text-zinc-700 uppercase transition-all hover:bg-zinc-50"
            >
              Berikutnya &rarr;
            </button>
          </div>

          <button className="h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 uppercase transition-all hover:bg-zinc-50">
            Impor Rekening Koran
          </button>
          <button className="h-10 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800">
            Cocokkan Otomatis
          </button>
        </div>
      </div>

      {/* 2. RESUME CARD PANEL (METRIK RINGKASAN HARIAN) */}
      <div className="mb-6 grid grid-cols-1 gap-4 font-sans md:grid-cols-4">
        <div className="rounded-sm border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Bank Belum Terhubung
            </span>
            <div className="rounded-sm bg-zinc-100 p-1.5">
              <Landmark className="h-4 w-4 text-zinc-600" />
            </div>
          </div>
          <div className="font-mono text-[16px] font-black text-zinc-900">
            {formatIDR(totalBankBelumTerhubung)}
          </div>
          <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
            Mutasi rekening koran ({tanggalAktif})
          </p>
        </div>

        <div className="rounded-sm border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-zinc-400 uppercase italic">
              Buku Besar Belum Terhubung
            </span>
            <div className="rounded-sm bg-zinc-100 p-1.5">
              <BookOpen className="h-4 w-4 text-zinc-600" />
            </div>
          </div>
          <div className="font-mono text-[16px] font-black text-zinc-900">
            {formatIDR(totalGlBelumTerhubung)}
          </div>
          <p className="mt-1 text-[9px] font-bold text-zinc-400 uppercase">
            Jurnal GL 100-01 ({tanggalAktif})
          </p>
        </div>

        <div
          className={`rounded-sm border p-4 shadow-sm ${
            selisihHarian === 0
              ? "border-emerald-200 bg-emerald-50/10"
              : "border-amber-200 bg-amber-50/10"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`text-[10px] font-black tracking-wider uppercase italic ${
                selisihHarian === 0 ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              Selisih Harian
            </span>
            <div
              className={`rounded-sm p-1.5 ${
                selisihHarian === 0 ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Scale
                className={`h-4 w-4 ${
                  selisihHarian === 0 ? "text-emerald-600" : "text-amber-600"
                }`}
              />
            </div>
          </div>
          <div
            className={`font-mono text-[16px] font-black ${
              selisihHarian === 0 ? "text-emerald-700" : "text-amber-600"
            }`}
          >
            {formatIDR(selisihHarian)}
          </div>
          <p
            className={`mt-1 text-[9px] font-bold uppercase ${
              selisihHarian === 0 ? "text-emerald-600/80" : "text-amber-600/80"
            }`}
          >
            {selisihHarian === 0 ? "Sudah balance" : "Belum balance"}
          </p>
        </div>

        <div className="flex items-center justify-center rounded-sm border border-zinc-200/80 bg-white p-4 shadow-sm">
          <button
            onClick={jalankanPencocokan}
            disabled={!pilihanBankId || !pilihanGlId}
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-sm text-xs font-black tracking-wide uppercase italic transition ${
              pilihanBankId && pilihanGlId
                ? "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                : "cursor-not-allowed bg-zinc-100 text-zinc-400"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" /> Hubungkan Data Terpilih
          </button>
        </div>
      </div>

      {/* 3. AREA UTAMA DUAL-PANEL */}
      <div className="mb-24 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PANEL KIRI: REKENING KORAN */}
        <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-md">
          <div className="flex items-center justify-between border-b bg-zinc-50/50 p-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Rekening Koran (Bank)
              </h2>
              <span className="text-[10px] font-semibold tracking-tight text-zinc-400 uppercase">
                Tanggal: {tanggalAktif}
              </span>
            </div>
            <span className="rounded-sm bg-blue-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-blue-700 uppercase">
              Bank BCA
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b bg-zinc-100/80 text-xs tracking-wider text-zinc-700 uppercase">
                <tr>
                  <th className="border-r p-3 font-bold">Pilih</th>
                  <th className="border-r p-3 font-bold">
                    Deskripsi Transaksi
                  </th>
                  <th className="border-r p-3 font-bold">Nominal</th>
                  <th className="border-r p-3 font-bold">Tipe</th>
                  <th className="p-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {bankHarian.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-zinc-400 italic"
                    >
                      Tidak ada transaksi bank pada tanggal ini.
                    </td>
                  </tr>
                ) : (
                  bankHarian.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        item.status === "TERHUBUNG"
                          ? "bg-emerald-50/30 opacity-60"
                          : pilihanBankId === item.id
                            ? "bg-blue-50/60"
                            : "hover:bg-zinc-50/80"
                      }`}
                    >
                      <td className="border-r p-3">
                        {item.status === "BELUM_TERHUBUNG" && (
                          <input
                            type="radio"
                            name="pilih_bank"
                            checked={pilihanBankId === item.id}
                            onChange={() => setPilihanBankId(item.id)}
                          />
                        )}
                      </td>
                      <td className="border-r p-3 font-medium text-zinc-700">
                        {item.deskripsi}
                      </td>
                      <td className="border-r p-3 font-mono text-[12px] font-black text-zinc-900">
                        {formatIDR(item.nominal)}
                      </td>
                      <td className="border-r p-3 text-[10px] font-black tracking-wide uppercase">
                        <span
                          className={
                            item.tipe === "KREDIT"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }
                        >
                          {item.tipe}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-sm px-2.5 py-1 text-[9px] font-black tracking-wider uppercase ${
                            item.status === "TERHUBUNG"
                              ? "bg-emerald-500 text-white"
                              : "bg-amber-400 text-black"
                          }`}
                        >
                          {item.status === "TERHUBUNG" ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Terhubung
                            </span>
                          ) : (
                            "Belum Match"
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: COA / BUKU BESAR */}
        <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-md">
          <div className="flex items-center justify-between border-b bg-zinc-50/50 p-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Buku Besar (General Ledger)
              </h2>
              <span className="text-[10px] font-semibold tracking-tight text-zinc-400 uppercase">
                Tanggal: {tanggalAktif}
              </span>
            </div>
            <span className="rounded-sm bg-purple-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-purple-700 uppercase">
              GL 100-01
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b bg-zinc-100/80 text-xs tracking-wider text-zinc-700 uppercase">
                <tr>
                  <th className="border-r p-3 font-bold">Pilih</th>
                  <th className="border-r p-3 font-bold">Keterangan Jurnal</th>
                  <th className="border-r p-3 font-bold">Nominal</th>
                  <th className="border-r p-3 font-bold">Tipe</th>
                  <th className="p-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {glHarian.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-zinc-400 italic"
                    >
                      Tidak ada transaksi buku besar pada tanggal ini.
                    </td>
                  </tr>
                ) : (
                  glHarian.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        item.status === "TERHUBUNG"
                          ? "bg-emerald-50/30 opacity-60"
                          : pilihanGlId === item.id
                            ? "bg-purple-50/60"
                            : "hover:bg-zinc-50/80"
                      }`}
                    >
                      <td className="border-r p-3">
                        {item.status === "BELUM_TERHUBUNG" && (
                          <input
                            type="radio"
                            name="pilih_gl"
                            checked={pilihanGlId === item.id}
                            onChange={() => setPilihanGlId(item.id)}
                          />
                        )}
                      </td>
                      <td className="border-r p-3 font-medium text-zinc-700">
                        {item.deskripsi}
                      </td>
                      <td className="border-r p-3 font-mono text-[12px] font-black text-zinc-900">
                        {formatIDR(item.nominal)}
                      </td>
                      <td className="border-r p-3 text-[10px] font-black tracking-wide uppercase">
                        <span
                          className={
                            item.tipe === "KREDIT"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }
                        >
                          {item.tipe}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-sm px-2.5 py-1 text-[9px] font-black tracking-wider uppercase ${
                            item.status === "TERHUBUNG"
                              ? "bg-emerald-500 text-white"
                              : "bg-amber-400 text-black"
                          }`}
                        >
                          {item.status === "TERHUBUNG" ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Terhubung
                            </span>
                          ) : (
                            "Belum Match"
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. PANEL STATUS BAWAH (STICKY FOOTER HARIAN) */}
      {/* left-0 di mobile (sidebar biasanya collapsed/overlay), lg:left-64 mengikuti lebar sidebar desktop.
          Ganti "lg:left-64" sesuai lebar sidebar aktual kamu (mis. lg:left-72, atau lg:left-[280px]). */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-zinc-800 bg-zinc-900 p-4 text-white shadow-lg lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap gap-8">
            <div>
              <span className="block text-[9px] font-black tracking-wider text-zinc-400 uppercase">
                Saldo Akhir Bank ({tanggalAktif})
              </span>
              <span className="font-mono text-[13px] font-black">
                {formatIDR(150000000)}
              </span>
            </div>
            <div>
              <span className="block text-[9px] font-black tracking-wider text-zinc-400 uppercase">
                + Belum Terhubung di GL
              </span>
              <span className="font-mono text-[13px] font-black text-amber-400">
                {formatIDR(totalGlBelumTerhubung)}
              </span>
            </div>
            <div>
              <span className="block text-[9px] font-black tracking-wider text-zinc-400 uppercase">
                - Belum Terhubung di Bank
              </span>
              <span className="font-mono text-[13px] font-black text-amber-400">
                {formatIDR(totalBankBelumTerhubung)}
              </span>
            </div>
            <div>
              <span className="block text-[9px] font-black tracking-wider text-zinc-400 uppercase">
                = Saldo Rekonsiliasi
              </span>
              <span className="font-mono text-[13px] font-black text-emerald-400">
                {formatIDR(
                  150000000 + totalGlBelumTerhubung - totalBankBelumTerhubung
                )}
              </span>
            </div>
          </div>

          <button className="h-9 rounded-sm bg-emerald-600 px-5 text-[11px] font-black tracking-wide text-white uppercase italic shadow-none transition hover:bg-emerald-700">
            Simpan & Tutup Buku Harian
          </button>
        </div>
      </div>
    </div>
  )
}
