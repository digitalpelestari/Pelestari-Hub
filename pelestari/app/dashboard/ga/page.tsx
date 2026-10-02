"use client"

import React, { useState, useEffect } from "react"
import {
  Plus,
  Trash2,
  Eye,
  FileText,
  X,
  Download,
  Printer,
  CalendarClock,
  CheckCircle,
  AlertCircle,
  Edit2,
  Calendar,
} from "lucide-react"

// Import Server Actions Lengkap
import {
  createPurchaseOrderAction,
  getPurchaseOrdersAction,
  updatePaymentStatusAction,
  getPoItemsAction,
  deletePurchaseOrderAction,
} from "@/app/actions/po"

// Import fungsi helper export berkas lengkap (Massal & Satuan)
import {
  exportToExcel,
  exportToPdf,
  exportSinglePoToExcel,
  exportSinglePoToPdf,
} from "@/app/utils/poExport"
import { swal } from "@/lib/sweetalert"

interface POItem {
  transaksi: string
  ukuran: string
  quantity: number
  unit_price: number
  total: number
}

export default function PurchaseOrderPage() {
  const [poList, setPoList] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // === STATE FILTER TANGGAL ===
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // === STATE MODAL EDIT REMINDER & PEMBAYARAN ===
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null)
  const [editTempoHari, setEditTempoHari] = useState(0)
  const [editStatusPembayaran, setEditStatusPembayaran] =
    useState("Belum Bayar")
  const [editAkunPembayaran, setEditAkunPembayaran] = useState("11200")
  const [editTanggalBayar, setEditTanggalBayar] = useState(
    new Date().toISOString().split("T")[0]
  )

  // === STATE MODAL DETAIL READ-ONLY ===
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailPo, setDetailPo] = useState<any>(null)
  const [detailItems, setDetailItems] = useState<POItem[]>([])

  // === STATE FORM MASTER (ADD NEW PO) ===
  const [nomorPo, setNomorPo] = useState("")
  const [tanggalPo, setTanggalPo] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [vendorNama, setVendorNama] = useState("")
  const [vendorPic, setVendorPic] = useState("")
  const [vendorEmail, setVendorEmail] = useState("")
  const [alamatPengantaran, setAlamatPengantaran] = useState("")
  const [penerimaNama, setPenerimaNama] = useState("")
  const [isPpnActive, setIsPpnActive] = useState(true)

  // State Item Row
  const [items, setItems] = useState<POItem[]>([
    { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 },
  ])

  const subTotal = items.reduce((acc, item) => acc + item.total, 0)
  const ppn = isPpnActive ? subTotal * 0.11 : 0
  const totalHarga = subTotal + ppn

  useEffect(() => {
    fetchPO()
  }, [])

  const fetchPO = async () => {
    const res = await getPurchaseOrdersAction()
    if (res.success) {
      setPoList(res.data)
    }
  }

  // === LOGIC FILTERING DATA PO ===
  const filteredPoList = poList.filter((po) => {
    if (!po.tanggal_po) return true

    // Normalisasi format tanggal PO (mengambil YYYY-MM-DD)
    const poDateStr = new Date(po.tanggal_po).toISOString().split("T")[0]

    if (startDate && poDateStr < startDate) return false
    if (endDate && poDateStr > endDate) return false

    return true
  })

  const handleResetFilter = () => {
    setStartDate("")
    setEndDate("")
  }

  const handleOpenDetailModal = async (po: any) => {
    setDetailPo(po)
    const res = await getPoItemsAction(po.id_po)
    if (res.success) {
      setDetailItems(res.data)
      setIsDetailModalOpen(true)
    } else {
      swal.error("Gagal mengambil rincian item barang")
    }
  }

  const handleOpenEditModal = (po: any) => {
    setSelectedPoId(po.id_po)
    setEditTempoHari(po.tempo_hari || 0)
    setEditStatusPembayaran(po.status_pembayaran || "Belum Bayar")
    setEditAkunPembayaran(po.akun_pembayaran || null)
    // Jika data dari database sudah memiliki tanggal_bayar_1, tampilkan tanggal tersebut
    if (po.tanggal_bayar_1) {
      setEditTanggalBayar(
        new Date(po.tanggal_bayar_1).toISOString().split("T")[0]
      )
    } else {
      setEditTanggalBayar(new Date().toISOString().split("T")[0])
    }

    setIsEditModalOpen(true)
  }

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPoId) return

    setLoading(true)

    // Kirim tanggal_bayar jika statusnya lunas, jika tidak set null
    const tglBayarPayload =
      editStatusPembayaran === "Lunas" ? editTanggalBayar : null

    const res = await updatePaymentStatusAction(
      selectedPoId,
      editStatusPembayaran,
      Number(editTempoHari),
      tglBayarPayload,
      editAkunPembayaran
    )

    if (res.success) {
      swal.success("Status pembayaran dan tanggal berhasil diperbarui!")
      setIsEditModalOpen(false)
      fetchPO()
    } else {
      swal.error("Gagal memperbarui data: " + res.message)
    }
    setLoading(false)
  }

  const handleDeletePO = async (id_po: number, nomor_po: string) => {
    const konfirmasi = await swal.confirm(
      `Apakah Anda yakin ingin menghapus PO ${nomor_po}?\nTindakan ini otomatis memotong balik saldo utang usaha jika statusnya belum dibayar.`
    )
    if (!konfirmasi) return

    setLoading(true)
    const res = await deletePurchaseOrderAction(id_po)
    if (res.success) {
      swal.success(res.message)
      fetchPO()
    } else {
      swal.error("Gagal menghapus PO: " + res.message)
    }
    setLoading(false)
  }

  const resetFormFields = () => {
    setNomorPo("")
    setTanggalPo(new Date().toISOString().split("T")[0])
    setVendorNama("")
    setVendorPic("")
    setVendorEmail("")
    setAlamatPengantaran("")
    setPenerimaNama("")
    setIsPpnActive(true)
    setItems([
      { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 },
    ])
  }

  const handleAddItemRow = () => {
    setItems([
      ...items,
      { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 },
    ])
  }

  const handleSomeChange = (index: number, field: string, value: any) => {
    const updatedItems = [...items] as any[]

    if (field === "quantity" || field === "unit_price") {
      updatedItems[index][field] = value
      updatedItems[index].total =
        updatedItems[index].quantity * updatedItems[index].unit_price
    } else {
      updatedItems[index][field] = value
    }
    setItems(updatedItems)
  }

  const handleRemoveItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    } else {
      setItems([
        { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 },
      ])
    }
  }

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0 || !items[0].transaksi) {
      swal.warning("Harap isi minimal 1 item transaksi!")
      return
    }

    setLoading(true)

    const payload = {
      nomor_po: nomorPo,
      tanggal_po: tanggalPo,
      vendor_nama: vendorNama,
      vendor_pic: vendorPic,
      vendor_email: vendorEmail,
      alamat_pengantaran: alamatPengantaran,
      penerima_nama: penerimaNama,
      sub_total: subTotal,
      ppn: ppn,
      total_harga: totalHarga,
      tempo_hari: 0,
      items,
    }

    const res = await createPurchaseOrderAction(payload)

    if (res.success) {
      swal.success(res.message)
      setIsModalOpen(false)
      resetFormFields()
      fetchPO()
    } else {
      swal.error("Oops, Gagal menyimpan PO: " + res.message)
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-7xl p-6 font-sans">
      {/* HEADER UTAMA & EXPORT BUTTONS */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            DATA PURCHASE ORDER
          </h1>
          <p className="text-xs text-zinc-500">
            Pengelolaan internal dokumen pengadaan barang divisi HRGA
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Aksi Cetak Menggunakan `filteredPoList` */}
          <button
            onClick={() => exportToExcel(filteredPoList)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-xs font-bold tracking-wider text-white uppercase shadow transition-colors hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" /> Excel Rekap
          </button>

          <button
            onClick={() => exportToPdf(filteredPoList)}
            className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-2 text-xs font-bold tracking-wider text-white uppercase shadow transition-colors hover:bg-red-700"
          >
            <Printer className="h-3.5 w-3.5" /> PDF Rekap
          </button>

          <button
            onClick={() => {
              resetFormFields()
              setIsModalOpen(true)
            }}
            className="ml-0 flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-xs font-bold tracking-wider text-white uppercase shadow-sm transition-colors hover:bg-blue-700 md:ml-2"
          >
            <Plus className="h-4 w-4" /> Buat PO Baru
          </button>
        </div>
      </div>

      {/* PANEL FILTER RANGE TANGGAL */}
      <div className="mb-6 flex flex-col gap-4 rounded border border-zinc-200 bg-zinc-50 p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="max-w-xs flex-1">
          <label className="mb-1.5 block flex items-center gap-1 text-[11px] font-bold text-zinc-600 uppercase">
            <Calendar className="h-3 w-3 text-zinc-400" /> Dari Tanggal
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white p-2 text-xs text-zinc-800 focus:outline-zinc-400"
          />
        </div>

        <div className="max-w-xs flex-1">
          <label className="mb-1.5 block flex items-center gap-1 text-[11px] font-bold text-zinc-600 uppercase">
            <Calendar className="h-3 w-3 text-zinc-400" /> Sampai Tanggal
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white p-2 text-xs text-zinc-800 focus:outline-zinc-400"
          />
        </div>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleResetFilter}
            className="h-fit self-start rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 sm:self-auto"
          >
            Bersihkan Filter
          </button>
        )}

        {/* Informasi Jumlah Data Terfilter */}
        <div className="ml-auto self-center text-[11px] font-medium text-zinc-500">
          Menampilkan{" "}
          <span className="font-bold text-zinc-800">
            {filteredPoList.length}
          </span>{" "}
          dari {poList.length} total PO
        </div>
      </div>

      {/* TABEL LIST REKAPITULASI PO */}
      <div className="overflow-hidden rounded border border-zinc-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 font-bold text-zinc-700 uppercase">
              <th className="p-3">No PO / Tanggal</th>
              <th className="p-3">Vendor Target</th>
              <th className="p-3 text-right">Total Akhir</th>
              <th className="p-3 text-center">Status Bayar</th>
              <th className="p-3 text-center">Reminder Tempo / Tgl Bayar</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredPoList.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center font-medium text-zinc-400"
                >
                  {poList.length === 0
                    ? "Belum ada dokumen PO yang tersimpan."
                    : "Tidak ada dokumen PO pada rentang tanggal ini."}
                </td>
              </tr>
            ) : (
              filteredPoList.map((po) => (
                <tr
                  key={po.id_po}
                  className="align-middle transition-colors hover:bg-zinc-50/80"
                >
                  <td className="p-3 font-semibold text-zinc-900">
                    <span className="block text-blue-600">{po.nomor_po}</span>
                    <span className="text-[10px] font-normal text-zinc-400">
                      {new Date(po.tanggal_po).toLocaleDateString("id-ID")}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-zinc-800">
                    {po.vendor_nama}
                  </td>
                  <td className="p-3 text-right font-bold text-zinc-900">
                    Rp {Number(po.total_harga).toLocaleString("id-ID")}
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold ${
                        po.status_pembayaran === "Lunas"
                          ? "border border-green-200 bg-green-50 text-green-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {po.status_pembayaran}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    {/* TAMPILAN DINAMIS TANGGAL BAYAR */}
                    {po.status_pembayaran === "Lunas" ? (
                      <div className="text-center">
                        <span className="mx-auto flex w-fit items-center justify-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />{" "}
                          Lunas
                        </span>
                        {po.tanggal_bayar_1 && (
                          <span className="mt-1 block text-[10px] font-medium text-zinc-500">
                            Pd:{" "}
                            {new Date(po.tanggal_bayar_1).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        )}
                      </div>
                    ) : po.tempo_hari === 0 ? (
                      <span className="text-[11px] text-zinc-400 italic">
                        Belum di-set tempo
                      </span>
                    ) : po.sisa_hari < 0 ? (
                      <span className="mx-auto flex w-fit items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" /> Lewat{" "}
                        {Math.abs(po.sisa_hari)} Hari
                      </span>
                    ) : po.sisa_hari === 0 ? (
                      <span className="animate-pulse rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-600">
                        Hari Ini Tempo!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                        <CalendarClock className="h-3.5 w-3.5 text-zinc-500" />{" "}
                        {po.sisa_hari} Hari Lagi
                      </span>
                    )}
                  </td>

                  <td className="flex items-center justify-center gap-2 p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(po)}
                      className="rounded border border-zinc-300 p-1.5 text-zinc-700 transition-colors hover:bg-zinc-100"
                      title="Lihat Invoice PO"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(po)}
                      className="flex items-center gap-1 rounded bg-zinc-900 px-2 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-zinc-800"
                    >
                      <Edit2 className="h-3 w-3" /> Set Tempo
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDeletePO(po.id_po, po.nomor_po)}
                      className="rounded border border-red-200 p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:bg-zinc-100"
                      title="Hapus Dokumen PO"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MODAL DETAIL PO ================= */}
      {isDetailModalOpen && detailPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-4xl overflow-hidden rounded border border-zinc-300 bg-white shadow-xl">
            <div className="flex items-center justify-between bg-zinc-900 px-6 py-3 text-xs font-bold tracking-wider text-white uppercase">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-400" /> Pratinjau Dokumen
                Purchase Order
              </span>

              <div className="mr-4 ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportSinglePoToExcel(detailPo, detailItems)}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase transition-colors hover:bg-emerald-700"
                >
                  <Download className="h-3 w-3" /> Cetak Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportSinglePoToPdf(detailPo, detailItems)}
                  className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase transition-colors hover:bg-red-700"
                >
                  <Printer className="h-3 w-3" /> Cetak PDF
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-zinc-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 bg-white p-6 text-xs select-none">
              <div className="space-y-4 rounded border border-zinc-300 bg-zinc-50/40 p-4">
                <div className="border-b border-zinc-200 pb-3 text-center">
                  <h2 className="text-sm font-black tracking-widest text-zinc-900 uppercase">
                    PURCHASE ORDER
                  </h2>
                  <p className="mt-1 font-bold text-zinc-700">
                    PO Number:{" "}
                    <span className="font-black text-blue-600 underline">
                      {detailPo.nomor_po}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">
                      Alamat Perusahaan
                    </p>
                    <p className="font-semibold text-zinc-800">
                      PT Peduli Lestari Indonesia
                    </p>
                    <p>NPWP : 0423 0271 5040 4000</p>
                    <p>Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008</p>
                    <p>Kedung Halang, Bogor Utara, Kota Bogor, Jawa Barat</p>
                  </div>
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">
                      Vendor Target
                    </p>
                    <p className="font-bold text-zinc-800">
                      {detailPo.vendor_nama}
                    </p>
                    <p>
                      <span className="font-semibold">PIC Hub:</span>{" "}
                      {detailPo.vendor_pic || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span>{" "}
                      {detailPo.vendor_email || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">PO Date:</span>{" "}
                      {new Date(detailPo.tanggal_po).toLocaleDateString(
                        "id-ID"
                      )}
                    </p>
                    {detailPo.status_pembayaran === "Lunas" &&
                      detailPo.tanggal_bayar_1 && (
                        <p className="font-bold text-green-600">
                          <span className="font-semibold text-zinc-600">
                            Tanggal Realisasi Bayar:
                          </span>{" "}
                          {new Date(
                            detailPo.tanggal_bayar_1
                          ).toLocaleDateString("id-ID")}
                        </p>
                      )}
                  </div>
                </div>
              </div>

              <div>
                <table className="w-full border-collapse border border-zinc-300 text-left">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-200 font-bold text-zinc-800">
                      <th className="w-12 border-r border-zinc-300 p-2 text-center">
                        No
                      </th>
                      <th className="border-r border-zinc-300 p-2">
                        Transaksi / Deskripsi Barang
                      </th>
                      <th className="w-24 border-r border-zinc-300 p-2 text-center">
                        Ukuran
                      </th>
                      <th className="w-20 border-r border-zinc-300 p-2 text-center">
                        Qty
                      </th>
                      <th className="w-36 border-r border-zinc-300 p-2 text-right">
                        Harga Satuan
                      </th>
                      <th className="w-40 p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {detailItems.map((item: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="border-r border-zinc-200 p-2 text-center font-bold text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="border-r border-zinc-200 p-2 font-medium text-zinc-800">
                          {item.transaksi}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-center font-semibold">
                          {item.ukuran || "-"}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-center font-bold">
                          {item.quantity}
                        </td>
                        <td className="border-r border-zinc-200 p-2 text-right">
                          Rp {Number(item.unit_price).toLocaleString("id-ID")}
                        </td>
                        <td className="bg-zinc-50/30 p-2 text-right font-bold">
                          Rp {Number(item.total).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-1.5 rounded border border-zinc-200 bg-zinc-50/50 p-3 text-zinc-600">
                  <p className="font-bold text-zinc-800 uppercase">
                    Alamat Pengantaran
                  </p>
                  <p className="font-medium whitespace-pre-wrap text-zinc-700">
                    {detailPo.alamat_pengantaran}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-zinc-800">
                      UP Penerima:
                    </span>{" "}
                    {detailPo.penerima_nama}
                  </p>
                </div>
                <div className="h-fit divide-y divide-zinc-200 overflow-hidden rounded border border-zinc-300 text-sm">
                  <div className="flex justify-between bg-zinc-50/30 p-2">
                    <span className="font-bold text-zinc-600">Sub Total</span>
                    <span className="font-semibold text-zinc-900">
                      Rp {Number(detailPo.sub_total).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between bg-zinc-50/30 p-2">
                    <span className="font-bold text-zinc-600">PPN 11%</span>
                    <span className="font-semibold text-zinc-900">
                      Rp {Number(detailPo.ppn).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between bg-zinc-900 p-2 font-bold text-white">
                    <span>TOTAL AKHIR</span>
                    <span className="text-blue-400">
                      Rp {Number(detailPo.total_harga).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="rounded bg-zinc-900 px-5 py-2 font-bold text-white shadow hover:bg-zinc-800"
                >
                  Tutup Lampiran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT REMINDER & PEMBAYARAN ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded border border-zinc-300 bg-white shadow-xl">
            <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
              <span>Atur Pengingat & Pembayaran</span>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveReminder}
              className="space-y-4 p-4 text-xs"
            >
              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Status Pembayaran Saat Ini
                </label>
                <select
                  value={editStatusPembayaran}
                  onChange={(e) => setEditStatusPembayaran(e.target.value)}
                  className="w-full cursor-pointer rounded border border-zinc-300 bg-white p-2 font-semibold text-zinc-800 focus:outline-none"
                >
                  <option value="Belum Bayar">Belum Bayar</option>
                  <option value="Lunas">Lunas</option>
                </select>
              </div>

              {/* FIELD KALENDER: Hanya tampil bersyarat jika status "Lunas" */}
              {editStatusPembayaran === "Lunas" && (
                <div className="rounded border border-green-200 bg-green-50/60 p-3 transition-all">
                  <label className="mb-1 block flex items-center gap-1 font-bold text-green-900">
                    <Calendar className="h-3.5 w-3.5 text-green-600" /> Tanggal
                    Realisasi Pembayaran
                  </label>
                  <input
                    type="date"
                    required
                    value={editTanggalBayar}
                    onChange={(e) => setEditTanggalBayar(e.target.value)}
                    className="w-full cursor-pointer rounded border border-green-300 bg-white p-2 text-xs font-semibold text-zinc-800 focus:outline-green-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block font-bold text-zinc-700">
                  Jumlah Hari Reminder Tempo
                </label>
                <select
                  value={editTempoHari}
                  onChange={(e) => setEditTempoHari(Number(e.target.value))}
                  className="w-full cursor-pointer rounded border border-zinc-300 bg-white p-2 font-semibold text-zinc-800 focus:outline-none"
                  disabled={editStatusPembayaran === "Lunas"}
                >
                  <option value={0}>Cash Langsung (Hari H)</option>
                  <option value={7}>7 Hari Kalender</option>
                  <option value={14}>14 Hari Kalender</option>
                  <option value={30}>30 Hari (1 Bulan)</option>
                  <option value={45}>45 Hari Kerja</option>
                  <option value={60}>60 Hari (2 Bulan)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded border border-zinc-300 px-3 py-1.5 font-semibold text-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-4 py-1.5 font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? "Menyimpan..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL INPUT FORM (BUAT PO BARU) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-4xl overflow-hidden rounded border border-zinc-300 bg-white shadow-xl">
            <div className="flex items-center justify-between bg-zinc-900 px-6 py-3 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-bold tracking-wider uppercase">
                  Form Pembuatan Purchase Order
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-6 p-6 text-xs">
              <div className="space-y-4 rounded border border-zinc-300 bg-zinc-50/50 p-4">
                <div className="border-b border-zinc-200 pb-3 text-center">
                  <h2 className="text-sm font-black tracking-widest text-zinc-900 uppercase">
                    PURCHASE ORDER
                  </h2>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="font-bold text-zinc-600">PO Number:</span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 001/PO-GA/PLI/VIII/2025"
                      value={nomorPo}
                      onChange={(e) => setNomorPo(e.target.value)}
                      className="w-64 rounded border border-zinc-300 px-2 py-0.5 text-center font-medium text-zinc-800 placeholder-zinc-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">
                      Alamat Perusahaan
                    </p>
                    <p className="font-medium text-zinc-800">
                      PT Peduli Lestari Indonesia
                    </p>
                    <p>NPWP : 0423 0271 5040 4000</p>
                    <p>Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008</p>
                    <p>Kedung Halang, Bogor Utara, Kota Bogor, Jawa Barat</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">
                        PO Date:
                      </span>
                      <input
                        type="date"
                        required
                        value={tanggalPo}
                        onChange={(e) => setTanggalPo(e.target.value)}
                        className="w-full rounded border border-zinc-300 px-2 py-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">
                        Vendor:
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Masukkan Nama CV / PT Vendor"
                        value={vendorNama}
                        onChange={(e) => setVendorNama(e.target.value)}
                        className="w-full rounded border border-zinc-300 px-2 py-1 font-bold placeholder-zinc-300"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">
                        PIC Hub:
                      </span>
                      <input
                        type="text"
                        placeholder="Contoh: Pak Dera - 0812xxxxxxxx"
                        value={vendorPic}
                        onChange={(e) => setVendorPic(e.target.value)}
                        className="w-full rounded border border-zinc-300 px-2 py-1 placeholder-zinc-300"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">
                        Email:
                      </span>
                      <input
                        type="email"
                        placeholder="vendor@email.com"
                        value={vendorEmail}
                        onChange={(e) => setVendorEmail(e.target.value)}
                        className="w-full rounded border border-zinc-300 px-2 py-1 placeholder-zinc-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold tracking-wider text-zinc-700 uppercase">
                    Daftar Item Transaksi
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="rounded bg-zinc-900 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-zinc-800"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <table className="w-full border-collapse border border-zinc-300 text-left">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-200 font-bold text-zinc-800">
                      <th className="w-12 border-r border-zinc-300 p-2 text-center">
                        No
                      </th>
                      <th className="w-1/3 border-r border-zinc-300 p-2">
                        Transaksi / Deskripsi Barang
                      </th>
                      <th className="w-24 border-r border-zinc-300 p-2 text-center">
                        Ukuran
                      </th>
                      <th className="w-20 border-r border-zinc-300 p-2 text-center">
                        Quantity
                      </th>
                      <th className="w-36 border-r border-zinc-300 p-2 text-right">
                        Unit Price (Rp)
                      </th>
                      <th className="w-40 border-r border-zinc-300 p-2 text-right">
                        Total
                      </th>
                      <th className="w-12 p-2 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-300">
                    {items.map((item, idx) => (
                      <tr key={idx} className="align-middle">
                        <td className="border-r border-zinc-300 p-2 text-center font-bold text-zinc-500">
                          {idx + 1}
                        </td>
                        <td className="border-r border-zinc-300 p-1">
                          <input
                            type="text"
                            required
                            placeholder="Nama barang / jasa"
                            value={item.transaksi}
                            onChange={(e) =>
                              handleSomeChange(idx, "transaksi", e.target.value)
                            }
                            className="w-full bg-transparent px-1 py-0.5 placeholder-zinc-300 focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-zinc-300 p-1">
                          <input
                            type="text"
                            placeholder="S/M/L/Pcs"
                            value={item.ukuran}
                            onChange={(e) =>
                              handleSomeChange(idx, "ukuran", e.target.value)
                            }
                            className="w-full bg-transparent px-1 py-0.5 text-center placeholder-zinc-300 focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-zinc-300 p-1">
                          <input
                            type="number"
                            required
                            min={1}
                            value={item.quantity || ""}
                            onChange={(e) =>
                              handleSomeChange(idx, "quantity", e.target.value)
                            }
                            className="w-full bg-transparent px-1 py-0.5 text-center font-semibold focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-zinc-300 p-1 text-right">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-zinc-400">Rp</span>
                            <input
                              type="number"
                              required
                              min={0}
                              value={item.unit_price || ""}
                              onChange={(e) =>
                                handleSomeChange(
                                  idx,
                                  "unit_price",
                                  e.target.value
                                )
                              }
                              className="w-28 bg-transparent py-0.5 text-right font-semibold focus:outline-none"
                            />
                          </div>
                        </td>
                        <td className="border-r border-zinc-300 bg-zinc-50/50 p-2 text-right font-semibold">
                          Rp {item.total.toLocaleString("id-ID")}
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2">
                <div className="space-y-2 rounded border border-zinc-200 bg-zinc-50 p-3">
                  <p className="font-bold tracking-wide text-zinc-800 uppercase">
                    Alamat Pengantaran
                  </p>
                  <textarea
                    rows={2}
                    required
                    placeholder="Masukkan alamat lengkap tujuan pengiriman barang"
                    value={alamatPengantaran}
                    onChange={(e) => setAlamatPengantaran(e.target.value)}
                    className="w-full resize-none rounded border border-zinc-300 bg-white p-2 text-zinc-700 placeholder-zinc-300"
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-600">
                      Penerima:
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Nama penanggung jawab penerima"
                      value={penerimaNama}
                      onChange={(e) => setPenerimaNama(e.target.value)}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-0.5 placeholder-zinc-300"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50/50 p-2 shadow-sm">
                    <input
                      type="checkbox"
                      id="ppnToggle"
                      checked={isPpnActive}
                      onChange={(e) => setIsPpnActive(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded accent-blue-600"
                    />
                    <label
                      htmlFor="ppnToggle"
                      className="cursor-pointer text-[11px] font-bold tracking-wide text-blue-900 uppercase select-none"
                    >
                      Gunakan Pungutan PPN Pajak (11%)
                    </label>
                  </div>

                  <div className="h-fit divide-y divide-zinc-300 overflow-hidden rounded border border-zinc-300 text-sm">
                    <div className="flex justify-between bg-zinc-50/50 p-2">
                      <span className="font-bold text-zinc-600">Sub Total</span>
                      <span className="font-semibold text-zinc-900">
                        Rp {subTotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-50/50 p-2">
                      <span className="font-bold text-zinc-600">PPN 11%</span>
                      <span
                        className={`font-semibold ${isPpnActive ? "text-zinc-900" : "text-zinc-400 line-through"}`}
                      >
                        Rp {ppn.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between bg-zinc-900 p-2 font-bold text-white">
                      <span>TOTAL</span>
                      <span className="text-blue-400">
                        Rp {totalHarga.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-5 py-2 font-bold text-white shadow transition-colors hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? "Menyimpan Dokumen..." : "Simpan & Rekap PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
