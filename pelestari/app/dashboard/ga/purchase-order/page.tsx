"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Eye, FileText, X, Download, Printer, CalendarClock, CheckCircle, AlertCircle, Edit2, Calendar } from "lucide-react";

// Import Server Actions Lengkap
import { 
  createPurchaseOrderAction, 
  getPurchaseOrdersAction, 
  updatePaymentStatusAction, 
  getPoItemsAction,
  deletePurchaseOrderAction 
} from "@/app/actions/po";

// Import fungsi helper export berkas lengkap (Massal & Satuan)
import { exportToExcel, exportToPdf, exportSinglePoToExcel, exportSinglePoToPdf } from "@/app/utils/poExport";

interface POItem {
  transaksi: string;
  ukuran: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export default function PurchaseOrderPage() {
  const [poList, setPoList] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // === STATE FILTER TANGGAL ===
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // === STATE MODAL EDIT REMINDER ===
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [editTempoHari, setEditTempoHari] = useState(0);
  const [editStatusPembayaran, setEditStatusPembayaran] = useState("Belum Bayar");

  // === STATE MODAL DETAIL READ-ONLY ===
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailPo, setDetailPo] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<POItem[]>([]);

  // === STATE FORM MASTER (ADD NEW PO) ===
  const [nomorPo, setNomorPo] = useState("");
  const [tanggalPo, setTanggalPo] = useState(new Date().toISOString().split("T")[0]);
  const [vendorNama, setVendorNama] = useState("");
  const [vendorPic, setVendorPic] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [alamatPengantaran, setAlamatPengantaran] = useState("");
  const [penerimaNama, setPenerimaNama] = useState("");
  const [isPpnActive, setIsPpnActive] = useState(true);

  // State Item Row
  const [items, setItems] = useState<POItem[]>([
    { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 },
  ]);

  const subTotal = items.reduce((acc, item) => acc + item.total, 0);
  const ppn = isPpnActive ? subTotal * 0.11 : 0; 
  const totalHarga = subTotal + ppn;

  useEffect(() => {
    fetchPO();
  }, []);

  const fetchPO = async () => {
    const res = await getPurchaseOrdersAction();
    if (res.success) {
      setPoList(res.data);
    }
  };

  // === LOGIC FILTERING DATA PO ===
  const filteredPoList = poList.filter((po) => {
    if (!po.tanggal_po) return true;
    
    // Normalisasi format tanggal PO (mengambil YYYY-MM-DD)
    const poDateStr = new Date(po.tanggal_po).toISOString().split("T")[0];

    if (startDate && poDateStr < startDate) return false;
    if (endDate && poDateStr > endDate) return false;
    
    return true;
  });

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleOpenDetailModal = async (po: any) => {
    setDetailPo(po);
    const res = await getPoItemsAction(po.id_po);
    if (res.success) {
      setDetailItems(res.data);
      setIsDetailModalOpen(true);
    } else {
      alert("Gagal mengambil rincian item barang");
    }
  };

  const handleOpenEditModal = (po: any) => {
    setSelectedPoId(po.id_po);
    setEditTempoHari(po.tempo_hari || 0);
    setEditStatusPembayaran(po.status_pembayaran || "Belum Bayar");
    setIsEditModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) return;

    setLoading(true);
    const res = await updatePaymentStatusAction(selectedPoId, editStatusPembayaran, Number(editTempoHari));

    if (res.success) {
      alert("Pengingat tempo dan status pembayaran berhasil diperbarui!");
      setIsEditModalOpen(false);
      fetchPO();
    } else {
      alert("Gagal memperbarui data: " + res.message);
    }
    setLoading(false);
  };

  const handleDeletePO = async (id_po: number, nomor_po: string) => {
    const konfirmasi = confirm(`Apakah Anda yakin ingin menghapus PO ${nomor_po}?\nTindakan ini otomatis memotong balik saldo utang usaha jika statusnya belum dibayar.`);
    if (!konfirmasi) return;

    setLoading(true);
    const res = await deletePurchaseOrderAction(id_po);
    if (res.success) {
      alert(res.message);
      fetchPO();
    } else {
      alert("Gagal menghapus PO: " + res.message);
    }
    setLoading(false);
  };

  const resetFormFields = () => {
    setNomorPo("");
    setTanggalPo(new Date().toISOString().split("T")[0]);
    setVendorNama("");
    setVendorPic("");
    setVendorEmail("");
    setAlamatPengantaran("");
    setPenerimaNama("");
    setIsPpnActive(true);
    setItems([{ transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 }]);
  };

  const handleAddItemRow = () => {
    setItems([...items, { transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 }]);
  };

  const handleSomeChange = (index: number, field: string, value: any) => {
    const updatedItems = [...items] as any[];

    if (field === "quantity" || field === "unit_price") {
      updatedItems[index][field] = value;
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unit_price;
    } else {
      updatedItems[index][field] = value;
    }
    setItems(updatedItems);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      setItems([{ transaksi: "", ukuran: "", quantity: 0, unit_price: 0, total: 0 }]);
    }
  };

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !items[0].transaksi) {
      alert("Harap isi minimal 1 item transaksi!");
      return;
    }

    setLoading(true);

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
      items
    };

    const res = await createPurchaseOrderAction(payload);

    if (res.success) {
      alert(res.message);
      setIsModalOpen(false);
      resetFormFields();
      fetchPO();
    } else {
      alert("Oops, Gagal menyimpan PO: " + res.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      {/* HEADER UTAMA & EXPORT BUTTONS */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">DATA PURCHASE ORDER</h1>
          <p className="text-xs text-zinc-500">Pengelolaan internal dokumen pengadaan barang divisi HRGA</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Aksi Cetak Menggunakan `filteredPoList` */}
          <button onClick={() => exportToExcel(filteredPoList)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors shadow">
            <Download className="h-3.5 w-3.5" /> Excel Rekap
          </button>
          
          <button onClick={() => exportToPdf(filteredPoList)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors shadow">
            <Printer className="h-3.5 w-3.5" /> PDF Rekap
          </button>

          <button onClick={() => { resetFormFields(); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors shadow-sm ml-0 md:ml-2">
            <Plus className="h-4 w-4" /> Buat PO Baru
          </button>
        </div>
      </div>

      {/* PANEL FILTER RANGE TANGGAL */}
      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded mb-6 flex flex-col sm:flex-row sm:items-end gap-4 shadow-sm">
        <div className="flex-1 max-w-xs">
          <label className="block text-zinc-600 text-[11px] font-bold uppercase mb-1.5 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-zinc-400" /> Dari Tanggal
          </label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-full border border-zinc-300 p-2 text-xs rounded bg-white text-zinc-800 focus:outline-zinc-400"
          />
        </div>

        <div className="flex-1 max-w-xs">
          <label className="block text-zinc-600 text-[11px] font-bold uppercase mb-1.5 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-zinc-400" /> Sampai Tanggal
          </label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-full border border-zinc-300 p-2 text-xs rounded bg-white text-zinc-800 focus:outline-zinc-400"
          />
        </div>

        {(startDate || endDate) && (
          <button 
            type="button" 
            onClick={handleResetFilter} 
            className="text-xs font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-300 px-3 py-2 rounded bg-white hover:bg-zinc-100 transition-colors h-fit self-start sm:self-auto"
          >
            Bersihkan Filter
          </button>
        )}

        {/* Informasi Jumlah Data Terfilter */}
        <div className="ml-auto text-[11px] text-zinc-500 font-medium self-center">
          Menampilkan <span className="font-bold text-zinc-800">{filteredPoList.length}</span> dari {poList.length} total PO
        </div>
      </div>

      {/* TABEL LIST REKAPITULASI PO */}
      <div className="bg-white border border-zinc-200 rounded shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-bold uppercase">
              <th className="p-3">No PO / Tanggal</th>
              <th className="p-3">Vendor Target</th>
              <th className="p-3 text-right">Total Akhir</th>
              <th className="p-3 text-center">Status Bayar</th>
              <th className="p-3 text-center">Reminder Tempo</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredPoList.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400 font-medium">
                  {poList.length === 0 ? "Belum ada dokumen PO yang tersimpan." : "Tidak ada dokumen PO pada rentang tanggal ini."}
                </td>
              </tr>
            ) : (
              filteredPoList.map((po) => (
                <tr key={po.id_po} className="hover:bg-zinc-50/80 transition-colors align-middle">
                  <td className="p-3 font-semibold text-zinc-900">
                    <span className="text-blue-600 block">{po.nomor_po}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">{new Date(po.tanggal_po).toLocaleDateString("id-ID")}</span>
                  </td>
                  <td className="p-3 font-medium text-zinc-800">{po.vendor_nama}</td>
                  <td className="p-3 text-right font-bold text-zinc-900">
                    Rp {Number(po.total_harga).toLocaleString("id-ID")}
                  </td>
                  
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      po.status_pembayaran === "SUDAH BAYAR" 
                        ? "bg-green-50 text-green-700 border border-green-200" 
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {po.status_pembayaran}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    {po.status_pembayaran === "SUDAH BAYAR" ? (
                      <span className="text-zinc-400 text-[11px] flex items-center justify-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Lunas</span>
                    ) : po.tempo_hari === 0 ? (
                      <span className="text-zinc-400 italic text-[11px]">Belum di-set tempo</span>
                    ) : po.sisa_hari < 0 ? (
                      <span className="text-red-600 font-bold text-[11px] bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center justify-center gap-1 w-fit mx-auto">
                        <AlertCircle className="h-3.5 w-3.5" /> Lewat {Math.abs(po.sisa_hari)} Hari
                      </span>
                    ) : po.sisa_hari === 0 ? (
                      <span className="text-orange-600 font-bold text-[11px] bg-orange-50 px-2 py-0.5 rounded border border-orange-200 animate-pulse">
                        Hari Ini Tempo!
                      </span>
                    ) : (
                      <span className="text-zinc-700 font-medium text-[11px] bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-zinc-500" /> {po.sisa_hari} Hari Lagi
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-center flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(po)}
                      className="p-1.5 border border-zinc-300 rounded text-zinc-700 hover:bg-zinc-100 transition-colors"
                      title="Lihat Invoice PO"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(po)}
                      className="flex items-center gap-1 text-[11px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 px-2 py-1.5 rounded transition-colors"
                    >
                      <Edit2 className="h-3 w-3" /> Set Tempo
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDeletePO(po.id_po, po.nomor_po)}
                      className="p-1.5 border border-red-200 text-red-500 hover:bg-red-50 disabled:bg-zinc-100 rounded transition-colors"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded shadow-xl border border-zinc-300 overflow-hidden my-auto">
            <div className="bg-zinc-900 text-white px-6 py-3 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-blue-400" /> Pratinjau Dokumen Purchase Order</span>
              
              <div className="flex items-center gap-2 ml-auto mr-4">
                <button
                  type="button"
                  onClick={() => exportSinglePoToExcel(detailPo, detailItems)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 uppercase transition-colors"
                >
                  <Download className="h-3 w-3" /> Cetak Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportSinglePoToPdf(detailPo, detailItems)}
                  className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 uppercase transition-colors"
                >
                  <Printer className="h-3 w-3" /> Cetak PDF
                </button>
              </div>

              <button type="button" onClick={() => setIsDetailModalOpen(false)} className="text-zinc-300 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-6 text-xs space-y-6 bg-white select-none">
              <div className="border border-zinc-300 p-4 rounded bg-zinc-50/40 space-y-4">
                <div className="text-center border-b border-zinc-200 pb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">PURCHASE ORDER</h2>
                  <p className="mt-1 font-bold text-zinc-700">PO Number: <span className="text-blue-600 underline font-black">{detailPo.nomor_po}</span></p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">Alamat Perusahaan</p>
                    <p className="font-semibold text-zinc-800">PT Peduli Lestari Indonesia</p>
                    <p>NPWP : 0423 0271 5040 4000</p>
                    <p>Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008</p>
                    <p>Kedung Halang, Bogor Utara, Kota Bogor, Jawa Barat</p>
                  </div>
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">Vendor Target</p>
                    <p className="font-bold text-zinc-800">{detailPo.vendor_nama}</p>
                    <p><span className="font-semibold">PIC Hub:</span> {detailPo.vendor_pic || "-"}</p>
                    <p><span className="font-semibold">Email:</span> {detailPo.vendor_email || "-"}</p>
                    <p><span className="font-semibold">PO Date:</span> {new Date(detailPo.tanggal_po).toLocaleDateString("id-ID")}</p>
                  </div>
                </div>
              </div>

              <div>
                <table className="w-full border border-zinc-300 text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-200 border-b border-zinc-300 text-zinc-800 font-bold">
                      <th className="p-2 border-r border-zinc-300 text-center w-12">No</th>
                      <th className="p-2 border-r border-zinc-300">Transaksi / Deskripsi Barang</th>
                      <th className="p-2 border-r border-zinc-300 text-center w-24">Ukuran</th>
                      <th className="p-2 border-r border-zinc-300 text-center w-20">Qty</th>
                      <th className="p-2 border-r border-zinc-300 text-right w-36">Harga Satuan</th>
                      <th className="p-2 text-right w-40">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {detailItems.map((item: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-2 border-r border-zinc-200 text-center font-bold text-zinc-400">{idx + 1}</td>
                        <td className="p-2 border-r border-zinc-200 font-medium text-zinc-800">{item.transaksi}</td>
                        <td className="p-2 border-r border-zinc-200 text-center font-semibold">{item.ukuran || "-"}</td>
                        <td className="p-2 border-r border-zinc-200 text-center font-bold">{item.quantity}</td>
                        <td className="p-2 border-r border-zinc-200 text-right">Rp {Number(item.unit_price).toLocaleString("id-ID")}</td>
                        <td className="p-2 text-right font-bold bg-zinc-50/30">Rp {Number(item.total).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 border border-zinc-200 p-3 bg-zinc-50/50 rounded text-zinc-600">
                  <p className="font-bold text-zinc-800 uppercase">Alamat Pengantaran</p>
                  <p className="font-medium text-zinc-700 whitespace-pre-wrap">{detailPo.alamat_pengantaran}</p>
                  <p className="mt-2"><span className="font-bold text-zinc-800">UP Penerima:</span> {detailPo.penerima_nama}</p>
                </div>
                <div className="border border-zinc-300 rounded divide-y divide-zinc-200 text-sm overflow-hidden h-fit">
                  <div className="flex justify-between p-2 bg-zinc-50/30">
                    <span className="font-bold text-zinc-600">Sub Total</span>
                    <span className="font-semibold text-zinc-900">Rp {Number(detailPo.sub_total).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-zinc-50/30">
                    <span className="font-bold text-zinc-600">PPN 11%</span>
                    <span className="font-semibold text-zinc-900">Rp {Number(detailPo.ppn).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-zinc-900 text-white font-bold">
                    <span>TOTAL AKHIR</span>
                    <span className="text-blue-400">Rp {Number(detailPo.total_harga).toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setIsDetailModalOpen(false)} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded shadow">Tutup Lampiran</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT REMINDER TEMPO ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded shadow-xl border border-zinc-300 overflow-hidden">
            <div className="bg-zinc-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span>Atur Pengingat Pembayaran</span>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            
            <form onSubmit={handleSaveReminder} className="p-4 text-xs space-y-4">
              <div>
                <label className="block text-zinc-700 font-bold mb-1">Jumlah Hari Reminder Tempo</label>
                <select value={editTempoHari} onChange={(e) => setEditTempoHari(Number(e.target.value))} className="w-full border border-zinc-300 bg-white p-2 rounded text-zinc-800 font-semibold focus:outline-none cursor-pointer" >
                  <option value={0}>Cash Langsung (Hari H)</option>
                  <option value={7}>7 Hari Kalender</option>
                  <option value={14}>14 Hari Kalender</option>
                  <option value={30}>30 Hari (1 Bulan)</option>
                  <option value={45}>45 Hari Kerja</option>
                  <option value={60}>60 Hari (2 Bulan)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">Status Pembayaran Saat Ini</label>
                <select value={editStatusPembayaran} onChange={(e) => setEditStatusPembayaran(e.target.value)} className="w-full border border-zinc-300 bg-white p-2 rounded text-zinc-800 font-semibold focus:outline-none cursor-pointer" >
                  <option value="Belum Bayar">Belum Bayar</option>
                  <option value="SUDAH BAYAR">SUDAH BAYAR</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded font-semibold">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow disabled:bg-blue-400">
                  {loading ? "Menyimpan..." : "Update Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL INPUT FORM (BUAT PO BARU) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded shadow-xl border border-zinc-300 overflow-hidden my-auto">
            <div className="bg-zinc-900 text-white px-6 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Form Pembuatan Purchase Order</span>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitPO} className="p-6 text-xs space-y-6">
              <div className="border border-zinc-300 p-4 rounded bg-zinc-50/50 space-y-4">
                <div className="text-center border-b border-zinc-200 pb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">PURCHASE ORDER</h2>
                  <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="font-bold text-zinc-600">PO Number:</span>
                    <input type="text" required placeholder="Contoh: 001/PO-GA/PLI/VIII/2025" value={nomorPo} onChange={(e) => setNomorPo(e.target.value)} className="border border-zinc-300 px-2 py-0.5 rounded text-zinc-800 font-medium w-64 text-center placeholder-zinc-300" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1 text-zinc-600">
                    <p className="font-bold text-zinc-900 uppercase">Alamat Perusahaan</p>
                    <p className="font-medium text-zinc-800">PT Peduli Lestari Indonesia</p>
                    <p>NPWP : 0423 0271 5040 4000</p>
                    <p>Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008</p>
                    <p>Kedung Halang, Bogor Utara, Kota Bogor, Jawa Barat</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">PO Date:</span>
                      <input type="date" required value={tanggalPo} onChange={(e) => setTanggalPo(e.target.value)} className="border border-zinc-300 px-2 py-1 rounded w-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">Vendor:</span>
                      <input type="text" required placeholder="Masukkan Nama CV / PT Vendor" value={vendorNama} onChange={(e) => setVendorNama(e.target.value)} className="border border-zinc-300 px-2 py-1 rounded w-full font-bold placeholder-zinc-300" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">PIC Hub:</span>
                      <input type="text" placeholder="Contoh: Pak Dera - 0812xxxxxxxx" value={vendorPic} onChange={(e) => setVendorPic(e.target.value)} className="border border-zinc-300 px-2 py-1 rounded w-full placeholder-zinc-300" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-bold text-zinc-700">Email:</span>
                      <input type="email" placeholder="vendor@email.com" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className="border border-zinc-300 px-2 py-1 rounded w-full placeholder-zinc-300" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold uppercase tracking-wider text-zinc-700">Daftar Item Transaksi</span>
                  <button type="button" onClick={handleAddItemRow} className="bg-zinc-900 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-zinc-800 transition-colors">+ Tambah Baris</button>
                </div>
                
                <table className="w-full border border-zinc-300 text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-200 border-b border-zinc-300 text-zinc-800 font-bold">
                      <th className="p-2 border-r border-zinc-300 text-center w-12">No</th>
                      <th className="p-2 border-r border-zinc-300 w-1/3">Transaksi / Deskripsi Barang</th>
                      <th className="p-2 border-r border-zinc-300 text-center w-24">Ukuran</th>
                      <th className="p-2 border-r border-zinc-300 text-center w-20">Quantity</th>
                      <th className="p-2 border-r border-zinc-300 text-right w-36">Unit Price (Rp)</th>
                      <th className="p-2 border-r border-zinc-300 text-right w-40">Total</th>
                      <th className="p-2 text-center w-12">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-300">
                    {items.map((item, idx) => (
                      <tr key={idx} className="align-middle">
                        <td className="p-2 border-r border-zinc-300 text-center font-bold text-zinc-500">{idx + 1}</td>
                        <td className="p-1 border-r border-zinc-300">
                          <input type="text" required placeholder="Nama barang / jasa" value={item.transaksi} onChange={(e) => handleSomeChange(idx, "transaksi", e.target.value)} className="w-full bg-transparent px-1 py-0.5 focus:outline-none placeholder-zinc-300" />
                        </td>
                        <td className="p-1 border-r border-zinc-300">
                          <input type="text" placeholder="S/M/L/Pcs" value={item.ukuran} onChange={(e) => handleSomeChange(idx, "ukuran", e.target.value)} className="w-full text-center bg-transparent px-1 py-0.5 focus:outline-none placeholder-zinc-300" />
                        </td>
                        <td className="p-1 border-r border-zinc-300">
                          <input type="number" required min={1} value={item.quantity || ""} onChange={(e) => handleSomeChange(idx, "quantity", e.target.value)} className="w-full text-center bg-transparent px-1 py-0.5 focus:outline-none font-semibold" />
                        </td>
                        <td className="p-1 border-r border-zinc-300 text-right">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-zinc-400">Rp</span>
                            <input type="number" required min={0} value={item.unit_price || ""} onChange={(e) => handleSomeChange(idx, "unit_price", e.target.value)} className="w-28 text-right bg-transparent py-0.5 focus:outline-none font-semibold" />
                          </div>
                        </td>
                        <td className="p-2 border-r border-zinc-300 text-right font-semibold bg-zinc-50/50">Rp {item.total.toLocaleString("id-ID")}</td>
                        <td className="p-1 text-center">
                          <button type="button" onClick={() => handleRemoveItemRow(idx)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2 border border-zinc-200 p-3 bg-zinc-50 rounded">
                  <p className="font-bold text-zinc-800 uppercase tracking-wide">Alamat Pengantaran</p>
                  <textarea rows={2} required placeholder="Masukkan alamat lengkap tujuan pengiriman barang" value={alamatPengantaran} onChange={(e) => setAlamatPengantaran(e.target.value)} className="w-full border border-zinc-300 p-2 rounded text-zinc-700 bg-white resize-none placeholder-zinc-300" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-600">Penerima:</span>
                    <input type="text" required placeholder="Nama penanggung jawab penerima" value={penerimaNama} onChange={(e) => setPenerimaNama(e.target.value)} className="border border-zinc-300 px-2 py-0.5 rounded w-full bg-white placeholder-zinc-300" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-200 p-2 rounded shadow-sm">
                    <input type="checkbox" id="ppnToggle" checked={isPpnActive} onChange={(e) => setIsPpnActive(e.target.checked)} className="h-4 w-4 accent-blue-600 cursor-pointer rounded" />
                    <label htmlFor="ppnToggle" className="text-[11px] font-bold text-blue-900 uppercase tracking-wide cursor-pointer select-none">Gunakan Pungutan PPN Pajak (11%)</label>
                  </div>

                  <div className="border border-zinc-300 rounded divide-y divide-zinc-300 text-sm overflow-hidden h-fit">
                    <div className="flex justify-between p-2 bg-zinc-50/50">
                      <span className="font-bold text-zinc-600">Sub Total</span>
                      <span className="font-semibold text-zinc-900">Rp {subTotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-zinc-50/50 items-center">
                      <span className="font-bold text-zinc-600">PPN 11%</span>
                      <span className={`font-semibold ${isPpnActive ? "text-zinc-900" : "text-zinc-400 line-through"}`}>Rp {ppn.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-zinc-900 text-white font-bold">
                      <span>TOTAL</span>
                      <span className="text-blue-400">Rp {totalHarga.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded hover:bg-zinc-100 font-semibold">Batal</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors disabled:bg-blue-400">
                  {loading ? "Menyimpan Dokumen..." : "Simpan & Rekap PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}