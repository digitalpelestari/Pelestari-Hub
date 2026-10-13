"use client"

import { useCallback, useEffect, useState } from "react"
import {
  createRAB,
  deleteRAB,
  getRAB,
  submitRAB,
  updateRAB,
} from "@/app/actions/rab"

type RincianRAB = {
  id_rab?: number
  jenis_biaya: string
  kelompok_biaya: string
  satuan: string
  harga: number
  jumlah: number
  durasi: number
  subtotal?: number
  total?: number
  keterangan: string
  penjelasan_keterangan: string
}

type PengajuanRAB = {
  id_pengajuan: number
  nomor_rab: string
  nama_kegiatan: string
  tanggal: string
  lokasi: string
  status_persetujuan: string
  catatan?: string | null
  total: number
  rincian: RincianRAB[]
}

type FormRAB = {
  nomor_rab: string
  nama_kegiatan: string
  tanggal: string
  lokasi: string
  catatan: string
  rincian: RincianRAB[]
}

const STATUS_OPTIONS = [
  "Draft",
  "Menunggu Persetujuan Manager",
  "Revisi oleh Pelatihan",
  "Menunggu Verifikasi Finance",
  "Disetujui",
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

const FORM_KOSONG: FormRAB = {
  nomor_rab: "",
  nama_kegiatan: "",
  tanggal: new Date().toISOString().slice(0, 10),
  lokasi: "",
  catatan: "",
  rincian: [{ ...RINCIAN_KOSONG }],
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function hitungSubtotal(item: RincianRAB) {
  return (
    Number(item.harga || 0) *
    Number(item.jumlah || 0) *
    Number(item.durasi || 0)
  )
}

function statusClass(status: string) {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-700"
    case "Menunggu Persetujuan Manager":
      return "bg-amber-100 text-amber-800"
    case "Revisi oleh Pelatihan":
      return "bg-orange-100 text-orange-800"
    case "Menunggu Verifikasi Finance":
      return "bg-blue-100 text-blue-800"
    case "Disetujui":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-700"
  }
}
function formatTanggalInput(value: string) {
  if (!value) return ""

  const tanggal = new Date(value)

  if (Number.isNaN(tanggal.getTime())) {
    return ""
  }

  const tahun = tanggal.getFullYear()
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0")
  const hari = String(tanggal.getDate()).padStart(2, "0")

  return `${tahun}-${bulan}-${hari}`
}
export default function RABPage() {
  const [data, setData] = useState<PengajuanRAB[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("Semua")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormRAB>(FORM_KOSONG)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const result = await getRAB()
      setData(result as PengajuanRAB[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data RAB.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totalForm = form.rincian.reduce(
    (total, item) => total + hitungSubtotal(item),
    0
  )

  const filteredData = data.filter((item) => {
    const keyword = search.toLowerCase()

    const cocokSearch =
      item.nomor_rab.toLowerCase().includes(keyword) ||
      item.nama_kegiatan.toLowerCase().includes(keyword) ||
      item.lokasi.toLowerCase().includes(keyword)

    const cocokStatus =
      filterStatus === "Semua" || item.status_persetujuan === filterStatus

    return cocokSearch && cocokStatus
  })

  const totalAnggaran = data.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  )

  const jumlahMenunggu = data.filter(
    (item) =>
      item.status_persetujuan === "Menunggu Persetujuan Manager" ||
      item.status_persetujuan === "Menunggu Verifikasi Finance"
  ).length

  function bukaTambah() {
    setEditingId(null)
    setForm({
      ...FORM_KOSONG,
      tanggal: new Date().toISOString().slice(0, 10),
      rincian: [{ ...RINCIAN_KOSONG }],
    })
    setError("")
    setModalOpen(true)
  }

  function bukaEdit(item: PengajuanRAB) {
    console.log("Nilai tanggal:", item.tanggal)
    console.log("Tipe tanggal:", typeof item.tanggal)
    setEditingId(item.id_pengajuan)
    setForm({
      nomor_rab: item.nomor_rab,
      nama_kegiatan: item.nama_kegiatan,
      tanggal: formatTanggalInput(item.tanggal),
      lokasi: item.lokasi,
      catatan: item.catatan || "",
      rincian: item.rincian.length
        ? item.rincian.map((r) => ({ ...r }))
        : [{ ...RINCIAN_KOSONG }],
    })
    setError("")
    setModalOpen(true)
  }

  function ubahHeader(
    field: "nomor_rab" | "nama_kegiatan" | "tanggal" | "lokasi" | "catatan",
    value: string
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function ubahRincian(
    index: number,
    field: keyof RincianRAB,
    value: string | number
  ) {
    setForm((prev) => ({
      ...prev,
      rincian: prev.rincian.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  function tambahRincian() {
    setForm((prev) => ({
      ...prev,
      rincian: [...prev.rincian, { ...RINCIAN_KOSONG }],
    }))
  }

  function hapusRincian(index: number) {
    setForm((prev) => ({
      ...prev,
      rincian:
        prev.rincian.length > 1
          ? prev.rincian.filter((_, i) => i !== index)
          : prev.rincian,
    }))
  }

  async function simpanRAB() {
    setError("")

    if (
      !form.nomor_rab.trim() ||
      !form.nama_kegiatan.trim() ||
      !form.tanggal ||
      !form.lokasi.trim()
    ) {
      setError("Lengkapi nomor RAB, kegiatan, tanggal, dan lokasi.")
      return
    }

    if (
      form.rincian.some(
        (item) =>
          !item.jenis_biaya.trim() ||
          !item.kelompok_biaya.trim() ||
          !item.satuan.trim() ||
          Number(item.harga) < 0 ||
          Number(item.jumlah) <= 0 ||
          Number(item.durasi) <= 0
      )
    ) {
      setError(
        "Lengkapi seluruh rincian. Harga tidak boleh negatif, sedangkan jumlah dan durasi harus lebih dari 0."
      )
      return
    }

    const payload = {
      nomor_rab: form.nomor_rab.trim(),
      nama_kegiatan: form.nama_kegiatan.trim(),
      tanggal: form.tanggal,
      lokasi: form.lokasi.trim(),
      catatan: form.catatan.trim(),
      rincian: form.rincian.map((item) => ({
        jenis_biaya: item.jenis_biaya.trim(),
        kelompok_biaya: item.kelompok_biaya.trim(),
        satuan: item.satuan.trim(),
        harga: Number(item.harga),
        jumlah: Number(item.jumlah),
        durasi: Number(item.durasi),
        keterangan: item.keterangan.trim(),
        penjelasan_keterangan: item.penjelasan_keterangan.trim(),
      })),
    }

    setSaving(true)

    try {
      if (editingId !== null) {
        await updateRAB(editingId, payload)
      } else {
        await createRAB(payload)
      }

      setModalOpen(false)
      setEditingId(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan RAB.")
    } finally {
      setSaving(false)
    }
  }

  async function ajukanRAB(item: PengajuanRAB) {
    const setuju = window.confirm(
      `Ajukan RAB ${item.nomor_rab} untuk persetujuan Manager?`
    )

    if (!setuju) return

    setError("")
    setSaving(true)

    try {
      await submitRAB(item.id_pengajuan)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengajukan RAB.")
    } finally {
      setSaving(false)
    }
  }

  async function hapusRAB(item: PengajuanRAB) {
    const setuju = window.confirm(
      `Hapus RAB ${item.nomor_rab}? Tindakan ini tidak dapat dibatalkan.`
    )

    if (!setuju) return

    setError("")
    setSaving(true)

    try {
      await deleteRAB(item.id_pengajuan)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus RAB.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Rencana Anggaran Biaya
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola pengajuan anggaran kegiatan dan proses persetujuannya.
          </p>
        </div>

        <button
          type="button"
          onClick={bukaTambah}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Buat RAB
        </button>
      </div>

      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Jumlah Pengajuan</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{data.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Anggaran RAB</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {formatRupiah(totalAnggaran)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Menunggu Proses</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {jumlahMenunggu}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor RAB, kegiatan, atau lokasi..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 md:flex-1"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="Semua">Semua Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-4">Nomor RAB</th>
                <th className="px-5 py-4">Kegiatan</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Lokasi</th>
                <th className="px-5 py-4 text-right">Total Anggaran</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Catatan Manager
                </th>
                <th className="px-5 py-4">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Memuat data RAB...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Belum ada data RAB.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id_pengajuan} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-semibold text-gray-900">
                      {item.nomor_rab}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {item.nama_kegiatan}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                      {item.tanggal
                        ? new Date(item.tanggal).toLocaleDateString("id-ID", {
                            timeZone: "UTC",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{item.lokasi}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      {formatRupiah(Number(item.total || 0))}
                    </td>

                    {/* Kolom Status */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                            item.status_persetujuan === "Disetujui"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : item.status_persetujuan ===
                                  "Menunggu Persetujuan Manager"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : item.status_persetujuan ===
                                    "Menunggu Verifikasi Finance"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : item.status_persetujuan ===
                                      "Revisi oleh Pelatihan"
                                    ? "border-orange-200 bg-orange-50 text-orange-700"
                                    : "border-gray-200 bg-gray-50 text-gray-600"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              item.status_persetujuan === "Disetujui"
                                ? "bg-green-500"
                                : item.status_persetujuan ===
                                    "Menunggu Persetujuan Manager"
                                  ? "bg-amber-500"
                                  : item.status_persetujuan ===
                                      "Menunggu Verifikasi Finance"
                                    ? "bg-blue-500"
                                    : item.status_persetujuan ===
                                        "Revisi oleh Pelatihan"
                                      ? "bg-orange-500"
                                      : "bg-gray-400"
                            }`}
                          />
                          {item.status_persetujuan}
                        </span>
                      </div>
                    </td>
                    {/* Kolom Catatan Manager */}
                    <td className="px-6 py-4">
                      {item.status_persetujuan === "Revisi oleh Pelatihan" &&
                      item.catatan ? (
                        <div className="max-w-xs min-w-[200px] rounded-lg border border-orange-200 bg-orange-50 p-3">
                          <p className="text-sm whitespace-pre-wrap text-orange-900">
                            {item.catatan}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {(item.status_persetujuan === "Draft" ||
                          item.status_persetujuan ===
                            "Revisi oleh Pelatihan") && (
                          <>
                            <button
                              type="button"
                              onClick={() => bukaEdit(item)}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void ajukanRAB(item)}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Ajukan
                            </button>
                          </>
                        )}

                        {item.status_persetujuan === "Draft" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void hapusRAB(item)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Hapus
                          </button>
                        )}

                        {item.status_persetujuan !== "Draft" &&
                          item.status_persetujuan !==
                            "Revisi oleh Pelatihan" && (
                            <span className="text-xs text-gray-400">
                              Tidak dapat diedit
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
          Menampilkan {filteredData.length} dari {data.length} pengajuan.
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 md:p-8">
          <div className="my-auto w-full max-w-5xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId !== null ? "Edit RAB" : "Buat Pengajuan RAB"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Lengkapi informasi kegiatan dan rincian anggaran.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-5 md:p-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nomor RAB *
                  </label>
                  <input
                    value={form.nomor_rab}
                    onChange={(e) => ubahHeader("nomor_rab", e.target.value)}
                    placeholder="Contoh: RAB-2026-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Tanggal Kegiatan *
                  </label>
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => ubahHeader("tanggal", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nama Kegiatan *
                  </label>
                  <input
                    value={form.nama_kegiatan}
                    onChange={(e) =>
                      ubahHeader("nama_kegiatan", e.target.value)
                    }
                    placeholder="Nama kegiatan"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Lokasi *
                  </label>
                  <input
                    value={form.lokasi}
                    onChange={(e) => ubahHeader("lokasi", e.target.value)}
                    placeholder="Lokasi kegiatan"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Catatan Pengajuan
                  </label>
                  <textarea
                    value={form.catatan}
                    onChange={(e) => ubahHeader("catatan", e.target.value)}
                    rows={2}
                    placeholder="Catatan tambahan (opsional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Rincian Anggaran
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Subtotal dihitung dari harga × jumlah × durasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={tambahRincian}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    + Tambah Rincian
                  </button>
                </div>

                <div className="space-y-4">
                  {form.rincian.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-800">
                          Rincian #{index + 1}
                        </h4>
                        {form.rincian.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusRincian(index)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Hapus rincian
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Jenis Biaya *
                          </label>
                          <input
                            value={item.jenis_biaya}
                            onChange={(e) =>
                              ubahRincian(index, "jenis_biaya", e.target.value)
                            }
                            placeholder="Contoh: Konsumsi"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Kelompok Biaya *
                          </label>
                          <input
                            value={item.kelompok_biaya}
                            onChange={(e) =>
                              ubahRincian(
                                index,
                                "kelompok_biaya",
                                e.target.value
                              )
                            }
                            placeholder="Contoh: Operasional"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Satuan *
                          </label>
                          <input
                            value={item.satuan}
                            onChange={(e) =>
                              ubahRincian(index, "satuan", e.target.value)
                            }
                            placeholder="Contoh: Orang"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Harga Satuan (Rp) *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.harga}
                            onChange={(e) =>
                              ubahRincian(
                                index,
                                "harga",
                                Number(e.target.value)
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Jumlah *
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.jumlah}
                            onChange={(e) =>
                              ubahRincian(
                                index,
                                "jumlah",
                                Number(e.target.value)
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Durasi *
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.durasi}
                            onChange={(e) =>
                              ubahRincian(
                                index,
                                "durasi",
                                Number(e.target.value)
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                          <div className="rounded-lg bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-500">
                              Subtotal Rincian #{index + 1}
                            </p>
                            <p className="mt-1 font-semibold text-gray-900">
                              {formatRupiah(hitungSubtotal(item))}
                            </p>
                          </div>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Keterangan
                          </label>
                          <input
                            value={item.keterangan}
                            onChange={(e) =>
                              ubahRincian(index, "keterangan", e.target.value)
                            }
                            placeholder="Keterangan singkat (opsional)"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Penjelasan Keterangan
                          </label>
                          <textarea
                            value={item.penjelasan_keterangan}
                            onChange={(e) =>
                              ubahRincian(
                                index,
                                "penjelasan_keterangan",
                                e.target.value
                              )
                            }
                            rows={2}
                            placeholder="Penjelasan tambahan (opsional)"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 p-5">
                <p className="text-sm font-medium text-blue-800">
                  Total Anggaran yang Diajukan
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {formatRupiah(totalForm)}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void simpanRAB()}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
