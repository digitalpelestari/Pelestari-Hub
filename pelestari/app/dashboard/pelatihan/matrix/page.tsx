"use client"

import React, { useState, useEffect, useId } from "react"
import Swal from "sweetalert2"
import { createWorker } from "tesseract.js"
import { uploadFileToR2Action } from "@/app/actions/upload-r2"
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
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react"

export interface TbBatch {
  id: number
  nama: string
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  lokasi: string | null
}

export type JenisPelatihan = "AKBB" | "ABB"

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
  ddt?: boolean | string | number | null
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
  const [filterDdt, setFilterDdt] = useState<"ALL" | "YA" | "TIDAK">("ALL")

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

  // Form Peserta State: jenis_pelatihan default kosong ("")
  const [formValues, setFormValues] = useState({
    batch_id: "",
    nama: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    nik: "",
    nomor_sim: "",
    jenis_sim: "",
    perusahaan: "",
    lokasi: "",
    jenis_muatan: "",
    jenis_pelatihan: "" as JenisPelatihan | "",
    ddt: "TIDAK" as "YA" | "TIDAK",
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

  // Helper Tanggal Indonesia
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

  // 1. Preprocessing Khusus KTP (Grayscale + Adaptive Contrast agar latar biru & garis pudar, teks NIK tetap hitam pekat)
  const preprocessKtpImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return resolve(URL.createObjectURL(file))

        // Naikkan resolusi (Upscale) 2x lipat agar font dot-matrix/OCR-B terbaca utuh
        const targetWidth = Math.max(img.width * 2, 1400)
        const scale = targetWidth / img.width
        canvas.width = targetWidth
        canvas.height = img.height * scale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data

        // Filter: Buang channel biru/cyan latar KTP dengan memberi bobot lebih pada red/green
        for (let i = 0; i < d.length; i += 4) {
          // Bobot dominan di merah & hijau untuk meredam background cyan KTP
          const gray = 0.5 * d[i] + 0.4 * d[i + 1] + 0.1 * d[i + 2]
          
          // Dynamic Binarization: font NIK hitam pekat akan masuk ke 0 (hitam), background ke 255 (putih)
          const val = gray < 110 ? 0 : 255
          d[i] = val
          d[i + 1] = val
          d[i + 2] = val
        }

        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      }
      img.src = URL.createObjectURL(file)
    })
  }

  // 2. Parser NIK Khusus OCR KTP
  const extractNikFromOcr = (text: string): string => {
    // Normalisasi karakter yang sering tertukar pada OCR-B e-KTP
    const cleanOcrDigits = (str: string) =>
      str
        .replace(/[OoDdQq]/g, "0")
        .replace(/[IiLl|!]/g, "1")
        .replace(/[Bb]/g, "8")
        .replace(/[Ss]/g, "5")
        .replace(/[Zz]/g, "2")
        .replace(/[Gg]/g, "6")
        .replace(/[^0-9]/g, "")

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

    // Cara 1: Ambil teks di samping label NIK (meskipun ada spasi di tengah nomor)
    for (const line of lines) {
      if (/N\s*[I1Ll|!]\s*[Kk]/i.test(line)) {
        const afterNik = line.replace(/.*N\s*[I1Ll|!]\s*[Kk]\s*[:=.\-]?\s*/i, "")
        const digitsOnly = cleanOcrDigits(afterNik)
        if (digitsOnly.length >= 16) {
          return digitsOnly.slice(0, 16)
        }
      }
    }

    // Cara 2: Cari deretan angka/huruf mirip 16 digit di seluruh baris teks
    // Toleran terhadap spasi seperti: "140109 080378 0001" atau "14O1O9O8O378OOO1"
    const wordsAndChunks = text.match(/[0-9OoDdQqIiLl|!BbSsZz\s-]{16,28}/g) || []
    for (const chunk of wordsAndChunks) {
      const digits = cleanOcrDigits(chunk)
      // NIK selalu 16 digit dan diawali kode provinsi (11-92)
      if (digits.length === 16 && /^[1-9][0-9]/.test(digits)) {
        return digits
      }
    }

    return ""
  }

  // Export Excel
  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Tidak ada data",
        text: "Tidak ada peserta pada filter/batch ini untuk diekspor.",
      })
      return
    }

    setIsExporting(true)
    try {
      const res = await fetch("/api/matrix/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filteredData,
          batchInfo: currentBatchInfo,
        }),
      })

      if (!res.ok) {
        throw new Error("Gagal generate excel di server")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const namaBatchFile =
        currentBatchInfo?.nama?.replace(/[^a-zA-Z0-9]/g, "_") || "Semua_Batch"
      const tanggalFile = new Date().toISOString().slice(0, 10)
      const fileName = `Matrix_Peserta_${namaBatchFile}_${tanggalFile}.xlsx`

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
    } catch (err: any) {
      console.error("Export Excel error:", err)
      Swal.fire({
        icon: "error",
        title: "Gagal Export",
        text: err.message || "Terjadi kesalahan saat mengekspor data.",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // OCR KTP
  const cleanOcrDigits = (str: string) =>
    str
      .replace(/[OoDdQq]/g, "0")
      .replace(/[IiLl|!]/g, "1")
      .replace(/[Bb]/g, "8")
      .replace(/[Ss]/g, "5")
      .replace(/[Zz]/g, "2")
      .replace(/[Gg]/g, "6")
      .replace(/[^0-9]/g, "")

  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileKtp(file)
    setPreviewKtp(URL.createObjectURL(file))
    setLoadingOcrKtp(true)

    let worker: any = null
    try {
      worker = await createWorker("ind")

      // Langsung baca file gambar asli tanpa canvas binarization
      const { data } = await worker.recognize(file)
      const text: string = data.text || ""
      console.log("--- OCR KTP RAW OUTPUT --- \n", text)

      const lines: string[] = text
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean)

      let extractedNik = ""
      let extractedNama = ""
      let extractedTempat = ""
      let extractedTgl = ""

      // 1. Ekstraksi NIK
      // Cari baris yang mengandung kata NIK
      for (const line of lines) {
        if (/N\s*[I1Ll|!]\s*[Kk]/i.test(line)) {
          const afterLabel = line.replace(/.*N\s*[I1Ll|!]\s*[Kk]\s*[:=.\-]?\s*/i, "")
          const digits = cleanOcrDigits(afterLabel)
          if (digits.length >= 16) {
            extractedNik = digits.slice(0, 16)
            break
          }
        }
      }

      // Fallback NIK jika label NIK tidak terbaca: cari deretan 16 digit angka
      if (!extractedNik) {
        const potentialChunks = text.match(/[0-9OoDdQqIiLl|!BbSsZz\s-]{16,30}/g) || []
        for (const chunk of potentialChunks) {
          const digits = cleanOcrDigits(chunk)
          if (digits.length === 16 && /^[1-9]/.test(digits)) {
            extractedNik = digits
            break
          }
        }
      }

      // 2. Ekstraksi Nama (mendukung format "Nama : BERTO WIDODO")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/Nam[ae]/i.test(line)) {
          let clean = line
            .replace(/.*Nam[ae]\s*[:=.\-]?\s*/i, "")
            .replace(/[^a-zA-Z\s.,'-]/g, "")
            .trim()
          if (clean.length > 2) {
            extractedNama = clean
            break
          }
        }
      }

      // Fallback Nama: baris tepat setelah baris NIK
      if (!extractedNama) {
        const nikIdx = lines.findIndex(
          (l: string) => /N\s*[I1Ll|!]\s*[Kk]/i.test(l) || (extractedNik && l.includes(extractedNik))
        )
        if (nikIdx !== -1 && lines[nikIdx + 1]) {
          const candidate = lines[nikIdx + 1]
            .replace(/.*[:=.\-]\s*/, "")
            .replace(/[^a-zA-Z\s.,'-]/g, "")
            .trim()
          if (!/Tempat|Lahir|Tgl/i.test(candidate) && candidate.length > 2) {
            extractedNama = candidate
          }
        }
      }

      // 3. Ekstraksi Tempat & Tanggal Lahir (cth: "GEMA, 19-07-1997")
      for (const line of lines) {
        if (/Tempat|Tgl\s*Lahir|Lahir/i.test(line)) {
          const rawTTL = line.replace(/.*(?:Lahir|Tgl\s*Lahir|Tempat)\s*[:=.\-]?\s*/i, "").trim()
          const parts = rawTTL.split(",")
          if (parts.length >= 2) {
            extractedTempat = parts[0].replace(/[^a-zA-Z\s]/g, "").trim()
            const dMatch = parts[1].match(/(\d{2})[-/\s.](\d{2})[-/\s.](\d{4})/)
            if (dMatch) {
              extractedTgl = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`
            }
          }
        }
      }

      setFormValues((prev) => ({
        ...prev,
        nik: extractedNik || prev.nik,
        nama: extractedNama ? extractedNama.toUpperCase() : prev.nama,
        tempat_lahir: extractedTempat ? extractedTempat.toUpperCase() : prev.tempat_lahir,
        tanggal_lahir: extractedTgl || prev.tanggal_lahir,
      }))
    } catch (err) {
      console.error("OCR KTP Error:", err)
      Swal.fire({
        icon: "warning",
        title: "OCR Terbatas",
        text: "Gagal memproses gambar KTP. Silakan isi form secara manual.",
      })
    } finally {
      if (worker) await worker.terminate()
      setLoadingOcrKtp(false)
    }
  }

  // OCR SIM
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

      let jenisSim = ""
      let noSim = ""

      const normalizeSimNumber = (val: string) =>
        val
          .toUpperCase()
          .replace(/[\s-]/g, "")
          .replace(/O/g, "0")
          .replace(/I/g, "1")
          .replace(/Z/g, "2")
          .replace(/S/g, "5")
          .replace(/B/g, "8")

      const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean)

      const simIndex = lines.findIndex((l: string) =>
        /SURAT\s*IZIN\s*MENGEMUDI|SIM/i.test(l)
      )

      if (simIndex !== -1) {
        const afterSimLine = lines[simIndex + 1] || ""
        const afterSimDigits = afterSimLine.match(/[\d\s-]{12,20}/)
        if (afterSimDigits) {
          noSim = normalizeSimNumber(afterSimDigits[0]).slice(0, 16)
        }
      }

      if (!noSim) {
        const simSection = text.match(/SURAT\s*IZIN\s*MENGEMUDI[\s\S]{0,100}/i)
        if (simSection) {
          const digitsInSection = simSection[0].match(/[\d\s-]{12,20}/)
          if (digitsInSection) {
            noSim = normalizeSimNumber(digitsInSection[0]).slice(0, 16)
          }
        }
      }

      if (!noSim) {
        const labeledNoMatch = text.match(
          /(?:NO(?:\.|\s+SIM)?|NOMOR)\s*[:=.\s]*([\d\s-]{12,20})/i
        )
        if (labeledNoMatch) {
          noSim = normalizeSimNumber(labeledNoMatch[1]).slice(0, 16)
        }
      }

      if (!noSim) {
        const patternMatch =
          text.match(/\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}(?:[-\s]?\d{4})?)\b/) ||
          text.match(/\b(\d{12,16})\b/)
        if (patternMatch) {
          noSim = normalizeSimNumber(patternMatch[1]).slice(0, 16)
        }
      }

      const mapSimType = (raw: string): string => {
        const s = raw
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        if (!s) return ""
        const compact = s.replace(/\s+/g, "")
        if (
          /\bB\s*(I{1,2}|1{1,2}|L{1,2}|2|II)\b.*UMUM/i.test(s) &&
          !/B\s*I\s*UMUM/.test(s) &&
          (/\bB\s*(II|2|I{2})\b/.test(s) || /B2/.test(compact))
        ) {
          return "B II UMUM"
        }
        if (/\bB\s*(II|2|11|I{2})\s*UMUM/i.test(s) || /\bB2\s*UMUM/i.test(s))
          return "B II UMUM"
        if (/\bB\s*(I|1|L)\s*UMUM/i.test(s) || /\bB1\s*UMUM/i.test(s))
          return "B I UMUM"
        if (/\bB\s*II\b/i.test(s) || /\bB2\b/.test(compact)) return "B II UMUM"
        if (/\bB\s*I\b/i.test(s) || /\bB1\b/.test(compact)) return "B I UMUM"
        if (/\bA\s*UMUM\b/i.test(s) || (/\bA(?![A-Z])/.test(s) && /A/.test(compact)))
          return "A"
        if (/\bC(?![A-Z])/.test(s) || /\bC\s*UMUM\b/i.test(s)) return "C"
        if (/\bD(?![A-Z])/.test(s) || /\bD\s*UMUM\b/i.test(s)) return "D"
        return s
      }

      const labelTypeMatch = text.match(
        /(?:GOLONGAN|GOL|JENIS|TYPE|TIPE)\s*(?:SIM|SURAT\s*IZIN)?\s*[:=.\s]*\s*([A-D](?:\s*(?:I{1,2}|1{1,2}|L{1,2}|2))?(?:\s*UMUM)?)/i
      )
      if (labelTypeMatch) {
        const v = mapSimType(labelTypeMatch[1])
        if (v) jenisSim = v
      }

      if (!jenisSim) {
        for (let i = 0; i < lines.length; i++) {
          if (/SURAT\s*IZIN\s*MENGEMUDI|^SIM\s*$|DRIVING\s*LICENSE/i.test(lines[i])) {
            for (let j = 1; j <= 3 && i + j < lines.length; j++) {
              const next = lines[i + j]
              if (/\b[A-D]\b/i.test(next) || /UMUM/i.test(next)) {
                const v = mapSimType(next)
                if (v && /^(A|B|C|D)/.test(v)) {
                  jenisSim = v
                  break
                }
              }
            }
            if (jenisSim) break
          }
        }
      }

      if (!jenisSim && noSim) {
        for (const line of lines) {
          if (!/[\d\s-]{12,20}/.test(line)) continue
          const v = mapSimType(line)
          if (v && /^(A|B|C|D)/.test(v) && v.length <= 20) {
            jenisSim = v
            break
          }
        }
      }

      if (!jenisSim) {
        const fallback =
          text.match(/\b([A-D])\s*UMUM\b/i) ||
          text.match(/\bSIM\s*([A-D])\b/i) ||
          text.match(/\b([A-D])\s*(I{1,2}|1{1,2})\s*UMUM\b/i) ||
          text.match(/\b(B\s*II|B\s*I|B2|B1|BII|B1I|B11|81)\b/i)
        if (fallback) {
          const v = mapSimType(fallback[1] || fallback[0])
          if (v) jenisSim = v
        }
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

  // Submit Batch
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

  // Submit Peserta
  const handleSubmitPeserta = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
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
      payload.append("jenis_pelatihan", formValues.jenis_pelatihan || "")
      payload.append("ddt", formValues.ddt === "YA" ? "true" : "false")
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
      jenis_sim: "",
      perusahaan: "",
      lokasi: "",
      jenis_muatan: "",
      jenis_pelatihan: "", // Kosong sebagai default
      ddt: "TIDAK",
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
    const isDdt =
      row.ddt === true ||
      row.ddt === 1 ||
      String(row.ddt).toLowerCase() === "true" ||
      String(row.ddt).toLowerCase() === "ya"

    setFormValues({
      batch_id: row.batch_id ? String(row.batch_id) : selectedBatchId,
      nama: row.nama || "",
      tempat_lahir: row.tempat_lahir || "",
      tanggal_lahir: row.tanggal_lahir
        ? row.tanggal_lahir.substring(0, 10)
        : "",
      nik: row.nik || "",
      nomor_sim: row.nomor_sim || "",
      jenis_sim: row.jenis_sim || "",
      perusahaan: row.perusahaan || "",
      lokasi: row.lokasi || "",
      jenis_muatan: row.jenis_muatan || "",
      jenis_pelatihan: (row.jenis_pelatihan as JenisPelatihan) || "",
      ddt: isDdt ? "YA" : "TIDAK",
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

  // Filter Data Matrix
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

    const isDdtTrue =
      item.ddt === true ||
      item.ddt === 1 ||
      String(item.ddt).toLowerCase() === "true" ||
      String(item.ddt).toLowerCase() === "ya"

    const matchDdt =
      filterDdt === "ALL" ||
      (filterDdt === "YA" && isDdtTrue) ||
      (filterDdt === "TIDAK" && !isDdtTrue)

    return matchSearch && matchJenis && matchDdt
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
            <div className="relative w-72 sm:w-80">
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
              </select>
            </div>

            {/* Filter DDT */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <select
                aria-label="Filter DDT"
                value={filterDdt}
                onChange={(e) =>
                  setFilterDdt(e.target.value as "ALL" | "YA" | "TIDAK")
                }
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua DDT</option>
                <option value="YA">DDT: Ya</option>
                <option value="TIDAK">DDT: Tidak</option>
              </select>
            </div>

            {/* Batch Selector */}
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
                <th className="px-4 py-3.5">Pelatihan & DDT</th>
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
                      Tidak ada data peserta yang cocok dengan filter yang dipilih.
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
                      <div className="flex flex-col items-start gap-1">
                        {row.jenis_pelatihan ? (
                          <span
                            className={
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide " +
                              (row.jenis_pelatihan === "AKBB"
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
                            }
                          >
                            {row.jenis_pelatihan}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                        <span
                          className={
                            "inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold " +
                            (row.ddt === true ||
                            row.ddt === 1 ||
                            String(row.ddt).toLowerCase() === "true" ||
                            String(row.ddt).toLowerCase() === "ya"
                              ? "bg-teal-50 text-teal-700"
                              : "bg-slate-100 text-slate-500")
                          }
                        >
                          DDT:{" "}
                          {row.ddt === true ||
                          row.ddt === 1 ||
                          String(row.ddt).toLowerCase() === "true" ||
                          String(row.ddt).toLowerCase() === "ya"
                            ? "Ya"
                            : "Tidak"}
                        </span>
                      </div>
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

      {/* MODAL 2: TAMBAH / EDIT PESERTA MATRIX */}
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

              {/* Upload Cards */}
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
                  <input
                    type="text"
                    value={formValues.jenis_sim}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        jenis_sim: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="misal B II Umum, C, A"
                  />
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

                {/* Jenis Pelatihan: Not Null / Boleh Kosong & Default Placeholder */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Jenis Pelatihan (Opsional)
                  </label>
                  <select
                    value={formValues.jenis_pelatihan}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        jenis_pelatihan: e.target.value as JenisPelatihan | "",
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Pilih Jenis Pelatihan</option>
                    <option value="AKBB">AKBB</option>
                    <option value="ABB">ABB</option>
                  </select>
                </div>

                {/* PILIHAN DDT (Ya / Tidak) */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    DDT (Defensive Driving Training) *
                  </label>
                  <select
                    required
                    value={formValues.ddt}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        ddt: e.target.value as "YA" | "TIDAK",
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="TIDAK">Tidak</option>
                    <option value="YA">Ya</option>
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
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Jenis Pelatihan
                </span>
                <span className="font-semibold text-indigo-700">
                  {selectedDetail.jenis_pelatihan || "-"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="block text-[11px] text-slate-400">
                  Status DDT
                </span>
                <span className="font-semibold text-slate-700">
                  {selectedDetail.ddt === true ||
                  selectedDetail.ddt === 1 ||
                  String(selectedDetail.ddt).toLowerCase() === "true" ||
                  String(selectedDetail.ddt).toLowerCase() === "ya"
                    ? "Ya"
                    : "Tidak"}
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