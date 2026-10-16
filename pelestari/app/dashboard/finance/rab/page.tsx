"use client"

import { useCallback, useEffect, useState } from "react"
import { verifyRAB, getRAB, reviseRABFinance } from "@/app/actions/rab"

type RincianRAB = {
  id_rab?: number
  jenis_biaya: string
  kelompok_biaya: string
  satuan: string
  harga: number
  jumlah: number
  durasi: number
  subtotal: number
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

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export default function FinanceRABPage() {
  const [data, setData] = useState<PengajuanRAB[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selected, setSelected] = useState<PengajuanRAB | null>(null)
  const [catatanRevisi, setCatatanRevisi] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
    const result = await getRAB()

console.log("Semua RAB:", result)

console.log(
  "RAB menunggu Finance:",
  result.filter(
    (item) =>
      item.status_persetujuan === "Menunggu Verifikasi Finance"
  )
)

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

  // Hanya RAB yang sudah disetujui Manager
  // dan menunggu verifikasi Finance.
  const menunggu = data.filter(
    (item) => item.status_persetujuan === "Menunggu Verifikasi Finance"
  )

  const totalMenunggu = menunggu.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  )

  async function handleVerify(item: PengajuanRAB) {
    const confirmed = window.confirm(
      `Verifikasi dan setujui RAB ${item.nomor_rab}?`
    )

    if (!confirmed) return

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const result = await verifyRAB(item.id_pengajuan)

      setSuccess(result.message)
      setSelected(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi RAB.")
    } finally {
      setProcessing(false)
    }
  }

  async function handleRevise() {
    if (!selected) return

    if (!catatanRevisi.trim()) {
      setError("Isi alasan revisi sebelum mengirim.")
      return
    }

    const confirmed = window.confirm(
      `Kembalikan RAB ${selected.nomor_rab} untuk diperbaiki oleh Pelatihan?`
    )

    if (!confirmed) return

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      const result = await reviseRABFinance(
        selected.id_pengajuan,
        catatanRevisi.trim()
      )

      setSuccess(result.message)
      setSelected(null)
      setCatatanRevisi("")
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
        <p className="text-sm font-medium text-blue-600">Panel Finance</p>

        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          Verifikasi RAB
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Periksa rincian dan kewajaran anggaran sebelum melakukan verifikasi
          keuangan.
        </p>
      </header>

      {error && (
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
          <p className="text-sm text-gray-500">Menunggu Verifikasi</p>
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
          <h2 className="font-semibold text-gray-900">Daftar Pengajuan RAB</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-4">Nomor RAB</th>
                <th className="px-5 py-4">Kegiatan</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4 text-right">Total Anggaran</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-gray-500"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : menunggu.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-gray-500"
                  >
                    Tidak ada RAB yang menunggu verifikasi Finance.
                  </td>
                </tr>
              ) : (
                menunggu.map((item) => (
                  <tr key={item.id_pengajuan} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-semibold text-gray-900">
                      {item.nomor_rab}
                    </td>

                    <td className="px-5 py-4 text-gray-700">
                      {item.nama_kegiatan}
                      <p className="mt-1 text-xs text-gray-500">
                        {item.lokasi}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {String(item.tanggal).slice(0, 10)}
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      {rupiah(item.total)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        Menunggu Verifikasi Finance
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(item)
                          setCatatanRevisi("")
                          setError("")
                          setSuccess("")
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Periksa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 py-6 md:p-8">
          <div className="mx-auto max-w-5xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Detail Verifikasi RAB
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selected.nomor_rab}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Nama Kegiatan</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selected.nama_kegiatan}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Tanggal Kegiatan</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {String(selected.tanggal).slice(0, 10)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Lokasi</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {selected.lokasi}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Catatan Pengajuan</p>
                  <p className="mt-1 text-sm text-gray-700">
                    {selected.catatan || "-"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-gray-900">
                  Rincian Anggaran
                </h3>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Jenis Biaya</th>
                        <th className="px-4 py-3">Kelompok</th>
                        <th className="px-4 py-3">Satuan</th>
                        <th className="px-4 py-3 text-right">Harga</th>
                        <th className="px-4 py-3 text-right">Jumlah</th>
                        <th className="px-4 py-3 text-right">Durasi</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {selected.rincian.map((rincian, index) => (
                        <tr key={rincian.id_rab ?? index}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">
                              {rincian.jenis_biaya}
                            </p>

                            {rincian.keterangan && (
                              <p className="mt-1 text-xs text-gray-500">
                                {rincian.keterangan}
                              </p>
                            )}

                            {rincian.penjelasan_keterangan && (
                              <p className="mt-1 text-xs text-gray-500">
                                {rincian.penjelasan_keterangan}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3 text-gray-600">
                            {rincian.kelompok_biaya}
                          </td>

                          <td className="px-4 py-3 text-gray-600">
                            {rincian.satuan}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {rupiah(rincian.harga)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {rincian.jumlah}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {rincian.durasi}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {rupiah(
                              Number(rincian.subtotal) ||
                                Number(rincian.harga) *
                                  Number(rincian.jumlah) *
                                  Number(rincian.durasi)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="rounded-lg bg-blue-50 px-5 py-4 text-right">
                    <p className="text-sm text-blue-700">Total Anggaran</p>
                    <p className="mt-1 text-2xl font-bold text-blue-900">
                      {rupiah(selected.total)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <label
                  htmlFor="catatan-revisi-finance"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  Catatan Revisi Finance
                </label>

                <textarea
                  id="catatan-revisi-finance"
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan bagian anggaran yang harus diperbaiki..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                />

                <p className="mt-2 text-xs text-gray-500">
                  Catatan wajib diisi jika RAB dikembalikan untuk revisi.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={processing}
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Tutup
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() => void handleRevise()}
                className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
              >
                {processing ? "Memproses..." : "Minta Revisi"}
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() => void handleVerify(selected)}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? "Memproses..." : "Verifikasi RAB"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
