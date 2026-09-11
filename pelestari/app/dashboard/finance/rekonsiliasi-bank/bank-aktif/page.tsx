"use client"
import { bacaPdfRekeningKoran } from "@/app/actions/parse-rekening-koran"
import {
  Landmark,
  BookOpen,
  Scale,
  Link2,
  CheckCircle2,
  Loader2,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react"

import React, {
  useCallback,
  useRef,
  useState,
  useTransition,
  useEffect,
} from "react"

// Sesuaikan path import berikut dengan lokasi file actions kamu.
import {
  getDataRekonsiliasiHarian,
  cocokkanTransaksi,
  batalkanPencocokan,
  cocokkanOtomatisHarian,
  tambahTransaksiBank,
  editTransaksiBank,
  hapusTransaksiBank,
  tutupBukuHarian,
  simpanHasilImportBank,
  type TransaksiRekonDTO,
} from "@/app/actions/rekonsiliasi"
import { swal } from "@/lib/sweetalert"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)

const getTanggalHariIni = () => {
  const sekarang = new Date()
  const tahun = sekarang.getFullYear()
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0")
  const hari = String(sekarang.getDate()).padStart(2, "0")
  return `${tahun}-${bulan}-${hari}`
}

/** Tambah/kurang N hari dari string tanggal YYYY-MM-DD tanpa lewat UTC shift. */
const geserTanggal = (tanggal: string, jumlahHari: number) => {
  const [tahun, bulan, hari] = tanggal.split("-").map(Number)
  const tgl = new Date(tahun, bulan - 1, hari)
  tgl.setDate(tgl.getDate() + jumlahHari)
  const y = tgl.getFullYear()
  const m = String(tgl.getMonth() + 1).padStart(2, "0")
  const d = String(tgl.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

type FormTransaksi = {
  tanggal: string
  keterangan: string
  nominal: string
  tipe: "KREDIT" | "DEBIT"
}

const formTransaksiKosong = (): FormTransaksi => ({
  tanggal: getTanggalHariIni(),
  keterangan: "",
  nominal: "",
  tipe: "KREDIT",
})

/* ------------------------------------------------------------------ */
/* Presentational subcomponents                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({
  status,
  onBatalkan,
  disabled,
}: {
  status: TransaksiRekonDTO["status"]
  onBatalkan?: () => void
  disabled?: boolean
}) {
  const terhubung = status === "TERHUBUNG"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[9px] font-black tracking-wider uppercase ${
          terhubung ? "bg-emerald-500 text-white" : "bg-amber-400 text-black"
        }`}
      >
        {terhubung ? (
          <>
            <CheckCircle2 className="h-3 w-3" /> Terhubung
          </>
        ) : (
          "Belum Match"
        )}
      </span>

      {terhubung && onBatalkan && (
        <button
          onClick={onBatalkan}
          disabled={disabled}
          title="Batalkan pencocokan"
          className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase hover:underline disabled:opacity-50"
        >
          <XCircle className="h-3 w-3" /> Batalkan
        </button>
      )}
    </div>
  )
}

function TipeLabel({ tipe }: { tipe: "KREDIT" | "DEBIT" }) {
  return (
    <span
      className={`text-[10px] font-black tracking-wide uppercase ${
        tipe === "KREDIT" ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {tipe}
    </span>
  )
}

function RingkasanCard({
  label,
  sublabel,
  value,
  icon,
  tone = "netral",
}: {
  label: string
  sublabel: string
  value: string
  icon: React.ReactNode
  tone?: "netral" | "positif" | "peringatan"
}) {
  const toneClasses = {
    netral: {
      border: "border-zinc-200/80",
      bg: "bg-white",
      label: "text-zinc-400",
      iconBg: "bg-zinc-100",
      value: "text-zinc-900",
      sublabel: "text-zinc-400",
    },
    positif: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/10",
      label: "text-emerald-600",
      iconBg: "bg-emerald-100",
      value: "text-emerald-700",
      sublabel: "text-emerald-600/80",
    },
    peringatan: {
      border: "border-amber-200",
      bg: "bg-amber-50/10",
      label: "text-amber-600",
      iconBg: "bg-amber-100",
      value: "text-amber-600",
      sublabel: "text-amber-600/80",
    },
  }[tone]

  return (
    <div
      className={`rounded-sm border ${toneClasses.border} ${toneClasses.bg} p-4 shadow-sm`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`text-[10px] font-black tracking-wider uppercase italic ${toneClasses.label}`}
        >
          {label}
        </span>
        <div className={`rounded-sm p-1.5 ${toneClasses.iconBg}`}>{icon}</div>
      </div>
      <div className={`font-mono text-[16px] font-black ${toneClasses.value}`}>
        {value}
      </div>
      <p
        className={`mt-1 text-[9px] font-bold uppercase ${toneClasses.sublabel}`}
      >
        {sublabel}
      </p>
    </div>
  )
}

function PanelTransaksi({
  judul,
  tanggal,
  headerRight,
  kolomTerakhir,
  data,
  isLoading,
  pilihanId,
  onPilih,
  namaRadio,
  rowHighlight,
  emptyMessage,
  renderAksi,
  getIdBatal,
  onBatalkanClick,
  sedangSibuk,
}: {
  judul: string
  tanggal: string
  headerRight: React.ReactNode
  kolomTerakhir: string
  data: TransaksiRekonDTO[]
  isLoading: boolean
  pilihanId: number | null
  onPilih: (id: number) => void
  namaRadio: string
  rowHighlight: string
  emptyMessage: string
  renderAksi?: (item: TransaksiRekonDTO) => React.ReactNode
  getIdBatal: (item: TransaksiRekonDTO) => number | null | undefined
  onBatalkanClick: (id: number) => void
  sedangSibuk: boolean
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b bg-zinc-50/50 p-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">{judul}</h2>
          <span className="text-[10px] font-semibold tracking-tight text-zinc-400 uppercase">
            Tanggal: {tanggal}
          </span>
        </div>
        {headerRight}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b bg-zinc-100/80 text-xs tracking-wider text-zinc-700 uppercase">
            <tr>
              <th className="border-r p-3 font-bold">Pilih</th>
              <th className="border-r p-3 font-bold">Tanggal</th>
              <th className="border-r p-3 font-bold">{kolomTerakhir}</th>
              <th className="border-r p-3 font-bold">Nominal</th>
              <th className="border-r p-3 font-bold">Tipe</th>
              <th
                className={
                  renderAksi ? "border-r p-3 font-bold" : "p-3 font-bold"
                }
              >
                Status
              </th>
              {renderAksi && <th className="p-3 font-bold">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-zinc-400 italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const terhubung = item.status === "TERHUBUNG"
                const idUntukBatal = getIdBatal(item)

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      terhubung
                        ? "bg-emerald-50/30 opacity-60"
                        : pilihanId === item.id
                          ? rowHighlight
                          : "hover:bg-zinc-50/80"
                    }`}
                  >
                    <td className="border-r p-3">
                      {!terhubung && (
                        <input
                          type="radio"
                          name={namaRadio}
                          disabled={sedangSibuk}
                          checked={pilihanId === item.id}
                          onChange={() => onPilih(item.id)}
                        />
                      )}
                    </td>
                    <td className="border-r p-3 font-mono text-[11px] font-bold text-zinc-600">
                      {item.tanggal}
                    </td>
                    <td className="border-r p-3 font-medium text-zinc-700">
                      {item.keterangan}
                    </td>
                    <td className="border-r p-3 font-mono text-[12px] font-black text-zinc-900">
                      {formatIDR(item.nominal)}
                    </td>
                    <td className="border-r p-3">
                      <TipeLabel tipe={item.tipe} />
                    </td>
                    <td className={renderAksi ? "border-r p-3" : "p-3"}>
                      <StatusBadge
                        status={item.status}
                        disabled={sedangSibuk}
                        onBatalkan={
                          typeof idUntukBatal === "number"
                            ? () => onBatalkanClick(idUntukBatal)
                            : undefined
                        }
                      />
                    </td>
                    {renderAksi && <td className="p-3">{renderAksi(item)}</td>}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

const NO_AKUN_BANK_AKTIF = "11200"

export default function RekonsiliasiBankHarian() {
  const [modePeriode, setModePeriode] = useState<"HARIAN" | "BULANAN">("HARIAN")
  const [showFormTransaksi, setShowFormTransaksi] = useState(false)
  const [transaksiYangDiedit, setTransaksiYangDiedit] = useState<number | null>(
    null
  )
  const [formTransaksi, setFormTransaksi] = useState<FormTransaksi>(
    formTransaksiKosong()
  )

  // ------------------------------------------------------------------
  // PERBAIKAN UTAMA:
  // Dulu ada dua state tanggal terpisah (tanggalAktif untuk aksi vs
  // tanggalMulai/tanggalSampai untuk tampilan) yang tidak saling sinkron,
  // sehingga tombol "Cocokkan Otomatis" & "Tutup Buku" bisa berjalan
  // untuk tanggal yang BEDA dari data yang sedang terlihat di layar.
  //
  // Sekarang tanggalMulai/tanggalSampai adalah SATU-SATUNYA sumber
  // kebenaran, dipakai baik untuk menampilkan data maupun menjalankan aksi.
  // Untuk mode HARIAN, tanggalMulai selalu === tanggalSampai (rentang 1 hari).
  // ------------------------------------------------------------------
  const [tanggalMulai, setTanggalMulai] = useState(getTanggalHariIni())
  const [tanggalSampai, setTanggalSampai] = useState(getTanggalHariIni())

  const [dataBank, setDataBank] = useState<TransaksiRekonDTO[]>([])
  const [dataGL, setDataGL] = useState<TransaksiRekonDTO[]>([])

  const [pilihanBankId, setPilihanBankId] = useState<number | null>(null)
  const [pilihanGlId, setPilihanGlId] = useState<number | null>(null)

  const [isLoading, startLoadingTransition] = useTransition()
  const [isMemproses, startMemprosesTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputPdfRef = useRef<HTMLInputElement>(null)
  const [hasilPdf, setHasilPdf] = useState("")

  const sedangSibuk = isLoading || isMemproses

  // Ambil data terbaru dari server untuk rentang tanggal aktif
  const muatData = useCallback(
    async (mulai: string = tanggalMulai, sampai: string = tanggalSampai) => {
      if (mulai > sampai) {
        await swal.error(
          "Tanggal mulai tidak boleh lebih besar dari tanggal sampai."
        )
        return
      }

      try {
        const hasil = await getDataRekonsiliasiHarian(
          mulai,
          sampai,
          NO_AKUN_BANK_AKTIF
        )

        setDataBank(hasil.bank)
        setDataGL(hasil.gl)
      } catch (err) {
        await swal.error(
          err instanceof Error ? err.message : "Gagal memuat data rekonsiliasi."
        )
      }
    },
    [tanggalMulai, tanggalSampai]
  )
  useEffect(() => {
    startLoadingTransition(() => {
      muatData(tanggalMulai, tanggalSampai)
    })
  }, [tanggalMulai, tanggalSampai, muatData])
  const resetPilihan = () => {
    setPilihanBankId(null)
    setPilihanGlId(null)
  }
  const jalankanPencocokan = () => {
    if (!pilihanBankId || !pilihanGlId) {
      swal.warning("Pilih satu transaksi bank dan satu transaksi jurnal.")
      return
    }

    startMemprosesTransition(async () => {
      try {
        await cocokkanTransaksi(pilihanBankId, pilihanGlId)

        resetPilihan()
        await muatData()

        await swal.success("Transaksi berhasil dihubungkan.")
      } catch (err) {
        await swal.error(
          err instanceof Error ? err.message : "Gagal mencocokkan transaksi."
        )
      }
    })
  }

  // Butuh bank_transaksi_id, karena itu kolom UNIQUE di tb_rekonsiliasi
  const batalkanSatuPencocokan = (bankTransaksiId: number) => {
    startMemprosesTransition(async () => {
      try {
        await batalkanPencocokan(bankTransaksiId)
        await muatData()
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Gagal membatalkan pencocokan."
        )
      }
    })
  }

  const hapusSatuTransaksi = async (id: number) => {
    const konfirmasi = await swal.confirm(
      "Apakah Anda yakin ingin menghapus transaksi bank ini?"
    )

    if (!konfirmasi) return

    startMemprosesTransition(async () => {
      try {
        const hasil = await hapusTransaksiBank(id)

        if (!hasil.success) {
          await swal.error(hasil.message)
          return
        }

        setPilihanBankId(null)
        await muatData()

        await swal.success("Transaksi bank berhasil dihapus.")
      } catch (err) {
        await swal.error(
          err instanceof Error ? err.message : "Gagal menghapus transaksi bank."
        )
      }
    })
  }

  const jalankanTutupBukuHarian = () => {
    startMemprosesTransition(async () => {
      try {
        const hasil = await tutupBukuHarian(
          tanggalMulai,
          tanggalSampai,
          NO_AKUN_BANK_AKTIF
        )

        if (!hasil.success) {
          await swal.error(hasil.message)
          return
        }

        resetPilihan()
        await muatData()

        await swal.success(hasil.message)
      } catch (err) {
        await swal.error(
          err instanceof Error
            ? err.message
            : "Gagal menyelesaikan rekonsiliasi."
        )
      }
    })
  }

  const jalankanCocokkanOtomatis = () => {
    startMemprosesTransition(async () => {
      try {
        const { jumlahCocok } = await cocokkanOtomatisHarian(
          tanggalMulai,
          tanggalSampai,
          NO_AKUN_BANK_AKTIF
        )

        await muatData()

        if (jumlahCocok === 0) {
          await swal.warning(
            "Tidak ada transaksi yang cocok otomatis. Tanggal, tipe, dan nominal harus sama persis."
          )
          return
        }

        await swal.success(
          `${jumlahCocok} transaksi berhasil dicocokkan secara otomatis.`
        )
      } catch (err) {
        await swal.error(
          err instanceof Error
            ? err.message
            : "Gagal menjalankan pencocokan otomatis."
        )
      }
    })
  }
  const bukaFormTambah = () => {
    setTransaksiYangDiedit(null)
    setFormTransaksi({ ...formTransaksiKosong(), tanggal: tanggalMulai })
    setShowFormTransaksi(true)
  }

  const bukaFormEdit = (item: TransaksiRekonDTO) => {
    setTransaksiYangDiedit(item.id)
    setFormTransaksi({
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      nominal: String(item.nominal),
      tipe: item.tipe,
    })
    setShowFormTransaksi(true)
  }

  const simpanFormTransaksi = () => {
    startMemprosesTransition(async () => {
      const hasil = transaksiYangDiedit
        ? await editTransaksiBank({
            id: transaksiYangDiedit,
            tanggal: formTransaksi.tanggal,
            keterangan: formTransaksi.keterangan,
            nominal: Number(formTransaksi.nominal),
            tipe: formTransaksi.tipe,
          })
        : await tambahTransaksiBank({
            tanggal: formTransaksi.tanggal,
            keterangan: formTransaksi.keterangan,
            nominal: Number(formTransaksi.nominal),
            tipe: formTransaksi.tipe,
            noAkunBank: NO_AKUN_BANK_AKTIF,
          })

      if (!hasil.success) {
        await swal.error(hasil.message)
        return
      }

      setShowFormTransaksi(false)
      setTransaksiYangDiedit(null)
      await muatData()
      setFormTransaksi(formTransaksiKosong())
      await swal.success(
        transaksiYangDiedit
          ? "Transaksi bank berhasil diperbarui."
          : "Transaksi bank berhasil ditambahkan."
      )
    })
  }

  const handleUploadPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    startMemprosesTransition(async () => {
      try {
        const hasil = await bacaPdfRekeningKoran(file)

        if (!hasil.transaksi.length) {
          await swal.warning(
            "Tidak ada transaksi yang berhasil dibaca dari rekening koran."
          )
          return
        }

        if (!hasil.tanggalMulai || !hasil.tanggalSampai) {
          await swal.warning(
            "Tanggal transaksi dari rekening koran tidak berhasil dibaca."
          )
          return
        }

        // Simpan transaksi menggunakan tanggal hasil pembacaan PDF
        const hasilSimpan = await simpanHasilImportBank(
          hasil.tanggalMulai,
          hasil.transaksi,
          NO_AKUN_BANK_AKTIF
        )

        if (!hasilSimpan.success) {
          await swal.error(hasilSimpan.message)
          return
        }

        // Update tanggal pada frontend sesuai periode rekening koran
        setTanggalMulai(hasil.tanggalMulai)
        setTanggalSampai(hasil.tanggalSampai)

        const hasilCocok = await cocokkanOtomatisHarian(
          hasil.tanggalMulai,
          hasil.tanggalSampai,
          NO_AKUN_BANK_AKTIF
        )

        // Ambil ulang data berdasarkan periode PDF
        await muatData(hasil.tanggalMulai, hasil.tanggalSampai)

        await swal.success(
          `Rekening koran berhasil diimpor.\n\n` +
            `${hasilSimpan.jumlahDisimpan} transaksi disimpan ke database.\n` +
            `${hasilCocok.jumlahCocok} transaksi otomatis terhubung dengan jurnal.`
        )
      } catch (err) {
        await swal.error(
          err instanceof Error ? err.message : "Gagal mengimpor rekening koran."
        )
      } finally {
        if (inputPdfRef.current) {
          inputPdfRef.current.value = ""
        }
      }
    })
  }

  // Kalkulasi ringkasan (data sudah difilter tanggal di server)
  const totalBankBelumTerhubung = dataBank
    .filter((i) => i.status === "BELUM_TERHUBUNG")
    .reduce((acc, curr) => acc + curr.nominal, 0)

  const totalGlBelumTerhubung = dataGL
    .filter((i) => i.status === "BELUM_TERHUBUNG")
    .reduce((acc, curr) => acc + curr.nominal, 0)

  const selisihHarian = totalBankBelumTerhubung - totalGlBelumTerhubung
  const sudahBalance = selisihHarian === 0

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 p-6 font-sans">
      <div className="mx-auto w-full max-w-7xl">
        {/* 1. HEADER */}
        <header className="mb-6 flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-zinc-900 p-2 text-white">
                <Landmark className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                Rekonsiliasi Bank Aktif
              </h1>
            </div>
            <p className="pl-9 text-xs text-zinc-500">
              Pencocokan transaksi mutasi bank dan jurnal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-sm border border-zinc-200 bg-zinc-100 p-1">
              {(["HARIAN", "BULANAN"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModePeriode(mode)}
                  disabled={sedangSibuk}
                  className={`h-8 rounded-sm px-4 text-[11px] font-bold uppercase transition ${
                    modePeriode === mode
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {mode === "HARIAN" ? "Harian" : "Bulanan"}
                </button>
              ))}
            </div>

            {modePeriode === "HARIAN" ? (
              <div className="flex items-end gap-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    disabled={sedangSibuk}
                    onChange={(e) => {
                      const v = e.target.value

                      setTanggalMulai(v)
                      resetPilihan()

                      startLoadingTransition(() => {
                        muatData(v, tanggalSampai)
                      })
                    }}
                    className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
                    Tanggal Sampai
                  </label>
                  <input
                    type="date"
                    value={tanggalSampai}
                    disabled={sedangSibuk}
                    onChange={(e) => {
                      const v = e.target.value

                      setTanggalSampai(v)
                      resetPilihan()

                      startLoadingTransition(() => {
                        muatData(tanggalMulai, v)
                      })
                    }}
                    className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-4">
                {/* TANGGAL MULAI */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    disabled={sedangSibuk}
                    onChange={(e) => {
                      const v = e.target.value

                      setTanggalMulai(v)
                      resetPilihan()

                      startLoadingTransition(() => {
                        muatData(v, tanggalSampai)
                      })
                    }}
                    className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* TANGGAL SAMPAI */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
                    Tanggal Sampai
                  </label>
                  <input
                    type="date"
                    value={tanggalSampai}
                    disabled={sedangSibuk}
                    onChange={(e) => {
                      const v = e.target.value

                      setTanggalSampai(v)
                      resetPilihan()

                      startLoadingTransition(() => {
                        muatData(tanggalMulai, v)
                      })
                    }}
                    className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* IMPORT REKENING KORAN - BULANAN */}
                {modePeriode === "BULANAN" && (
                  <>
                    <input
                      ref={inputPdfRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={handleUploadPdf}
                    />

                    <button
                      type="button"
                      onClick={() => inputPdfRef.current?.click()}
                      disabled={sedangSibuk}
                      className="h-10 rounded-lg border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 uppercase transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Impor Rekening Koran
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              onClick={jalankanCocokkanOtomatis}
              disabled={sedangSibuk}
              className="flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMemproses && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cocokkan Otomatis
            </button>
          </div>
        </header>

        {/* PESAN ERROR */}
        {errorMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {hasilPdf && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-2 text-xs font-semibold text-zinc-700">
              Hasil Pembacaan Rekening Koran
            </div>
            <pre className="max-h-[500px] overflow-auto text-xs whitespace-pre-wrap text-zinc-600">
              {hasilPdf}
            </pre>
          </div>
        )}

        {/* 2. RINGKASAN */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RingkasanCard
            label="Bank Belum Terhubung"
            sublabel={`Mutasi rekening koran (${tanggalMulai} s/d ${tanggalSampai})`}
            value={formatIDR(totalBankBelumTerhubung)}
            icon={<Landmark className="h-4 w-4 text-zinc-600" />}
          />

          <RingkasanCard
            label="Jurnal Belum Terhubung"
            sublabel={`Jurnal (${tanggalMulai} s/d ${tanggalSampai})`}
            value={formatIDR(totalGlBelumTerhubung)}
            icon={<BookOpen className="h-4 w-4 text-zinc-600" />}
          />

          <RingkasanCard
            label="Selisih Periode"
            sublabel={sudahBalance ? "Sudah balance" : "Belum balance"}
            value={formatIDR(selisihHarian)}
            icon={
              <Scale
                className={`h-4 w-4 ${
                  sudahBalance ? "text-emerald-600" : "text-amber-600"
                }`}
              />
            }
            tone={sudahBalance ? "positif" : "peringatan"}
          />

          <div className="flex items-center justify-center rounded-sm border border-zinc-200/80 bg-white p-4 shadow-sm">
            <button
              onClick={jalankanPencocokan}
              disabled={!pilihanBankId || !pilihanGlId || sedangSibuk}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-sm text-xs font-black tracking-wide uppercase italic transition ${
                pilihanBankId && pilihanGlId && !sedangSibuk
                  ? "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                  : "cursor-not-allowed bg-zinc-100 text-zinc-400"
              }`}
            >
              {isMemproses ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Hubungkan Data Terpilih
            </button>
          </div>
        </div>

        {/* 3. DUAL PANEL: BANK vs GL */}
        <div className="mb-28 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PanelTransaksi
            judul="Rekening Koran (Bank)"
            tanggal={`${tanggalMulai} s/d ${tanggalSampai}`}
            headerRight={
              modePeriode === "HARIAN" ? (
                <button
                  type="button"
                  disabled={sedangSibuk}
                  onClick={bukaFormTambah}
                  className="h-8 rounded-sm border border-zinc-200 bg-white px-3 text-[11px] font-bold text-zinc-700 uppercase shadow-sm transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tambah Transaksi
                </button>
              ) : (
                <span className="rounded-sm bg-blue-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-blue-700 uppercase"></span>
              )
            }
            kolomTerakhir="Deskripsi Transaksi"
            data={dataBank}
            isLoading={isLoading}
            pilihanId={pilihanBankId}
            onPilih={setPilihanBankId}
            namaRadio="pilih_bank"
            rowHighlight="bg-blue-50/60"
            emptyMessage="Tidak ada transaksi bank pada rentang tanggal ini."
            sedangSibuk={sedangSibuk}
            getIdBatal={(item) =>
              item.status === "TERHUBUNG" ? item.id : null
            }
            onBatalkanClick={batalkanSatuPencocokan}
            renderAksi={(item) =>
              item.status === "BELUM_TERHUBUNG" && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => bukaFormEdit(item)}
                    disabled={sedangSibuk}
                    title="Edit transaksi"
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 uppercase hover:underline disabled:opacity-50"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => hapusSatuTransaksi(item.id)}
                    disabled={sedangSibuk}
                    title="Hapus transaksi"
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 uppercase hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              )
            }
          />

          <PanelTransaksi
            judul="Jurnal"
            tanggal={`${tanggalMulai} s/d ${tanggalSampai}`}
            headerRight={null}
            kolomTerakhir="Keterangan Jurnal"
            data={dataGL}
            isLoading={isLoading}
            pilihanId={pilihanGlId}
            onPilih={setPilihanGlId}
            namaRadio="pilih_gl"
            rowHighlight="bg-purple-50/60"
            emptyMessage="Tidak ada transaksi jurnal pada rentang tanggal ini."
            sedangSibuk={sedangSibuk}
            getIdBatal={(item) =>
              item.status === "TERHUBUNG"
                ? (item.pasanganId as number | null)
                : null
            }
            onBatalkanClick={batalkanSatuPencocokan}
          />
        </div>
      </div>

      {/* 4. STICKY FOOTER */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-zinc-800 bg-zinc-900 p-4 text-white shadow-lg lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap gap-8">
            <div>
              <span className="block text-[9px] font-black tracking-wider text-zinc-400 uppercase">
                + Belum Terhubung di Jurnal
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
          </div>

          <button
            onClick={jalankanTutupBukuHarian}
            disabled={!sudahBalance || sedangSibuk}
            className="h-9 rounded-sm bg-emerald-600 px-5 text-[11px] font-black tracking-wide text-white uppercase italic shadow-none transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isMemproses ? "Memproses..." : "Simpan & Tutup Buku"}
          </button>
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT TRANSAKSI */}
      {showFormTransaksi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">
                  {transaksiYangDiedit
                    ? "Edit Transaksi Bank"
                    : "Tambah Transaksi Bank"}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Masukkan transaksi bank secara manual.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowFormTransaksi(false)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={formTransaksi.tanggal}
                  onChange={(e) =>
                    setFormTransaksi((prev) => ({
                      ...prev,
                      tanggal: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={formTransaksi.keterangan}
                  onChange={(e) =>
                    setFormTransaksi((prev) => ({
                      ...prev,
                      keterangan: e.target.value,
                    }))
                  }
                  placeholder="Contoh: Pembayaran vendor"
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Nominal
                </label>
                <input
                  type="number"
                  min="0"
                  value={formTransaksi.nominal}
                  onChange={(e) =>
                    setFormTransaksi((prev) => ({
                      ...prev,
                      nominal: e.target.value,
                    }))
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Tipe Transaksi
                </label>
                <select
                  value={formTransaksi.tipe}
                  onChange={(e) =>
                    setFormTransaksi((prev) => ({
                      ...prev,
                      tipe: e.target.value as "KREDIT" | "DEBIT",
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="KREDIT">KREDIT</option>
                  <option value="DEBIT">DEBIT</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowFormTransaksi(false)}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={sedangSibuk}
                onClick={simpanFormTransaksi}
                className="h-10 rounded-lg bg-zinc-900 px-5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMemproses ? "Menyimpan..." : "Simpan Transaksi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
