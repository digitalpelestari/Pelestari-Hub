"use client";

import React, { useState, useEffect } from "react";
import { FileSpreadsheet, TrendingDown, RefreshCw } from "lucide-react";
import { getAssetsAction } from "@/app/actions/asset";
import { exportAssetToExcelFinance } from "@/app/utils/assetExport";

export default function FinanceAssetTrackingPage() {
  const [financeAssets, setFinanceAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setLoading(true);
    const res = await getAssetsAction(true); 
    if (res.success) {
      setFinanceAssets(res.data);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-xs">
      
      {/* HEADER PAGE */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight uppercase flex items-center gap-1.5">
            <TrendingDown className="h-5 w-5 text-blue-600" /> Finance: Laporan Penyusutan & Pajak Aset
          </h1>
          <p className="text-zinc-500 text-[11px]">
            Monitoring data amortisasi komersial & fiskal menggunakan Metode Garis Lurus terpusat database (Buku Berjalan 2026)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchFinanceData} 
            disabled={loading}
            className="p-2 border border-zinc-300 rounded text-zinc-600 hover:bg-zinc-100 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={() => exportAssetToExcelFinance(financeAssets)} 
            className="bg-blue-900 hover:bg-zinc-800 text-white px-3 py-2 font-bold rounded shadow flex items-center gap-1.5 uppercase tracking-wider transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400" /> Cetak Excel Pajak
          </button>
        </div>
      </div>

      {/* TABEL VIEW STRUKTUR SEL KOMPLIT DENGAN METODE GARIS LURUS */}
      <div className="bg-white border border-zinc-300 rounded overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            {/* Header Tingkat 1: Pengelompokan Kategori */}
            <tr className="bg-zinc-800 text-white font-bold text-[10px] uppercase border-b border-zinc-700">
              <th colSpan={3} className="p-2.5 text-center border-r border-zinc-700">Informasi Aset</th>
              <th className="p-2.5 text-right border-r border-zinc-700">Nilai Perolehan</th>
              <th colSpan={4} className="p-2.5 text-center bg-blue-950 border-r border-zinc-700">Akuntansi Komersial (Garis Lurus)</th>
              <th colSpan={4} className="p-2.5 text-center bg-purple-950 border-r border-zinc-700">Fiskal Pajak UU (Garis Lurus)</th>
              <th className="p-2.5 text-center bg-zinc-900 text-yellow-400">Nilai Buku</th>
            </tr>
            {/* Header Tingkat 2: Detail Nama Kolom Sel */}
            <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-800 font-bold text-[10px] uppercase">
              <th className="p-2 text-center border-r border-zinc-300 w-10">No</th>
              <th className="p-2 border-r border-zinc-300">Nama Barang / Inventaris</th>
              <th className="p-2 text-center border-r border-zinc-300 w-24">Kode Aset</th>
              <th className="p-2 text-right border-r border-zinc-300 w-32">Harga Beli</th>
              
              {/* Komersial */}
              <th className="p-2 text-center border-r border-zinc-300 w-12">Kelompok</th>
              <th className="p-2 text-center border-r border-zinc-300 w-14">Tarif</th>
              <th className="p-2 text-right border-r border-zinc-300 w-28">Penyusutan /Th</th>
              <th className="p-2 text-right border-r border-zinc-300 w-28">Prorata Berjalan</th>
              
              {/* Fiskal */}
              <th className="p-2 text-center border-r border-zinc-300 w-12">Kelompok</th>
              <th className="p-2 text-center border-r border-zinc-300 w-14">Tarif</th>
              <th className="p-2 text-right border-r border-zinc-300 w-28">Penyusutan /Th</th>
              <th className="p-2 text-right border-r border-zinc-300 w-28">Prorata Berjalan</th>
              
              {/* Sisa Nilai Buku */}
              <th className="p-2 text-right text-zinc-900 bg-yellow-50/50">Sisa Nilai Buku</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-zinc-200 text-[11px]">
            {financeAssets.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-8 text-center text-zinc-400 font-medium">
                  Belum ada data registrasi aset dari GA yang masuk ke database.
                </td>
              </tr>
            ) : (
              financeAssets.map((asset, index) => (
                <tr key={asset.id_asset} className="hover:bg-zinc-50/80 align-middle">
                  <td className="p-2 text-center font-bold text-zinc-400 border-r border-zinc-200">{index + 1}</td>
                  <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{asset.nama_asset}</td>
                  <td className="p-2 text-center font-mono text-zinc-600 border-r border-zinc-200">{asset.kode_asset || "-"}</td>
                  <td className="p-2 text-right font-semibold text-zinc-900 border-r border-zinc-200">
                    Rp {Number(asset.harga_beli).toLocaleString("id-ID")}
                  </td>
                  
                  {/* METODE GARIS LURUS: KOMERSIAL */}
                  <td className="p-2 text-center text-blue-700 font-bold border-r border-zinc-200 bg-blue-50/5">
                    {asset.kelompok_komersial}
                  </td>
                  <td className="p-2 text-center text-zinc-500 border-r border-zinc-200 bg-blue-50/5">
                    {asset.tarif_komersial_persen}
                  </td>
                  <td className="p-2 text-right text-zinc-700 border-r border-zinc-200">
                    Rp {Number(asset.penyusutan_komersial).toLocaleString("id-ID")}
                  </td>
                  <td className="p-2 text-right text-blue-800 font-semibold border-r border-zinc-200 bg-blue-50/5">
                    Rp {Number(asset.prorata_komersial).toLocaleString("id-ID")}
                  </td>
                  
                  {/* METODE GARIS LURUS: FISKAL PAJAK */}
                  <td className="p-2 text-center text-purple-700 font-bold border-r border-zinc-200 bg-purple-50/5">
                    {asset.kelompok_fiskal}
                  </td>
                  <td className="p-2 text-center text-zinc-500 border-r border-zinc-200 bg-purple-50/5">
                    {asset.tarif_fiskal_persen}
                  </td>
                  <td className="p-2 text-right text-zinc-700 border-r border-zinc-200">
                    Rp {Number(asset.penyusutan_fiskal).toLocaleString("id-ID")}
                  </td>
                  <td className="p-2 text-right text-purple-800 font-semibold border-r border-zinc-200 bg-purple-50/5">
                    Rp {Number(asset.prorata_fiskal).toLocaleString("id-ID")}
                  </td>
                  
                  {/* SISA NILAI BUKU KUNING */}
                  <td className="p-2 text-right font-black bg-yellow-50 text-zinc-900">
                    Rp {Number(asset.sisa_nilai_buku).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))
            )}

            {/* GRAND TOTAL KAKI TABEL */}
            {financeAssets.length > 0 && (
              <tr className="bg-zinc-100 font-black border-t-2 border-zinc-400 text-zinc-950 align-middle text-[11px]">
                <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider border-r border-zinc-200">
                  Grand Total :
                </td>
                <td className="p-2.5 text-right border-r border-zinc-200 text-zinc-900">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.harga_beli), 0).toLocaleString("id-ID")}
                </td>
                
                {/* Grand Total Komersial */}
                <td colSpan={2} className="border-r border-zinc-200 bg-zinc-50"></td>
                <td className="p-2.5 text-right border-r border-zinc-200 text-zinc-700">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.penyusutan_komersial), 0).toLocaleString("id-ID")}
                </td>
                <td className="p-2.5 text-right border-r border-zinc-200 text-blue-900 bg-blue-50/10">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.prorata_komersial), 0).toLocaleString("id-ID")}
                </td>
                
                {/* Grand Total Fiskal */}
                <td colSpan={2} className="border-r border-zinc-200 bg-zinc-50"></td>
                <td className="p-2.5 text-right border-r border-zinc-200 text-zinc-700">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.penyusutan_fiskal), 0).toLocaleString("id-ID")}
                </td>
                <td className="p-2.5 text-right border-r border-zinc-200 text-purple-900 bg-purple-50/10">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.prorata_fiskal), 0).toLocaleString("id-ID")}
                </td>
                
                {/* Grand Total Sisa Buku */}
                <td className="p-2.5 text-right bg-yellow-100 text-zinc-950 font-black">
                  Rp {financeAssets.reduce((sum, a) => sum + Number(a.sisa_nilai_buku), 0).toLocaleString("id-ID")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}