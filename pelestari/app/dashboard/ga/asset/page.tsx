"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, FileSpreadsheet, ClipboardList, Trash2 } from "lucide-react";
import { getAssetsAction, createAssetAction, deleteAssetAction } from "@/app/actions/asset";
import { exportAssetToExcelGA } from "@/app/utils/assetExport";

export default function GaAssetPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [namaAsset, setNamaAsset] = useState("");
  const [kodeAsset, setKodeAsset] = useState("");
  const [bulanPerolehan, setBulanPerolehan] = useState("Januari");
  const [tahunPerolehan, setTahunPerolehan] = useState<number | "">("");
  const [hargaBeli, setHargaBeli] = useState("");
  const [caraPerolehan, setCaraPerolehan] = useState("cash");
  const [jumlah, setJumlah] = useState(1);
  const [keterangan, setKeterangan] = useState("");
  const [kondisi, setKondisi] = useState("Baik");

  useEffect(() => {
    fetchAssets();
    setTahunPerolehan(new Date().getFullYear());
  }, []);

  const fetchAssets = async () => {
    const res = await getAssetsAction(false);
    if (res.success) setAssets(res.data);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { nama_asset: namaAsset, kode_asset: kodeAsset, bulan_perolehan: bulanPerolehan, tahun_perolehan: Number(tahunPerolehan), harga_beli: hargaBeli, cara_perolehan: caraPerolehan, jumlah: jumlah, keterangan: keterangan, kondisi: kondisi };
    const res = await createAssetAction(payload);
    if (res.success) {
      setIsModalOpen(false);
      setNamaAsset(""); setKodeAsset(""); setHargaBeli(""); setJumlah(1); setKeterangan("");
      fetchAssets();
    } else {
      alert(res.message);
    }
    setLoading(false);
  };

  // FUNGSI UTAMA HAPUS DATA DENGAN KONFIRMASI
  const handleDeleteAsset = async (id_asset: number, nama_asset: string) => {
    const konfirmasi = window.confirm(`Apakah Anda yakin ingin menghapus aset "${nama_asset}"? Data di menu Finance juga akan ikut terhapus.`);
    if (!konfirmasi) return;

    const res = await deleteAssetAction(id_asset);
    if (res.success) {
      fetchAssets(); // Reload data tabel secara sinkron
    } else {
      alert("Gagal menghapus aset: " + res.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-xs">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 uppercase">General Affairs: Registrasi Inventaris</h1>
          <p className="text-zinc-500 text-[11px]">Input data master aset logistik kantor PT Peduli Lestari Indonesia</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportAssetToExcelGA(assets)} className="bg-emerald-600 text-white px-3 py-2 font-bold rounded shadow flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Cetak Excel GA</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 font-bold rounded shadow flex items-center gap-1"><Plus className="h-4 w-4" /> Tambah Aset Baru</button>
        </div>
      </div>

      <div className="bg-white border rounded overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-100 font-bold uppercase border-b text-zinc-800">
            <tr>
              <th className="p-3 text-center w-12">No</th>
              <th>Nama Asset</th>
              <th className="p-3 text-center">Kode</th>
              <th className="p-3 text-center">Bulan / Tahun</th>
              <th className="p-3 text-right">Harga Beli</th>
              <th className="p-3 text-center">Perolehan</th>
              <th className="p-3 text-center">Jumlah</th>
              <th>Keterangan</th>
              <th className="p-3 text-center">Kondisi</th>
              <th className="p-3 text-center w-16">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {assets.map((asset, index) => (
              <tr key={asset.id_asset} className="hover:bg-zinc-50 align-middle">
                <td className="p-3 text-center font-bold text-zinc-400">{index + 1}</td>
                <td className="p-3 font-semibold text-zinc-900">{asset.nama_asset}</td>
                <td className="p-3 text-center font-mono font-medium">{asset.kode_asset || "-"}</td>
                <td className="p-3 text-center">{asset.bulan_perolehan} {asset.tahun_perolehan}</td>
                <td className="p-3 text-right font-bold text-zinc-900">Rp {Number(asset.harga_beli).toLocaleString("id-ID")}</td>
                <td className="p-3 text-center uppercase"><span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100">{asset.cara_perolehan}</span></td>
                <td className="p-3 text-center font-bold">{asset.jumlah}</td>
                <td className="p-3 text-zinc-600 font-medium">{asset.keterangan || "-"}</td>
                <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-black bg-green-50 text-green-700 border">{asset.kondisi}</span></td>
                
                {/* TOMBOL AKSI TRASH CAN */}
                <td className="p-3 text-center">
                  <button 
                    onClick={() => handleDeleteAsset(asset.id_asset, asset.nama_asset)}
                    className="p-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    title="Hapus Data Aset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DIALOG MODAL GA INPUT FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow-xl overflow-hidden">
            <div className="bg-zinc-900 text-white px-5 py-3 flex justify-between items-center font-bold uppercase">
              <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-blue-400" /> Form Registrasi Aset</span>
              <button type="button" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSaveAsset} className="p-5 space-y-4">
              <div><label className="block font-bold text-zinc-700 mb-1">Nama Aset / Barang *</label><input type="text" required placeholder="Contoh: CCTV rumah ibu maya" value={namaAsset} onChange={(e) => setNamaAsset(e.target.value)} className="w-full border p-2 rounded" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-zinc-700 mb-1">Kode Barang</label><input type="text" placeholder="Contoh: LK.01" value={kodeAsset} onChange={(e) => setKodeAsset(e.target.value)} className="w-full border p-2 rounded" /></div>
                <div><label className="block font-bold text-zinc-700 mb-1">Jumlah Unit *</label><input type="number" required min={1} value={jumlah} onChange={(e) => setJumlah(Number(e.target.value))} className="w-full border p-2 rounded text-center" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-zinc-700 mb-1">Bulan Perolehan</label><select value={bulanPerolehan} onChange={(e) => setBulanPerolehan(e.target.value)} className="w-full border p-2 bg-white rounded cursor-pointer">{["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m) => (<option key={m} value={m}>{m}</option>))}</select></div>
                <div><label className="block font-bold text-zinc-700 mb-1">Tahun Perolehan *</label><input type="number" required value={tahunPerolehan} onChange={(e) => setTahunPerolehan(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border p-2 rounded text-center" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-zinc-700 mb-1">Harga Beli Total (Rp) *</label><input type="number" required placeholder="Nominal" value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} className="w-full border p-2 rounded text-right font-semibold" /></div>
                <div><label className="block font-bold text-zinc-700 mb-1">Cara Perolehan</label><select value={caraPerolehan} onChange={(e) => setCaraPerolehan(e.target.value)} className="w-full border p-2 bg-white rounded cursor-pointer font-bold"><option value="cash">CASH</option><option value="Kredit">KREDIT</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-zinc-700 mb-1">Kondisi Awal</label><input type="text" required value={kondisi} onChange={(e) => setKondisi(e.target.value)} className="w-full border p-2 rounded" /></div>
                <div><label className="block font-bold text-zinc-700 mb-1">Keterangan Catatan / Lokasi</label><input type="text" placeholder="Contoh: R.Arsip / Di rumah ibu maya" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="w-full border p-2 rounded" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded font-semibold text-zinc-600">Batal</button><button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white font-bold rounded shadow">{loading ? "Menyimpan..." : "Simpan Berkas"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}