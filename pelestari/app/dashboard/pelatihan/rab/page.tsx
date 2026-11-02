"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  Send,
  Eye,
  ChevronDown,
  FileText,
} from "lucide-react"

import {
  getRAB,
  createRAB,
  updateRAB,
  deleteRAB,
  submitRAB,
} from "@/app/actions/rab"

type RincianRAB = {
  id_rab?: number
  jenis_biaya: string
  kelompok_biaya: string
  satuan: string
  harga: number
  jumlah: number
  durasi: number
  keterangan: string
  penjelasan_keterangan: string
  satuan_terkunci?: boolean // hanya untuk UI, tidak dikirim ke server
  jenis_terkunci?: boolean // hanya untuk UI, tidak dikirim ke server
}

type KelompokRAB = {
  kelompok_biaya: string
  rincian: RincianRAB[]
}

type PengajuanRAB = {
  id_pengajuan: number
  nomor_rab: string
  nama_kegiatan: string
  tanggal: string
  lokasi: string
  status_persetujuan: string
  catatan_revisi_manager?: string | null
  catatan_revisi_finance?: string | null
  catatan_penolakan_manager?: string | null
  catatan_penolakan_finance?: string | null
  bukti_transfer?: string | null
  total: number
  rincian: RincianRAB[]
}

type FormRAB = {
  nomor_rab: string
  nama_kegiatan: string
  tanggal: string
  lokasi: string
  catatan_revisi_manager: string | null
  catatan_revisi_finance: string | null
  kelompok: KelompokRAB[]
}

const SATUAN_HARI = "Per orang per hari"
const SATUAN_KAMAR = "Per kamar"

// Struktur tetap mengikuti format Excel RAB.
// Tiap baris punya jenis biaya dan satuan bawaan yang terkunci.
// Satuan "" = satuan bebas diisi user. Biaya baru ditambah lewat "Tambah baris".
// "maksNomor" membatasi penomoran huruf (a, b, ...) pada kelompok tertentu;
// baris setelahnya tampil tanpa nomor. Kosong = bernomor semua.
const TEMPLATE_KELOMPOK: {
  nama: string
  maksNomor?: number
  baris: { jenis: string; satuan: string }[]
}[] = [
  {
    nama: "Transportasi",
    maksNomor: 2,
    baris: [
      { jenis: "Tiket Berangkat", satuan: SATUAN_HARI },
      { jenis: "Tiket Pulang", satuan: SATUAN_HARI },
      { jenis: "Transportasi Lokal", satuan: SATUAN_HARI },
    ],
  },
  {
    nama: "Akomodasi",
    baris: [
      { jenis: "Hotel", satuan: SATUAN_KAMAR },
      { jenis: "Meal Instruktur", satuan: SATUAN_HARI },
      { jenis: "Penginapan", satuan: SATUAN_HARI },
      { jenis: "Pax Meeting hari ke 1-2", satuan: SATUAN_HARI },
      { jenis: "Pax Meeting hari ke 3", satuan: SATUAN_HARI },
    ],
  },
  { nama: "Biaya ADM", baris: [] },
  {
    nama: "Biaya lain-lain",
    baris: [{ jenis: "Cetak Sertifikat Internal", satuan: "" }],
  },
]

// Nama kelompok lama di database yang dipetakan ke nama di Excel.
const ALIAS_KELOMPOK: Record<string, string> = {
  "biaya sdm": "Biaya ADM",
}

const RINCIAN_KOSONG: RincianRAB = {
  jenis_biaya: "",
  kelompok_biaya: "",
  satuan: "",
  harga: 0,
  jumlah: 0,
  durasi: 0,
  keterangan: "",
  penjelasan_keterangan: "",
}

function buatRincianKosong(
  kelompok: string,
  jenis: string,
  satuan: string
): RincianRAB {
  return {
    ...RINCIAN_KOSONG,
    kelompok_biaya: kelompok,
    jenis_biaya: jenis,
    satuan,
    jenis_terkunci: jenis !== "",
    satuan_terkunci: satuan !== "",
  }
}

function buatKelompokTemplate(): KelompokRAB[] {
  return TEMPLATE_KELOMPOK.map((k) => ({
    kelompok_biaya: k.nama,
    rincian: k.baris.map((b) => buatRincianKosong(k.nama, b.jenis, b.satuan)),
  }))
}

function jumlahBarisTemplate(namaKelompok: string): number {
  return (
    TEMPLATE_KELOMPOK.find((k) => k.nama === namaKelompok)?.baris.length ?? 0
  )
}

// Label nomor baris (a, b, ...). Kosong bila melewati batas penomoran kelompok.
function labelNomorBaris(namaKelompok: string, indexRincian: number): string {
  const maks = TEMPLATE_KELOMPOK.find((k) => k.nama === namaKelompok)?.maksNomor

  if (maks !== undefined && indexRincian >= maks) return ""

  return String.fromCharCode(97 + indexRincian)
}

type BarisTampil = {
  item: RincianRAB
  slot: number
  jenisTerkunci: boolean
  satuanTerkunci: boolean
}
type KelompokTampil = {
  nomor: number
  kelompok_biaya: string
  baris: BarisTampil[]
}

// Susun rincian untuk modal Detail: urutan dan penomoran mengikuti modal
// Tambah/Edit (baris bawaan sesuai slot template, baris lain menyusul).
function kelompokkanUntukTampil(rincian: RincianRAB[]): KelompokTampil[] {
  const hasil: KelompokTampil[] = TEMPLATE_KELOMPOK.map((k, i) => ({
    nomor: i + 1,
    kelompok_biaya: k.nama,
    baris: [],
  }))
  const lain: KelompokTampil[] = []

  rincian.forEach((item) => {
    const nama = cariNamaKelompok(item.kelompok_biaya || "") || "Tanpa Kelompok"

    let target =
      hasil.find((k) => k.kelompok_biaya === nama) ??
      lain.find((k) => k.kelompok_biaya === nama)

    if (!target) {
      target = {
        nomor: TEMPLATE_KELOMPOK.length + lain.length + 1,
        kelompok_biaya: nama,
        baris: [],
      }
      lain.push(target)
    }

    target.baris.push({
      item,
      slot: -1,
      jenisTerkunci: false,
      satuanTerkunci: false,
    })
  })

  hasil.forEach((kelompok) => {
    const template =
      TEMPLATE_KELOMPOK.find((k) => k.nama === kelompok.kelompok_biaya)
        ?.baris ?? []
    const terpakai = new Set<number>()

    kelompok.baris.forEach((b) => {
      const kunci = normalisasiNama(b.item.jenis_biaya)
      const index = template.findIndex(
        (t, i) => !terpakai.has(i) && normalisasiNama(t.jenis) === kunci
      )

      if (index >= 0) {
        terpakai.add(index)
        b.slot = index
      }
    })

    let berikutnya = template.length
    kelompok.baris.forEach((b) => {
      if (b.slot < 0) b.slot = berikutnya++
    })

    // Baris bawaan: jenis biaya (dan satuan bila ada) terkunci seperti di Tambah/Edit.
    kelompok.baris.forEach((b) => {
      if (b.slot < template.length) {
        b.jenisTerkunci = true
        b.satuanTerkunci = template[b.slot].satuan !== ""
      }
    })

    // Baris bawaan yang tidak tersimpan tetap ditampilkan (kosong).
    template.forEach((t, i) => {
      if (terpakai.has(i)) return

      kelompok.baris.push({
        item: buatRincianKosong(kelompok.kelompok_biaya, t.jenis, t.satuan),
        slot: i,
        jenisTerkunci: true,
        satuanTerkunci: t.satuan !== "",
      })
    })

    kelompok.baris.sort((a, b) => a.slot - b.slot)
  })

  lain.forEach((kelompok) => {
    kelompok.baris.forEach((b, i) => {
      b.slot = i
    })
  })

  return [...hasil, ...lain]
}

function normalisasiNama(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim()
}

function cariNamaKelompok(nama: string): string {
  const kunci = normalisasiNama(nama)
  const cocok = TEMPLATE_KELOMPOK.find((k) => normalisasiNama(k.nama) === kunci)

  return cocok?.nama ?? ALIAS_KELOMPOK[kunci] ?? nama
}

// Baris bawaan (jenis biaya terkunci) dianggap terisi bila harga diisi.
// Baris tambahan dianggap terisi bila jenis biaya atau harga diisi.
function barisTerisi(item: RincianRAB): boolean {
  if (item.jenis_terkunci) return Number(item.harga) > 0

  return item.jenis_biaya.trim() !== "" || Number(item.harga) > 0
}

function buatFormKosong(): FormRAB {
  return {
    nomor_rab: "",
    nama_kegiatan: "",
    tanggal: "",
    lokasi: "",
    catatan_revisi_manager: "",
    catatan_revisi_finance: "",
    kelompok: buatKelompokTemplate(),
  }
}

function formatRupiah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(nilai) || 0)
}

function hitungSubtotal(item: RincianRAB): number {
  return (
    (Number(item.harga) || 0) *
    (Number(item.jumlah) || 0) *
    (Number(item.durasi) || 0)
  )
}

function formatTanggalInput(tanggal?: string | Date | null): string {
  if (!tanggal) return ""

  const date = tanggal instanceof Date ? tanggal : new Date(tanggal)

  if (Number.isNaN(date.getTime())) return ""

  const tahun = date.getFullYear()
  const bulan = String(date.getMonth() + 1).padStart(2, "0")
  const hari = String(date.getDate()).padStart(2, "0")

  return `${tahun}-${bulan}-${hari}`
}

function formatTanggalTabel(tanggal?: string | null): string {
  const nilai = formatTanggalInput(tanggal)

  if (!nilai) return "-"

  const [tahun, bulan, hari] = nilai.split("-")

  const namaBulan = [
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

  return `${Number(hari)} ${namaBulan[Number(bulan) - 1]} ${tahun}`
}

function formatStatus(status: string): string {
  const daftarStatus: Record<string, string> = {
    Draft: "Draft",
    "Menunggu Persetujuan Manager": "Menunggu Persetujuan Manager",
    "Mengirimkan Revisi": "Mengirimkan Revisi",
    "Menunggu Verifikasi Finance": "Menunggu Verifikasi Finance",
    "Revisi Oleh Manager": "Revisi Oleh Manager",
    "Revisi Oleh Finance": "Revisi Oleh Finance",
    Disetujui: "Disetujui",
    Ditolak: "Ditolak",
  }

  return daftarStatus[status] ?? status
}

function warnaStatus(status: string): string {
  switch (status) {
    case "Disetujui":
      return "bg-green-100 text-green-700"
    case "Ditolak":
      return "bg-red-100 text-red-700"
    case "Menunggu Persetujuan Manager":
    case "Mengirimkan Revisi":
      return "bg-amber-100 text-amber-800"
    case "Menunggu Verifikasi Finance":
      return "bg-yellow-100 text-yellow-800"
    case "Revisi Oleh Manager":
    case "Revisi Oleh Finance":
      return "bg-orange-100 text-orange-700"
    case "Draft":
      return "bg-gray-100 text-gray-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

type CatatanAktif = { label: string; teks: string; kelas: string }

// Hanya catatan yang relevan dengan status saat ini yang tampil di tabel.
// Riwayat lengkap tetap bisa dilihat di modal Detail.
function catatanAktif(rab: PengajuanRAB): CatatanAktif[] {
  switch (rab.status_persetujuan) {
    case "Revisi Oleh Manager":
      return rab.catatan_revisi_manager
        ? [
            {
              label: "Revisi Manager",
              teks: rab.catatan_revisi_manager,
              kelas: "text-orange-700",
            },
          ]
        : []

    case "Revisi Oleh Finance":
      return rab.catatan_revisi_finance
        ? [
            {
              label: "Revisi Finance",
              teks: rab.catatan_revisi_finance,
              kelas: "text-blue-700",
            },
          ]
        : []

    case "Ditolak":
      if (rab.catatan_penolakan_finance) {
        return [
          {
            label: "Ditolak Finance",
            teks: rab.catatan_penolakan_finance,
            kelas: "text-red-700",
          },
        ]
      }

      if (rab.catatan_penolakan_manager) {
        return [
          {
            label: "Ditolak Manager",
            teks: rab.catatan_penolakan_manager,
            kelas: "text-red-700",
          },
        ]
      }

      return []

    default:
      return []
  }
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"

// Header tabel menempel di atas area scroll modal. Garis memakai inset shadow
// karena border pada border-collapse tidak ikut menempel.
const TH_CLASS =
  "sticky top-0 z-10 bg-gray-100 px-2 py-2 shadow-[inset_0_1px_0_#d1d5db,inset_0_-1px_0_#d1d5db,inset_-1px_0_0_#d1d5db]"

// Kolom informasi (hanya baca) di modal Detail.
const VIEW_FIELD_CLASS =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800"

const CELL_INPUT_CLASS =
  "w-full bg-transparent px-2 py-1.5 text-xs focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"

export default function RABPage() {
  const [dataRAB, setDataRAB] = useState<PengajuanRAB[]>([])
  const [loading, setLoading] = useState(true)
  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState("")
  const [pesan, setPesan] = useState("")

  const [modalTerbuka, setModalTerbuka] = useState(false)
  const [modeEdit, setModeEdit] = useState(false)
  const [idEdit, setIdEdit] = useState<number | null>(null)
  const [form, setForm] = useState<FormRAB>(buatFormKosong())

  const [pencarian, setPencarian] = useState("")
  const [filterStatus, setFilterStatus] = useState("Semua")
  const [rabTerpilih, setRabTerpilih] = useState<PengajuanRAB | null>(null)

  const muatData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const hasil = await getRAB()
      setDataRAB((hasil ?? []) as PengajuanRAB[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data RAB.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  const totalForm = form.kelompok.reduce(
    (total, kelompok) =>
      total +
      kelompok.rincian.reduce(
        (subtotal, item) => subtotal + hitungSubtotal(item),
        0
      ),
    0
  )

  const dataTerfilter = dataRAB.filter((rab) => {
    const kataKunci = pencarian.toLowerCase()

    const cocokPencarian =
      String(rab.nomor_rab ?? "")
        .toLowerCase()
        .includes(kataKunci) ||
      String(rab.nama_kegiatan ?? "")
        .toLowerCase()
        .includes(kataKunci) ||
      String(rab.lokasi ?? "")
        .toLowerCase()
        .includes(kataKunci)

    const cocokStatus =
      filterStatus === "Semua" || rab.status_persetujuan === filterStatus

    return cocokPencarian && cocokStatus
  })

  const kelompokDetail = rabTerpilih
    ? kelompokkanUntukTampil(rabTerpilih.rincian ?? [])
    : []

  const totalDetail = rabTerpilih
    ? (rabTerpilih.rincian ?? []).reduce(
        (total, item) => total + hitungSubtotal(item),
        0
      )
    : 0

  function bukaTambah() {
    setModeEdit(false)
    setIdEdit(null)
    setForm(buatFormKosong())
    setError("")
    setPesan("")
    setModalTerbuka(true)
  }

  function bukaEdit(rab: PengajuanRAB) {
    const kelompok = buatKelompokTemplate()
    const kelompokLain: KelompokRAB[] = []

    ;(rab.rincian ?? []).forEach((item) => {
      const nama = cariNamaKelompok(item.kelompok_biaya || "")

      const data: RincianRAB = {
        ...item,
        kelompok_biaya: nama,
        satuan: item.satuan ?? "",
        harga: Number(item.harga) || 0,
        jumlah: Number(item.jumlah) || 0,
        durasi: Number(item.durasi) || 0,
        keterangan: item.keterangan ?? "",
        penjelasan_keterangan: item.penjelasan_keterangan ?? "",
      }

      let target =
        kelompok.find((k) => k.kelompok_biaya === nama) ??
        kelompokLain.find((k) => k.kelompok_biaya === nama)

      if (!target) {
        target = { kelompok_biaya: nama, rincian: [] }
        kelompokLain.push(target)
      }

      // Cocokkan ke baris bawaan lewat nama jenis biaya; sisanya jadi baris tambahan.
      const kunciJenis = normalisasiNama(data.jenis_biaya)
      const indexCocok = target.rincian.findIndex(
        (r) =>
          !!r.jenis_terkunci &&
          !r.id_rab &&
          normalisasiNama(r.jenis_biaya) === kunciJenis
      )

      if (indexCocok >= 0) {
        const preset = target.rincian[indexCocok]
        const cocokSatuan =
          !!preset.satuan_terkunci &&
          (data.satuan === "" || data.satuan === preset.satuan)

        target.rincian[indexCocok] = {
          ...data,
          jenis_biaya: preset.jenis_biaya,
          jenis_terkunci: true,
          satuan: data.satuan || preset.satuan,
          satuan_terkunci: cocokSatuan,
        }
      } else {
        target.rincian.push({
          ...data,
          jenis_terkunci: false,
          satuan_terkunci: false,
        })
      }
    })

    setModeEdit(true)
    setIdEdit(rab.id_pengajuan)
    setError("")
    setPesan("")

    setForm({
      nomor_rab: rab.nomor_rab ?? "",
      nama_kegiatan: rab.nama_kegiatan ?? "",
      tanggal: formatTanggalInput(rab.tanggal),
      lokasi: rab.lokasi ?? "",
      catatan_revisi_manager: rab.catatan_revisi_manager ?? "",
      catatan_revisi_finance: rab.catatan_revisi_finance ?? "",
      kelompok: [...kelompok, ...kelompokLain],
    })

    setModalTerbuka(true)
  }

  function ubahFieldForm(
    field: keyof Omit<FormRAB, "kelompok">,
    value: string
  ) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      [field]: value,
    }))
  }

  function ubahRincian(
    indexKelompok: number,
    indexRincian: number,
    field: keyof RincianRAB,
    value: string
  ) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok: sebelumnya.kelompok.map((kelompok, index) => {
        if (index !== indexKelompok) return kelompok

        return {
          ...kelompok,
          rincian: kelompok.rincian.map((item, indexItem) => {
            if (indexItem !== indexRincian) return item

            if (field === "harga" || field === "jumlah" || field === "durasi") {
              return {
                ...item,
                [field]: value === "" ? 0 : Number(value),
              }
            }

            return {
              ...item,
              [field]: value,
            }
          }),
        }
      }),
    }))
  }

  function tambahRincian(indexKelompok: number) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok: sebelumnya.kelompok.map((kelompok, index) =>
        index === indexKelompok
          ? {
              ...kelompok,
              rincian: [
                ...kelompok.rincian,
                {
                  ...RINCIAN_KOSONG,
                  kelompok_biaya: kelompok.kelompok_biaya,
                },
              ],
            }
          : kelompok
      ),
    }))
  }

  function hapusRincian(indexKelompok: number, indexRincian: number) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok: sebelumnya.kelompok.map((kelompok, index) => {
        if (index !== indexKelompok) return kelompok

        return {
          ...kelompok,
          rincian: kelompok.rincian.filter(
            (_, indexItem) => indexItem !== indexRincian
          ),
        }
      }),
    }))
  }

  async function simpanRAB() {
    setError("")
    setPesan("")

    if (
      !form.nomor_rab.trim() ||
      !form.nama_kegiatan.trim() ||
      !form.tanggal ||
      !form.lokasi.trim()
    ) {
      setError("Nomor RAB, nama kegiatan, tanggal, dan lokasi wajib diisi.")
      return
    }

    // Baris yang dikosongkan tidak ikut disimpan.
    const kelompokTerisi = form.kelompok.map((kelompok) => ({
      ...kelompok,
      rincian: kelompok.rincian.filter(barisTerisi),
    }))

    if (kelompokTerisi.every((kelompok) => kelompok.rincian.length === 0)) {
      setError("Isi minimal satu rincian biaya.")
      return
    }

    for (const kelompok of kelompokTerisi) {
      for (const item of kelompok.rincian) {
        if (!item.jenis_biaya.trim() || !item.satuan.trim()) {
          setError(
            `Jenis biaya dan satuan wajib diisi pada rincian ${kelompok.kelompok_biaya}.`
          )
          return
        }

        if (
          !Number.isSafeInteger(Number(item.harga)) ||
          Number(item.harga) < 0 ||
          !Number.isSafeInteger(Number(item.jumlah)) ||
          Number(item.jumlah) < 1 ||
          !Number.isSafeInteger(Number(item.durasi)) ||
          Number(item.durasi) < 1
        ) {
          setError(
            `Harga harus bilangan bulat minimal 0, jumlah dan durasi minimal 1 (${kelompok.kelompok_biaya}).`
          )
          return
        }

        if (!Number.isSafeInteger(hitungSubtotal(item))) {
          setError("Subtotal terlalu besar. Periksa harga, jumlah, dan durasi.")
          return
        }
      }
    }

    const rincianPayload = kelompokTerisi.flatMap((kelompok) =>
      kelompok.rincian.map((item) => ({
        ...(item.id_rab ? { id_rab: item.id_rab } : {}),
        jenis_biaya: item.jenis_biaya.trim(),
        kelompok_biaya: kelompok.kelompok_biaya,
        satuan: item.satuan.trim(),
        harga: Number(item.harga),
        jumlah: Number(item.jumlah),
        durasi: Number(item.durasi),
        keterangan: item.keterangan.trim(),
        penjelasan_keterangan: item.penjelasan_keterangan.trim(),
      }))
    )

    const payload = {
      nomor_rab: form.nomor_rab.trim(),
      nama_kegiatan: form.nama_kegiatan.trim(),
      tanggal: form.tanggal,
      lokasi: form.lokasi.trim(),
      rincian: rincianPayload,
    }

    setMenyimpan(true)

    try {
      if (modeEdit && idEdit !== null) {
        await updateRAB(idEdit, payload)
        setPesan("RAB berhasil diperbarui.")
      } else {
        await createRAB(payload)
        setPesan("RAB berhasil ditambahkan.")
      }

      setModalTerbuka(false)
      await muatData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan RAB.")
    } finally {
      setMenyimpan(false)
    }
  }

  async function hapusRAB(rab: PengajuanRAB) {
    if (
      !window.confirm(
        `Hapus RAB ${rab.nomor_rab}? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return
    }

    setError("")
    setPesan("")

    try {
      await deleteRAB(rab.id_pengajuan)
      setPesan("RAB berhasil dihapus.")
      await muatData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus RAB.")
    }
  }

  async function jalankanAksi(
    aksi: () => Promise<unknown>,
    pesanBerhasil: string
  ) {
    setError("")
    setPesan("")

    try {
      await aksi()
      setPesan(pesanBerhasil)
      await muatData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aksi gagal diproses.")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengajuan RAB</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola Rencana Anggaran Biaya kegiatan.
          </p>
        </div>

        <button
          type="button"
          onClick={bukaTambah}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Tambah RAB
        </button>
      </div>

      {/* Notifikasi */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Tutup pesan error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {pesan && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <span>{pesan}</span>
          <button
            type="button"
            onClick={() => setPesan("")}
            aria-label="Tutup pesan"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Pencarian dan Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 md:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={pencarian}
            onChange={(e) => setPencarian(e.target.value)}
            placeholder="Cari nomor RAB, kegiatan, atau lokasi..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pr-3 pl-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>

        <div className="relative md:w-64">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="Semua">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Menunggu Persetujuan Manager">
              Menunggu Persetujuan Manager
            </option>
            <option value="Mengirimkan Revisi">Mengirimkan Revisi</option>
            <option value="Menunggu Verifikasi Finance">
              Menunggu Verifikasi Finance
            </option>
            <option value="Revisi Oleh Manager">Revisi Oleh Manager</option>
            <option value="Revisi Oleh Finance">Revisi Oleh Finance</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
          />
        </div>
      </div>

      {/* Tabel RAB */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Nomor RAB</th>
                <th className="px-4 py-3 font-medium">Nama Kegiatan</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Lokasi</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Catatan</th>
                <th className="px-4 py-3 text-center font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Memuat data RAB...
                  </td>
                </tr>
              ) : dataTerfilter.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Tidak ada data RAB.
                  </td>
                </tr>
              ) : (
                dataTerfilter.map((rab, index) => (
                  <tr key={rab.id_pengajuan} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {rab.nomor_rab}
                    </td>
                    <td className="max-w-xs px-4 py-4">
                      <div className="font-medium text-gray-800">
                        {rab.nama_kegiatan}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                      {formatTanggalTabel(rab.tanggal)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{rab.lokasi}</td>
                    <td className="px-4 py-4 text-right font-medium whitespace-nowrap text-gray-800">
                      {formatRupiah(
                        Number(rab.total) ||
                          (rab.rincian ?? []).reduce(
                            (total, item) => total + hitungSubtotal(item),
                            0
                          )
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${warnaStatus(
                          rab.status_persetujuan
                        )}`}
                      >
                        {formatStatus(rab.status_persetujuan)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const catatan = catatanAktif(rab)

                        if (catatan.length === 0) return "-"

                        return (
                          <div className="space-y-1">
                            {catatan.map((c) => (
                              <p key={c.label} className={c.kelas}>
                                <span className="font-medium">{c.label}:</span>{" "}
                                {c.teks}
                              </p>
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Lihat rincian"
                          onClick={() => setRabTerpilih(rab)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye size={17} />
                        </button>

                        {rab.bukti_transfer && (
                          <a
                            href={rab.bukti_transfer}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Lihat bukti transfer"
                            className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          >
                            <FileText size={17} />
                          </a>
                        )}

                        {(rab.status_persetujuan === "Draft" ||
                          rab.status_persetujuan === "Revisi Oleh Manager" ||
                          rab.status_persetujuan === "Revisi Oleh Finance") && (
                          <>
                            <button
                              type="button"
                              title="Edit RAB"
                              onClick={() => bukaEdit(rab)}
                              className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              type="button"
                              title="Hapus RAB"
                              onClick={() => void hapusRAB(rab)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}

                        {(rab.status_persetujuan === "Draft" ||
                          rab.status_persetujuan === "Revisi Oleh Manager" ||
                          rab.status_persetujuan === "Revisi Oleh Finance") && (
                          <button
                            type="button"
                            title={
                              rab.status_persetujuan === "Draft"
                                ? "Ajukan RAB"
                                : "Kirim Ulang RAB"
                            }
                            onClick={() =>
                              void jalankanAksi(
                                () => submitRAB(rab.id_pengajuan),
                                rab.status_persetujuan === "Draft"
                                  ? "RAB berhasil diajukan."
                                  : "RAB hasil revisi berhasil dikirim ulang."
                              )
                            }
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Send size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
          Menampilkan {dataTerfilter.length} dari {dataRAB.length} pengajuan
          RAB.
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {modalTerbuka && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 sm:p-6">
          <div className="my-auto w-full max-w-[95vw] overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {modeEdit ? "Edit RAB" : "Tambah RAB"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Isi data kegiatan dan rincian anggaran.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Isi Modal */}
            <div className="max-h-[75vh] overflow-y-auto px-5 pb-5 md:px-6 md:pb-6">
              <div className="space-y-6 pt-5 md:pt-6">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {/* Informasi Kegiatan */}
                <section className="space-y-4">
                  <h3 className="border-b border-gray-200 pb-2 text-xs font-semibold text-gray-900">
                    Informasi Kegiatan
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Nomor RAB *
                      </label>
                      <input
                        type="text"
                        value={form.nomor_rab}
                        onChange={(e) =>
                          ubahFieldForm("nomor_rab", e.target.value)
                        }
                        placeholder="Contoh: RAB-001/2026"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Nama Kegiatan *
                      </label>
                      <input
                        type="text"
                        value={form.nama_kegiatan}
                        onChange={(e) =>
                          ubahFieldForm("nama_kegiatan", e.target.value)
                        }
                        placeholder="Nama kegiatan"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Tanggal *
                      </label>
                      <input
                        type="date"
                        value={form.tanggal}
                        onChange={(e) =>
                          ubahFieldForm("tanggal", e.target.value)
                        }
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Lokasi *
                      </label>
                      <input
                        type="text"
                        value={form.lokasi}
                        onChange={(e) =>
                          ubahFieldForm("lokasi", e.target.value)
                        }
                        placeholder="Lokasi kegiatan"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </section>

                {/* Rincian Anggaran (format mengikuti Excel RAB) */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Rincian Anggaran
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Jenis biaya dan satuan berwarna abu-abu sudah sesuai
                      format RAB. Cukup isi harga, jumlah, dan durasi; baris
                      yang harganya tidak diisi tidak akan disimpan. Gunakan
                      &quot;Tambah baris&quot; untuk biaya baru.
                    </p>
                  </div>

                  <div className="border border-gray-300">
                    <table className="w-full min-w-[1020px] border-collapse text-xs">
                      <thead>
                        <tr className="text-center text-[11px] font-semibold text-gray-700">
                          <th className={`${TH_CLASS} w-10`}>No</th>
                          <th className={`${TH_CLASS} min-w-[160px]`}>
                            JENIS BIAYA
                          </th>
                          <th className={`${TH_CLASS} w-32`}>SATUAN</th>
                          <th className={`${TH_CLASS} w-24`}>HARGA</th>
                          <th className={`${TH_CLASS} w-16`}>JUMLAH</th>
                          <th className={`${TH_CLASS} w-16`}>DURASI</th>
                          <th className={`${TH_CLASS} w-28`}>SUB TOTAL</th>
                          <th className={`${TH_CLASS} w-28`}>TOTAL</th>
                          <th className={`${TH_CLASS} min-w-[130px]`}>
                            KETERANGAN
                          </th>
                          <th className={`${TH_CLASS} min-w-[150px]`}>
                            PENJELASAN KETERANGAN
                          </th>
                          <th className={`${TH_CLASS} w-8`} />
                        </tr>
                      </thead>

                      <tbody>
                        {form.kelompok.map((kelompok, indexKelompok) => {
                          const batasTemplate = jumlahBarisTemplate(
                            kelompok.kelompok_biaya
                          )

                          return (
                            <Fragment key={indexKelompok}>
                              {/* Baris judul kelompok */}
                              <tr className="bg-blue-50 font-semibold text-gray-900">
                                <td className="border border-gray-300 px-2 py-1.5 text-center">
                                  {indexKelompok + 1}
                                </td>
                                <td
                                  colSpan={6}
                                  className="border border-gray-300 px-2 py-1.5"
                                >
                                  {kelompok.kelompok_biaya}
                                </td>
                                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">
                                  {formatRupiah(
                                    kelompok.rincian.reduce(
                                      (total, item) =>
                                        total + hitungSubtotal(item),
                                      0
                                    )
                                  )}
                                </td>
                                <td
                                  colSpan={3}
                                  className="border border-gray-300"
                                />
                              </tr>

                              {/* Baris rincian */}
                              {kelompok.rincian.map((item, indexRincian) => (
                                <tr key={item.id_rab ?? indexRincian}>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-600">
                                    {labelNomorBaris(
                                      kelompok.kelompok_biaya,
                                      indexRincian
                                    )}
                                  </td>

                                  {item.jenis_terkunci ? (
                                    <td
                                      title="Jenis biaya sesuai format RAB"
                                      className="border border-gray-300 bg-gray-100 px-2 py-1.5 text-gray-700"
                                    >
                                      {item.jenis_biaya}
                                    </td>
                                  ) : (
                                    <td className="border border-gray-300 p-0">
                                      <input
                                        type="text"
                                        value={item.jenis_biaya}
                                        onChange={(e) =>
                                          ubahRincian(
                                            indexKelompok,
                                            indexRincian,
                                            "jenis_biaya",
                                            e.target.value
                                          )
                                        }
                                        className={CELL_INPUT_CLASS}
                                      />
                                    </td>
                                  )}

                                  {item.satuan_terkunci ? (
                                    <td
                                      title="Satuan terkunci sesuai format RAB"
                                      className="border border-gray-300 bg-gray-100 px-2 py-1.5 text-gray-600"
                                    >
                                      {item.satuan}
                                    </td>
                                  ) : (
                                    <td className="border border-gray-300 p-0">
                                      <input
                                        type="text"
                                        value={item.satuan}
                                        onChange={(e) =>
                                          ubahRincian(
                                            indexKelompok,
                                            indexRincian,
                                            "satuan",
                                            e.target.value
                                          )
                                        }
                                        className={CELL_INPUT_CLASS}
                                      />
                                    </td>
                                  )}

                                  <td className="border border-gray-300 p-0">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={item.harga === 0 ? "" : item.harga}
                                      onChange={(e) =>
                                        ubahRincian(
                                          indexKelompok,
                                          indexRincian,
                                          "harga",
                                          e.target.value
                                        )
                                      }
                                      className={`${CELL_INPUT_CLASS} text-right`}
                                    />
                                  </td>

                                  <td className="border border-gray-300 p-0">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={item.jumlah || ""}
                                      onChange={(e) =>
                                        ubahRincian(
                                          indexKelompok,
                                          indexRincian,
                                          "jumlah",
                                          e.target.value
                                        )
                                      }
                                      className={`${CELL_INPUT_CLASS} text-right`}
                                    />
                                  </td>

                                  <td className="border border-gray-300 p-0">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={item.durasi || ""}
                                      onChange={(e) =>
                                        ubahRincian(
                                          indexKelompok,
                                          indexRincian,
                                          "durasi",
                                          e.target.value
                                        )
                                      }
                                      className={`${CELL_INPUT_CLASS} text-right`}
                                    />
                                  </td>

                                  <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 text-right whitespace-nowrap text-gray-800">
                                    {hitungSubtotal(item) > 0
                                      ? formatRupiah(hitungSubtotal(item))
                                      : ""}
                                  </td>

                                  <td className="border border-gray-300 bg-gray-50" />

                                  <td className="border border-gray-300 p-0">
                                    <input
                                      type="text"
                                      value={item.keterangan}
                                      onChange={(e) =>
                                        ubahRincian(
                                          indexKelompok,
                                          indexRincian,
                                          "keterangan",
                                          e.target.value
                                        )
                                      }
                                      className={CELL_INPUT_CLASS}
                                    />
                                  </td>

                                  <td className="border border-gray-300 p-0">
                                    <input
                                      type="text"
                                      value={item.penjelasan_keterangan}
                                      onChange={(e) =>
                                        ubahRincian(
                                          indexKelompok,
                                          indexRincian,
                                          "penjelasan_keterangan",
                                          e.target.value
                                        )
                                      }
                                      className={CELL_INPUT_CLASS}
                                    />
                                  </td>

                                  <td className="border border-gray-300 text-center">
                                    {indexRincian >= batasTemplate && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          hapusRincian(
                                            indexKelompok,
                                            indexRincian
                                          )
                                        }
                                        title="Hapus baris"
                                        className="rounded p-1 text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}

                              {/* Tambah baris */}
                              <tr>
                                <td
                                  colSpan={11}
                                  className="border border-gray-300 px-2 py-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => tambahRincian(indexKelompok)}
                                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                  >
                                    <Plus size={14} />
                                    Tambah baris {kelompok.kelompok_biaya}
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>

                      <tfoot>
                        <tr className="bg-gray-100 font-bold text-gray-900">
                          <td
                            colSpan={7}
                            className="border border-gray-300 px-2 py-2 text-center"
                          >
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-right whitespace-nowrap">
                            {formatRupiah(totalForm)}
                          </td>
                          <td colSpan={3} className="border border-gray-300" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Total Keseluruhan */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs text-gray-600">
                      Total Keseluruhan RAB
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {form.kelompok.reduce(
                        (jumlah, kelompok) =>
                          jumlah + kelompok.rincian.filter(barisTerisi).length,
                        0
                      )}{" "}
                      rincian terisi
                    </p>
                  </div>

                  <p className="text-lg font-bold text-blue-700">
                    {formatRupiah(totalForm)}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row md:px-6">
              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                disabled={menyimpan}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void simpanRAB()}
                disabled={menyimpan}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={15} />
                {menyimpan
                  ? "Menyimpan..."
                  : modeEdit
                    ? "Simpan Perubahan"
                    : "Simpan RAB"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail RAB */}
      {rabTerpilih && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 sm:p-6">
          <div className="my-auto w-full max-w-[95vw] overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Detail RAB
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {rabTerpilih.nomor_rab}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRabTerpilih(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>

            {/* Isi Modal */}
            <div className="max-h-[75vh] overflow-y-auto px-5 pb-5 md:px-6 md:pb-6">
              <div className="space-y-6 pt-5 md:pt-6">
                {/* Riwayat Catatan */}
                {(rabTerpilih.catatan_revisi_manager ||
                  rabTerpilih.catatan_revisi_finance ||
                  rabTerpilih.catatan_penolakan_manager ||
                  rabTerpilih.catatan_penolakan_finance) && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-900">
                      Riwayat Catatan
                    </p>

                    {rabTerpilih.catatan_revisi_manager && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
                        <span className="font-semibold">
                          Catatan Revisi Manager:
                        </span>{" "}
                        {rabTerpilih.catatan_revisi_manager}
                      </div>
                    )}

                    {rabTerpilih.catatan_revisi_finance && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                        <span className="font-semibold">
                          Catatan Revisi Finance:
                        </span>{" "}
                        {rabTerpilih.catatan_revisi_finance}
                      </div>
                    )}

                    {rabTerpilih.catatan_penolakan_manager && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <span className="font-semibold">
                          Alasan Penolakan Manager:
                        </span>{" "}
                        {rabTerpilih.catatan_penolakan_manager}
                      </div>
                    )}

                    {rabTerpilih.catatan_penolakan_finance && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <span className="font-semibold">
                          Alasan Penolakan Finance:
                        </span>{" "}
                        {rabTerpilih.catatan_penolakan_finance}
                      </div>
                    )}
                  </div>
                )}

                {/* Informasi Kegiatan */}
                <section className="space-y-4">
                  <h3 className="border-b border-gray-200 pb-2 text-xs font-semibold text-gray-900">
                    Informasi Kegiatan
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-gray-700">
                        Nomor RAB
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {rabTerpilih.nomor_rab}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-gray-700">
                        Nama Kegiatan
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {rabTerpilih.nama_kegiatan}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-gray-700">
                        Tanggal
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {formatTanggalTabel(rabTerpilih.tanggal)}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-gray-700">
                        Lokasi
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {rabTerpilih.lokasi}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-gray-700">
                        Status
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${warnaStatus(
                          rabTerpilih.status_persetujuan
                        )}`}
                      >
                        {formatStatus(rabTerpilih.status_persetujuan)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Bukti Transfer */}
                {rabTerpilih.bukti_transfer && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <h3 className="text-xs font-semibold text-gray-900">
                        Bukti Transfer
                      </h3>
                      <a
                        href={rabTerpilih.bukti_transfer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <FileText size={14} />
                        Buka di tab baru
                      </a>
                    </div>

                    <iframe
                      src={rabTerpilih.bukti_transfer}
                      title="Bukti transfer"
                      className="h-96 w-full rounded-lg border border-gray-200"
                    />
                  </section>
                )}

                {/* Rincian Anggaran (tampilan sama dengan modal Tambah/Edit) */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Rincian Anggaran
                  </h3>

                  <div className="border border-gray-300">
                    <table className="w-full min-w-[1020px] border-collapse text-xs">
                      <thead>
                        <tr className="text-center text-[11px] font-semibold text-gray-700">
                          <th className={`${TH_CLASS} w-10`}>No</th>
                          <th className={`${TH_CLASS} min-w-[160px]`}>
                            JENIS BIAYA
                          </th>
                          <th className={`${TH_CLASS} w-32`}>SATUAN</th>
                          <th className={`${TH_CLASS} w-24`}>HARGA</th>
                          <th className={`${TH_CLASS} w-16`}>JUMLAH</th>
                          <th className={`${TH_CLASS} w-16`}>DURASI</th>
                          <th className={`${TH_CLASS} w-28`}>SUB TOTAL</th>
                          <th className={`${TH_CLASS} w-28`}>TOTAL</th>
                          <th className={`${TH_CLASS} min-w-[130px]`}>
                            KETERANGAN
                          </th>
                          <th className={`${TH_CLASS} min-w-[150px]`}>
                            PENJELASAN KETERANGAN
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {kelompokDetail.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="border border-gray-300 px-2 py-8 text-center text-gray-500"
                            >
                              Tidak ada rincian biaya.
                            </td>
                          </tr>
                        ) : (
                          kelompokDetail.map((kelompok) => (
                            <Fragment key={kelompok.kelompok_biaya}>
                              {/* Baris judul kelompok */}
                              <tr className="bg-blue-50 font-semibold text-gray-900">
                                <td className="border border-gray-300 px-2 py-1.5 text-center">
                                  {kelompok.nomor}
                                </td>
                                <td
                                  colSpan={6}
                                  className="border border-gray-300 px-2 py-1.5"
                                >
                                  {kelompok.kelompok_biaya}
                                </td>
                                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">
                                  {formatRupiah(
                                    kelompok.baris.reduce(
                                      (total, b) =>
                                        total + hitungSubtotal(b.item),
                                      0
                                    )
                                  )}
                                </td>
                                <td
                                  colSpan={2}
                                  className="border border-gray-300"
                                />
                              </tr>

                              {/* Baris rincian */}
                              {kelompok.baris.map(
                                ({
                                  item,
                                  slot,
                                  jenisTerkunci,
                                  satuanTerkunci,
                                }) => (
                                  <tr
                                    key={
                                      item.id_rab ??
                                      `${kelompok.kelompok_biaya}-${slot}`
                                    }
                                    className="align-top"
                                  >
                                    <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-600">
                                      {labelNomorBaris(
                                        kelompok.kelompok_biaya,
                                        slot
                                      )}
                                    </td>
                                    <td
                                      className={`border border-gray-300 px-2 py-1.5 ${
                                        jenisTerkunci
                                          ? "bg-gray-100 text-gray-700"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      {item.jenis_biaya}
                                    </td>
                                    <td
                                      className={`border border-gray-300 px-2 py-1.5 ${
                                        satuanTerkunci
                                          ? "bg-gray-100 text-gray-600"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      {item.satuan}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">
                                      {item.harga > 0
                                        ? formatRupiah(item.harga)
                                        : ""}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-right">
                                      {item.jumlah || ""}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-right">
                                      {item.durasi || ""}
                                    </td>
                                    <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 text-right whitespace-nowrap text-gray-800">
                                      {hitungSubtotal(item) > 0
                                        ? formatRupiah(hitungSubtotal(item))
                                        : ""}
                                    </td>
                                    <td className="border border-gray-300 bg-gray-50" />
                                    <td className="border border-gray-300 px-2 py-1.5 text-gray-700">
                                      {item.keterangan}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-gray-700">
                                      {item.penjelasan_keterangan}
                                    </td>
                                  </tr>
                                )
                              )}
                            </Fragment>
                          ))
                        )}
                      </tbody>

                      <tfoot>
                        <tr className="bg-gray-100 font-bold text-gray-900">
                          <td
                            colSpan={7}
                            className="border border-gray-300 px-2 py-2 text-center"
                          >
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-right whitespace-nowrap">
                            {formatRupiah(totalDetail)}
                          </td>
                          <td colSpan={2} className="border border-gray-300" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Total Keseluruhan */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs text-gray-600">
                      Total Keseluruhan RAB
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {(rabTerpilih.rincian ?? []).length} rincian
                    </p>
                  </div>

                  <p className="text-lg font-bold text-blue-700">
                    {formatRupiah(totalDetail)}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end border-t border-gray-200 bg-white px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={() => setRabTerpilih(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
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