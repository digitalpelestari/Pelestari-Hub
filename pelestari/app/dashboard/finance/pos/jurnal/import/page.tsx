"use client"

import React, { useEffect, useRef, useState } from "react"
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
  UploadCloud,
  CheckCircle2,
  XCircle,
  Copy,
  Landmark,
} from "lucide-react"
import {
  previewImportJurnal,
  commitImportJurnal,
} from "@/app/actions/import-jurnal"
import type { ImportPreviewRow } from "@/app/actions/import-jurnal.types"
import { swal } from "@/lib/sweetalert"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ImportJurnalPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [fileName, setFileName] = useState("")

  const [ciRows, setCiRows] = useState<ImportPreviewRow[]>([])
  const [coRows, setCoRows] = useState<ImportPreviewRow[]>([])
  const [kkRows, setKkRows] = useState<ImportPreviewRow[]>([])
  const [rekeningBelumDimapping, setRekeningBelumDimapping] = useState<
    string[]
  >([])
  const [summary, setSummary] = useState({
    totalBaris: 0,
    siap: 0,
    dilewati: 0,
  })

  const [lastBase64, setLastBase64] = useState<string>("")

  const handleCopySnippet = () => {
    const snippet = rekeningBelumDimapping
      .map((nama) => `  "${nama.toLowerCase()}": "NO_AKUN_DISINI", // ${nama}`)
      .join("\n")
    navigator.clipboard.writeText(snippet)
    swal.success(
      "Snippet disalin. Tempel ke REKENING_MAPPING di app/actions/import-jurnal.ts lalu isi no_akun-nya."
    )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsParsing(true)
    try {
      const base64 = await fileToBase64(file)
      setLastBase64(base64)
      await runPreview(base64)
    } catch (err: any) {
      swal.error("Gagal membaca file: " + err.message)
    } finally {
      setIsParsing(false)
    }
  }

  const runPreview = async (base64: string) => {
    const res = await previewImportJurnal(base64)
    if (!res.success) {
      swal.error(res.message || "Gagal memproses file")
      return
    }
    setCiRows(res.ci)
    setCoRows(res.co)
    setKkRows(res.kk)
    setRekeningBelumDimapping(res.rekeningBelumDimapping)
    setSummary(res.summary)
  }

  const handleImport = async () => {
    const siapRows = [...ciRows, ...coRows, ...kkRows].filter(
      (r) => r.status === "siap"
    )
    if (siapRows.length === 0) {
      swal.error("Tidak ada baris berstatus 'siap' untuk diimpor")
      return
    }

    if (
      !(await swal.confirm(
        `Import ${siapRows.length} transaksi ke jurnal umum? Baris berstatus "dilewati" tidak akan diimpor.`
      ))
    )
      return

    setIsImporting(true)
    try {
      const res = await commitImportJurnal(siapRows)
      if (res.success) {
        swal.success(res.message)
      } else {
        swal.error(
          res.message +
            (res.pesanGagal?.length ? "\n" + res.pesanGagal.join("\n") : "")
        )
      }
      // reset
      setCiRows([])
      setCoRows([])
      setKkRows([])
      setFileName("")
      if (fileInputRef.current) fileInputRef.current.value = ""
    } finally {
      setIsImporting(false)
    }
  }

  const renderRow = (row: ImportPreviewRow) => (
    <TableRow
      key={row.rowKey}
      className={row.status === "dilewati" ? "bg-rose-50/40" : ""}
    >
      <TableCell className="font-mono text-xs whitespace-nowrap">
        {row.noRegistrasi}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {row.tanggal || "-"}
      </TableCell>
      <TableCell className="text-xs">
        {row.rekeningExcel}
        {row.noAkunKasBank && (
          <span className="ml-1 text-[10px] text-zinc-400">
            → {row.noAkunKasBank}
            {row.skorMatchRekening !== null &&
              ` (${Math.round(row.skorMatchRekening * 100)}%)`}
          </span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {row.namaAkunLawan || (
          <span className="text-rose-500">tidak ditemukan</span>
        )}
        {row.skorMatchLawan !== null && (
          <span className="ml-1 text-[10px] text-zinc-400">
            ({Math.round(row.skorMatchLawan * 100)}%)
          </span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {row.namaPihak}
        {row.isPihakBaru && row.namaPihak && (
          <Badge
            variant="outline"
            className="ml-1 border-blue-200 bg-blue-50 text-[10px] text-blue-600"
          >
            baru
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs">{row.namaPemohon || "-"}</TableCell>
      <TableCell className="text-right font-mono text-xs">
        {new Intl.NumberFormat("id-ID").format(row.nominal)}
      </TableCell>
      <TableCell className="text-xs">
        {row.status === "siap" ? (
          <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Siap
          </Badge>
        ) : (
          <Badge
            className="gap-1 border-rose-200 bg-rose-50 text-rose-700"
            title={row.alasanDilewati}
          >
            <XCircle className="h-3 w-3" /> Dilewati
          </Badge>
        )}
        {row.status === "dilewati" && (
          <div className="mt-0.5 text-[10px] text-rose-500">
            {row.alasanDilewati}
          </div>
        )}
      </TableCell>
    </TableRow>
  )

  return (
    <div className="min-h-screen w-full space-y-6 bg-zinc-50/50 p-6 font-sans text-zinc-900">
      <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="rounded-lg bg-zinc-900 p-2 text-white">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Import Jurnal dari Excel (CI / CO / KK)
          </h1>
          <p className="text-xs text-zinc-500">
            Upload file laporan bulanan, sistem akan membaca sheet "CI ...", "CO
            ..." dan "Petty Cash" lalu mencocokkannya ke akun secara otomatis.
            Periksa hasilnya sebelum konfirmasi import.
          </p>
        </div>
      </div>

      {/* UPLOAD */}
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-6">
        <UploadCloud className="h-8 w-8 text-zinc-400" />
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="text-xs"
          />
          {fileName && (
            <p className="mt-1 text-xs text-zinc-500">File: {fileName}</p>
          )}
        </div>
        {isParsing && (
          <span className="text-xs text-zinc-500">Memproses file...</span>
        )}
      </div>

      {/* REKENING YANG BELUM ADA DI CONFIG */}
      {rekeningBelumDimapping.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">
            Ada {rekeningBelumDimapping.length} nama rekening yang belum ada di{" "}
            <code className="rounded bg-amber-100 px-1">REKENING_MAPPING</code>{" "}
            (dalam{" "}
            <code className="rounded bg-amber-100 px-1">
              app/actions/import-jurnal.ts
            </code>
            ). Baris dengan rekening ini akan dilewati sampai diisi dan aplikasi
            di-redeploy.
          </p>
          <ul className="flex flex-wrap gap-2">
            {rekeningBelumDimapping.map((nama) => (
              <li
                key={nama}
                className="rounded-md border border-amber-300 bg-white px-2 py-1 font-mono text-xs text-amber-800"
              >
                {nama}
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopySnippet}
            className="h-8 gap-1 border-amber-300 bg-white text-xs text-amber-800 hover:bg-amber-100"
          >
            <Copy className="h-3 w-3" /> Copy snippet untuk REKENING_MAPPING
          </Button>
          <p className="text-[11px] text-amber-700">
            Tempel hasil copy ke dalam objek <code>REKENING_MAPPING</code>,
            ganti <code>NO_AKUN_DISINI</code> dengan no_akun Kas/Bank yang
            benar, lalu upload ulang file setelah aplikasi di-redeploy.
          </p>
        </div>
      )}

      {/* SUMMARY + TOMBOL IMPORT */}
      {(ciRows.length > 0 || coRows.length > 0 || kkRows.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex gap-4 text-xs text-zinc-600">
            <span>
              Total baris: <b>{summary.totalBaris}</b>
            </span>
            <span className="text-emerald-600">
              Siap: <b>{summary.siap}</b>
            </span>
            <span className="text-rose-600">
              Dilewati: <b>{summary.dilewati}</b>
            </span>
          </div>
          <Button
            onClick={handleImport}
            disabled={isImporting || summary.siap === 0}
            className="h-9 gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isImporting ? "MENGIMPOR..." : `IMPOR ${summary.siap} TRANSAKSI`}
          </Button>
        </div>
      )}

      {/* PREVIEW CI */}
      {ciRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs font-bold uppercase">
            Pemasukan (CI) — {ciRows.length} baris
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="text-[11px] text-zinc-500 uppercase">
                  <TableHead>No. Registrasi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Akun Lawan (Pendapatan)</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{ciRows.map(renderRow)}</TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* PREVIEW CO */}
      {coRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs font-bold uppercase">
            Pengeluaran (CO) — {coRows.length} baris
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="text-[11px] text-zinc-500 uppercase">
                  <TableHead>No. Registrasi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Akun Lawan (Beban)</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{coRows.map(renderRow)}</TableBody>
            </Table>
          </div>
        </div>
      )}
      {/* PREVIEW KK / PETTY CASH */}
      {kkRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs font-bold uppercase">
            Petty Cash (KK) — {kkRows.length} baris
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[850px]">
              <TableHeader>
                <TableRow className="text-[11px] text-zinc-500 uppercase">
                  <TableHead>No. Registrasi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kas</TableHead>
                  <TableHead>Akun Beban</TableHead>
                  <TableHead>Kelompok Biaya</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {kkRows.map((row) => (
                  <TableRow
                    key={row.rowKey}
                    className={row.status === "dilewati" ? "bg-rose-50/40" : ""}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.noRegistrasi}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {row.tanggal || "-"}
                    </TableCell>

                    <TableCell className="text-xs">
                      {row.noAkunKasBank || "-"}
                    </TableCell>

                    <TableCell className="text-xs">
                      {row.namaAkunLawan || (
                        <span className="text-rose-500">tidak ditemukan</span>
                      )}

                      {row.skorMatchLawan !== null && (
                        <span className="ml-1 text-[10px] text-zinc-400">
                          ({Math.round(row.skorMatchLawan * 100)}%)
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {row.teksSumberLawan || "-"}
                    </TableCell>

                    <TableCell className="text-xs">
                      {row.keterangan || "-"}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs">
                      {new Intl.NumberFormat("id-ID").format(row.nominal)}
                    </TableCell>

                    <TableCell className="text-xs">
                      {row.status === "siap" ? (
                        <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Siap
                        </Badge>
                      ) : (
                        <>
                          <Badge
                            className="gap-1 border-rose-200 bg-rose-50 text-rose-700"
                            title={row.alasanDilewati}
                          >
                            <XCircle className="h-3 w-3" />
                            Dilewati
                          </Badge>

                          <div className="mt-0.5 text-[10px] text-rose-500">
                            {row.alasanDilewati}
                          </div>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
