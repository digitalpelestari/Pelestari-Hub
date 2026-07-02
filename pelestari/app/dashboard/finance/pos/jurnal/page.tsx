"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, Search, Calendar, Landmark, Hash, Bookmark,
  CheckCircle2, AlertTriangle, Pencil, Check, Trash2, FileText, Download, ArrowRight 
} from "lucide-react"
import { getJurnalList, updateJurnalItem, deleteJurnalByHeader, exportJurnalToExcel } from "@/app/actions/jurnal"
import { getAkunList } from "@/app/actions/akun" 
import Link from "next/link"

export default function JurnalUmumListPage() {
  const [jurnalList, setJurnalList] = useState<any[]>([])
  const [akunList, setAkunList] = useState<any[]>([]) 
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // === STATE FILTER RENTANG TANGGAL ===
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // State manajemen inline editing untuk satu paket transaksi jurnal (Header + Semua Items)
  const [editingJurnalId, setEditingJurnalId] = useState<number | null>(null) 
  const [editHeaderForm, setEditHeaderForm] = useState<any>({})
  const [editItemsForm, setEditItemsForm] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const startParam = startDate ? startDate : undefined
      const endParam = endDate ? endDate : undefined

      const dataJurnal = await getJurnalList(startParam, endParam)
      const dataAkun = await getAkunList()
      
      setJurnalList(dataJurnal)
      setAkunList(dataAkun)
    } catch (error) {
      console.error("Gagal memuat data pembukuan:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  // Filter pencarian teks berdasarkan No Registrasi, No Referensi, atau Keterangan Jurnal (Memo)
  const filteredJurnal = useMemo(() => {
    return jurnalList.filter(j => 
      (j.no_registrasi && j.no_registrasi.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.no_referensi && j.no_referensi.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.keterangan && j.keterangan.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [jurnalList, searchQuery])

  const totalAccumulasi = useMemo(() => {
    let debit = 0
    let kredit = 0
    filteredJurnal.forEach((jurnal) => {
      if (jurnal.items) {
        jurnal.items.forEach((item: any) => {
          debit += Number(item.debit) || 0
          kredit += Number(item.kredit) || 0
        })
      }
    })
    return { debit, kredit, isBalanced: debit === kredit && debit > 0 }
  }, [filteredJurnal])

  // Aktifkan mode edit untuk SEMUA KOLOM di dalam satu bundel transaksi
  const startEditJurnal = (jurnal: any) => {
    setEditingJurnalId(jurnal.id)
    setEditHeaderForm({
      tanggal: jurnal.tanggal ? new Date(jurnal.tanggal).toISOString().split('T')[0] : "",
      no_registrasi: jurnal.no_registrasi || "",
      no_referensi: jurnal.no_referensi || "", // <-- Menyimpan no_referensi lama ke form edit
      keterangan: jurnal.keterangan || ""
    })
    setEditItemsForm(JSON.parse(JSON.stringify(jurnal.items || [])))
  }

  const cancelEditJurnal = () => {
    setEditingJurnalId(null)
    setEditHeaderForm({})
    setEditItemsForm([])
  }

  const handleHeaderChange = (field: string, value: string) => {
    setEditHeaderForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (itemIndex: number, field: string, value: any) => {
    setEditItemsForm((prev) => {
      const updated = [...prev]
      
      if (field === "no_akun") {
        updated[itemIndex].no_akun = value
        const targetAkun = akunList.find(a => a.no_akun === value)
        
        updated[itemIndex].nama_akun = targetAkun ? targetAkun.nama_akun : ""
        updated[itemIndex].nama_kelompok = targetAkun ? (targetAkun.kelompok_biaya || targetAkun.nama_kelompok || "General Parameter") : ""
      } else {
        updated[itemIndex] = { ...updated[itemIndex], [field]: value }
      }
      
      if (field === "debit" && Number(value) > 0) updated[itemIndex].kredit = 0
      if (field === "kredit" && Number(value) > 0) updated[itemIndex].debit = 0
      
      return updated
    })
  }

  const saveEditJurnal = async (jurnalId: number) => {
    let totalDebitJurnal = 0
    let totalKreditJurnal = 0

    editItemsForm.forEach((item) => {
      totalDebitJurnal += Number(item.debit) || 0
      totalKreditJurnal += Number(item.kredit) || 0
    })

    if (totalDebitJurnal !== totalKreditJurnal) {
      alert(`Gagal Simpan: Transaksi Jurnal TIDAK BALANCE!\nTotal Debit: Rp ${totalDebitJurnal.toLocaleString("id-ID")}\nTotal Kredit: Rp ${totalKreditJurnal.toLocaleString("id-ID")}\n\nPastikan nilai debit dan kredit sama sebelum menyimpan.`);
      return
    }

    setLoading(true)
    try {
      for (const item of editItemsForm) {
        if (!item.id) {
          throw new Error("ID baris transaksi hilang. Pastikan query backend getJurnalList mengambil kolom i.id!");
        }

        // Mengirim parameter lengkap beserta no_referensi ke backend update action
        await updateJurnalItem(item.id, {
          jurnal_id: jurnalId,
          tanggal: editHeaderForm.tanggal,
          no_registrasi: editHeaderForm.no_registrasi,
          no_referensi: editHeaderForm.no_referensi, // <-- Terkirim ke database mysql
          keterangan_umum: editHeaderForm.keterangan,
          no_akun: item.no_akun,
          debit: Number(item.debit) || 0,
          kredit: Number(item.kredit) || 0
        })
      }
      
      alert("Perubahan seluruh kolom jurnal berhasil disimpan!")
      setEditingJurnalId(null)
      await loadData()
    } catch (err: any) {
      alert("Gagal menyimpan perubahan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveJurnalUtah = async (jurnalId: number, noRegis: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh transaksi No. Registrasi: ${noRegis}?`)) return

    setLoading(true)
    const res = await deleteJurnalByHeader(jurnalId)
    if (res.success) {
      alert(res.message)
      await loadData() 
    } else {
      alert("Gagal menghapus transaksi: " + res.message)
    }
    setLoading(false)
  }

  const handleDownloadExcel = async () => {
    setIsExporting(true)
    try {
      const startParam = startDate ? startDate : undefined
      const endParam = endDate ? endDate : undefined

      const res = await exportJurnalToExcel(startParam, endParam)
      if (!res.success || !res.base64) {
        alert(res.message || "Terjadi kesalahan sistem saat mengekspor data.")
        return
      }

      const byteCharacters = atob(res.base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = res.fileName || "Jurnal_Umum.xlsx"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      alert("Gagal mengunduh file Excel: " + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleResetFilterTanggal = () => {
    setStartDate("")
    setEndDate("")
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-black flex items-center gap-2">
            <Landmark className="h-6 w-6" /> Jurnal Umum Pembukuan
          </h1>
          <p className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase italic mt-0.5">
            General Journal Log Dashboard
          </p>
        </div>
        <div className="flex items-center self-end sm:self-auto">
          <Button 
            onClick={handleDownloadExcel} 
            disabled={isExporting || loading} 
            variant="outline" 
            className="h-9 border-zinc-300 text-zinc-700 text-xs font-black italic rounded-sm px-4 mr-2 gap-1.5"
          >
            <Download className="h-4 w-4" /> {isExporting ? "MENGONVERSI..." : "EKSPOR EXCEL"}
          </Button>
          
          <Link href="/dashboard/pos/kasir">
            <Button className="h-9 bg-black text-white text-xs font-black italic rounded-sm transition-all px-4">
              <Plus className="mr-1 h-4 w-4" /> BUAT JURNAL BARU
            </Button>
          </Link>
        </div>
      </div>

      {/* FILTER SEARCH TEXT & RENTANG TANGGAL */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 p-3 rounded-sm border border-zinc-200 shadow-sm">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input 
            placeholder="Cari No. Regis, Referensi, atau Memo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 p-1 pl-8 text-xs bg-white border-zinc-300 rounded-sm focus:ring-1 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-sm px-2 h-9">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[10px] uppercase text-zinc-400 font-black">Dari:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="outline-none text-xs font-mono bg-transparent cursor-pointer" />
          </div>
          
          <ArrowRight className="h-4 w-4 text-zinc-400" />

          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-sm px-2 h-9">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[10px] uppercase text-zinc-400 font-black">Sampai:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="outline-none text-xs font-mono bg-transparent cursor-pointer" />
          </div>

          {(startDate || endDate) && (
            <Button variant="ghost" onClick={handleResetFilterTanggal} className="h-9 px-2 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-sm uppercase tracking-wider">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* DATA RIWAYAT JURNAL TABLE - SEKARANG MENJADI 10 KOLOM TOTALNYA */}
      <div className="border border-zinc-300 rounded-sm overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-100">
            <TableRow className="hover:bg-zinc-100 border-b border-zinc-300 text-[10px] font-black uppercase">
              <TableHead className="w-[110px] text-zinc-800 border-r py-3 px-3 font-black">Tanggal</TableHead>
              <TableHead className="w-[130px] text-zinc-800 border-r px-3 font-black">No. Registrasi</TableHead>
              <TableHead className="w-[130px] text-zinc-800 border-r px-3 font-black">No. Referensi</TableHead> {/* <-- Header Kolom Baru */}
              <TableHead className="w-[170px] text-zinc-800 border-r px-3 font-black">Keterangan Jurnal (Memo)</TableHead>
              <TableHead className="w-[90px] text-zinc-800 border-r px-3 font-black">Kode Akun</TableHead>
              <TableHead className="w-[130px] text-zinc-800 border-r px-3 font-black">Nama Akun</TableHead>
              <TableHead className="w-[110px] text-zinc-800 border-r px-3 font-black">Tipe Akun</TableHead>
              <TableHead className="w-[110px] text-zinc-800 text-right border-r px-3 font-black">Debit (Rp)</TableHead>
              <TableHead className="w-[110px] text-zinc-800 text-right border-r px-3 font-black">Kredit (Rp)</TableHead>
              <TableHead className="w-[95px] text-zinc-800 text-center px-3 font-black">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-[11px] font-bold">
            {loading ? (
              <TableRow><TableCell colSpan={10} className="h-32 text-center text-zinc-400 italic">Menarik log data berdasarkan rentang waktu dari MySQL...</TableCell></TableRow>
            ) : filteredJurnal.length > 0 ? (
              filteredJurnal.map((jurnal) => {
                const totalItems = jurnal.items ? jurnal.items.length : 1;
                const isJurnalEditing = editingJurnalId === jurnal.id;

                return jurnal.items && jurnal.items.map((item: any, idx: number) => {
                  return (
                    <TableRow key={`${jurnal.id}-${idx}`} className="border-b border-zinc-200 hover:bg-zinc-50/20 transition-colors last:border-0">
                      
                      {/* === GABUNGAN ROWSPAN KOLOM KIRI (TANGGAL, NO REGIS, NO REFERENSI, MEMO) === */}
                      {idx === 0 && (
                        <>
                          <TableCell rowSpan={totalItems} className="py-3 px-2 border-r font-mono bg-zinc-50/50 align-top">
                            {isJurnalEditing ? (
                              <Input 
                                type="date"
                                value={editHeaderForm.tanggal || ""}
                                onChange={(e) => handleHeaderChange("tanggal", e.target.value)}
                                className="h-7 p-1 text-[11px] font-mono border-zinc-300 rounded-sm mt-1 bg-white focus-visible:ring-1 focus-visible:ring-black"
                              />
                            ) : (
                              <div className="flex items-center gap-1 mt-1 text-zinc-600">
                                <Calendar className="h-3 w-3 text-zinc-400" />
                                {new Date(jurnal.tanggal).toLocaleDateString('id-ID')}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell rowSpan={totalItems} className="px-2 border-r font-mono bg-zinc-50/50 align-top">
                            {isJurnalEditing ? (
                              <Input 
                                type="text"
                                value={editHeaderForm.no_registrasi || ""}
                                onChange={(e) => handleHeaderChange("no_registrasi", e.target.value)}
                                className="h-7 p-1 text-[11px] font-mono border-zinc-300 rounded-sm mt-1 bg-white focus-visible:ring-1 focus-visible:ring-black"
                              />
                            ) : (
                              <div className="flex items-center gap-1 mt-1 text-blue-700">
                                <Hash className="h-3 w-3 text-zinc-400" />
                                {jurnal.no_registrasi || "-"}
                              </div>
                            )}
                          </TableCell>

                          {/* === FIELD RENDERING BARU: NO REFERENSI DENGAN ROWSPAN === */}
                          <TableCell rowSpan={totalItems} className="px-2 border-r font-mono bg-zinc-50/50 align-top">
                            {isJurnalEditing ? (
                              <Input 
                                type="text"
                                value={editHeaderForm.no_referensi || ""}
                                onChange={(e) => handleHeaderChange("no_referensi", e.target.value)}
                                className="h-7 p-1 text-[11px] font-mono border-zinc-300 rounded-sm mt-1 bg-white focus-visible:ring-1 focus-visible:ring-black"
                              />
                            ) : (
                              <div className="flex items-center gap-1 mt-1 text-emerald-700">
                                <Bookmark className="h-3 w-3 text-zinc-400" />
                                {jurnal.no_referensi || "-"}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell rowSpan={totalItems} className="px-2 border-r bg-zinc-50/50 align-top">
                            {isJurnalEditing ? (
                              <Input 
                                type="text"
                                value={editHeaderForm.keterangan || ""}
                                onChange={(e) => handleHeaderChange("keterangan", e.target.value)}
                                className="h-7 p-1 text-[11px] uppercase border-zinc-300 rounded-sm mt-1 bg-white focus-visible:ring-1 focus-visible:ring-black"
                              />
                            ) : (
                              <div className="flex items-center gap-1 mt-1 text-zinc-500 font-medium uppercase tracking-tight">
                                <FileText className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                                <span className="break-all max-w-[150px]" title={jurnal.keterangan}>
                                  {jurnal.keterangan}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}

                      {/* === DATA DETAIL BARIS AKUN === */}
                      <TableCell className="font-mono text-zinc-500 py-2.5 px-3 border-r">
                        {isJurnalEditing ? (
                          <>
                            <Input 
                              type="text"
                              list={`edit-coa-${jurnal.id}-${idx}`}
                              value={editItemsForm[idx]?.no_akun ?? ""}
                              onChange={(e) => handleItemChange(idx, "no_akun", e.target.value)}
                              className="h-7 p-1 text-[11px] font-mono border-zinc-300 rounded-sm bg-white focus-visible:ring-1 focus-visible:ring-black"
                            />
                            <datalist id={`edit-coa-${jurnal.id}-${idx}`}>
                              {akunList.map((a) => (
                                <option key={a.id} value={a.no_akun}>{a.nama_akun}</option>
                              ))}
                            </datalist>
                          </>
                        ) : (
                          item.no_akun
                        )}
                      </TableCell>
                      
                      <TableCell className={`px-3 border-r uppercase tracking-tight text-zinc-800 ${item.kredit > 0 ? "pl-5 text-zinc-600 font-normal italic" : ""}`}>
                        {isJurnalEditing ? (
                          <Input 
                            readOnly
                            type="text"
                            value={editItemsForm[idx]?.nama_akun ?? ""}
                            className="h-7 p-1 text-[11px] uppercase bg-zinc-100 border-zinc-300 text-zinc-400 rounded-sm cursor-not-allowed"
                          />
                        ) : (
                          item.nama_akun
                        )}
                      </TableCell>

                      <TableCell className="px-3 border-r text-zinc-400 uppercase italic text-[10px]">
                        {isJurnalEditing ? (
                          <Input 
                            readOnly
                            type="text"
                            value={editItemsForm[idx]?.nama_kelompok ?? "General Parameter"}
                            className="h-7 p-1 text-[10px] uppercase bg-zinc-100 border-zinc-300 text-zinc-400 rounded-sm cursor-not-allowed"
                          />
                        ) : (
                          <Badge variant="outline" className="rounded-sm font-black text-[9px] bg-zinc-50 border-zinc-200 text-zinc-500 px-1.5 py-0">
                            {item.nama_kelompok || "General Parameter"}
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-right font-mono text-zinc-900 px-3 border-r bg-zinc-50/5">
                        {isJurnalEditing ? (
                          <Input 
                            type="number"
                            value={editItemsForm[idx]?.debit ?? 0} 
                            onChange={(e) => handleItemChange(idx, "debit", Number(e.target.value))}
                            className="h-7 text-xs bg-white border-zinc-300 rounded-sm w-full text-right font-mono focus-visible:ring-1 focus-visible:ring-black"
                          />
                        ) : (
                          item.debit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(item.debit) : "-"
                        )}
                      </TableCell>

                      <TableCell className="text-right font-mono text-zinc-900 px-3 border-r bg-zinc-50/5">
                        {isJurnalEditing ? (
                          <Input 
                            type="number"
                            value={editItemsForm[idx]?.kredit ?? 0} 
                            onChange={(e) => handleItemChange(idx, "kredit", Number(e.target.value))}
                            className="h-7 text-xs bg-white border-zinc-300 rounded-sm w-full text-right font-mono focus-visible:ring-1 focus-visible:ring-black"
                          />
                        ) : (
                          item.kredit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(item.kredit) : "-"
                        )}
                      </TableCell>

                      {/* === GABUNGAN KOLOM AKSI ROWSPAN === */}
                      {idx === 0 && (
                        <TableCell rowSpan={totalItems} className="px-3 text-center bg-zinc-50/50 align-middle">
                          {isJurnalEditing ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 animate-in fade-in duration-200">
                              <Button size="sm" variant="outline" onClick={() => saveEditJurnal(jurnal.id)} disabled={loading} className="h-7 w-full text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 rounded-sm font-black text-[10px] gap-1">
                                <Check className="h-3 w-3" /> SIMPAN
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditJurnal} disabled={loading} className="h-7 w-full text-zinc-500 hover:bg-zinc-200 rounded-sm font-bold text-[10px]">
                                BATAL
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => startEditJurnal(jurnal)} 
                                disabled={loading} 
                                className="h-7 w-full text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-sm text-[10px] font-bold flex items-center justify-start px-2 gap-1.5"
                              >
                                <Pencil className="h-3 w-3 text-zinc-400" /> EDIT
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleRemoveJurnalUtah(jurnal.id, jurnal.no_registrasi)} 
                                disabled={loading} 
                                className="h-7 w-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-sm text-[10px] font-bold flex items-center justify-start px-2 gap-1.5 italic"
                              >
                                <Trash2 className="h-3 w-3 text-rose-400" /> HAPUS
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}

                    </TableRow>
                  )
                })
              })
            ) : (
              <TableRow><TableCell colSpan={10} className="h-32 text-center text-zinc-400 italic">Tidak ada rekaman transaksi jurnal pada rentang waktu ini.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* PANEL INDIKATOR TOTAL BALANCE HALAMAN */}
      {!loading && filteredJurnal.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-100 p-4 rounded-sm border border-zinc-300 shadow-inner">
          <div className="flex items-center gap-2">
            {totalAccumulasi.isBalanced ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-sm text-[10px] font-black tracking-wider uppercase italic">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> TOTAL LIST BALANCE
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-700 bg-rose-100 border border-rose-300 px-3 py-1.5 rounded-sm text-[10px] font-black tracking-wider uppercase italic">
                <AlertTriangle className="h-4 w-4 text-rose-600" /> LIST TIDAK BALANCE
              </div>
            )}
          </div>

          <div className="flex gap-8 text-xs font-bold text-zinc-700">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Debit Kumulatif</p>
              <p className="font-mono text-sm text-black">
                Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalAccumulasi.debit)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Kredit Kumulatif</p>
              <p className="font-mono text-sm text-black">
                Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalAccumulasi.kredit)}
              </p>
            </div>
            {!totalAccumulasi.isBalanced && (
              <div className="space-y-0.5 border-l border-zinc-300 pl-6">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-wider">Total Selisih (Variance)</p>
                <p className="font-mono text-sm text-rose-600">
                  Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(Math.abs(totalAccumulasi.debit - totalAccumulasi.kredit))}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}