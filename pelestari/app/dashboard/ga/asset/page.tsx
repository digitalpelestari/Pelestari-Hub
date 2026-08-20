"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, FileSpreadsheet, ClipboardList, Trash2, Search, Filter } from "lucide-react";
// IMPORT DIPERBARUI: Menambahkan updateAssetKondisiAction dari Server Action Backend
import { getAssetsAction, createAssetAction, deleteAssetAction, updateAssetKondisiAction } from "@/app/actions/asset";
import { exportAssetToExcelGA } from "@/app/utils/assetExport";
import { swal } from "@/lib/sweetalert"

export default function GaAssetPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null); // State loading inline per baris

  // === STATE FILTER & SEARCHING ===
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenis, setFilterJenis] = useState("Semua");

  // === STATE FORM INPUT ===
  const [namaAsset, setNamaAsset] = useState("");
  const [kodeAsset, setKodeAsset] = useState("");
  const [jenisAsset, setJenisAsset] = useState("Aset Tetap");
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

  // === LOGIC FILTER & SEARCHING DATA ASET ===
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = 
      asset.nama_asset?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.kode_asset?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filterJenis === "Semua" || 
      asset.jenis_asset === filterJenis;

    return matchesSearch && matchesFilter;
  });

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = { 
      nama_asset: namaAsset, 
      kode_asset: kodeAsset, 
      jenis_asset: jenisAsset,
      bulan_perolehan: bulanPerolehan, 
      tahun_perolehan: Number(tahunPerolehan), 
      harga_beli: hargaBeli, 
      cara_perolehan: caraPerolehan, 
      jumlah: jumlah, 
      keterangan: keterangan, 
      kondisi: kondisi 
    };
    
    const res = await createAssetAction(payload);
    if (res.success) {
      swal.success("Aset berhasil ditambahkan")
      setIsModalOpen(false);
      setNamaAsset(""); 
      setKodeAsset(""); 
      setJenisAsset("Aset Tetap");
      setHargaBeli(""); 
      setJumlah(1); 
      setKeterangan("");
      setKondisi("Baik");
      fetchAssets();
    } else {
      swal.error(res.message);
    }
    setLoading(false);
  };

  // === FUNGSI INLINE EDIT KONDISI BARANG (SUDAH AKTIF KE DATABASE) ===
  const handleInlineChangeKondisi = async (id_asset: number, kondisiBaru: string) => {
    setUpdatingId(id_asset);
    
    // Optimistic Update UI (Biar kerasa instan di mata user sebelum network selesai)
    const originalAssets = [...assets];
    setAssets(assets.map(a => a.id_asset === id_asset ? { ...a, kondisi: kondisiBaru } : a));

    try {
      // Menjalankan fungsi server action untuk update kondisi ke MySQL
      const res = await updateAssetKondisiAction(id_asset, kondisiBaru);
      
      if (!res.success) {
        throw new Error(res.message);
      }
      
      // Sinkronisasi ulang data agar selaras dengan database terbaru
      fetchAssets();
    } catch (error: any) {
      swal.error("Gagal memperbarui kondisi ke database: " + error.message);
      setAssets(originalAssets); // Kembalikan ke kondisi asal jika query gagal/error
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAsset = async (id_asset: number, nama_asset: string) => {
    const konfirmasi = await swal.confirm(`Apakah Anda yakin ingin menghapus aset "${nama_asset}"? Data di menu Finance juga akan ikut terhapus.`)
    if (!konfirmasi) return;

    const res = await deleteAssetAction(id_asset);
    if (res.success) {
      swal.success("Aset berhasil dihapus")
      fetchAssets();
    } else {
      swal.error("Gagal menghapus aset: " + res.message);
    }
  };

  const getKondisiSelectStyle = (statusKondisi: string) => {
    switch (statusKondisi) {
      case "Baik":
        return "text-green-700 font-bold bg-green-50 border-green-200";
      case "Rusak":
        return "text-red-700 font-bold bg-red-50 border-red-200";
      case "Perlu Perbaikan":
        return "text-amber-700 font-bold bg-amber-50 border-amber-200";
      case "Tidak Layak Pakai":
        return "text-zinc-700 font-bold bg-zinc-100 border-zinc-300";
      default:
        return "text-zinc-600 bg-zinc-50 border-zinc-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-xs">
      {/* HEADER UTAMA */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 uppercase">General Affairs: Registrasi Inventaris</h1>
          <p className="text-zinc-500 text-[11px]">Input data master aset logistik kantor PT Peduli Lestari Indonesia</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportAssetToExcelGA(filteredAssets)} className="bg-emerald-600 text-white px-3 py-2 font-bold rounded shadow flex items-center gap-1 whitespace-nowrap"><FileSpreadsheet className="h-3.5 w-3.5" /> Cetak Excel GA</button>
          <button onClick={() => { setKondisi("Baik"); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 font-bold rounded shadow flex items-center gap-1 whitespace-nowrap"><Plus className="h-4 w-4" /> Tambah Aset Baru</button>
        </div>
      </div>

      {/* PANEL CONTROL: SEARCHING & FILTERING */}
      <div className="bg-zinc-50 border border-zinc-200 p-3 rounded mb-6 flex flex-col md:flex-row gap-3 items-center shadow-sm">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari nama barang atau kode aset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-zinc-300 rounded bg-white text-zinc-800 focus:outline-zinc-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-zinc-500 font-bold uppercase flex items-center gap-1 whitespace-nowrap text-[10px]">
            <Filter className="h-3 w-3 text-zinc-400" /> Klasifikasi:
          </span>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="border border-zinc-300 p-2 rounded bg-white font-semibold text-zinc-800 focus:outline-none cursor-pointer w-full md:w-44"
          >
            <option value="Semua">Semua Aset</option>
            <option value="Aset Tetap">Aset Tetap</option>
            <option value="Aset Non-Tetap">Aset Non-Tetap</option>
          </select>
        </div>

        <div className="md:ml-auto text-zinc-500 font-medium text-[11px] whitespace-nowrap">
          Menampilkan <span className="font-bold text-zinc-800">{filteredAssets.length}</span> dari {assets.length} total aset
        </div>
      </div>

      {/* TABEL MASTER DATA ASET */}
      <div className="bg-white border rounded overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-100 font-bold uppercase border-b text-zinc-800">
            <tr>
              <th className="p-3 text-center w-12">No</th>
              <th>Nama Asset</th>
              <th className="p-3 text-center">Kode</th>
              <th className="p-3 text-center">Jenis Aset</th>
              <th className="p-3 text-center">Bulan / Tahun</th>
              <th className="p-3 text-right">Harga Beli</th>
              <th className="p-3 text-center">Perolehan</th>
              <th className="p-3 text-center">Jumlah</th>
              <th>Keterangan</th>
              <th className="p-3 text-center w-36">Kondisi (Bisa Edit)</th>
              <th className="p-3 text-center w-16">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-zinc-400 font-medium">
                  {assets.length === 0 ? "Belum ada data inventaris aset yang terdaftar." : "Tidak ada data aset yang cocok dengan kriteria pencarian/filter."}
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset, index) => (
                <tr key={asset.id_asset} className="hover:bg-zinc-50 align-middle">
                  <td className="p-3 text-center font-bold text-zinc-400">{index + 1}</td>
                  <td className="p-3 font-semibold text-zinc-900">{asset.nama_asset}</td>
                  <td className="p-3 text-center font-mono font-medium">{asset.kode_asset || "-"}</td>
                  
                  <td className="p-3 text-center font-medium">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      asset.jenis_asset === "Aset Tetap" 
                        ? "bg-blue-50 text-blue-700 border border-blue-200" 
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}>
                      {asset.jenis_asset || "Aset Tetap"}
                    </span>
                  </td>

                  <td className="p-3 text-center">{asset.bulan_perolehan} {asset.tahun_perolehan}</td>
                  <td className="p-3 text-right font-bold text-zinc-900">Rp {Number(asset.harga_beli).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-center uppercase"><span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100">{asset.cara_perolehan}</span></td>
                  <td className="p-3 text-center font-bold">{asset.jumlah}</td>
                  <td className="p-3 text-zinc-600 font-medium">{asset.keterangan || "-"}</td>
                  
                  {/* EDITABLE SELECT DROPDOWN (SUDAH TERHUBUNG BE ACTION) */}
                  <td className="p-2 text-center">
                    <select
                      value={asset.kondisi || "Baik"}
                      disabled={updatingId === asset.id_asset}
                      onChange={(e) => handleInlineChangeKondisi(asset.id_asset, e.target.value)}
                      className={`w-full p-1 rounded text-[10px] border transition-all cursor-pointer focus:outline-none text-center ${getKondisiSelectStyle(asset.kondisi)}`}
                    >
                      <option value="Baik" className="text-green-700 bg-white font-medium">Baik</option>
                      <option value="Perlu Perbaikan" className="text-amber-700 bg-white font-medium">Perlu Perbaikan</option>
                      <option value="Rusak" className="text-red-700 bg-white font-medium">Rusak</option>
                      <option value="Tidak Layak Pakai" className="text-zinc-700 bg-white font-medium">Tidak Layak Pakai</option>
                    </select>
                  </td>
                  
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
              ))
            )}
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
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Aset / Barang *</label>
                <input type="text" required placeholder="Contioh: CCTV rumah ibu maya" value={namaAsset} onChange={(e) => setNamaAsset(e.target.value)} className="w-full border p-2 rounded" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Kode Aset</label>
                  <input type="text" placeholder="Contoh: LK.01" value={kodeAsset} onChange={(e) => setKodeAsset(e.target.value)} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Jenis Klasifikasi Aset *</label>
                  <select 
                    value={jenisAsset} 
                    onChange={(e) => setJenisAsset(e.target.value)} 
                    className="w-full border p-2 bg-white rounded cursor-pointer font-semibold focus:outline-zinc-400"
                  >
                    <option value="Aset Tetap">Aset Tetap</option>
                    <option value="Aset Non-Tetap">Aset Non-Tetap</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Bulan Perolehan</label>
                  <select value={bulanPerolehan} onChange={(e) => setBulanPerolehan(e.target.value)} className="w-full border p-2 bg-white rounded cursor-pointer">{["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m) => (<option key={m} value={m}>{m}</option>))}</select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tahun Perolehan *</label>
                  <input type="number" required value={tahunPerolehan} onChange={(e) => setTahunPerolehan(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border p-2 rounded text-center" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-zinc-700 mb-1">Harga Beli Total (Rp) *</label>
                  <input type="number" required placeholder="Nominal" value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} className="w-full border p-2 rounded text-right font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Jumlah Unit *</label>
                  <input type="number" required min={1} value={jumlah} onChange={(e) => setJumlah(Number(e.target.value))} className="w-full border p-2 rounded text-center" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Cara Perolehan</label>
                  <select value={caraPerolehan} onChange={(e) => setCaraPerolehan(e.target.value)} className="w-full border p-2 bg-white rounded cursor-pointer font-bold"><option value="cash">CASH</option><option value="Kredit">KREDIT</option></select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Kondisi Barang *</label>
                  <select 
                    value={kondisi} 
                    onChange={(e) => setKondisi(e.target.value)} 
                    className="w-full border p-2 bg-white rounded cursor-pointer font-semibold focus:outline-zinc-400"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Tidak Layak Pakai">Tidak Layak Pakai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Keterangan Catatan / Lokasi</label>
                <input type="text" placeholder="Contoh: R.Arsip / Di rumah ibu maya" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="w-full border p-2 rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded font-semibold text-zinc-600">Batal</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white font-bold rounded shadow">{loading ? "Menyimpan..." : "Simpan Berkas"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}