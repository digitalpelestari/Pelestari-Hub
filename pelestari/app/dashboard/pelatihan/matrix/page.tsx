'use client';

import React, { useState, useEffect, useId } from "react";
import Swal from "sweetalert2";
import {
  Search,
  Eye,
  Loader2,
  Plus,
  Building2,
  Truck,
  MapPin,
  X,
  CreditCard,
  User,
  Image as ImageIcon,
  Layers,
  FileText,
  Calendar,
  Pencil,
  Trash2,
} from "lucide-react";

export interface TbBatch {
  id: number;
  nama: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  lokasi: string | null;
}

export interface TbMatrix {
  id: number;
  batch_id: number | null;
  nama_batch?: string;
  nama: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  nik: string | null;
  nomor_sim: string | null;
  jenis_sim: string | null;
  perusahaan: string | null;
  lokasi: string | null;
  jenis_muatan: string | null;
  foto_ktp: string | null;
  foto_sim: string | null;
  pas_foto: string | null;
  created_at: string;
}

export default function PelatihanMatrixPage() {
  const [batches, setBatches] = useState<TbBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [data, setData] = useState<TbMatrix[]>([]);
  
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<TbMatrix | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formValues, setFormValues] = useState({
    batch_id: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nik: '',
    nomor_sim: '',
    jenis_sim: 'B II UMUM',
    perusahaan: '',
    lokasi: '',
    jenis_muatan: '',
  });

  // Files & Previews
  const [fileKtp, setFileKtp] = useState<File | null>(null);
  const [previewKtp, setPreviewKtp] = useState<string>('');
  const [fileSim, setFileSim] = useState<File | null>(null);
  const [previewSim, setPreviewSim] = useState<string>('');
  const [filePasFoto, setFilePasFoto] = useState<File | null>(null);
  const [previewPasFoto, setPreviewPasFoto] = useState<string>('');

  const [loadingOcrKtp, setLoadingOcrKtp] = useState(false);
  const [loadingOcrSim, setLoadingOcrSim] = useState(false);

// State Modal Batch Baru
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    nama: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    lokasi: "",
  });
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);

  const ktpInputId = useId();
  const simInputId = useId();
  const photoInputId = useId();

  // 1. Fetch Daftar Batch
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setLoadingBatch(true);
        const res = await fetch('/api/batch');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          setBatches(json.data);
          setSelectedBatchId(String(json.data[0].id));
          setFormValues((prev) => ({ ...prev, batch_id: String(json.data[0].id) }));
        }
      } catch (err) {
        console.error('Error fetch batch:', err);
      } finally {
        setLoadingBatch(false);
      }
    };
    fetchBatches();
  }, []);

  // 2. Fetch Data Matrix berdasarkan Selected Batch
  useEffect(() => {
    const fetchMatrixData = async () => {
      if (!selectedBatchId) return;
      try {
        setLoadingData(true);
        const res = await fetch(`/api/matrix?batch_id=${selectedBatchId}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Error fetch matrix:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchMatrixData();
  }, [selectedBatchId]);

  // Helper Usia
  const calculateAge = (dateString: string | null) => {
    if (!dateString) return '-';
    const birth = new Date(dateString);
    if (isNaN(birth.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} Thn`;
  };

  // OCR KTP Handler
  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileKtp(file);
    setPreviewKtp(URL.createObjectURL(file));
    setLoadingOcrKtp(true);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/api/ocr/ktp', { method: 'POST', body });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        const { nik, nama, tempatLahir, tanggalLahir } = resJson.data;
        setFormValues((prev) => ({
          ...prev,
          nik: nik || prev.nik,
          nama: (nama || prev.nama).toUpperCase(),
          tempat_lahir: (tempatLahir || prev.tempat_lahir).toUpperCase(),
          tanggal_lahir: tanggalLahir || prev.tanggal_lahir,
        }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Gagal", text: "Gagal membaca OCR KTP" });
    } finally {
      setLoadingOcrKtp(false);
    }
  };

  // OCR SIM Handler
  const handleSimUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSim(file);
    setPreviewSim(URL.createObjectURL(file));
    setLoadingOcrSim(true);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/api/ocr/sim', { method: 'POST', body });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        const { noSim, jenisSim } = resJson.data;
        setFormValues((prev) => ({
          ...prev,
          nomor_sim: noSim || prev.nomor_sim,
          jenis_sim: jenisSim || prev.jenis_sim,
        }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Gagal", text: "Gagal membaca OCR SIM" });
    } finally {
      setLoadingOcrSim(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = new FormData();
    payload.append('batch_id', formValues.batch_id || selectedBatchId);
    payload.append('nama', formValues.nama);
    payload.append('tempat_lahir', formValues.tempat_lahir);
    payload.append('tanggal_lahir', formValues.tanggal_lahir);
    payload.append('nik', formValues.nik);
    payload.append('nomor_sim', formValues.nomor_sim);
    payload.append('jenis_sim', formValues.jenis_sim);
    payload.append('perusahaan', formValues.perusahaan);
    payload.append('lokasi', formValues.lokasi);
    payload.append('jenis_muatan', formValues.jenis_muatan);

    if (fileKtp) payload.append('foto_ktp', fileKtp);
    if (fileSim) payload.append('foto_sim', fileSim);
    if (filePasFoto) payload.append('pas_foto', filePasFoto);

    try {
      const res = await fetch('/api/matrix', { method: 'POST', body: payload });
      const result = await res.json();

      if (result.success) {
        setIsModalOpen(false);
        setFormValues({
          batch_id: selectedBatchId,
          nama: '',
          tempat_lahir: '',
          tanggal_lahir: '',
          nik: '',
          nomor_sim: '',
          jenis_sim: 'B II UMUM',
          perusahaan: '',
          lokasi: '',
          jenis_muatan: '',
        });
        setFileKtp(null);
        setFileSim(null);
        setFilePasFoto(null);
        setPreviewKtp('');
        setPreviewSim('');
        setPreviewPasFoto('');

        // Refresh list
        const resReload = await fetch(`/api/matrix?batch_id=${selectedBatchId}`);
        const jsonReload = await resReload.json();
        if (jsonReload.success) setData(jsonReload.data);

        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Peserta berhasil disimpan.",
          timer: 2000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal: ' + result.error });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Kesalahan', text: 'Terjadi kesalahan saat menyimpan data' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBatchInfo = batches.find((b) => String(b.id) === selectedBatchId);

  // Refresh daftar batch (dipakai ulang setelah buat batch baru)
  const refreshBatches = async () => {
    try {
      const res = await fetch('/api/batch');
      const json = await res.json();
      if (json.success) {
        setBatches(json.data);
        return json.data as TbBatch[];
      }
      return [] as TbBatch[];
    } catch (err) {
      console.error('Error refresh batch:', err);
      return [] as TbBatch[];
    }
  };

  // Submit Batch (Buat / Edit)
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.nama.trim()) {
      Swal.fire({ icon: "warning", title: "Perhatian", text: "Nama batch wajib diisi" });
      return;
    }
    setIsSubmittingBatch(true);
    try {
      const res = await fetch(
        isBatchEditMode ? `/api/batch?id=${selectedBatchId}` : "/api/batch",
        {
          method: isBatchEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchForm),
        }
      );
      const result = await res.json();
      if (result.success) {
        const updated = await refreshBatches();
        if (isBatchEditMode) {
          setIsBatchModalOpen(false);
          await Swal.fire({
            icon: "success",
            title: "Berhasil",
            text: "Batch berhasil diperbarui.",
            timer: 2000,
            showConfirmButton: true,
          });
        } else {
          if (result.data?.id) {
            setSelectedBatchId(String(result.data.id));
            setFormValues((prev) => ({ ...prev, batch_id: String(result.data.id) }));
          } else if (updated.length > 0) {
            const newest = updated[0];
            setSelectedBatchId(String(newest.id));
            setFormValues((prev) => ({ ...prev, batch_id: String(newest.id) }));
          }
          await Swal.fire({
            icon: "success",
            title: "Berhasil",
            text: "Batch baru berhasil dibuat.",
            timer: 2000,
            showConfirmButton: true,
          });
        }
        setBatchForm({ nama: "", tanggal_mulai: "", tanggal_selesai: "", lokasi: "" });
        setIsBatchEditMode(false);
        setIsBatchModalOpen(false);
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: (isBatchEditMode ? "Gagal memperbarui batch: " : "Gagal membuat batch: ") +
            (result.error || "unknown error"),
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: isBatchEditMode
          ? "Terjadi kesalahan saat memperbarui batch"
          : "Terjadi kesalahan saat membuat batch",
      });
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Buka Modal Edit Batch
  const handleOpenEditBatch = () => {
    if (!currentBatchInfo) return;
    setBatchForm({
      nama: currentBatchInfo.nama || "",
      tanggal_mulai: currentBatchInfo.tanggal_mulai || "",
      tanggal_selesai: currentBatchInfo.tanggal_selesai || "",
      lokasi: currentBatchInfo.lokasi || "",
    });
    setIsBatchEditMode(true);
    setIsBatchModalOpen(true);
  };

  // Hapus Batch
  const handleDeleteBatch = async () => {
    if (!currentBatchInfo) return;

    const confirm = await Swal.fire({
      title: "Hapus Batch?",
      text: `Batch "${currentBatchInfo.nama}" dan seluruh peserta di dalamnya akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/batch?id=${currentBatchInfo.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        const updated = await refreshBatches();
        if (updated.length > 0) {
          const first = updated[0];
          setSelectedBatchId(String(first.id));
          setFormValues((prev) => ({ ...prev, batch_id: String(first.id) }));
        } else {
          setSelectedBatchId("");
          setFormValues((prev) => ({ ...prev, batch_id: "" }));
        }
        setData([]);
        await Swal.fire({
          icon: "success",
          title: "Terhapus!",
          text: result.message || "Batch berhasil dihapus.",
          timer: 2000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: "Gagal menghapus batch: " + (result.error || "unknown error"),
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Kesalahan",
        text: "Terjadi kesalahan saat menghapus batch",
      });
    }
  };

  const filteredData = data.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nama?.toLowerCase().includes(q) ||
      item.nik?.includes(q) ||
      item.nomor_sim?.includes(q) ||
      item.perusahaan?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full p-4 sm:p-6 space-y-6">
      {/* Header & Batch Dropdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Matriks Pelatihan per Batch
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Pilih batch pelatihan untuk melihat dan mengelola data peserta.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Batch Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Pilih Batch Pelatihan"
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setFormValues((prev) => ({ ...prev, batch_id: e.target.value }));
                }}
                disabled={loadingBatch || batches.length === 0}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
              >
                {batches.length === 0 ? (
                  <option value="">Belum ada batch</option>
                ) : (
                  batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama} {b.lokasi ? `(${b.lokasi})` : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsBatchEditMode(false);
                  setBatchForm({ nama: "", tanggal_mulai: "", tanggal_selesai: "", lokasi: "" });
                  setIsBatchModalOpen(true);
                }}
                title="Buat Batch Baru"
                className="ml-1 p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleOpenEditBatch}
                disabled={!selectedBatchId}
                title="Edit Batch Saat Ini"
                className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm disabled:bg-amber-300 disabled:cursor-not-allowed"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                disabled={!selectedBatchId}
                title="Hapus Batch Saat Ini"
                className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedBatchId}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm disabled:bg-indigo-300"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Peserta</span>
            </button>
          </div>
        </div>

        {/* Info Batch yang sedang aktif */}
        {currentBatchInfo && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span><b>Lokasi Pelatihan:</b> {currentBatchInfo.lokasi || '-'}</span>
            <span>•</span>
            <span>
              <b>Periode:</b> {currentBatchInfo.tanggal_mulai ? new Date(currentBatchInfo.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {currentBatchInfo.tanggal_selesai ? new Date(currentBatchInfo.tanggal_selesai).toLocaleDateString('id-ID') : '-'}
            </span>
          </div>
        )}
      </div>

      {/* Tabel Matrix Peserta */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nama, NIK, SIM, Perusahaan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total di batch ini: {filteredData.length} Peserta
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3.5 text-center w-12">No</th>
                <th className="px-4 py-3.5">Pas Foto</th>
                <th className="px-4 py-3.5">Nama & NIK</th>
                <th className="px-4 py-3.5">TTL & Usia</th>
                <th className="px-4 py-3.5">Kualifikasi SIM</th>
                <th className="px-4 py-3.5">Perusahaan & Muatan</th>
                <th className="px-4 py-3.5">Lokasi</th>
                <th className="px-4 py-3.5 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loadingData ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Memuat data peserta batch...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>Belum ada peserta di batch ini. Silakan klik <b>Tambah Peserta</b>.</span>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="w-10 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                        {row.pas_foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.pas_foto} alt={row.nama} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 uppercase">{row.nama}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">NIK: {row.nik || '-'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>{row.tempat_lahir || '-'}, {row.tanggal_lahir ? new Date(row.tanggal_lahir).toLocaleDateString('id-ID') : '-'}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                        {calculateAge(row.tanggal_lahir)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-indigo-700">{row.jenis_sim || '-'}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">No: {row.nomor_sim || '-'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> {row.perusahaan || '-'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Truck className="w-3 h-3 text-slate-400" /> {row.jenis_muatan || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {row.lokasi || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedDetail(row)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Lihat Detail & Berkas"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BATCH BARU */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {isBatchEditMode ? "Edit Batch" : "Buat Batch Baru"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isBatchEditMode
                    ? "Perbarui informasi batch pelatihan."
                    : "Tambahkan batch pelatihan ke dalam sistem."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setIsBatchEditMode(false);
                  setBatchForm({ nama: "", tanggal_mulai: "", tanggal_selesai: "", lokasi: "" });
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Batch *</label>
                <input
                  type="text"
                  required
                  value={batchForm.nama}
                  onChange={(e) => setBatchForm({ ...batchForm, nama: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                  placeholder="Contoh: Batch XII - Surabaya"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={batchForm.tanggal_mulai}
                    onChange={(e) => setBatchForm({ ...batchForm, tanggal_mulai: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={batchForm.tanggal_selesai}
                    onChange={(e) => setBatchForm({ ...batchForm, tanggal_selesai: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Lokasi</label>
                <input
                  type="text"
                  value={batchForm.lokasi}
                  onChange={(e) => setBatchForm({ ...batchForm, lokasi: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  placeholder="Lokasi / Site pelatihan"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchModalOpen(false);
                    setIsBatchEditMode(false);
                    setBatchForm({ nama: "", tanggal_mulai: "", tanggal_selesai: "", lokasi: "" });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBatch}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmittingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isBatchEditMode ? "Simpan Perubahan" : "Simpan Batch"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM INPUT PESERTA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Tambah Peserta ({currentBatchInfo?.nama || 'Batch Pelatihan'})
                </h3>
                <p className="text-xs text-slate-500">Ekstraksi otomatis KTP & SIM via OCR.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Batch Selection in Form */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Target Batch Pelatihan</label>
                <select
                  value={formValues.batch_id}
                  onChange={(e) => setFormValues({ ...formValues, batch_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-semibold bg-slate-50 text-slate-700"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama} — {b.lokasi || 'Tanpa Lokasi'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3 Upload Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Upload KTP */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  <input type="file" id={ktpInputId} accept="image/*" className="hidden" onChange={handleKtpUpload} />
                  <label htmlFor={ktpInputId} className="cursor-pointer w-full flex flex-col items-center">
                    <CreditCard className="w-8 h-8 text-indigo-500 mb-2" />
                    <span className="text-xs font-semibold text-slate-700">Upload KTP</span>
                    <span className="text-[10px] text-slate-400 mt-1">OCR: NIK, Nama, TTL</span>
                    {loadingOcrKtp && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-600 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scan KTP...
                      </div>
                    )}
                    {previewKtp && !loadingOcrKtp && (
                      <span className="text-xs text-emerald-600 font-medium mt-2">✓ KTP Terunggah</span>
                    )}
                  </label>
                </div>

                {/* Upload SIM */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  <input type="file" id={simInputId} accept="image/*" className="hidden" onChange={handleSimUpload} />
                  <label htmlFor={simInputId} className="cursor-pointer w-full flex flex-col items-center">
                    <CreditCard className="w-8 h-8 text-amber-500 mb-2" />
                    <span className="text-xs font-semibold text-slate-700">Upload SIM</span>
                    <span className="text-[10px] text-slate-400 mt-1">OCR: No. SIM & Jenis SIM</span>
                    {loadingOcrSim && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scan SIM...
                      </div>
                    )}
                    {previewSim && !loadingOcrSim && (
                      <span className="text-xs text-emerald-600 font-medium mt-2">✓ SIM Terunggah</span>
                    )}
                  </label>
                </div>

                {/* Upload Pas Foto */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  <input
                    type="file"
                    id={photoInputId}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFilePasFoto(file);
                        setPreviewPasFoto(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <label htmlFor={photoInputId} className="cursor-pointer w-full flex flex-col items-center">
                    <ImageIcon className="w-8 h-8 text-sky-500 mb-2" />
                    <span className="text-xs font-semibold text-slate-700">Upload Pas Foto</span>
                    <span className="text-[10px] text-slate-400 mt-1">Foto formal peserta</span>
                    {previewPasFoto && (
                      <span className="text-xs text-emerald-600 font-medium mt-2">✓ Foto Terpilih</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={formValues.nama}
                    onChange={(e) => setFormValues({ ...formValues, nama: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                    placeholder="Nama Lengkap"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">NIK</label>
                  <input
                    type="text"
                    value={formValues.nik}
                    onChange={(e) => setFormValues({ ...formValues, nik: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    placeholder="16 Digit NIK"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formValues.tempat_lahir}
                    onChange={(e) => setFormValues({ ...formValues, tempat_lahir: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Kota Lahir"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formValues.tanggal_lahir}
                    onChange={(e) => setFormValues({ ...formValues, tanggal_lahir: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Jenis SIM</label>
                  <select
                    value={formValues.jenis_sim}
                    onChange={(e) => setFormValues({ ...formValues, jenis_sim: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="A">SIM A</option>
                    <option value="B I">SIM B I</option>
                    <option value="B I UMUM">SIM B I Umum</option>
                    <option value="B II">SIM B II</option>
                    <option value="B II UMUM">SIM B II Umum</option>
                    <option value="C">SIM C</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Nomor SIM</label>
                  <input
                    type="text"
                    value={formValues.nomor_sim}
                    onChange={(e) => setFormValues({ ...formValues, nomor_sim: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    placeholder="Nomor SIM"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Perusahaan</label>
                  <input
                    type="text"
                    value={formValues.perusahaan}
                    onChange={(e) => setFormValues({ ...formValues, perusahaan: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Nama Perusahaan"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Lokasi Kerja</label>
                  <input
                    type="text"
                    value={formValues.lokasi}
                    onChange={(e) => setFormValues({ ...formValues, lokasi: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Lokasi / Site"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Jenis Muatan</label>
                  <input
                    type="text"
                    value={formValues.jenis_muatan}
                    onChange={(e) => setFormValues({ ...formValues, jenis_muatan: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Contoh: Bahan Kimia Cair (B3)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan ke Batch</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL PREVIEW */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">Detail Peserta: {selectedDetail.nama}</h3>
              <button onClick={() => setSelectedDetail(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Gambar Berkas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Foto KTP</span>
                {selectedDetail.foto_ktp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedDetail.foto_ktp} alt="KTP" className="w-full h-24 object-cover rounded-lg" />
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-slate-400">Tidak ada berkas</div>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Foto SIM</span>
                {selectedDetail.foto_sim ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedDetail.foto_sim} alt="SIM" className="w-full h-24 object-cover rounded-lg" />
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-slate-400">Tidak ada berkas</div>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Pas Foto</span>
                {selectedDetail.pas_foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedDetail.pas_foto} alt="Pas Foto" className="w-full h-24 object-cover rounded-lg" />
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-slate-400">Tidak ada berkas</div>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Nama Lengkap</span>
                <span className="font-bold text-slate-800">{selectedDetail.nama}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">NIK</span>
                <span className="font-mono font-semibold">{selectedDetail.nik || '-'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">TTL</span>
                <span>{selectedDetail.tempat_lahir || '-'}, {selectedDetail.tanggal_lahir ? new Date(selectedDetail.tanggal_lahir).toLocaleDateString('id-ID') : '-'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Kualifikasi SIM</span>
                <span className="font-semibold text-indigo-700">{selectedDetail.jenis_sim || '-'} ({selectedDetail.nomor_sim || '-'})</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Perusahaan</span>
                <span className="font-medium">{selectedDetail.perusahaan || '-'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Lokasi</span>
                <span className="font-medium">{selectedDetail.lokasi || '-'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}