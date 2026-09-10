"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
  Save,
  X,
  FileText,
  ArrowLeft,
  Search,
  Loader2,
} from "lucide-react"
import {
  createJurnalDenganReferensiInvoiceOnly,
  generateNoRegistrasiOtomatis,
} from "@/app/actions/jurnal"
import { getAkunList } from "@/app/actions/akun"
import { getPenerima } from "@/app/actions/penerima"
import { lookupReferensi, type ReferensiMatch } from "@/app/actions/referensi"
import Link from "next/link"
import { swal } from "@/lib/sweetalert"

interface JournalItem {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  kredit: number
  keterangan: string
}

interface JournalForm {
  tanggal: string
  noRegistrasi: string
  noReferensi: string
  invoiceId?: number | null
  poId?: number | null
  penerimaId: number | null
  keterangan: string
  items: JournalItem[]
}

function makeEmptyItems(): JournalItem[] {
  return [
    {
      accountCode: "",
      accountName: "",
      accountType: "",
      debit: 0,
      kredit: 0,
      keterangan: "",
    },
    {
      accountCode: "",
      accountName: "",
      accountType: "",
      debit: 0,
      kredit: 0,
      keterangan: "",
    },
  ]
}

export default function KasirJurnalPage() {
  const [akunList, setAkunList] = useState<any[]>([])

  const [penerimaList, setPenerimaList] = useState<
    { id: number; nama_penerima: string }[]
  >([])
  const [searchPenerima, setSearchPenerima] = useState("")
  const [showPenerimaDropdown, setShowPenerimaDropdown] = useState(false)
  const [loadingSearchPenerima, setLoadingSearchPenerima] = useState(false)

  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState<JournalForm>({
    tanggal: new Date().toISOString().split("T")[0],
    noRegistrasi: "",
    noReferensi: "",
    penerimaId: null,
    keterangan: "",
    items: makeEmptyItems(),
  })

  // State lookup referensi -- HANYA untuk info sisa tagihan & validasi, TIDAK auto-fill baris jurnal
  const [referensiMatch, setReferensiMatch] = useState<ReferensiMatch>({
    found: null,
  })
  const [isLooking, setIsLooking] = useState(false)
  const lastQueriedRef = useRef<string>("")

  // Ref untuk dropdown penerima
  const penerimaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadAkun() {
      const data = await getAkunList()
      setAkunList(data)
    }

    loadAkun()
  }, [])

  useEffect(() => {
    const keyword = searchPenerima.trim()

    if (!keyword) {
      setPenerimaList([])
      setLoadingSearchPenerima(false)
      return
    }

    if (keyword.length < 2) {
      setPenerimaList([])
      setLoadingSearchPenerima(false)
      return
    }

    setLoadingSearchPenerima(true)

    const timer = setTimeout(async () => {
      try {
        const data = await getPenerima(keyword)
        setPenerimaList(Array.isArray(data) ? data : [])
      } catch (error) {
        setPenerimaList([])
      } finally {
        setLoadingSearchPenerima(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchPenerima])

  const totalDebit = form.items.reduce(
    (sum, item) => sum + (Number(item.debit) || 0),
    0
  )
  const totalKredit = form.items.reduce(
    (sum, item) => sum + (Number(item.kredit) || 0),
    0
  )
  const isBalanced = totalDebit === totalKredit && totalDebit > 0

  // Generator manual saat tombol +BK / +BD / +KK diklik
  const handleGenerateManual = async (tipe: "BK" | "BD" | "KK") => {
    const res = await generateNoRegistrasiOtomatis(tipe as any)
    if (res.success && res.code) {
      setForm((prev) => ({ ...prev, noRegistrasi: res.code }))
    }
  }

  // Debounce lookup noReferensi ~400ms -- HANYA menampilkan info sisa tagihan, tidak isi baris jurnal
  useEffect(() => {
    const noRef = (form.noReferensi || "").trim()
    if (noRef.length < 3) {
      setReferensiMatch({ found: null })
      setIsLooking(false)
      lastQueriedRef.current = ""
      return
    }
    if (noRef === lastQueriedRef.current) return

    setIsLooking(true)
    const timer = setTimeout(async () => {
      try {
        const result = await lookupReferensi(noRef)
        lastQueriedRef.current = noRef
        setReferensiMatch(result)
      } catch (e) {
        setReferensiMatch({ found: null })
      } finally {
        setIsLooking(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [form.noReferensi])

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Handler nominal murni tanpa side effect ke nomor registrasi
  const handleItemChange = (
    index: number,
    field: keyof JournalItem,
    value: string | number
  ) => {
    const updatedItems = [...form.items]

    if (field === "accountCode") {
      updatedItems[index].accountCode = value as string
      const targetAkun = akunList.find((a) => a.no_akun === value)
      updatedItems[index].accountName = targetAkun ? targetAkun.nama_akun : ""
      updatedItems[index].accountType = targetAkun
        ? targetAkun.nama_kelompok || "General Parameter"
        : ""
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value }
    }

    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          accountCode: "",
          accountName: "",
          accountType: "",
          debit: 0,
          kredit: 0,
          keterangan: "",
        },
      ],
    }))
  }

  const removeRow = (index: number) => {
    if (form.items.length <= 2) {
      swal.warning(
        "Jurnal umum minimal harus memiliki 2 baris (Debit & Kredit)."
      )
      return
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasi awal: jika referensi invoice/PO, pastikan akun target dan bank/kas diisi
    if (referensiMatch.found === "invoice" || referensiMatch.found === "po") {
      const keyword = referensiMatch.found === "invoice" ? "PIUTANG" : "UTANG"
      const hasTarget = form.items.some((item) => {
        const tipe = (item.accountType || "").toUpperCase()
        const nominal = (Number(item.debit) || 0) + (Number(item.kredit) || 0)
        return tipe.includes(keyword) && nominal > 0
      })
      const hasBank = form.items.some((item) => {
        const tipe = (item.accountType || "").toUpperCase()
        const nominal = (Number(item.debit) || 0) + (Number(item.kredit) || 0)
        return tipe.includes("KAS/BANK") && nominal > 0
      })

      if (!hasTarget || !hasBank) {
        const pesan =
          referensiMatch.found === "invoice"
            ? "Untuk pembayaran invoice, harap isi akun Piutang (Kredit) dan Bank/Kas (Debit)!"
            : "Untuk pembayaran PO, harap isi akun Utang (Debit) dan Bank/Kas (Kredit)!"
        return swal.warning(pesan)
      }
    }

    if (!isBalanced)
      return swal.warning("Total Debit dan Kredit harus seimbang (Balanced)!")

    // Validasi dini: cek apakah nominal bayar melebihi sisa tagihan invoice/PO
    if (referensiMatch.found === "invoice" || referensiMatch.found === "po") {
      const sisaTagihan = Number(referensiMatch.data.sisa_tagihan) || 0
      const keyword = referensiMatch.found === "invoice" ? "PIUTANG" : "UTANG"

      const nominalTerkait = form.items.reduce((sum, item) => {
        const tipe = (item.accountType || "").toUpperCase()
        if (tipe.includes(keyword)) {
          return sum + (Number(item.debit) || 0) + (Number(item.kredit) || 0)
        }
        return sum
      }, 0)

      if (nominalTerkait > sisaTagihan) {
        return swal.warning(
          `Nominal pembayaran (Rp ${nominalTerkait.toLocaleString("id-ID")}) melebihi sisa tagihan ${referensiMatch.data.nomor} (Rp ${sisaTagihan.toLocaleString("id-ID")}). Periksa kembali nominal debit/kredit.`
        )
      }
    }

    setLoading(true)
    const res = await createJurnalDenganReferensiInvoiceOnly(form)

    if (res.success) {
      swal.success(res.message)
      setForm({
        tanggal: new Date().toISOString().split("T")[0],
        noRegistrasi: "",
        noReferensi: "",
        invoiceId: null,
        poId: null,
        penerimaId: null,
        keterangan: "",
        items: makeEmptyItems(),
      })
      setReferensiMatch({ found: null })
      lastQueriedRef.current = ""
    } else {
      swal.error("Gagal Simpan: " + res.message)
    }
    setLoading(false)
  }

  return (
    <div className="w-full space-y-6 p-6 font-sans text-zinc-900">
      {/* HEADER BAR UTAMA */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Buat Jurnal Umum Baru
            </h1>
          </div>
          <p className="pl-9 text-xs text-zinc-500">
            Double-Entry Accounting Input System
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance/pos/jurnal">
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-lg border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4 text-zinc-500" /> LIHAT RIWAYAT
              JURNAL
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* HEADER TRANSAKSI (5 KOLOM RESPONSIF) */}
        <Card className="rounded-sm border bg-zinc-50/50 shadow-sm">
          <CardContent className="grid grid-cols-1 gap-4 p-4 text-xs md:grid-cols-5">
            {/* 1. TANGGAL */}
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black text-zinc-500 uppercase italic">
                Tanggal Transaksi *
              </label>
              <Input
                type="date"
                name="tanggal"
                value={form.tanggal}
                onChange={handleHeaderChange}
                required
                className="h-10 rounded-sm border-zinc-300 bg-white font-bold"
              />
            </div>

            {/* 2. NO. REGISTRASI + 3 BADGE (BK / BD / KK) */}
            <div className="space-y-1.5">
              <label className="ml-1 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase italic">
                <span>No. Registrasi / Bukti</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="BK/BD/KK"
                  name="noRegistrasi"
                  value={form.noRegistrasi}
                  onChange={handleHeaderChange}
                  className="h-10 rounded-sm border-zinc-300 bg-white pr-24 font-mono font-bold text-zinc-700"
                />
                <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
                  <Badge
                    onClick={() => handleGenerateManual("BK")}
                    className="cursor-pointer rounded-[2px] border border-red-200 bg-red-50 px-1 py-0.5 text-[8px] font-bold text-red-700 hover:bg-red-100"
                    title="Bank Keluar"
                  >
                    +BK
                  </Badge>
                  <Badge
                    onClick={() => handleGenerateManual("BD")}
                    className="cursor-pointer rounded-[2px] border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[8px] font-bold text-emerald-700 hover:bg-emerald-100"
                    title="Bank Masuk / Debet"
                  >
                    +BD
                  </Badge>
                  <Badge
                    onClick={() => handleGenerateManual("KK")}
                    className="cursor-pointer rounded-[2px] border border-amber-200 bg-amber-50 px-1 py-0.5 text-[8px] font-bold text-amber-700 hover:bg-amber-100"
                    title="Kas Keluar"
                  >
                    +KK
                  </Badge>
                </div>
              </div>
            </div>

            {/* 3. NO. REFERENSI */}
            <div className="space-y-1.5">
              <label className="ml-1 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase italic">
                <span>No. Referensi / Nota Asli</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="Contoh: 001/INV/VIII/2026/G atau 001/PO-GA/..."
                  name="noReferensi"
                  value={form.noReferensi}
                  onChange={handleHeaderChange}
                  className="h-10 rounded-sm border-zinc-300 bg-white pr-10 font-bold"
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  {isLooking ? (
                    <Search className="h-4 w-4 animate-pulse text-zinc-400" />
                  ) : referensiMatch.found ? (
                    <Search className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Search className="h-4 w-4 text-zinc-300" />
                  )}
                </div>
              </div>
              {/* BADGE INFO SISA TAGIHAN -- untuk referensi kasir, TIDAK auto-fill apapun */}
              <div className="flex min-h-[20px] flex-wrap items-center gap-1.5 pt-1">
                {isLooking && (
                  <Badge
                    variant="outline"
                    className="rounded-[2px] border-zinc-300 text-[9px] font-bold text-zinc-500"
                  >
                    <Search className="mr-1 h-3 w-3 animate-pulse" /> Mencari
                    referensi...
                  </Badge>
                )}
                {!isLooking && referensiMatch.found === "invoice" && (
                  <Badge className="rounded-[2px] border border-emerald-300 bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800 hover:bg-emerald-100">
                    ✓ INVOICE: {referensiMatch.data.nomor} —{" "}
                    {referensiMatch.data.perusahaan_tujuan}
                    <span className="ml-1 font-mono">
                      (Sisa Rp{" "}
                      {referensiMatch.data.sisa_tagihan.toLocaleString("id-ID")}
                      )
                    </span>
                  </Badge>
                )}
                {!isLooking && referensiMatch.found === "po" && (
                  <Badge className="rounded-[2px] border border-amber-300 bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800 hover:bg-amber-100">
                    ✓ PO: {referensiMatch.data.nomor} —{" "}
                    {referensiMatch.data.vendor_nama}
                    <span className="ml-1 font-mono">
                      (Sisa Rp{" "}
                      {referensiMatch.data.sisa_tagihan.toLocaleString("id-ID")}
                      )
                    </span>
                  </Badge>
                )}
                {!isLooking &&
                  referensiMatch.found === null &&
                  form.noReferensi.trim().length >= 3 && (
                    <Badge
                      variant="outline"
                      className="rounded-[2px] border-zinc-300 text-[9px] font-bold text-zinc-500"
                    >
                      Referensi bebas — tidak terhubung ke invoice/PO
                    </Badge>
                  )}
              </div>
            </div>

            {/* 4. PENERIMA / VENDOR */}
            <div className="space-y-1.5">
              <label className="ml-1 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase italic">
                Penerima
              </label>

              <div className="relative">
                <div className="relative">
                  <Input
                    placeholder="Cari penerima..."
                    value={searchPenerima}
                    onChange={(e) => {
                      const value = e.target.value

                      setSearchPenerima(value)
                      setShowPenerimaDropdown(true)

                      // Kalau input dikosongkan, hapus penerima yang dipilih
                      if (!value.trim()) {
                        setForm((prev) => ({
                          ...prev,
                          penerimaId: null,
                        }))
                      }
                    }}
                    onFocus={() => {
                      if (searchPenerima.trim().length >= 2) {
                        setShowPenerimaDropdown(true)
                      }
                    }}
                    className="h-10 rounded-sm border-zinc-300 bg-white pr-9 font-bold"
                  />

                  {loadingSearchPenerima ? (
                    <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
                  ) : searchPenerima ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPenerima("")
                        setPenerimaList([])
                        setShowPenerimaDropdown(false)

                        setForm((prev) => ({
                          ...prev,
                          penerimaId: null,
                        }))
                      }}
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  )}
                </div>

                {/* HASIL PENCARIAN */}
                {showPenerimaDropdown && searchPenerima.trim().length >= 2 && (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-zinc-200 bg-white shadow-lg">
                    {loadingSearchPenerima ? (
                      <div className="px-3 py-3 text-xs text-zinc-400">
                        Mencari penerima...
                      </div>
                    ) : penerimaList.length > 0 ? (
                      penerimaList.map((penerima) => (
                        <button
                          key={penerima.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              penerimaId: penerima.id,
                            }))

                            setSearchPenerima(penerima.nama_penerima)
                            setShowPenerimaDropdown(false)
                          }}
                          className="block w-full px-3 py-2.5 text-left text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                        >
                          {penerima.nama_penerima}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs text-zinc-400">
                        Penerima tidak ditemukan.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 5. KETERANGAN */}
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black text-zinc-500 uppercase italic">
                Keterangan Umum
              </label>
              <Input
                placeholder="Deskripsi ringkas transaksi..."
                name="keterangan"
                value={form.keterangan}
                onChange={handleHeaderChange}
                className="h-10 rounded-sm border-zinc-300 bg-white font-bold"
              />
            </div>
          </CardContent>
        </Card>

        {/* TABLE DATA ITEM */}
        <div className="overflow-hidden rounded-sm border border-zinc-300 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-zinc-100">
              <TableRow className="border-b border-zinc-300 text-[10px] font-black uppercase hover:bg-zinc-100">
                <TableHead className="w-[160px] border-r px-3 py-4 font-black text-zinc-800">
                  Kode Akun
                </TableHead>
                <TableHead className="border-r px-3 font-black text-zinc-800">
                  Nama Akun
                </TableHead>
                <TableHead className="w-[180px] border-r px-3 font-black text-zinc-800">
                  Tipe Akun (Kelompok)
                </TableHead>
                <TableHead className="border-r px-3 font-black text-zinc-800">
                  Keterangan
                </TableHead>
                <TableHead className="w-[160px] border-r px-3 text-right font-black text-zinc-800">
                  Debit (Rp)
                </TableHead>
                <TableHead className="w-[160px] border-r px-3 text-right font-black text-zinc-800">
                  Kredit (Rp)
                </TableHead>
                <TableHead className="w-[50px] text-center font-black text-zinc-800">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.items.map((item, index) => (
                <TableRow
                  key={index}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
                >
                  <TableCell className="border-r p-1">
                    <Input
                      list={`coa-codes-${index}`}
                      placeholder="Ketik/Pilih Kode..."
                      value={item.accountCode}
                      onChange={(e) =>
                        handleItemChange(index, "accountCode", e.target.value)
                      }
                      required
                      className="h-9 border-none bg-transparent font-mono text-xs font-bold shadow-none focus-visible:ring-0"
                    />
                    <datalist id={`coa-codes-${index}`}>
                      {akunList.map((a) => (
                        <option key={a.id} value={a.no_akun}>
                          {`${a.nama_akun} (${a.nama_kelompok || "General Parameter"})`}
                        </option>
                      ))}
                    </datalist>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <Input
                      readOnly
                      placeholder="Nama Akun otomatis..."
                      value={item.accountName}
                      className="h-9 border-none bg-zinc-50/50 text-xs font-bold text-zinc-500 shadow-none"
                    />
                  </TableCell>
                  <TableCell className="border-r px-3">
                    {item.accountType ? (
                      <Badge
                        variant="outline"
                        className="rounded-sm border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[9px] font-black text-zinc-500 uppercase italic"
                      >
                        {item.accountType}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-zinc-300 italic">
                        Belum dipilih
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <Input
                      placeholder="Keterangan..."
                      value={item.keterangan || ""}
                      onChange={(e) =>
                        handleItemChange(index, "keterangan", e.target.value)
                      }
                      className="h-9 border-none bg-transparent text-xs font-medium shadow-none focus-visible:ring-0"
                    />
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.debit || ""}
                      onChange={(e) =>
                        handleItemChange(index, "debit", Number(e.target.value))
                      }
                      className="h-9 border-none bg-transparent text-right font-mono text-xs font-bold shadow-none focus-visible:ring-0"
                    />
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.kredit || ""}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "kredit",
                          Number(e.target.value)
                        )
                      }
                      className="h-9 border-none bg-transparent text-right font-mono text-xs font-bold shadow-none focus-visible:ring-0"
                    />
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-sm text-zinc-400 hover:text-red-600"
                      onClick={() => removeRow(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* CONTROL BOTTOM */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-sm border border-zinc-200 bg-zinc-100/50 p-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            className="h-9 w-full rounded-sm border-zinc-300 bg-white text-xs font-black sm:w-auto"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> TAMBAH BARIS AKUN
          </Button>
          <div className="text-center text-xs font-bold">
            {totalDebit === 0 && totalKredit === 0 ? (
              <span className="text-zinc-400 italic">
                Nilai debit dan kredit kosong.
              </span>
            ) : isBalanced ? (
              <div className="flex items-center gap-6">
                <span className="rounded-[4px] border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-[9px] font-black tracking-wider text-emerald-700 uppercase">
                  ✓ SEIMBANG (BALANCE)
                </span>
                <span className="font-mono text-zinc-600">
                  Total: Rp {totalDebit.toLocaleString("id-ID")},00
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <span className="rounded-[4px] border border-rose-200 bg-rose-100/80 px-3 py-1 text-[9px] font-black tracking-wider text-rose-700 uppercase">
                  ⚠️ BELUM BALANCED
                </span>
                <span className="font-mono text-rose-600">
                  Selisih: Rp{" "}
                  {Math.abs(totalDebit - totalKredit).toLocaleString("id-ID")}
                  ,00
                </span>
              </div>
            )}
          </div>
        </div>

        {/* BUTTON SIMPAN */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <Button
            type="submit"
            disabled={!isBalanced || loading}
            className={`h-10 rounded-sm px-8 text-xs font-black italic shadow-sm ${isBalanced ? "bg-black text-white hover:bg-zinc-800" : "cursor-not-allowed bg-zinc-200 text-zinc-400"}`}
          >
            <Save className="mr-1.5 h-4 w-4" />{" "}
            {loading ? "SEDANG MENYIMPAN..." : "SIMPAN JURNAL UMUM"}
          </Button>
        </div>
      </form>
    </div>
  )
}
