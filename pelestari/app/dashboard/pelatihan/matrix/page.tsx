"use client"

import React, { useState, useEffect, useId } from "react"
import Swal from "sweetalert2"
import { createWorker } from "tesseract.js"
import { uploadFileToR2Action } from "@/app/actions/upload-r2"
import ExcelJS from "exceljs"
import { FileSpreadsheet } from "lucide-react"
import {
  Search,
  Eye,
  Loader2,
  Plus,
  Building2,
  Truck,
  MapPin,
  X,
  CreditCard,
  User,
  Image as ImageIcon,
  Layers,
  FileText,
  Calendar,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react"

export interface TbBatch {
  id: number
  nama: string
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  lokasi: string | null
}

export type JenisPelatihan = "AKBB" | "ABB" | "OTHERS"

export interface TbMatrix {
  id: number
  batch_id: number | null
  nama_batch?: string
  nama: string
  tempat_lahir: string | null
  tanggal_lahir: string | null
  nik: string | null
  nomor_sim: string | null
  jenis_sim: string | null
  perusahaan: string | null
  lokasi: string | null
  jenis_muatan: string | null
  foto_ktp: string | null
  foto_sim: string | null
  pas_foto: string | null
  jenis_pelatihan: JenisPelatihan | null
  created_at: string
}

export default function PelatihanMatrixPage() {
  const [batches, setBatches] = useState<TbBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const [data, setData] = useState<TbMatrix[]>([])

  const [loadingBatch, setLoadingBatch] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [search, setSearch] = useState("")
  const [filterJenisPelatihan, setFilterJenisPelatihan] = useState<"ALL" | JenisPelatihan>("ALL")

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<TbMatrix | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)
  const [isBatchEditMode, setIsBatchEditMode] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Form Batch State
  const [batchForm, setBatchForm] = useState({
    nama: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    lokasi: "",
  })

  // Form Peserta State
  const [formValues, setFormValues] = useState({
    batch_id: "",
    nama: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    nik: "",
    nomor_sim: "",
    jenis_sim: "B II UMUM",
    perusahaan: "",
    lokasi: "",
    jenis_muatan: "",
    jenis_pelatihan: "AKBB" as JenisPelatihan,
  })

  // Files & Previews
  const [fileKtp, setFileKtp] = useState<File | null>(null)
  const [previewKtp, setPreviewKtp] = useState<string>("")
  const [fileSim, setFileSim] = useState<File | null>(null)
  const [previewSim, setPreviewSim] = useState<string>("")
  const [filePasFoto, setFilePasFoto] = useState<File | null>(null)
  const [previewPasFoto, setPreviewPasFoto] = useState<string>("")

  // OCR Client States
  const [loadingOcrKtp, setLoadingOcrKtp] = useState(false)
  const [loadingOcrSim, setLoadingOcrSim] = useState(false)

  // State Edit & Delete Peserta
  const [isPesertaEditMode, setIsPesertaEditMode] = useState(false)
  const [editingPesertaId, setEditingPesertaId] = useState<number | null>(null)
  const [existingFoto, setExistingFoto] = useState({
    ktp: "",
    sim: "",
    pasFoto: "",
  })

  const ktpInputId = useId()
  const simInputId = useId()
  const photoInputId = useId()

  // 1. Fetch Batches
  const fetchBatches = async (): Promise<TbBatch[]> => {
    try {
      setLoadingBatch(true)
      const res = await fetch("/api/batch")
      const json = await res.json()
      if (json.success) {
        const data = (json.data || []) as TbBatch[]
        setBatches(data)
        return data
      }
      return []
    } catch (err) {
      console.error("Error fetch batch:", err)
      return []
    } finally {
      setLoadingBatch(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  // 2. Fetch Data Matrix
  const fetchMatrixData = async (batchId: string) => {
    try {
      setLoadingData(true)
      const url = batchId ? `/api/matrix?batch_id=${batchId}` : `/api/matrix`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error("Error fetch matrix:", err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchMatrixData(selectedBatchId)
  }, [selectedBatchId])

  // Helper Usia
  const calculateAge = (dateString: string | null) => {
    if (!dateString) return "-"
    const birth = new Date(dateString)
    if (isNaN(birth.getTime())) return "-"
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return `${age}`
  }

  const cmToPx = (cm: number) => (cm * 96) / 2.54
  const ptToPx = (pt: number) => (pt * 96) / 72

  // Lebar kolom Excel (dalam "karakter") -> pixel, formula standar Excel
  // dengan asumsi font default Calibri 11 (Maximum Digit Width = 7px)
  const excelColWidthToPx = (charWidth: number) => {
    const mdw = 7
    return Math.round(((256 * charWidth + Math.trunc(128 / mdw)) / 256) * mdw)
  }

  // Kebalikannya: dari target pixel -> lebar kolom Excel (karakter)
  const pxToExcelColWidth = (px: number) => {
    const mdw = 7
    return (px - Math.trunc(128 / mdw) * (mdw / 256)) / mdw
  }

  // ------------------------------------------------------------------
  // FETCH GAMBAR: buffer + tipe + dimensi asli (untuk pas foto)
  // ------------------------------------------------------------------
  async function fetchImageAsBuffer(url: string | null): Promise<{
    buffer: ArrayBuffer
    extension: "jpeg" | "png"
    naturalWidth: number
    naturalHeight: number
  } | null> {
    if (!url) return null
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buffer = await res.arrayBuffer()
      const contentType = res.headers.get("content-type") || ""
      const extension = contentType.includes("png") ? "png" : "jpeg"

      // Ambil dimensi asli gambar via createImageBitmap (tersedia di browser modern)
      let naturalWidth = 0
      let naturalHeight = 0
      try {
        const blob = new Blob([buffer], {
          type: contentType || `image/${extension}`,
        })
        const bitmap = await createImageBitmap(blob)
        naturalWidth = bitmap.width
        naturalHeight = bitmap.height
        bitmap.close()
      } catch {
        // fallback kalau createImageBitmap gagal / tidak didukung
        naturalWidth = 0
        naturalHeight = 0
      }

      return { buffer, extension, naturalWidth, naturalHeight }
    } catch (err) {
      console.warn("Gagal fetch gambar untuk export:", url, err)
      return null
    }
  }

  // Hitung ukuran "contain" (fit tanpa distorsi) ke dalam kotak maksimal
  function fitContain(natW: number, natH: number, maxW: number, maxH: number) {
    if (!natW || !natH) return { width: maxW, height: maxH }
    const scale = Math.min(maxW / natW, maxH / natH)
    return { width: Math.round(natW * scale), height: Math.round(natH * scale) }
  }

  // Helper untuk format rentang tanggal pelatihan (tetap sama seperti sebelumnya)
  const BULAN_ID = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ]
  function formatTanggalIndo(dateString: string | null): string {
    if (!dateString) return "-"
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return "-"
    return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`
  }

  function formatRentangTanggal(
    mulai: string | null,
    selesai: string | null
  ): string {
    if (!mulai) return "-"
    const dMulai = new Date(mulai)
    if (isNaN(dMulai.getTime())) return "-"

    if (!selesai) {
      return `${dMulai.getDate()} ${BULAN_ID[dMulai.getMonth()]} ${dMulai.getFullYear()}`
    }

    const dSelesai = new Date(selesai)
    if (isNaN(dSelesai.getTime())) {
      return `${dMulai.getDate()} ${BULAN_ID[dMulai.getMonth()]} ${dMulai.getFullYear()}`
    }

    const sameMonth =
      dMulai.getMonth() === dSelesai.getMonth() &&
      dMulai.getFullYear() === dSelesai.getFullYear()

    if (sameMonth) {
      return `${dMulai.getDate()}-${dSelesai.getDate()} ${BULAN_ID[dMulai.getMonth()]} ${dMulai.getFullYear()}`
    }

    return `${dMulai.getDate()} ${BULAN_ID[dMulai.getMonth()]} - ${dSelesai.getDate()} ${BULAN_ID[dSelesai.getMonth()]} ${dSelesai.getFullYear()}`
  }

  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Tidak ada data",
        text: "Tidak ada peserta pada batch ini untuk diekspor.",
      })
      return
    }

    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = "Sistem Pelatihan"
      workbook.created = new Date()

      const sheet = workbook.addWorksheet("Matrix Peserta", {
        views: [{ state: "frozen", ySplit: 4 }],
      })

      // ------------------------------------------------------------------
      // UKURAN FOTO (dalam pixel, dikonversi dari cm)
      // ------------------------------------------------------------------
      const KTP_SIM_SIZE_PX = {
        width: 240,
        height: 153,
      }
      const PAS_FOTO_MAX_BOX_PX = {
        width: 124,
        height: 151,
      }
      const PADDING_PX = 16

      const COLS = [
        { header: "No", width: 6 },
        { header: "Nama", width: 26 },
        { header: "Tempat, Tanggal Lahir", width: 26 },
        { header: "Nama Perusahaan", width: 24 },
        { header: "No. NIK", width: 20 },
        { header: "No. SIM", width: 20 },
        { header: "Klasifikasi (Jenis SIM)", width: 16 },
        { header: "Jenis Muatan yang Dibawa Driver", width: 28 },
        { header: "Usia", width: 10 },
        {
          header: "KTP",
          width: pxToExcelColWidth(KTP_SIM_SIZE_PX.width + PADDING_PX),
        },
        {
          header: "SIM",
          width: pxToExcelColWidth(KTP_SIM_SIZE_PX.width + PADDING_PX),
        },
        {
          header: "Foto",
          width: pxToExcelColWidth(PAS_FOTO_MAX_BOX_PX.width + PADDING_PX),
        },
        { header: "Lokasi", width: 18 },
      ]
      const TOTAL_COLS = COLS.length

      COLS.forEach((c, i) => {
        sheet.getColumn(i + 1).width = c.width
      })

      // ------------------------------------------------------------------
      // JUDUL DI ATAS TABEL (3 baris, merge sepanjang seluruh kolom)
      // ------------------------------------------------------------------
      const namaBatchTitle = currentBatchInfo?.nama?.toUpperCase() || "SEMUA BATCH"
      const lokasiTitle = currentBatchInfo?.lokasi?.toUpperCase() || ""
      const rentangTanggal = formatRentangTanggal(
        currentBatchInfo?.tanggal_mulai || null,
        currentBatchInfo?.tanggal_selesai || null
      )

      const titleLines = [
        "DAFTAR NAMA PESERTA DIKLAT AWAK ANGKUTAN BARANG BERBAHAYA",
        "DILAKSANAKAN OLEH PT PEDULI LESTARI INDONESIA",
        `TANGGAL PELATIHAN ${rentangTanggal} ${namaBatchTitle}${lokasiTitle ? " " + lokasiTitle : ""}`.trim(),
      ]

      titleLines.forEach((text, i) => {
        const rowNum = i + 1
        sheet.mergeCells(rowNum, 1, rowNum, TOTAL_COLS)
        const cell = sheet.getCell(rowNum, 1)
        cell.value = text
        cell.font = { bold: true, size: i === 0 ? 13 : 11 }
        cell.alignment = { vertical: "middle", horizontal: "center" }
        sheet.getRow(rowNum).height = i === 0 ? 22 : 18
      })

      // ------------------------------------------------------------------
      // HEADER TABEL (baris ke-4) — background putih, teks hitam bold
      // ------------------------------------------------------------------
      const HEADER_ROW_NUM = 4
      const headerRow = sheet.getRow(HEADER_ROW_NUM)
      COLS.forEach((c, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = c.header
        cell.font = { bold: true, color: { argb: "FF000000" } }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        }
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        }
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        }
      })
      headerRow.height = 30

      const IDX_KTP = COLS.findIndex((c) => c.header === "KTP") + 1
      const IDX_SIM = COLS.findIndex((c) => c.header === "SIM") + 1
      const IDX_FOTO = COLS.findIndex((c) => c.header === "Foto") + 1

      // Tinggi baris (points) dibuat cukup untuk memuat foto 5,398 cm + padding
      const IMAGE_ROW_HEIGHT_PT =
        ((KTP_SIM_SIZE_PX.height + PADDING_PX) * 72) / 96

      // Lebar kolom foto dalam pixel (dipakai untuk menghitung centering)
      const colWidthPxKtp = excelColWidthToPx(COLS[IDX_KTP - 1].width)
      const colWidthPxSim = excelColWidthToPx(COLS[IDX_SIM - 1].width)
      const colWidthPxFoto = excelColWidthToPx(COLS[IDX_FOTO - 1].width)
      const rowHeightPx = ptToPx(IMAGE_ROW_HEIGHT_PT)

      // Helper: hitung posisi tl (top-left) fractional supaya gambar center
      // di dalam sel (col/row berupa index 0-based + pecahan posisi dlm sel)
      function centeredAnchor(
        colIndex0: number,
        rowIndex0: number,
        colWidthPx: number,
        imgWidthPx: number,
        imgHeightPx: number
      ) {
        const offsetXFrac = Math.max(
          0,
          (colWidthPx - imgWidthPx) / 2 / colWidthPx
        )
        const offsetYFrac = Math.max(
          0,
          (rowHeightPx - imgHeightPx) / 2 / rowHeightPx
        )
        return { col: colIndex0 + offsetXFrac, row: rowIndex0 + offsetYFrac }
      }

      // ------------------------------------------------------------------
      // DATA PESERTA
      // ------------------------------------------------------------------
      for (let idx = 0; idx < filteredData.length; idx++) {
        const row = filteredData[idx]
        const rowNum = HEADER_ROW_NUM + 1 + idx
        const dataRow = sheet.getRow(rowNum)

        const ttl = `${row.tempat_lahir || "-"}, ${formatTanggalIndo(row.tanggal_lahir)}`

        const values = [
          idx + 1,
          row.nama || "-",
          ttl,
          row.perusahaan || "-",
          row.nik || "-",
          row.nomor_sim || "-",
          row.jenis_sim || "-",
          row.jenis_muatan || "-",
          calculateAge(row.tanggal_lahir),
          "",
          "",
          "",
          row.lokasi || "-",
        ]

        values.forEach((val, colIdx) => {
          const cell = dataRow.getCell(colIdx + 1)
          cell.value = val
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          }
          cell.alignment = {
            vertical: "middle",
            horizontal: [1, 3, 4, 7].includes(colIdx) ? "left" : "center",
          }
          if (idx % 2 === 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            }
          }
        })

        dataRow.height = IMAGE_ROW_HEIGHT_PT

        const [imgKtp, imgSim, imgPas] = await Promise.all([
          fetchImageAsBuffer(row.foto_ktp),
          fetchImageAsBuffer(row.foto_sim),
          fetchImageAsBuffer(row.pas_foto),
        ])

        const rowIndex0 = rowNum - 1

        // --- Foto KTP: ukuran FIX 8,56 x 5,398 cm, center di kolom ---
        if (imgKtp) {
          const imageId = workbook.addImage({
            buffer: imgKtp.buffer as any,
            extension: imgKtp.extension,
          })
          const anchor = centeredAnchor(
            IDX_KTP - 1,
            rowIndex0,
            colWidthPxKtp,
            KTP_SIM_SIZE_PX.width,
            KTP_SIM_SIZE_PX.height
          )
          sheet.addImage(imageId, { tl: anchor, ext: KTP_SIM_SIZE_PX })
        } else {
          dataRow.getCell(IDX_KTP).value = "-"
        }

        // --- Foto SIM: ukuran FIX 8,56 x 5,398 cm, center di kolom ---
        if (imgSim) {
          const imageId = workbook.addImage({
            buffer: imgSim.buffer as any,
            extension: imgSim.extension,
          })
          const anchor = centeredAnchor(
            IDX_SIM - 1,
            rowIndex0,
            colWidthPxSim,
            KTP_SIM_SIZE_PX.width,
            KTP_SIM_SIZE_PX.height
          )
          sheet.addImage(imageId, { tl: anchor, ext: KTP_SIM_SIZE_PX })
        } else {
          dataRow.getCell(IDX_SIM).value = "-"
        }

        // --- Pas Foto: ukuran menyesuaikan rasio aslinya (contain), center di kolom ---
        if (imgPas) {
          const imageId = workbook.addImage({
            buffer: imgPas.buffer as any,
            extension: imgPas.extension,
          })
          const fitted = fitContain(
            imgPas.naturalWidth,
            imgPas.naturalHeight,
            PAS_FOTO_MAX_BOX_PX.width,
            PAS_FOTO_MAX_BOX_PX.height
          )
          const anchor = centeredAnchor(
            IDX_FOTO - 1,
            rowIndex0,
            colWidthPxFoto,
            fitted.width,
            fitted.height
          )
          sheet.addImage(imageId, { tl: anchor, ext: fitted })
        } else {
          dataRow.getCell(IDX_FOTO).value = "-"
        }
      }

      sheet.autoFilter = {
        from: { row: HEADER_ROW_NUM, column: 1 },
        to: { row: HEADER_ROW_NUM, column: TOTAL_COLS },
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const namaBatchFile =
        currentBatchInfo?.nama?.replace(/[^a-zA-Z0-9]/g, "_") || "Semua_Batch"
      const tanggalFile = new Date().toISOString().slice(0, 10)
      const fileName = `Matrix_Peserta_${namaBatchFile}_${tanggalFile}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `File "${fileName}" berhasil diunduh.`,
        timer: 2000,
        showConfirmButton: true,
      })
    } catch (err) {
      console.error("Export Excel error:", err)
      Swal.fire({
        icon: "error",
        title: "Gagal Export",
        text: "Terjadi kesalahan saat membuat file Excel. Kemungkinan gambar gagal diambil (cek CORS di R2).",
      })
    } finally {
      setIsExporting(false)
    }
  }
  // 3. OCR KTP (Robust Parser)
  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileKtp(file)
    setPreviewKtp(URL.createObjectURL(file))
    setLoadingOcrKtp(true)

    let worker: any = null
    try {
      worker = await createWorker("ind")
      const {
        data: { text },
      } = await worker.recognize(file)
      console.log("--- OCR KTP RAW OUTPUT --- \n", text)

      const lines = text
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)

      let extractedNik = ""
      let extractedNama = ""
      let extractedTempat = ""
      let extractedTgl = ""
      let nikLineIdx = -1

      // A. Ekstraksi NIK
      const nikMatch =
        text.match(/\b\d{16}\b/) ||
        text.match(/(?:NIK|N1K|N|K)\s*[:=]?\s*([0-9OBIDSZ]{16})/i)
      if (nikMatch) {
        extractedNik = (nikMatch[1] || nikMatch[0])
          .replace(/O|D/g, "0")
          .replace(/I|l/g, "1")
          .replace(/B/g, "8")
          .replace(/S/g, "5")
          .replace(/Z/g, "2")
      }

      // Cari index baris NIK untuk fallback nama
      lines.forEach((line: string, idx: number) => {
        if (/NIK|N1K/i.test(line) || /\d{16}/.test(line)) {
          nikLineIdx = idx
        }
      })

      // B. Ekstraksi Nama
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match kata "Nama" atau "Nam a"
        if (/Nam[a|e]/i.test(line)) {
          let clean = line.replace(/.*Nam[a|e]\s*[:=]?\s*/i, "").trim()
          // Bersihkan karakter non-huruf di awal
          clean = clean.replace(/^[^a-zA-Z]+/, "")
          if (clean.length > 2) {
            extractedNama = clean
            break
          }
        }
      }

      // Fallback Nama: Jika tidak ada label "Nama", ambil baris setelah baris NIK
      if (!extractedNama && nikLineIdx !== -1 && lines[nikLineIdx + 1]) {
        const candidate = lines[nikLineIdx + 1].replace(/.*[:=]\s*/, "").trim()
        // Pastikan bukan baris TTL
        if (!/Tempat|Lahir|Tgl/i.test(candidate) && candidate.length > 2) {
          extractedNama = candidate
        }
      }

      // C. Ekstraksi Tempat & Tanggal Lahir
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/Tempat|Tgl\s*Lahir|Lahir/i.test(line)) {
          const rawTTL = line
            .replace(/.*(?:Lahir|Tgl Lahir|Tempat)\s*[:=]?\s*/i, "")
            .trim()
          const parts = rawTTL.split(",")
          if (parts.length >= 2) {
            extractedTempat = parts[0].replace(/[^a-zA-Z\s]/g, "").trim()
            const dMatch = parts[1].match(/\d{2}[-\s/]\d{2}[-\s/]\d{4}/)
            if (dMatch) {
              const [d, m, y] = dMatch[0].replace(/\s|\//g, "-").split("-")
              extractedTgl = `${y}-${m}-${d}`
            }
          }
        }
      }

      setFormValues((prev) => ({
        ...prev,
        nik: extractedNik || prev.nik,
        nama: extractedNama ? extractedNama.toUpperCase() : prev.nama,
        tempat_lahir: extractedTempat
          ? extractedTempat.toUpperCase()
          : prev.tempat_lahir,
        tanggal_lahir: extractedTgl || prev.tanggal_lahir,
      }))
    } catch (err) {
      console.error("OCR KTP Error:", err)
      alert("Gagal memproses OCR KTP")
    } finally {
      if (worker) await worker.terminate()
      setLoadingOcrKtp(false)
    }
  }

  // 4. OCR SIM
  const handleSimUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileSim(file)
    setPreviewSim(URL.createObjectURL(file))
    setLoadingOcrSim(true)

    let worker: any = null
    try {
      worker = await createWorker("ind")
      const {
        data: { text },
      } = await worker.recognize(file)
      console.log("--- OCR SIM RAW OUTPUT --- \n", text)

      let jenisSim = ""
      let noSim = ""

      const jenisMatch =
        text.match(
          /\b(?:SIM|SURAT\s*IZIN\s*MENGEMUDI)?\s*([A-C](?:\s*I{1,2})?)\b/i
        ) || text.match(/\b(BI|BII|B1|B2|A|C)\b/i)
      if (jenisMatch) {
        const matched = jenisMatch[1].toUpperCase().replace(/\s+/g, " ")
        if (matched.includes("B1") || matched.includes("B I"))
          jenisSim = "B I UMUM"
        else if (matched.includes("B2") || matched.includes("B II"))
          jenisSim = "B II UMUM"
        else if (matched.includes("A")) jenisSim = "A"
        else if (matched.includes("C")) jenisSim = "C"
        else jenisSim = matched
      }

      const noSimMatch =
        text.match(/(?:NO|NOMOR|NO\.)\s*[:=]?\s*([0-9-]{12,18})/i) ||
        text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4,6}\b/)
      if (noSimMatch) {
        noSim = (noSimMatch[1] || noSimMatch[0]).replace(/[^0-9]/g, "")
      }

      setFormValues((prev) => ({
        ...prev,
        nomor_sim: noSim || prev.nomor_sim,
        jenis_sim: jenisSim || prev.jenis_sim,
      }))
    } catch (err) {
      console.error("OCR SIM Error:", err)
      alert("Gagal memproses OCR SIM")
    } finally {
      if (worker) await worker.terminate()
      setLoadingOcrSim(false)
    }
  }

  // 5. Submit Tambah Batch Baru
  // Submit batch (Buat / Edit)
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingBatch(true)
    try {
      const url = isBatchEditMode
        ? `/api/batch?id=${selectedBatchId}`
        : "/api/batch"
      const method = isBatchEditMode ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchForm),
      })
      const result = await res.json()
      if (result.success) {
        setIsBatchModalOpen(false)
        setBatchForm({
          nama: "",
          tanggal_mulai: "",
          tanggal_selesai: "",
          lokasi: "",
        })
        setIsBatchEditMode(false)
        await fetchBatches()
        if (isBatchEditMode) {
          // tetap di batch yang diedit
        } else if (result.insertId) {
          setSelectedBatchId(String(result.insertId))
          setFormValues((prev) => ({
            ...prev,
            batch_id: String(result.insertId),
          }))
        } else if (result.data?.id) {
          setSelectedBatchId(String(result.data.id))
          setFormValues((prev) => ({
            ...prev,
            batch_id: String(result.data.id),
          }))
        }
      } else {
        alert(
          (isBatchEditMode
            ? "Gagal memperbarui batch: "
            : "Gagal membuat batch: ") + result.error
        )
      }
    } catch (err) {
      console.error(err)
      alert(
        isBatchEditMode
          ? "Terjadi kesalahan saat memperbarui batch"
          : "Terjadi kesalahan saat menambah batch"
      )
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  // Buka modal edit batch (prefill dari currentBatchInfo)
  const handleOpenEditBatch = () => {
    if (!currentBatchInfo) return
    setBatchForm({
      nama: currentBatchInfo.nama || "",
      tanggal_mulai: currentBatchInfo.tanggal_mulai || "",
      tanggal_selesai: currentBatchInfo.tanggal_selesai || "",
      lokasi: currentBatchInfo.lokasi || "",
    })
    setIsBatchEditMode(true)
    setIsBatchModalOpen(true)
  }

  // Hapus batch (cascade peserta)
  const handleDeleteBatch = async () => {
    if (!currentBatchInfo) return

    const confirm = await Swal.fire({
      title: "Hapus Batch?",
      text: `Batch "${currentBatchInfo.nama}" dan seluruh peserta di dalamnya akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    })

    if (!confirm.isConfirmed) return

    try {
      const res = await fetch(`/api/batch?id=${currentBatchInfo.id}`, {
        method: "DELETE",
      })
      const result = await res.json()
      if (result.success) {
        const updated = await fetchBatches()
        if (updated.length > 0) {
          const first = updated[0]
          setSelectedBatchId(String(first.id))
          setFormValues((prev) => ({ ...prev, batch_id: String(first.id) }))
        } else {
          setSelectedBatchId("")
          setFormValues((prev) => ({ ...prev, batch_id: "" }))
        }
        setData([])
        await Swal.fire({
          icon: "success",
          title: "Terhapus!",
          text: result.message || "Batch berhasil dihapus.",
          timer: 2000,
          showConfirmButton: true,
        })
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: "Gagal menghapus batch: " + (result.error || "unknown error"),
        })
      }
    } catch (err) {
      console.error(err)
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: "Terjadi kesalahan saat menghapus batch",
      })
    }
  }

  // 6. Submit Peserta (Buat / Edit dengan upload R2)
  const handleSubmitPeserta = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Upload foto baru ke R2 (jika ada), kalau tidak → pakai existing
      let fotoKtpUrl = existingFoto.ktp
      let fotoSimUrl = existingFoto.sim
      let pasFotoUrl = existingFoto.pasFoto

      if (fileKtp) {
        const fd = new FormData()
        fd.append("file", fileKtp)
        fd.append("prefix", "matrix")
        const r = await uploadFileToR2Action(fd)
        if (!r.success || !r.url)
          throw new Error(r.message || "Gagal upload KTP")
        fotoKtpUrl = r.url
      }
      if (fileSim) {
        const fd = new FormData()
        fd.append("file", fileSim)
        fd.append("prefix", "matrix")
        const r = await uploadFileToR2Action(fd)
        if (!r.success || !r.url)
          throw new Error(r.message || "Gagal upload SIM")
        fotoSimUrl = r.url
      }
      if (filePasFoto) {
        const fd = new FormData()
        fd.append("file", filePasFoto)
        fd.append("prefix", "matrix")
        const r = await uploadFileToR2Action(fd)
        if (!r.success || !r.url)
          throw new Error(r.message || "Gagal upload Pas Foto")
        pasFotoUrl = r.url
      }

      const payload = new FormData()
      payload.append("batch_id", formValues.batch_id || selectedBatchId)
      payload.append("nama", formValues.nama)
      payload.append("tempat_lahir", formValues.tempat_lahir)
      payload.append("tanggal_lahir", formValues.tanggal_lahir)
      payload.append("nik", formValues.nik)
      payload.append("nomor_sim", formValues.nomor_sim)
      payload.append("jenis_sim", formValues.jenis_sim)
      payload.append("perusahaan", formValues.perusahaan)
      payload.append("lokasi", formValues.lokasi)
      payload.append("jenis_muatan", formValues.jenis_muatan)
      payload.append("jenis_pelatihan", formValues.jenis_pelatihan)
      payload.append("foto_ktp", fotoKtpUrl)
      payload.append("foto_sim", fotoSimUrl)
      payload.append("pas_foto", pasFotoUrl)

      const url =
        isPesertaEditMode && editingPesertaId
          ? `/api/matrix?id=${editingPesertaId}`
          : "/api/matrix"
      const method = isPesertaEditMode ? "PATCH" : "POST"

      const res = await fetch(url, { method, body: payload })
      const result = await res.json()

      if (result.success) {
        setIsModalOpen(false)
        resetPesertaForm()
        fetchMatrixData(selectedBatchId)
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: isPesertaEditMode
            ? "Peserta berhasil diperbarui."
            : "Peserta berhasil disimpan.",
          timer: 2000,
          showConfirmButton: true,
        })
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: "Gagal: " + result.error,
        })
      }
    } catch (err: any) {
      console.error(err)
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: err.message || "Terjadi kesalahan saat menyimpan data peserta",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetPesertaForm = () => {
    setFormValues({
      batch_id: selectedBatchId,
      nama: "",
      tempat_lahir: "",
      tanggal_lahir: "",
      nik: "",
      nomor_sim: "",
      jenis_sim: "B II UMUM",
      perusahaan: "",
      lokasi: "",
      jenis_muatan: "",
      jenis_pelatihan: "AKBB",
    })
    setFileKtp(null)
    setFileSim(null)
    setFilePasFoto(null)
    setPreviewKtp("")
    setPreviewSim("")
    setPreviewPasFoto("")
    setIsPesertaEditMode(false)
    setEditingPesertaId(null)
    setExistingFoto({ ktp: "", sim: "", pasFoto: "" })
  }

  const handleOpenEditPeserta = (row: TbMatrix) => {
    setFormValues({
      batch_id: row.batch_id ? String(row.batch_id) : selectedBatchId,
      nama: row.nama || "",
      tempat_lahir: row.tempat_lahir || "",
      tanggal_lahir: row.tanggal_lahir
        ? row.tanggal_lahir.substring(0, 10)
        : "",
      nik: row.nik || "",
      nomor_sim: row.nomor_sim || "",
      jenis_sim: row.jenis_sim || "B II UMUM",
      perusahaan: row.perusahaan || "",
      lokasi: row.lokasi || "",
      jenis_muatan: row.jenis_muatan || "",
      jenis_pelatihan: (row.jenis_pelatihan as JenisPelatihan) || "AKBB",
    })
    setExistingFoto({
      ktp: row.foto_ktp || "",
      sim: row.foto_sim || "",
      pasFoto: row.pas_foto || "",
    })
    setPreviewKtp(row.foto_ktp || "")
    setPreviewSim(row.foto_sim || "")
    setPreviewPasFoto(row.pas_foto || "")
    setFileKtp(null)
    setFileSim(null)
    setFilePasFoto(null)
    setEditingPesertaId(row.id)
    setIsPesertaEditMode(true)
    setIsModalOpen(true)
  }

  const handleDeletePeserta = async (row: TbMatrix) => {
    const confirm = await Swal.fire({
      title: "Hapus Peserta?",
      text: `Peserta "${row.nama}" akan dihapus permanen dari sistem.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    })
    if (!confirm.isConfirmed) return

    try {
      const res = await fetch(`/api/matrix?id=${row.id}`, { method: "DELETE" })
      const result = await res.json()
      if (result.success) {
        fetchMatrixData(selectedBatchId)
        Swal.fire({
          icon: "success",
          title: "Terhapus!",
          text: result.message || "Peserta berhasil dihapus.",
          timer: 2000,
          showConfirmButton: true,
        })
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: "Gagal menghapus: " + (result.error || "unknown"),
        })
      }
    } catch (err: any) {
      console.error(err)
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: err.message || "Terjadi kesalahan saat menghapus peserta",
      })
    }
  }

  const currentBatchInfo = batches.find((b) => String(b.id) === selectedBatchId)

  const filteredData = data.filter((item) => {
    const q = search.toLowerCase()
    const matchSearch =
      item.nama?.toLowerCase().includes(q) ||
      item.nik?.includes(q) ||
      item.nomor_sim?.includes(q) ||
      item.perusahaan?.toLowerCase().includes(q)

    const matchJenis =
      filterJenisPelatihan === "ALL" ||
      item.jenis_pelatihan === filterJenisPelatihan

    return matchSearch && matchJenis
  })

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* Header & Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Layers className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Matriks Pelatihan per Batch
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Kelola peserta pelatihan dan ekstrak otomatis KTP & SIM.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || filteredData.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              )}
              <span>Export Excel</span>
            </button>
            {/* Tombol Tambah Batch */}
            <button
              onClick={() => {
                setIsBatchEditMode(false)
                setBatchForm({
                  nama: "",
                  tanggal_mulai: "",
                  tanggal_selesai: "",
                  lokasi: "",
                })
                setIsBatchModalOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <FolderPlus className="h-4 w-4 text-indigo-600" />
              <span>Tambah Batch</span>
            </button>

            {/* Tombol Tambah Peserta */}
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedBatchId}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Peserta</span>
            </button>
          </div>
        </div>

        {/* Info Batch Aktif */}
        {currentBatchInfo && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>
              <b>Lokasi:</b> {currentBatchInfo.lokasi || "-"}
            </span>
            <span>•</span>
            <span>
              <b>Periode:</b>{" "}
              {currentBatchInfo.tanggal_mulai
                ? new Date(currentBatchInfo.tanggal_mulai).toLocaleDateString(
                    "id-ID"
                  )
                : "-"}{" "}
              s/d{" "}
              {currentBatchInfo.tanggal_selesai
                ? new Date(currentBatchInfo.tanggal_selesai).toLocaleDateString(
                    "id-ID"
                  )
                : "-"}
            </span>
          </div>
        )}
      </div>

      {/* Tabel Matrix */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-80">
              <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Nama, NIK, SIM, Perusahaan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
            {/* Filter Jenis Pelatihan */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <select
                aria-label="Filter Jenis Pelatihan"
                value={filterJenisPelatihan}
                onChange={(e) =>
                  setFilterJenisPelatihan(
                    e.target.value as "ALL" | JenisPelatihan
                  )
                }
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Jenis</option>
                <option value="AKBB">AKBB</option>
                <option value="ABB">ABB</option>
                <option value="OTHERS">Lainnya</option>
              </select>
            </div>
            {/* Batch Selector (dipindahkan ke sini) */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select
                aria-label="Pilih Batch Pelatihan"
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value)
                  setFormValues((prev) => ({
                    ...prev,
                    batch_id: e.target.value,
                  }))
                }}
                disabled={loadingBatch || batches.length === 0}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
              >
                {batches.length === 0 ? (
                  <option value="">Belum ada batch</option>
                ) : (
                  <>
                    <option value="">Semua Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} {b.lokasi ? `(${b.lokasi})` : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-slate-500">
            Total di batch ini: {filteredData.length} Peserta
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold tracking-wider text-slate-500 uppercase">
                <th className="w-12 px-4 py-3.5 text-center">No</th>
                <th className="px-4 py-3.5">Pas Foto</th>
                <th className="px-4 py-3.5">Nama & NIK</th>
                <th className="px-4 py-3.5">TTL & Usia</th>
                <th className="px-4 py-3.5">Kualifikasi SIM</th>
                <th className="px-4 py-3.5">Perusahaan & Muatan</th>
                <th className="px-4 py-3.5">Lokasi</th>
                <th className="px-4 py-3.5">Jenis Pelatihan</th>
                <th className="w-20 px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loadingData ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-500" />
                    <span>Memuat data peserta...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <span>
                      Belum ada peserta di batch ini. Silakan klik{" "}
                      <b>Tambah Peserta</b>.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-indigo-50/20"
                  >
                    <td className="px-4 py-3.5 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex h-12 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {row.pas_foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.pas_foto}
                            alt={row.nama}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 uppercase">
                        {row.nama}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">
                        NIK: {row.nik || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        {row.tempat_lahir || "-"},{" "}
                        {formatTanggalIndo(row.tanggal_lahir)}
                      </div>
                      <span className="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {calculateAge(row.tanggal_lahir)} Tahun
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-indigo-700">
                        {row.jenis_sim || "-"}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">
                        No: {row.nomor_sim || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />{" "}
                        {row.perusahaan || "-"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Truck className="h-3 w-3 text-slate-400" />{" "}
                        {row.jenis_muatan || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />{" "}
                        {row.lokasi || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {row.jenis_pelatihan ? (
                        <span
                          className={
                            "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide " +
                            (row.jenis_pelatihan === "AKBB"
                              ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                              : row.jenis_pelatihan === "ABB"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200")
                          }
                        >
                          {row.jenis_pelatihan}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedDetail(row)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          title="Lihat Detail & Berkas"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditPeserta(row)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          title="Edit Peserta"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePeserta(row)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TAMBAH BATCH BARU */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {isBatchEditMode
                  ? "Edit Batch Pelatihan"
                  : "Tambah Batch Pelatihan"}
              </h3>
              <button
                onClick={() => {
                  setIsBatchModalOpen(false)
                  setIsBatchEditMode(false)
                  setBatchForm({
                    nama: "",
                    tanggal_mulai: "",
                    tanggal_selesai: "",
                    lokasi: "",
                  })
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nama Batch *
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.nama}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, nama: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Contoh: Batch Mei 2026 Gel. 1"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Lokasi Pelatihan
                </label>
                <input
                  type="text"
                  value={batchForm.lokasi}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, lokasi: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Contoh: Site Cilegon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={batchForm.tanggal_mulai}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        tanggal_mulai: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={batchForm.tanggal_selesai}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        tanggal_selesai: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchModalOpen(false)
                    setIsBatchEditMode(false)
                    setBatchForm({
                      nama: "",
                      tanggal_mulai: "",
                      tanggal_selesai: "",
                      lokasi: "",
                    })
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBatch}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  {isSubmittingBatch
                    ? "Menyimpan..."
                    : isBatchEditMode
                      ? "Simpan Perubahan"
                      : "Simpan Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH PESERTA MATRIX */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl space-y-6 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {isPesertaEditMode ? "Edit Peserta" : "Tambah Peserta"} (
                  {currentBatchInfo?.nama || "Batch Pelatihan"})
                </h3>
                <p className="text-xs text-slate-500">
                  Ekstraksi otomatis KTP & SIM via OCR.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  resetPesertaForm()
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPeserta} className="space-y-6">
              {/* Target Batch */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Target Batch Pelatihan
                </label>
                <select
                  value={formValues.batch_id}
                  onChange={(e) =>
                    setFormValues({ ...formValues, batch_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama} — {b.lokasi || "Tanpa Lokasi"}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3 Upload Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Upload KTP */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
                  {previewKtp ? (
                    <div className="flex w-full flex-col items-center">
                      <div className="relative w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewKtp}
                          alt="Preview KTP"
                          className="h-36 w-full rounded-lg border border-slate-200 object-cover"
                        />
                        {loadingOcrKtp && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                              <Loader2 className="h-4 w-4 animate-spin" />{" "}
                              Membaca KTP...
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFileKtp(null)
                          setPreviewKtp("")
                        }}
                        className="mt-2 text-xs font-medium text-red-600 hover:underline"
                      >
                        Hapus / Ganti
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        id={ktpInputId}
                        accept="image/*"
                        className="hidden"
                        onChange={handleKtpUpload}
                      />
                      <label
                        htmlFor={ktpInputId}
                        className="flex w-full cursor-pointer flex-col items-center"
                      >
                        <CreditCard className="mb-2 h-8 w-8 text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-700">
                          Upload KTP
                        </span>
                        <span className="mt-1 text-[10px] text-slate-400">
                          OCR: NIK, Nama, TTL
                        </span>
                        {loadingOcrKtp && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                            Membaca KTP...
                          </div>
                        )}
                      </label>
                    </>
                  )}
                </div>

                {/* Upload SIM */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
                  {previewSim ? (
                    <div className="flex w-full flex-col items-center">
                      <div className="relative w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewSim}
                          alt="Preview SIM"
                          className="h-36 w-full rounded-lg border border-slate-200 object-cover"
                        />
                        {loadingOcrSim && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                              <Loader2 className="h-4 w-4 animate-spin" />{" "}
                              Membaca SIM...
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFileSim(null)
                          setPreviewSim("")
                        }}
                        className="mt-2 text-xs font-medium text-red-600 hover:underline"
                      >
                        Hapus / Ganti
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        id={simInputId}
                        accept="image/*"
                        className="hidden"
                        onChange={handleSimUpload}
                      />
                      <label
                        htmlFor={simInputId}
                        className="flex w-full cursor-pointer flex-col items-center"
                      >
                        <CreditCard className="mb-2 h-8 w-8 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-700">
                          Upload SIM
                        </span>
                        <span className="mt-1 text-[10px] text-slate-400">
                          OCR: No. SIM & Jenis SIM
                        </span>
                        {loadingOcrSim && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                            Membaca SIM...
                          </div>
                        )}
                      </label>
                    </>
                  )}
                </div>

                {/* Upload Pas Foto */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
                  {previewPasFoto ? (
                    <div className="flex w-full flex-col items-center">
                      <div className="relative w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewPasFoto}
                          alt="Preview Pas Foto"
                          className="h-36 w-full rounded-lg border border-slate-200 object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFilePasFoto(null)
                          setPreviewPasFoto("")
                        }}
                        className="mt-2 text-xs font-medium text-red-600 hover:underline"
                      >
                        Hapus / Ganti
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        id={photoInputId}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setFilePasFoto(file)
                            setPreviewPasFoto(URL.createObjectURL(file))
                          }
                        }}
                      />
                      <label
                        htmlFor={photoInputId}
                        className="flex w-full cursor-pointer flex-col items-center"
                      >
                        <ImageIcon className="mb-2 h-8 w-8 text-sky-500" />
                        <span className="text-xs font-semibold text-slate-700">
                          Upload Pas Foto
                        </span>
                        <span className="mt-1 text-[10px] text-slate-400">
                          Foto formal peserta
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formValues.nama}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        nama: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Nama Lengkap Sesuai KTP"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    NIK
                  </label>
                  <input
                    type="text"
                    value={formValues.nik}
                    onChange={(e) =>
                      setFormValues({ ...formValues, nik: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    placeholder="16 Digit NIK"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    value={formValues.tempat_lahir}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        tempat_lahir: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Kota Lahir"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={formValues.tanggal_lahir}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        tanggal_lahir: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Jenis SIM
                  </label>
                  <select
                    value={formValues.jenis_sim}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        jenis_sim: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="A">SIM A</option>
                    <option value="B I">SIM B I</option>
                    <option value="B I UMUM">SIM B I Umum</option>
                    <option value="B II">SIM B II</option>
                    <option value="B II UMUM">SIM B II Umum</option>
                    <option value="C">SIM C</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Nomor SIM
                  </label>
                  <input
                    type="text"
                    value={formValues.nomor_sim}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        nomor_sim: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    placeholder="Nomor SIM"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Perusahaan
                  </label>
                  <input
                    type="text"
                    value={formValues.perusahaan}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        perusahaan: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Nama Perusahaan"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Lokasi Kerja
                  </label>
                  <input
                    type="text"
                    value={formValues.lokasi}
                    onChange={(e) =>
                      setFormValues({ ...formValues, lokasi: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Lokasi / Site"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Jenis Muatan
                  </label>
                  <input
                    type="text"
                    value={formValues.jenis_muatan}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        jenis_muatan: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Contoh: Bahan Kimia Cair (B3)"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Jenis Pelatihan *
                  </label>
                  <select
                    required
                    value={formValues.jenis_pelatihan}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        jenis_pelatihan: e.target.value as JenisPelatihan,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="AKBB">AKBB</option>
                    <option value="ABB">ABB</option>
                    <option value="OTHERS">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetPesertaForm()
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || loadingOcrKtp || loadingOcrSim}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>
                      {isPesertaEditMode
                        ? "Simpan Perubahan"
                        : "Simpan ke Batch"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL PREVIEW */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800">
                Detail Peserta: {selectedDetail.nama}
              </h3>
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
                <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                  Foto KTP
                </span>
                {selectedDetail.foto_ktp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDetail.foto_ktp}
                    alt="KTP"
                    className="h-24 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                    Tidak ada berkas
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
                <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                  Foto SIM
                </span>
                {selectedDetail.foto_sim ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDetail.foto_sim}
                    alt="SIM"
                    className="h-24 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                    Tidak ada berkas
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
                <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                  Pas Foto
                </span>
                {selectedDetail.pas_foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDetail.pas_foto}
                    alt="Pas Foto"
                    className="h-24 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                    Tidak ada berkas
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Nama Lengkap
                </span>
                <span className="font-bold text-slate-800">
                  {selectedDetail.nama}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">NIK</span>
                <span className="font-mono font-semibold">
                  {selectedDetail.nik || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">TTL</span>
                <span>
                  {selectedDetail.tempat_lahir || "-"},{" "}
                  {selectedDetail.tanggal_lahir
                    ? new Date(selectedDetail.tanggal_lahir).toLocaleDateString(
                        "id-ID"
                      )
                    : "-"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Kualifikasi SIM
                </span>
                <span className="font-semibold text-indigo-700">
                  {selectedDetail.jenis_sim || "-"} (
                  {selectedDetail.nomor_sim || "-"})
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Perusahaan
                </span>
                <span className="font-medium">
                  {selectedDetail.perusahaan || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">Lokasi</span>
                <span className="font-medium">
                  {selectedDetail.lokasi || "-"}
                </span>
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Jenis Pelatihan
                </span>
                <span className="font-semibold text-indigo-700">
                  {selectedDetail.jenis_pelatihan || "-"}
                </span>
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Jenis Muatan
                </span>
                <span className="font-medium">
                  {selectedDetail.jenis_muatan || "-"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
