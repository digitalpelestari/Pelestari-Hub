"use client";

import React, { useState, useEffect } from "react";
import { Eye, FileText, X, Download, Printer, CalendarClock, CheckCircle, AlertCircle } from "lucide-react";

// Import Server Actions murni
import { getPurchaseOrdersAction, getPoItemsAction } from "@/app/actions/po";
import { exportToExcel, exportToPdf, exportSinglePoToExcel, exportSinglePoToPdf } from "@/app/utils/poExport";
import { swal } from "@/lib/sweetalert"

interface POItem {
  transaksi: string;
  ukuran: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export default function FinancePoTrackingPage() {
  const [poList, setPoList] = useState<any[]>([]);

  // === STATE MODAL DETAIL READ-ONLY ===
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailPo, setDetailPo] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<POItem[]>([]);

  useEffect(() => {
    fetchPO();
  }, []);

  const fetchPO = async () => {
    const res = await getPurchaseOrdersAction();
    if (res.success) {
      setPoList(res.data);
    }
  };

  const handleOpenDetailModal = async (po: any) => {
    setDetailPo(po);
    const res = await getPoItemsAction(po.id_po);
    if (res.success) {
      setDetailItems(res.data);
      setIsDetailModalOpen(true);
    } else {
      swal.error("Gagal memuat rincian item barang.")
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-xs">
      
      {/* HEADER MONITORING FINANCE */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight uppercase">FINANCE: MONITORING PURCHASE ORDER</h1>
          <p className="text-zinc-500 text-[11px]">Halaman khusus tracking data jatuh tempo dan rincian berkas pengadaan barang divisi HRGA</p>
        </div>
        
        {/* Fitur Export Masal Daftar PO */}
        <div className="flex items-center gap-2">
          <button onClick={() => exportToExcel(poList)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 font-bold rounded shadow flex items-center gap-1 uppercase tracking-wider">
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button onClick={() => exportToPdf(poList)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 font-bold rounded shadow flex items-center gap-1 uppercase tracking-wider">
            <Printer className="h-3.5 w-3.5" /> Cetak PDF Laporan
          </button>
        </div>
      </div>

      {/* TABEL DATA REKAP UTAMA (PURE TRACKING) */}
      <div className="bg-white border border-zinc-200 rounded overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-700 font-bold uppercase text-white">
              <th className="p-3 w-40">No PO / Tanggal</th>
              <th className="p-3">Nama Vendor Target</th>
              <th className="p-3 text-right w-44">Total Tagihan</th>
              <th className="p-3 text-center w-36">Status Bayar</th>
              <th className="p-3 text-center w-44">Sisa Waktu Tempo</th>
              <th className="p-3 text-center w-24">Lihat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {poList.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-400 font-medium">Belum ada lampiran berkas PO masuk dari divisi GA.</td></tr>
            ) : (
              poList.map((po) => (
                <tr key={po.id_po} className="hover:bg-zinc-50 align-middle">
                  <td className="p-3 font-semibold">
                    <span className="text-blue-600 block">{po.nomor_po}</span>
                    <span className="text-zinc-400 font-normal">{new Date(po.tanggal_po).toLocaleDateString("id-ID")}</span>
                  </td>
                  <td className="p-3 font-medium text-zinc-800">{po.vendor_nama}</td>
                  <td className="p-3 text-right font-black text-zinc-900">
                    Rp {Number(po.total_harga).toLocaleString("id-ID")}
                  </td>
                  
                  {/* BADGE STATUS */}
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
                      po.status_pembayaran === "SUDAH BAYAR" 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {po.status_pembayaran}
                    </span>
                  </td>

                  {/* LIVE COUNTDOWN TEMPO */}
                  <td className="p-3 text-center">
                    {po.status_pembayaran === "SUDAH BAYAR" ? (
                      <span className="text-green-600 font-medium flex items-center justify-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Pembayaran Lunas</span>
                    ) : po.tempo_hari === 0 ? (
                      <span className="text-zinc-400 italic">Belum di-set tempo oleh GA</span>
                    ) : po.sisa_hari < 0 ? (
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> OVERDUE {Math.abs(po.sisa_hari)} Hari</span>
                    ) : po.sisa_hari === 0 ? (
                      <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border inline-flex items-center gap-1">Hari Ini Jatuh Tempo!</span>
                    ) : (
                      <span className="text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-zinc-500" /> {po.sisa_hari} Hari Lagi</span>
                    )}
                  </td>

                  {/* AKSI UNTUK MELIHAT DOKUMEN SATUAN */}
                  <td className="p-3 text-center">
                    <button onClick={() => handleOpenDetailModal(po)} className="p-1.5 border border-zinc-300 rounded text-zinc-700 hover:bg-zinc-100 mx-auto block" title="Periksa Item Invoice">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MODAL DETAIL PO: LENGKAP DENGAN TOMBOL PRINT NOTA INDIVIDU ================= */}
      {isDetailModalOpen && detailPo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded border shadow-xl overflow-hidden my-auto">
            
            <div className="bg-zinc-900 text-white px-6 py-3 flex justify-between items-center font-bold uppercase">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> Rincian Purchase Order Berkas Pengadaan</span>
              <div className="flex gap-2 ml-auto mr-4">
                <button onClick={async () => await exportSinglePoToExcel(detailPo, detailItems)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded font-bold">Cetak Excel</button>
                <button onClick={async () => await exportSinglePoToPdf(detailPo, detailItems)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-bold">Cetak PDF</button>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)}><X className="h-4 w-4 text-zinc-400 hover:text-white" /></button>
            </div>

            <div className="p-6 space-y-6 bg-white select-none">
              <div className="border border-zinc-200 p-4 rounded bg-zinc-50/40 text-center">
                <h2 className="text-sm font-black text-zinc-900 tracking-wider">PURCHASE ORDER</h2>
                <p className="font-bold text-zinc-600 mt-0.5">No Dokumen: <span className="text-blue-600 font-black">{detailPo.nomor_po}</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-zinc-100 pb-4">
                <div className="space-y-1 text-zinc-600">
                  <p className="font-bold text-zinc-900 uppercase">Perusahaan Pemesan (Pihak 1)</p>
                  <p className="font-bold text-zinc-800">PT Peduli Lestari Indonesia</p>
                  <p>NPWP: 0423 0271 5040 4000</p>
                  <p>Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008 Kedung Halang, Bogor</p>
                </div>
                <div className="space-y-1 text-zinc-600">
                  <p className="font-bold text-zinc-900 uppercase">Vendor Supplier (Pihak 2)</p>
                  <p className="font-black text-zinc-800">{detailPo.vendor_nama}</p>
                  <p><span className="font-semibold">PIC Kontak :</span> {detailPo.vendor_pic || "-"}</p>
                  <p><span className="font-semibold">Email :</span> {detailPo.vendor_email || "-"}</p>
                  <p><span className="font-semibold">Tanggal Berkas :</span> {new Date(detailPo.tanggal_po).toLocaleDateString("id-ID")}</p>
                </div>
              </div>

              <table className="w-full border border-zinc-300 text-left">
                <thead>
                  <tr className="bg-zinc-200 border-b border-zinc-300 font-bold text-zinc-800">
                    <th className="p-2 border-r border-zinc-300 w-12 text-center">No</th>
                    <th className="p-2 border-r border-zinc-300">Deskripsi Transaksi Barang / Jasa</th>
                    <th className="p-2 border-r border-zinc-300 text-center w-20">Ukuran</th>
                    <th className="p-2 border-r border-zinc-300 text-center w-16">Qty</th>
                    <th className="p-2 border-r border-zinc-300 text-right w-32">Harga Satuan</th>
                    <th className="p-2 text-right w-36">Total Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {detailItems.map((item: any, i) => (
                    <tr key={i} className="bg-white">
                      <td className="p-2 border-r border-zinc-200 text-center font-bold text-zinc-400">{i + 1}</td>
                      <td className="p-2 border-r border-zinc-200 font-medium text-zinc-800">{item.transaksi}</td>
                      <td className="p-2 border-r border-zinc-200 text-center font-semibold">{item.ukuran || "-"}</td>
                      <td className="p-2 border-r border-zinc-200 text-center font-bold">{item.quantity}</td>
                      <td className="p-2 border-r border-zinc-200 text-right">Rp {Number(item.unit_price).toLocaleString("id-ID")}</td>
                      <td className="p-2 text-right font-black bg-zinc-50/20">Rp {Number(item.total).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="border border-zinc-200 p-3 bg-zinc-50/50 rounded w-full md:w-1/2 text-zinc-600">
                  <p className="font-bold text-zinc-800 uppercase tracking-wide">Tujuan Lokasi Pengantaran</p>
                  <p className="font-medium text-zinc-700 mt-1 whitespace-pre-wrap">{detailPo.alamat_pengantaran}</p>
                  <p className="mt-2"><span className="font-bold text-zinc-800">UP Penanggung Jawab:</span> {detailPo.penerima_nama}</p>
                </div>
                
                <div className="border border-zinc-300 rounded divide-y divide-zinc-200 text-right w-full md:w-1/3 overflow-hidden">
                  <div className="p-2 flex justify-between bg-zinc-50/20"><span>Sub Total Tagihan:</span><span className="font-bold text-zinc-900">Rp {Number(detailPo.sub_total).toLocaleString("id-ID")}</span></div>
                  <div className="p-2 flex justify-between bg-zinc-50/20"><span>Pajak PPN 11%:</span><span className="font-bold text-zinc-900">Rp {Number(detailPo.ppn).toLocaleString("id-ID")}</span></div>
                  <div className="p-2 flex justify-between bg-zinc-900 text-white font-black text-sm"><span>GRAND TOTAL:</span><span className="text-blue-400">Rp {Number(detailPo.total_harga).toLocaleString("id-ID")}</span></div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setIsDetailModalOpen(false)} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded shadow">Tutup Lampiran</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}