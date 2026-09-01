'use client';

import React, { useState, useEffect, useId } from 'react';
import { createWorker } from 'tesseract.js';
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
  FolderPlus
} from 'lucide-react';

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
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<TbMatrix | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Form Batch State
  const [batchForm, setBatchForm] = useState({
    nama: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    lokasi: '',
  });

  // Form Peserta State
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

  // OCR Client States
  const [loadingOcrKtp, setLoadingOcrKtp] = useState(false);
  const [loadingOcrSim, setLoadingOcrSim] = useState(false);

  const ktpInputId = useId();
  const simInputId = useId();
  const photoInputId = useId();

  // 1. Fetch Batches
  const fetchBatches = async () => {
    try {
      setLoadingBatch(true);
      const res = await fetch('/api/batch');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setBatches(json.data);
        if (!selectedBatchId) {
          setSelectedBatchId(String(json.data[0].id));
          setFormValues((prev) => ({ ...prev, batch_id: String(json.data[0].id) }));
        }
      }
    } catch (err) {
      console.error('Error fetch batch:', err);
    } finally {
      setLoadingBatch(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // 2. Fetch Data Matrix
  const fetchMatrixData = async (batchId: string) => {
    if (!batchId) return;
    try {
      setLoadingData(true);
      const res = await fetch(`/api/matrix?batch_id=${batchId}`);
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

  useEffect(() => {
    if (selectedBatchId) {
      fetchMatrixData(selectedBatchId);
    }
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

  // 3. OCR KTP (Robust Parser)
  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileKtp(file);
    setPreviewKtp(URL.createObjectURL(file));
    setLoadingOcrKtp(true);

    let worker: any = null;
    try {
      worker = await createWorker('ind');
      const { data: { text } } = await worker.recognize(file);
      console.log('--- OCR KTP RAW OUTPUT --- \n', text);

      const lines = text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      let extractedNik = '';
      let extractedNama = '';
      let extractedTempat = '';
      let extractedTgl = '';
      let nikLineIdx = -1;

      // A. Ekstraksi NIK
      const nikMatch = text.match(/\b\d{16}\b/) || text.match(/(?:NIK|N1K|N|K)\s*[:=]?\s*([0-9OBIDSZ]{16})/i);
      if (nikMatch) {
        extractedNik = (nikMatch[1] || nikMatch[0])
          .replace(/O|D/g, '0')
          .replace(/I|l/g, '1')
          .replace(/B/g, '8')
          .replace(/S/g, '5')
          .replace(/Z/g, '2');
      }

      // Cari index baris NIK untuk fallback nama
      lines.forEach((line: string, idx: number) => {
        if (/NIK|N1K/i.test(line) || /\d{16}/.test(line)) {
          nikLineIdx = idx;
        }
      });

      // B. Ekstraksi Nama
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match kata "Nama" atau "Nam a"
        if (/Nam[a|e]/i.test(line)) {
          let clean = line.replace(/.*Nam[a|e]\s*[:=]?\s*/i, '').trim();
          // Bersihkan karakter non-huruf di awal
          clean = clean.replace(/^[^a-zA-Z]+/, '');
          if (clean.length > 2) {
            extractedNama = clean;
            break;
          }
        }
      }

      // Fallback Nama: Jika tidak ada label "Nama", ambil baris setelah baris NIK
      if (!extractedNama && nikLineIdx !== -1 && lines[nikLineIdx + 1]) {
        const candidate = lines[nikLineIdx + 1].replace(/.*[:=]\s*/, '').trim();
        // Pastikan bukan baris TTL
        if (!/Tempat|Lahir|Tgl/i.test(candidate) && candidate.length > 2) {
          extractedNama = candidate;
        }
      }

      // C. Ekstraksi Tempat & Tanggal Lahir
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/Tempat|Tgl\s*Lahir|Lahir/i.test(line)) {
          const rawTTL = line.replace(/.*(?:Lahir|Tgl Lahir|Tempat)\s*[:=]?\s*/i, '').trim();
          const parts = rawTTL.split(',');
          if (parts.length >= 2) {
            extractedTempat = parts[0].replace(/[^a-zA-Z\s]/g, '').trim();
            const dMatch = parts[1].match(/\d{2}[-\s/]\d{2}[-\s/]\d{4}/);
            if (dMatch) {
              const [d, m, y] = dMatch[0].replace(/\s|\//g, '-').split('-');
              extractedTgl = `${y}-${m}-${d}`;
            }
          }
        }
      }

      setFormValues((prev) => ({
        ...prev,
        nik: extractedNik || prev.nik,
        nama: extractedNama ? extractedNama.toUpperCase() : prev.nama,
        tempat_lahir: extractedTempat ? extractedTempat.toUpperCase() : prev.tempat_lahir,
        tanggal_lahir: extractedTgl || prev.tanggal_lahir,
      }));
    } catch (err) {
      console.error('OCR KTP Error:', err);
      alert('Gagal memproses OCR KTP');
    } finally {
      if (worker) await worker.terminate();
      setLoadingOcrKtp(false);
    }
  };

  // 4. OCR SIM
  const handleSimUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSim(file);
    setPreviewSim(URL.createObjectURL(file));
    setLoadingOcrSim(true);

    let worker: any = null;
    try {
      worker = await createWorker('ind');
      const { data: { text } } = await worker.recognize(file);
      console.log('--- OCR SIM RAW OUTPUT --- \n', text);

      let jenisSim = '';
      let noSim = '';

      const jenisMatch = text.match(/\b(?:SIM|SURAT\s*IZIN\s*MENGEMUDI)?\s*([A-C](?:\s*I{1,2})?)\b/i) ||
                         text.match(/\b(BI|BII|B1|B2|A|C)\b/i);
      if (jenisMatch) {
        const matched = jenisMatch[1].toUpperCase().replace(/\s+/g, ' ');
        if (matched.includes('B1') || matched.includes('B I')) jenisSim = 'B I UMUM';
        else if (matched.includes('B2') || matched.includes('B II')) jenisSim = 'B II UMUM';
        else if (matched.includes('A')) jenisSim = 'A';
        else if (matched.includes('C')) jenisSim = 'C';
        else jenisSim = matched;
      }

      const noSimMatch = text.match(/(?:NO|NOMOR|NO\.)\s*[:=]?\s*([0-9-]{12,18})/i) ||
                         text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4,6}\b/);
      if (noSimMatch) {
        noSim = (noSimMatch[1] || noSimMatch[0]).replace(/[^0-9]/g, '');
      }

      setFormValues((prev) => ({
        ...prev,
        nomor_sim: noSim || prev.nomor_sim,
        jenis_sim: jenisSim || prev.jenis_sim,
      }));
    } catch (err) {
      console.error('OCR SIM Error:', err);
      alert('Gagal memproses OCR SIM');
    } finally {
      if (worker) await worker.terminate();
      setLoadingOcrSim(false);
    }
  };

  // 5. Submit Tambah Batch Baru
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBatch(true);
    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchForm),
      });
      const result = await res.json();
      if (result.success) {
        setIsBatchModalOpen(false);
        setBatchForm({ nama: '', tanggal_mulai: '', tanggal_selesai: '', lokasi: '' });
        await fetchBatches();
        if (result.insertId) {
          setSelectedBatchId(String(result.insertId));
        }
      } else {
        alert('Gagal membuat batch: ' + result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menambah batch');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // 6. Submit Peserta
  const handleSubmitPeserta = async (e: React.FormEvent) => {
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

        fetchMatrixData(selectedBatchId);
      } else {
        alert('Gagal: ' + result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan data peserta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBatchInfo = batches.find((b) => String(b.id) === selectedBatchId);

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
      {/* Header & Controls */}
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
              Kelola peserta pelatihan dan ekstrak otomatis KTP & SIM.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Batch Selector */}
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
            </div>

            {/* Tombol Tambah Batch */}
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-sm"
            >
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>Tambah Batch</span>
            </button>

            {/* Tombol Tambah Peserta */}
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

        {/* Info Batch Aktif */}
        {currentBatchInfo && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span><b>Lokasi:</b> {currentBatchInfo.lokasi || '-'}</span>
            <span>•</span>
            <span>
              <b>Periode:</b> {currentBatchInfo.tanggal_mulai ? new Date(currentBatchInfo.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {currentBatchInfo.tanggal_selesai ? new Date(currentBatchInfo.tanggal_selesai).toLocaleDateString('id-ID') : '-'}
            </span>
          </div>
        )}
      </div>

      {/* Tabel Matrix */}
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
                    <span>Memuat data peserta...</span>
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

      {/* MODAL 1: TAMBAH BATCH BARU */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Tambah Batch Pelatihan</h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Batch *</label>
                <input
                  type="text"
                  required
                  value={batchForm.nama}
                  onChange={(e) => setBatchForm({ ...batchForm, nama: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Contoh: Batch Mei 2026 Gel. 1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Lokasi Pelatihan</label>
                <input
                  type="text"
                  value={batchForm.lokasi}
                  onChange={(e) => setBatchForm({ ...batchForm, lokasi: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  placeholder="Contoh: Site Cilegon"
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBatch}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmittingBatch ? 'Menyimpan...' : 'Simpan Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH PESERTA MATRIX */}
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

            <form onSubmit={handleSubmitPeserta} className="space-y-6">
              {/* Target Batch */}
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
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Membaca KTP...
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
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Membaca SIM...
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

              {/* Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={formValues.nama}
                    onChange={(e) => setFormValues({ ...formValues, nama: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                    placeholder="Nama Lengkap Sesuai KTP"
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
                  disabled={isSubmitting || loadingOcrKtp || loadingOcrSim}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Database...</span>
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
              <div className="col-span-2 p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Jenis Muatan</span>
                <span className="font-medium">{selectedDetail.jenis_muatan || '-'}</span>
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