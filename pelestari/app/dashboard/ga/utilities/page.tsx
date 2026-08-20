"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, Trash2, ClipboardList, Activity, BarChart3, Filter } from "lucide-react";
import { getUtilitiesAction, createUtilityAction, deleteUtilityAction } from "@/app/actions/utility";
import { swal } from "@/lib/sweetalert"

export default function GaUtilitiesPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // === STATE FILTER BULANAN & JENIS ===
  const [filterUtility, setFilterJenis] = useState("Semua");

  // === STATE FORM INPUT ===
  const [namaUtility, setNamaUtility] = useState("PLN/Listrik");
  const [bulan, setBulan] = useState("Januari");
  const [tahun, setTahun] = useState<number | "">("");
  const [nominal, setNominal] = useState("");
  const [tanggalBayar, setTanggalBayar] = useState(new Date().toISOString().split("T")[0]);
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    fetchRecords();
    setTahun(new Date().getFullYear());
  }, []);

  const fetchRecords = async () => {
    const res = await getUtilitiesAction();
    if (res.success) setRecords(res.data);
  };

  // === LOGIC FILTER DATA UNTUK TABEL & GRAFIK ===
  const filteredRecords = records.filter((rec) => {
    return filterUtility === "Semua" || rec.nama_utility === filterUtility;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      nama_utility: namaUtility,
      bulan,
      tahun: Number(tahun),
      nominal: Number(nominal),
      tanggal_bayar: tanggalBayar,
      keterangan
    };

    const res = await createUtilityAction(payload);
    if (res.success) {
      swal.success("Tagihan utilitas berhasil dicatat")
      setIsModalOpen(false);
      setNominal("");
      setKeterangan("");
      fetchRecords();
    } else {
      swal.error(res.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number, nama: string, bln: string) => {
    const konfirmasi = await swal.confirm(`Hapus catatan pembayaran ${nama} bulan ${bln}?`)
    if (!konfirmasi) return;

    const res = await deleteUtilityAction(id);
    if (res.success) {
      swal.success("Catatan pembayaran berhasil dihapus")
      fetchRecords();
    } else {
      swal.error(res.message);
    }
  };

  // Balik urutan khusus untuk tampilan grafik batang dari kiri-ke-kanan / atas-ke-bawah (kronologis waktu lama ke baru)
  const chartRecords = [...filteredRecords].reverse();
  
  // Ambil batas tertinggi nominal dari data yang sudah terfilter sebagai basis pembagi lebar bar
  const maxNominal = chartRecords.length > 0 ? Math.max(...chartRecords.map(r => Number(r.nominal))) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-xs">
      {/* HEADER UTAMA */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <Activity className="h-5 w-5 text-blue-600" /> GA: Tracking Pembayaran Utilitas
          </h1>
          <p className="text-zinc-500 text-[11px]">Analisis pengeluaran bulanan tagihan PLN, Air, dan internet kantor</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-bold rounded shadow flex items-center gap-1 transition-colors animate-fade-in"
        >
          <Plus className="h-4 w-4" /> Catat Tagihan Baru
        </button>
      </div>

      {/* PANEL CONTROL FILTER UTILLITAS */}
      <div className="bg-zinc-50 border border-zinc-200 p-3 rounded mb-6 flex flex-col sm:flex-row gap-3 items-center shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-zinc-500 font-bold uppercase flex items-center gap-1 whitespace-nowrap text-[10px]">
            <Filter className="h-3 w-3 text-zinc-400" /> Jenis Utilitas:
          </span>
          <select
            value={filterUtility}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="border border-zinc-300 p-2 rounded bg-white font-semibold text-zinc-800 focus:outline-none cursor-pointer w-full sm:w-48 text-xs"
          >
            <option value="Semua">Semua Utilitas</option>
            <option value="PLN/Listrik">PLN / Listrik</option>
            <option value="PDAM/Air">PDAM / Air Bersih</option>
            <option value="WiFi/Internet">WiFi / Internet</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        {/* Info Total Log */}
        <div className="sm:ml-auto text-zinc-500 font-medium text-[11px] whitespace-nowrap">
          Menampilkan <span className="font-bold text-zinc-800">{filteredRecords.length}</span> dari {records.length} total baris log
        </div>
      </div>

      {/* TABEL REKAP BULANAN */}
      <div className="bg-white border rounded overflow-hidden shadow-sm mb-6">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-100 font-bold uppercase border-b text-zinc-800 text-[11px]">
            <tr>
              <th className="p-3 text-center w-12">No</th>
              <th className="p-3">Jenis Utilitas</th>
              <th className="p-3 text-center">Periode Buku</th>
              <th className="p-3 text-center">Tanggal Bayar</th>
              <th className="p-3 text-right">Biaya Tagihan</th>
              <th className="p-3">Keterangan / Catatan</th>
              <th className="p-3 text-center w-16">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y text-zinc-700 font-medium">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  {records.length === 0 ? "Belum ada rekam tagihan utilitas yang di-input." : "Tidak ada catatan tagihan untuk jenis utilitas ini."}
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, idx) => (
                <tr key={rec.id_utility} className="hover:bg-zinc-50/80 align-middle">
                  <td className="p-3 text-center font-bold text-zinc-400">{idx + 1}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      rec.nama_utility === 'PLN/Listrik' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      rec.nama_utility === 'PDAM/Air' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      rec.nama_utility === 'WiFi/Internet' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-zinc-100 text-zinc-700'
                    }`}>
                      {rec.nama_utility}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-zinc-900">{rec.bulan} {rec.tahun}</td>
                  <td className="p-3 text-center text-zinc-500">{new Date(rec.tanggal_bayar).toLocaleDateString("id-ID")}</td>
                  <td className="p-3 text-right font-black text-zinc-900">Rp {Number(rec.nominal).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-zinc-500 text-[11px]">{rec.keterangan || "-"}</td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => handleDelete(rec.id_utility, rec.nama_utility, rec.bulan)}
                      className="p-1.5 border border-red-200 rounded text-red-500 hover:bg-red-50 transition-colors"
                      title="Hapus Log"
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

      {/* COMPONENT GRAFIK TREN BULANAN DI BAWAH TABEL */}
      <div className="bg-white border rounded p-4 shadow-sm">
        <h2 className="text-xs font-bold text-zinc-900 uppercase flex items-center gap-1.5 mb-4 border-b pb-2">
          <BarChart3 className="h-4 w-4 text-zinc-500" /> Grafik Visual Tren Biaya Terfilter ({filterUtility})
        </h2>

        {chartRecords.length === 0 ? (
          <p className="text-zinc-400 italic py-4 text-center">Tidak ada grafik untuk ditampilkan pada filter ini.</p>
        ) : (
          <div className="space-y-3">
            {chartRecords.map((rec) => {
              const percentageWidth = (Number(rec.nominal) / maxNominal) * 100;
              
              const barColor = 
                rec.nama_utility === 'PLN/Listrik' ? 'bg-amber-500' :
                rec.nama_utility === 'PDAM/Air' ? 'bg-blue-500' :
                rec.nama_utility === 'WiFi/Internet' ? 'bg-purple-500' :
                'bg-zinc-500';

              return (
                <div key={rec.id_utility} className="flex items-center gap-3 animate-fade-in">
                  <div className="w-28 font-bold text-zinc-700 whitespace-nowrap">
                    <span className="text-[10px] text-zinc-400 block font-normal">{rec.nama_utility}</span>
                    {rec.bulan} {rec.tahun}
                  </div>

                  <div className="flex-1 bg-zinc-100 rounded-full h-4 overflow-hidden relative shadow-inner">
                    <div 
                      className={`${barColor} h-full rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${percentageWidth}%` }}
                    />
                  </div>

                  <div className="w-24 text-right font-black text-zinc-900">
                    Rp {Number(rec.nominal).toLocaleString("id-ID")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legenda Grafik */}
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-3 border-t text-[10px] text-zinc-500 font-semibold">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> PLN/Listrik</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> PDAM/Air</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500 inline-block" /> WiFi/Internet</span>
        </div>
      </div>

      {/* DIALOG FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded shadow-xl overflow-hidden">
            <div className="bg-zinc-900 text-white px-5 py-3 flex justify-between items-center font-bold uppercase tracking-wide">
              <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-blue-400" /> Registrasi Tagihan Bulanan</span>
              <button type="button" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Utilitas Operasional *</label>
                <select 
                  value={namaUtility} 
                  onChange={(e) => setNamaUtility(e.target.value)} 
                  className="w-full border p-2 bg-white rounded font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="PLN/Listrik">PLN / Listrik</option>
                  <option value="PDAM/Air">PDAM / Air Bersih</option>
                  <option value="WiFi/Internet">WiFi / Internet IndiHome/Biznet</option>
                  <option value="Lainnya">Lainnya (Token/Iuran Gedung)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Bulan Buku Tagihan</label>
                  <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="w-full border p-2 bg-white rounded cursor-pointer">
                    {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tahun Buku *</label>
                  <input type="number" required value={tahun} onChange={(e) => setTahun(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border p-2 rounded text-center font-semibold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Total Nominal Tagihan *</label>
                  <input type="number" required placeholder="Contoh: 1500000" value={nominal} onChange={(e) => setNominal(e.target.value)} className="w-full border p-2 rounded text-right font-black" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tanggal Bayar *</label>
                  <input type="date" required value={tanggalBayar} onChange={(e) => setTanggalBayar(e.target.value)} className="w-full border p-2 rounded cursor-pointer font-medium" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Keterangan / Nomor ID Pelanggan</label>
                <textarea rows={2} placeholder="Contoh: No. ID PLN 5321xxxxxxxx (Dibayar via m-banking)" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="w-full border p-2 rounded resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded font-semibold text-zinc-600 hover:bg-zinc-50">Batal</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white font-bold rounded shadow transition-colors disabled:bg-blue-400">
                  {loading ? "Menyimpan..." : "Simpan Tagihan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}