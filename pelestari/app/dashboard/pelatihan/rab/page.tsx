"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  Send,
  CheckCircle,
  RotateCcw,
  Eye,
  ChevronDown,
} from "lucide-react"

import {
  getRAB,
  createRAB,
  updateRAB,
  deleteRAB,
  submitRAB,
  approveRAB,
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

const KELOMPOK_BIAYA_OPTIONS = [
  "Honor",
  "Transportasi",
  "Akomodasi",
  "Biaya SDM",
  "Biaya Lain Lain",
]

const RINCIAN_KOSONG: RincianRAB = {
  jenis_biaya: "",
  kelompok_biaya: "",
  satuan: "",
  harga: 0,
  jumlah: 1,
  durasi: 1,
  keterangan: "",
  penjelasan_keterangan: "",
}

function buatKelompokKosong(): KelompokRAB {
  return {
    kelompok_biaya: "",
    rincian: [{ ...RINCIAN_KOSONG }],
  }
}

function buatFormKosong(): FormRAB {
  return {
    nomor_rab: "",
    nama_kegiatan: "",
    tanggal: "",
    lokasi: "",
    catatan_revisi_manager: "",
    catatan_revisi_finance: "",
    kelompok: [buatKelompokKosong()],
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
    "Menunggu Verifikasi Finance": "Menunggu Verifikasi Finance",
    "Revisi Oleh Manager": "Revisi Oleh Manager",
    "Revisi Oleh Finance": "Revisi Oleh Finance",
    Disetujui: "Disetujui",
  }

  return daftarStatus[status] ?? status
}

function warnaStatus(status: string): string {
  switch (status) {
    case "Disetujui":
      return "bg-green-100 text-green-700"
    case "Menunggu Persetujuan Manager":
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

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"

const INPUT_COMPACT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"

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
      console.log("Data RAB:", hasil?.[0])
      console.log("Nilai tanggal:", hasil?.[0]?.tanggal)
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

  function bukaTambah() {
    setModeEdit(false)
    setIdEdit(null)
    setForm(buatFormKosong())
    setError("")
    setPesan("")
    setModalTerbuka(true)
  }

  function bukaEdit(rab: PengajuanRAB) {
    const kelompokMap = new Map<string, RincianRAB[]>()

    ;(rab.rincian ?? []).forEach((item) => {
      const namaKelompok = item.kelompok_biaya || ""

      if (!kelompokMap.has(namaKelompok)) {
        kelompokMap.set(namaKelompok, [])
      }

      kelompokMap.get(namaKelompok)!.push({
        ...item,
        harga: Number(item.harga) || 0,
        jumlah: Number(item.jumlah) || 1,
        durasi: Number(item.durasi) || 1,
        keterangan: item.keterangan ?? "",
        penjelasan_keterangan: item.penjelasan_keterangan ?? "",
      })
    })

    const kelompok = Array.from(kelompokMap.entries()).map(
      ([kelompok_biaya, rincian]) => ({
        kelompok_biaya,
        rincian,
      })
    )

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
      kelompok: kelompok.length > 0 ? kelompok : [buatKelompokKosong()],
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

  function ubahKelompok(
    indexKelompok: number,
    field: "kelompok_biaya",
    value: string
  ) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok: sebelumnya.kelompok.map((kelompok, index) =>
        index === indexKelompok
          ? {
              ...kelompok,
              [field]: value,
            }
          : kelompok
      ),
    }))
  }

  function tambahKelompok() {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok: [...sebelumnya.kelompok, buatKelompokKosong()],
    }))
  }

  function hapusKelompok(indexKelompok: number) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      kelompok:
        sebelumnya.kelompok.length > 1
          ? sebelumnya.kelompok.filter((_, index) => index !== indexKelompok)
          : sebelumnya.kelompok,
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
          rincian:
            kelompok.rincian.length > 1
              ? kelompok.rincian.filter(
                  (_, indexItem) => indexItem !== indexRincian
                )
              : kelompok.rincian,
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

    if (form.kelompok.length === 0) {
      setError("Tambahkan minimal satu kelompok biaya.")
      return
    }

    for (const kelompok of form.kelompok) {
      if (!kelompok.kelompok_biaya.trim()) {
        setError("Pilih kelompok biaya untuk setiap kelompok.")
        return
      }

      if (kelompok.rincian.length === 0) {
        setError(
          `Kelompok ${kelompok.kelompok_biaya} harus memiliki rincian biaya.`
        )
        return
      }

      for (const item of kelompok.rincian) {
        if (!item.jenis_biaya.trim() || !item.satuan.trim()) {
          setError("Jenis biaya dan satuan wajib diisi pada setiap rincian.")
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
            "Harga harus berupa bilangan bulat minimal 0. Jumlah dan durasi minimal 1."
          )
          return
        }

        if (!Number.isSafeInteger(hitungSubtotal(item))) {
          setError("Subtotal terlalu besar. Periksa harga, jumlah, dan durasi.")
          return
        }
      }
    }

    const rincianPayload = form.kelompok.flatMap((kelompok) =>
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
            <option value="Menunggu Verifikasi Finance">
              Menunggu Verifikasi Finance
            </option>
            <option value="Revisi Oleh Manager">Revisi Oleh Manager</option>
            <option value="Disetujui">Disetujui</option>
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
                <th className="px-4 py-3 text-left">Catatan Revisi</th>
                <th className="px-4 py-3 text-center font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Memuat data RAB...
                  </td>
                </tr>
              ) : dataTerfilter.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
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
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {rab.catatan_revisi_manager && (
                          <p className="text-orange-700">
                            <span className="font-medium">Manager:</span>{" "}
                            {rab.catatan_revisi_manager}
                          </p>
                        )}

                        {rab.catatan_revisi_finance && (
                          <p className="text-blue-700">
                            <span className="font-medium">Finance:</span>{" "}
                            {rab.catatan_revisi_finance}
                          </p>
                        )}

                        {!rab.catatan_revisi_manager &&
                          !rab.catatan_revisi_finance &&
                          "-"}
                      </div>
                    </td>{" "}
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
                                rab.status_persetujuan === "Revisi Oleh Manager"
                                  ? "RAB hasil revisi berhasil dikirim ulang."
                                  : "RAB berhasil diajukan."
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
          <div className="my-auto w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {modeEdit ? "Edit RAB" : "Tambah RAB"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Isi data kegiatan dan rincian anggaran.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Isi Modal */}
            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5 md:p-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Informasi Kegiatan */}
              <section className="space-y-4">
                <h3 className="border-b border-gray-200 pb-2 text-sm font-semibold text-gray-900">
                  Informasi Kegiatan
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Tanggal *
                    </label>
                    <input
                      type="date"
                      value={form.tanggal}
                      onChange={(e) => ubahFieldForm("tanggal", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Lokasi *
                    </label>
                    <input
                      type="text"
                      value={form.lokasi}
                      onChange={(e) => ubahFieldForm("lokasi", e.target.value)}
                      placeholder="Lokasi kegiatan"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </section>

              {/* Rincian Anggaran */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Rincian Anggaran
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Setiap rincian ditampilkan dalam satu baris.
                  </p>
                </div>

                {form.kelompok.map((kelompok, indexKelompok) => (
                  <div
                    key={indexKelompok}
                    className="overflow-hidden rounded-xl border border-gray-200"
                  >
                    {/* Header Kelompok */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                        <label className="shrink-0 text-sm font-medium text-gray-700">
                          Kelompok Biaya
                        </label>

                        <select
                          value={kelompok.kelompok_biaya}
                          onChange={(e) =>
                            ubahKelompok(
                              indexKelompok,
                              "kelompok_biaya",
                              e.target.value
                            )
                          }
                          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                        >
                          <option value="">Pilih Kelompok Biaya</option>
                          {KELOMPOK_BIAYA_OPTIONS.map((opsi) => (
                            <option key={opsi} value={opsi}>
                              {opsi}
                            </option>
                          ))}
                          {kelompok.kelompok_biaya &&
                            !KELOMPOK_BIAYA_OPTIONS.includes(
                              kelompok.kelompok_biaya
                            ) && (
                              <option value={kelompok.kelompok_biaya}>
                                {kelompok.kelompok_biaya}
                              </option>
                            )}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => hapusKelompok(indexKelompok)}
                        disabled={form.kelompok.length === 1}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                        Hapus Kelompok
                      </button>
                    </div>

                    {/* Tabel Rincian */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] border-collapse text-sm">
                        <thead>
                          <tr className="border-y border-gray-200 bg-white text-left text-gray-600">
                            <th className="min-w-[220px] px-3 py-3 font-medium">
                              Jenis Biaya
                            </th>
                            <th className="w-28 px-3 py-3 font-medium">
                              Satuan
                            </th>
                            <th className="w-36 px-3 py-3 font-medium">
                              Harga
                            </th>
                            <th className="w-24 px-3 py-3 font-medium">
                              Jumlah
                            </th>
                            <th className="w-24 px-3 py-3 font-medium">
                              Durasi
                            </th>
                            <th className="w-40 px-3 py-3 font-medium">
                              Subtotal
                            </th>
                            <th className="w-20 px-3 py-3 text-center font-medium">
                              Aksi
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {kelompok.rincian.map((item, indexRincian) => (
                            <tr
                              key={item.id_rab ?? indexRincian}
                              className="align-top"
                            >
                              <td className="px-3 py-3">
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
                                  placeholder="Nama biaya"
                                  className={INPUT_COMPACT_CLASS}
                                />
                              </td>

                              <td className="px-3 py-3">
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
                                  placeholder="Per Orang"
                                  className={INPUT_COMPACT_CLASS}
                                />
                              </td>

                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.harga}
                                  onChange={(e) =>
                                    ubahRincian(
                                      indexKelompok,
                                      indexRincian,
                                      "harga",
                                      e.target.value
                                    )
                                  }
                                  className={INPUT_COMPACT_CLASS}
                                />
                              </td>

                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.jumlah}
                                  onChange={(e) =>
                                    ubahRincian(
                                      indexKelompok,
                                      indexRincian,
                                      "jumlah",
                                      e.target.value
                                    )
                                  }
                                  className={INPUT_COMPACT_CLASS}
                                />
                              </td>

                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.durasi}
                                  onChange={(e) =>
                                    ubahRincian(
                                      indexKelompok,
                                      indexRincian,
                                      "durasi",
                                      e.target.value
                                    )
                                  }
                                  className={INPUT_COMPACT_CLASS}
                                />
                              </td>

                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="pt-2 font-semibold text-gray-800">
                                  {formatRupiah(hitungSubtotal(item))}
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    hapusRincian(indexKelompok, indexRincian)
                                  }
                                  disabled={kelompok.rincian.length === 1}
                                  title="Hapus rincian"
                                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        <tfoot>
                          <tr className="border-t border-gray-200 bg-gray-50">
                            <td
                              colSpan={5}
                              className="px-3 py-3 text-right font-semibold text-gray-700"
                            >
                              Total {kelompok.kelompok_biaya || "Kelompok"}:
                            </td>
                            <td
                              colSpan={2}
                              className="px-3 py-3 font-bold text-gray-900"
                            >
                              {formatRupiah(
                                kelompok.rincian.reduce(
                                  (total, item) => total + hitungSubtotal(item),
                                  0
                                )
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Keterangan Opsional */}
                    <details className="border-t border-gray-200">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Keterangan dan Penjelasan Rincian
                      </summary>

                      <div className="space-y-4 p-4">
                        {kelompok.rincian.map((item, indexRincian) => (
                          <div
                            key={item.id_rab ?? indexRincian}
                            className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-2"
                          >
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                {item.jenis_biaya ||
                                  `Rincian ${indexRincian + 1}`}{" "}
                                — Keterangan
                              </label>
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
                                placeholder="Keterangan biaya"
                                className={INPUT_COMPACT_CLASS}
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                Penjelasan
                              </label>
                              <textarea
                                rows={2}
                                value={item.penjelasan_keterangan}
                                onChange={(e) =>
                                  ubahRincian(
                                    indexKelompok,
                                    indexRincian,
                                    "penjelasan_keterangan",
                                    e.target.value
                                  )
                                }
                                placeholder="Penjelasan tambahan"
                                className={INPUT_COMPACT_CLASS}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Tambah Rincian */}
                    <div className="border-t border-gray-200 p-3">
                      <button
                        type="button"
                        onClick={() => tambahRincian(indexKelompok)}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        <Plus size={16} />
                        Tambah Rincian
                      </button>
                    </div>
                  </div>
                ))}

                {/* Tambah Kelompok */}
                <button
                  type="button"
                  onClick={tambahKelompok}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Tambah Kelompok Biaya
                </button>
              </section>

              {/* Total Keseluruhan */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-gray-600">Total Keseluruhan RAB</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {form.kelompok.reduce(
                      (jumlah, kelompok) => jumlah + kelompok.rincian.length,
                      0
                    )}{" "}
                    rincian dari {form.kelompok.length} kelompok biaya
                  </p>
                </div>

                <p className="text-xl font-bold text-blue-700">
                  {formatRupiah(totalForm)}
                </p>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row md:px-6">
              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                disabled={menyimpan}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void simpanRAB()}
                disabled={menyimpan}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} />
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
          <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Detail RAB</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {rabTerpilih.nomor_rab}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRabTerpilih(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Tutup detail"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Nama Kegiatan</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {rabTerpilih.nama_kegiatan}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Tanggal</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {formatTanggalTabel(rabTerpilih.tanggal)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Lokasi</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {rabTerpilih.lokasi}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${warnaStatus(
                      rabTerpilih.status_persetujuan
                    )}`}
                  >
                    {formatStatus(rabTerpilih.status_persetujuan)}
                  </span>
                </div>

                {(rabTerpilih.catatan_revisi_manager ||
                  rabTerpilih.catatan_revisi_finance) && (
                  <div className="space-y-3 sm:col-span-2">
                    {rabTerpilih.catatan_revisi_manager && (
                      <div>
                        <p className="text-xs text-gray-500">
                          Catatan Revisi Manager
                        </p>
                        <p className="mt-1 text-sm text-gray-800">
                          {rabTerpilih.catatan_revisi_manager}
                        </p>
                      </div>
                    )}

                    {rabTerpilih.catatan_revisi_finance && (
                      <div>
                        <p className="text-xs text-gray-500">
                          Catatan Revisi Finance
                        </p>
                        <p className="mt-1 text-sm text-gray-800">
                          {rabTerpilih.catatan_revisi_finance}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">
                  Rincian Anggaran
                </h3>

                {Array.from(
                  (rabTerpilih.rincian ?? [])
                    .reduce((map, item) => {
                      const nama = item.kelompok_biaya || "Tanpa Kelompok"

                      if (!map.has(nama)) {
                        map.set(nama, [])
                      }

                      map.get(nama)!.push(item)
                      return map
                    }, new Map<string, RincianRAB[]>())
                    .entries()
                ).map(([namaKelompok, rincian]) => (
                  <div
                    key={namaKelompok}
                    className="overflow-hidden rounded-xl border border-gray-200"
                  >
                    <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-800">
                      {namaKelompok}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-sm">
                        <thead className="border-y border-gray-200 text-left text-gray-500">
                          <tr>
                            <th className="px-3 py-3 font-medium">
                              Jenis Biaya
                            </th>
                            <th className="px-3 py-3 font-medium">Satuan</th>
                            <th className="px-3 py-3 text-right font-medium">
                              Harga
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                              Jumlah
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                              Durasi
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                              Subtotal
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {rincian.map((item, index) => (
                            <tr key={item.id_rab ?? index}>
                              <td className="px-3 py-3">{item.jenis_biaya}</td>
                              <td className="px-3 py-3">{item.satuan}</td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                {formatRupiah(item.harga)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {item.jumlah}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {item.durasi}
                              </td>
                              <td className="px-3 py-3 text-right font-medium whitespace-nowrap">
                                {formatRupiah(hitungSubtotal(item))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
                <span className="font-semibold text-gray-700">
                  Total Keseluruhan
                </span>
                <span className="text-lg font-bold text-blue-700">
                  {formatRupiah(
                    (rabTerpilih.rincian ?? []).reduce(
                      (total, item) => total + hitungSubtotal(item),
                      0
                    )
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={() => setRabTerpilih(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
