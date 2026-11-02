"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { FileText, X } from "lucide-react"

import { approveRAB, getRAB, reviseRAB, rejectRAB } from "@/app/actions/rab"

type RincianRAB = {
  id_rab?: number
  jenis_biaya: string
  kelompok_biaya: string
  satuan: string
  harga: number
  jumlah: number
  durasi: number
  subtotal: number
  keterangan: string | null
  penjelasan_keterangan: string | null
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
  bukti_transfer?: string | null
  total: number
  rincian: RincianRAB[]
}

const STATUS = {
  DRAFT: "Draft",
  MENUNGGU_MANAGER: "Menunggu Persetujuan Manager",
  MENGIRIM_REVISI: "Mengirimkan Revisi",
  REVISI: "Revisi Oleh Manager",
  MENUNGGU_FINANCE: "Menunggu Verifikasi Finance",
  REVISI_FINANCE: "Revisi Oleh Finance",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
} as const

// Status yang perlu diproses Manager (setujui / revisi / tolak).
const STATUS_PERLU_DIPROSES: string[] = [
  STATUS.MENUNGGU_MANAGER,
  STATUS.MENGIRIM_REVISI,
]

type TabKey = "menunggu" | "disetujui" | "revisi" | "ditolak" | "semua"
type ActionType = "revisi" | "tolak" | null

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  {
    key: "menunggu",
    label: "Menunggu",
    statuses: [STATUS.MENUNGGU_MANAGER, STATUS.MENGIRIM_REVISI],
  },
  {
    key: "disetujui",
    label: "Disetujui",
    statuses: [STATUS.MENUNGGU_FINANCE, STATUS.DISETUJUI],
  },
  {
    key: "revisi",
    label: "Revisi",
    statuses: [STATUS.REVISI, STATUS.REVISI_FINANCE],
  },
  {
    key: "ditolak",
    label: "Ditolak",
    statuses: [STATUS.DITOLAK],
  },
  {
    key: "semua",
    label: "Semua",
    statuses: [
      STATUS.MENUNGGU_MANAGER,
      STATUS.MENGIRIM_REVISI,
      STATUS.MENUNGGU_FINANCE,
      STATUS.DISETUJUI,
      STATUS.REVISI,
      STATUS.REVISI_FINANCE,
      STATUS.DITOLAK,
    ],
  },
]

const SATUAN_HARI = "Per orang per hari"
const SATUAN_KAMAR = "Per kamar"

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

const ALIAS_KELOMPOK: Record<string, string> = {
  "biaya sdm": "Biaya ADM",
}

const TH_CLASS =
  "sticky top-0 z-10 bg-gray-100 px-2 py-2 shadow-[inset_0_1px_0_#d1d5db,inset_0_-1px_0_#d1d5db,inset_-1px_0_0_#d1d5db]"

const VIEW_FIELD_CLASS =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800"

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}
function formatTanggal(tanggal: string | Date) {
  return new Date(tanggal).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
function hitungSubtotal(item: RincianRAB): number {
  return (
    (Number(item.harga) || 0) *
    (Number(item.jumlah) || 0) *
    (Number(item.durasi) || 0)
  )
}

function hitungTotal(item: PengajuanRAB): number {
  return (item.rincian ?? []).reduce(
    (total, rincian) => total + hitungSubtotal(rincian),
    0
  )
}

function warnaStatus(status: string): string {
  switch (status) {
    case STATUS.DISETUJUI:
      return "bg-green-100 text-green-700"
    case STATUS.DITOLAK:
      return "bg-red-100 text-red-700"
    case STATUS.MENUNGGU_MANAGER:
    case STATUS.MENGIRIM_REVISI:
      return "bg-amber-100 text-amber-800"
    case STATUS.MENUNGGU_FINANCE:
      return "bg-yellow-100 text-yellow-800"
    case STATUS.REVISI:
    case STATUS.REVISI_FINANCE:
      return "bg-orange-100 text-orange-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
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

function labelNomorBaris(namaKelompok: string, slot: number): string {
  const maks = TEMPLATE_KELOMPOK.find((k) => k.nama === namaKelompok)?.maksNomor

  if (maks !== undefined && slot >= maks) return ""

  return String.fromCharCode(97 + slot)
}

function buatBarisKosong(
  kelompok: string,
  jenis: string,
  satuan: string
): RincianRAB {
  return {
    jenis_biaya: jenis,
    kelompok_biaya: kelompok,
    satuan,
    harga: 0,
    jumlah: 0,
    durasi: 0,
    subtotal: 0,
    keterangan: "",
    penjelasan_keterangan: "",
  }
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

    kelompok.baris.forEach((b) => {
      if (b.slot < template.length) {
        b.jenisTerkunci = true
        b.satuanTerkunci = template[b.slot].satuan !== ""
      }
    })

    template.forEach((t, i) => {
      if (terpakai.has(i)) return

      kelompok.baris.push({
        item: buatBarisKosong(kelompok.kelompok_biaya, t.jenis, t.satuan),
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

export default function ManagerRABPage() {
  const [data, setData] = useState<PengajuanRAB[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selected, setSelected] = useState<PengajuanRAB | null>(null)

  const [catatanRevisi, setCatatanRevisi] = useState("")
  const [catatanPenolakan, setCatatanPenolakan] = useState("")
  const [actionType, setActionType] = useState<ActionType>(null)

  const [tab, setTab] = useState<TabKey>("menunggu")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const result = await getRAB()
      setData(result as PengajuanRAB[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat pengajuan RAB."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const menunggu = data.filter((item) =>
    STATUS_PERLU_DIPROSES.includes(item.status_persetujuan)
  )

  const totalMenunggu = menunggu.reduce(
    (total, item) => total + hitungTotal(item),
    0
  )

  const tabAktif = TABS.find((t) => t.key === tab) ?? TABS[0]

  const daftar = data.filter((item) =>
    tabAktif.statuses.includes(item.status_persetujuan)
  )

  const bolehProses = selected
    ? STATUS_PERLU_DIPROSES.includes(selected.status_persetujuan)
    : false

  const kelompokDetail = selected
    ? kelompokkanUntukTampil(selected.rincian ?? [])
    : []

  const totalDetail = selected ? hitungTotal(selected) : 0

  function tutupDetail() {
    if (processing) return

    setSelected(null)
    setActionType(null)
    setError("")
    setCatatanRevisi("")
    setCatatanPenolakan("")
  }

  async function handleApprove(item: PengajuanRAB) {
    const confirmed = window.confirm(
      `Setujui RAB ${item.nomor_rab} dan teruskan ke Finance?`
    )

    if (!confirmed) return

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const result = await approveRAB(item.id_pengajuan)

      setSuccess(result.message)
      setSelected(null)
      setActionType(null)

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyetujui RAB.")
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    if (!selected) return

    if (!catatanPenolakan.trim()) {
      setError("Alasan penolakan wajib diisi.")
      return
    }

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const result = await rejectRAB(
        selected.id_pengajuan,
        catatanPenolakan.trim()
      )

      setSuccess(result.message)
      setSelected(null)
      setActionType(null)
      setCatatanRevisi("")
      setCatatanPenolakan("")

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menolak pengajuan RAB."
      )
    } finally {
      setProcessing(false)
    }
  }

  async function handleRevise() {
    if (!selected) return

    if (!catatanRevisi.trim()) {
      setError("Catatan revisi wajib diisi.")
      return
    }

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const result = await reviseRAB(
        selected.id_pengajuan,
        catatanRevisi.trim()
      )

      setSuccess(result.message)
      setSelected(null)
      setActionType(null)
      setCatatanRevisi("")
      setCatatanPenolakan("")

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengembalikan RAB untuk revisi."
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="min-h-screen space-y-6 bg-gray-50 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-gray-600">Panel Manager</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          Persetujuan RAB
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Periksa rincian anggaran sebelum menyetujui atau meminta revisi.
        </p>
      </header>

      {error && !selected && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Menunggu Persetujuan</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {menunggu.length} RAB
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Anggaran Menunggu</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {rupiah(totalMenunggu)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Daftar Pengajuan</h2>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-5">
          {TABS.map((t) => {
            const jumlah = data.filter((item) =>
              t.statuses.includes(item.status_persetujuan)
            ).length

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    tab === t.key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {jumlah}
                </span>
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nomor RAB</th>
                <th className="px-4 py-3 font-medium">Kegiatan</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 text-right font-medium">
                  Total Anggaran
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : daftar.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {tab === "menunggu"
                      ? "Tidak ada pengajuan yang menunggu persetujuan."
                      : "Tidak ada RAB pada kategori ini."}
                  </td>
                </tr>
              ) : (
                daftar.map((item) => (
                  <tr key={item.id_pengajuan} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-semibold text-gray-900">
                      {item.nomor_rab}
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {item.nama_kegiatan}
                      <p className="mt-1 text-xs text-gray-500">
                        {item.lokasi}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatTanggal(item.tanggal)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {rupiah(hitungTotal(item))}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${warnaStatus(
                          item.status_persetujuan
                        )}`}
                      >
                        {item.status_persetujuan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item)
                            setCatatanRevisi("")
                            setCatatanPenolakan("")
                            setActionType(null)
                            setError("")
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {STATUS_PERLU_DIPROSES.includes(
                            item.status_persetujuan
                          )
                            ? "Periksa"
                            : "Lihat"}
                        </button>

                        {item.bukti_transfer && (
                          <a
                            href={item.bukti_transfer}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Lihat bukti transfer"
                            className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          >
                            <FileText size={17} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Detail RAB */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 sm:p-6">
          <div className="my-auto w-full max-w-[95vw] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Detail Pengajuan RAB
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selected.nomor_rab}
                </p>
              </div>

              <button
                type="button"
                onClick={tutupDetail}
                disabled={processing}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 pb-5 md:px-6 md:pb-6">
              <div className="space-y-6 pt-5 md:pt-6">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {/* Catatan yang sudah tersimpan */}
                {(selected.catatan_revisi_manager ||
                  selected.catatan_revisi_finance ||
                  selected.catatan_penolakan_manager) && (
                  <div className="space-y-2">
                    {selected.catatan_revisi_manager && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
                        <span className="font-semibold">
                          Catatan Revisi Manager:
                        </span>{" "}
                        {selected.catatan_revisi_manager}
                      </div>
                    )}

                    {selected.catatan_revisi_finance && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                        <span className="font-semibold">
                          Catatan Revisi Finance:
                        </span>{" "}
                        {selected.catatan_revisi_finance}
                      </div>
                    )}

                    {selected.catatan_penolakan_manager && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <span className="font-semibold">
                          Alasan Penolakan Manager:
                        </span>{" "}
                        {selected.catatan_penolakan_manager}
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
                      <p className="mb-1.5 text-xs font-medium text-gray-700">
                        Nomor RAB
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {selected.nomor_rab}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-700">
                        Nama Kegiatan
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {selected.nama_kegiatan}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-700">
                        Tanggal Kegiatan
                      </p>
                      <div className={VIEW_FIELD_CLASS}>
                        {formatTanggal(selected.tanggal)}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-700">
                        Lokasi
                      </p>
                      <div className={VIEW_FIELD_CLASS}>{selected.lokasi}</div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-700">
                        Status
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${warnaStatus(
                          selected.status_persetujuan
                        )}`}
                      >
                        {selected.status_persetujuan}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Bukti Transfer */}
                {selected.bukti_transfer && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <h3 className="text-xs font-semibold text-gray-900">
                        Bukti Transfer
                      </h3>
                      <a
                        href={selected.bukti_transfer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <FileText size={14} />
                        Buka di tab baru
                      </a>
                    </div>

                    <iframe
                      src={selected.bukti_transfer}
                      title="Bukti transfer"
                      className="h-96 w-full rounded-lg border border-gray-200"
                    />
                  </section>
                )}

                {/* Rincian Anggaran */}
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
                        {kelompokDetail.map((kelompok) => (
                          <Fragment key={kelompok.kelompok_biaya}>
                            <tr className="bg-gray-50 font-semibold text-gray-900">
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
                                {rupiah(
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
                                    {Number(item.harga) > 0
                                      ? rupiah(item.harga)
                                      : ""}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-right">
                                    {Number(item.jumlah) || ""}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-right">
                                    {Number(item.durasi) || ""}
                                  </td>
                                  <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 text-right whitespace-nowrap text-gray-800">
                                    {hitungSubtotal(item) > 0
                                      ? rupiah(hitungSubtotal(item))
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
                        ))}
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
                            {rupiah(totalDetail)}
                          </td>
                          <td colSpan={2} className="border border-gray-300" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Total Anggaran */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs text-gray-600">Total Anggaran</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {(selected.rincian ?? []).length} rincian
                    </p>
                  </div>

                  <p className="text-lg font-bold text-gray-900">
                    {rupiah(totalDetail)}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Detail */}
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row md:px-6">
              <button
                type="button"
                disabled={processing}
                onClick={tutupDetail}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Tutup
              </button>

              {bolehProses && (
                <>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => {
                      setError("")
                      setCatatanPenolakan("")
                      setActionType("tolak")
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Tolak RAB
                  </button>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => {
                      setError("")
                      setCatatanRevisi("")
                      setActionType("revisi")
                    }}
                    className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                  >
                    Minta Revisi
                  </button>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => void handleApprove(selected)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing ? "Memproses..." : "Setujui RAB"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Minta Revisi / Tolak RAB */}
      {selected && actionType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {actionType === "revisi"
                    ? "Minta Revisi RAB"
                    : "Tolak Pengajuan RAB"}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {selected.nomor_rab}
                </p>
              </div>

              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setActionType(null)
                  setError("")
                }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Tutup modal tindakan"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">
                  {selected.nama_kegiatan}
                </p>
                <p className="mt-1">{selected.lokasi}</p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-800">
                  {actionType === "revisi"
                    ? "Catatan Revisi"
                    : "Alasan Penolakan"}
                </label>

                <textarea
                  value={
                    actionType === "revisi" ? catatanRevisi : catatanPenolakan
                  }
                  onChange={(e) => {
                    if (actionType === "revisi") {
                      setCatatanRevisi(e.target.value)
                    } else {
                      setCatatanPenolakan(e.target.value)
                    }
                  }}
                  rows={5}
                  disabled={processing}
                  placeholder={
                    actionType === "revisi"
                      ? "Jelaskan bagian RAB yang perlu diperbaiki..."
                      : "Tuliskan alasan pengajuan RAB ditolak..."
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100 disabled:bg-gray-100"
                />

                <p className="mt-2 text-xs text-gray-500">
                  Catatan wajib diisi sebelum tindakan dikonfirmasi.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setActionType(null)
                  setError("")
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  if (actionType === "revisi") {
                    void handleRevise()
                  } else {
                    void handleReject()
                  }
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  actionType === "revisi"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processing
                  ? "Memproses..."
                  : actionType === "revisi"
                    ? "Kirim Revisi"
                    : "Konfirmasi Penolakan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
