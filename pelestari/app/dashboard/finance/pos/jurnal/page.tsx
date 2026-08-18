"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, Search, Calendar, Landmark, Hash, Bookmark,
  CheckCircle2, AlertTriangle, Pencil, Check, Trash2, FileText, Download, X 
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
      
      setJurnalList(Array.isArray(dataJurnal) ? dataJurnal : [])
      setAkunList(Array.isArray(dataAkun) ? dataAkun : [])
    } catch (error) {
      console.error("Gagal memuat data pembukuan:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

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
      if (jurnal.items && Array.isArray(jurnal.items)) {
        jurnal.items.forEach((item: any) => {
          debit += Number(item.debit) || 0
          kredit += Number(item.kredit) || 0
        })
      }
    })
    return { debit, kredit, isBalanced: debit === kredit && debit > 0 }
  }, [filteredJurnal])

  const startEditJurnal = (jurnal: any) => {
    setEditingJurnalId(jurnal.id)
    setEditHeaderForm({
      tanggal: jurnal.tanggal ? new Date(jurnal.tanggal).toISOString().split('T')[0] : "",
      no_registrasi: jurnal.no_registrasi || "",
      no_referensi: jurnal.no_referensi || "",
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
    setEditHeaderForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (itemIndex: number, field: string, value: any) => {
    setEditItemsForm((prev) => {
      const updated = [...prev]
      updated[itemIndex] = { ...updated[itemIndex] }
      
      if (field === "no_akun") {
        updated[itemIndex].no_akun = value
        const targetAkun = akunList.find(a => a.no_akun === value)
        updated[itemIndex].nama_akun = targetAkun ? targetAkun.nama_akun : ""
        updated[itemIndex].nama_kelompok = targetAkun ? (targetAkun.kelompok_biaya || targetAkun.nama_kelompok || "General") : ""
      } else {
        updated[itemIndex][field] = value
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
      alert(`Gagal Simpan: Transaksi Jurnal TIDAK BALANCE!\nTotal Debit: Rp ${totalDebitJurnal.toLocaleString("id-ID")}\nTotal Kredit: Rp ${totalKreditJurnal.toLocaleString("id-ID")}`);
      return
    }

    setLoading(true)
    try {
      for (const item of editItemsForm) {
        if (!item.id) {
          throw new Error("ID baris transaksi hilang.");
        }

        await updateJurnalItem(item.id, {
          jurnal_id: jurnalId,
          tanggal: editHeaderForm.tanggal,
          no_registrasi: editHeaderForm.no_registrasi,
          no_referensi: editHeaderForm.no_referensi,
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
    <div className="p-6 w-full space-y-6 font-sans bg-zinc-50/50 min-h-screen text-zinc-900">
      
      {/* HEADER BAR UTAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm w-full">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 text-white rounded-lg">
              <Landmark className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Jurnal Umum Pembukuan</h1>
          </div>
          <p className="text-xs text-zinc-500 pl-9">
            Kelola, pantau, dan audit seluruh rekaman transaksi buku besar secara real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleDownloadExcel} 
            disabled={isExporting || loading} 
            variant="outline" 
            className="h-10 border-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg px-4 gap-2 hover:bg-zinc-50 transition-all"
          >
            <Download className="h-4 w-4 text-zinc-500" /> 
            {isExporting ? "MENGONVERSI..." : "EKSPOR EXCEL"}
          </Button>
          
          <Link href="/dashboard/finance/pos/kasir">
            <Button className="h-10 bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold rounded-lg px-4 gap-2 shadow-sm transition-all">
              <Plus className="h-4 w-4" /> BUAT JURNAL BARU
            </Button>
          </Link>
        </div>
      </div>

      {/* FILTER BAR (SEARCH & DATE RANGE) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm w-full">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Cari No. Regis, Referensi, atau Memo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 text-xs bg-zinc-50/50 border-zinc-200 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-50/50 border border-zinc-200 rounded-lg px-3 h-10">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] uppercase text-zinc-400 font-bold">Dari:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="outline-none text-xs font-medium text-zinc-700 bg-transparent cursor-pointer" 
            />
          </div>
          
          <span className="text-zinc-300 font-medium">/</span>

          <div className="flex items-center gap-2 bg-zinc-50/50 border border-zinc-200 rounded-lg px-3 h-10">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] uppercase text-zinc-400 font-bold">Sampai:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="outline-none text-xs font-medium text-zinc-700 bg-transparent cursor-pointer" 
            />
          </div>

          {(startDate || endDate) && (
            <Button 
              variant="ghost" 
              onClick={handleResetFilterTanggal} 
              className="h-10 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg gap-1.5"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* TABEL DATA JURNAL DENGAN SCROLL HORIZONTAL YANG AMAN */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm w-full overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[1000px] border-collapse">
            <TableHeader className="bg-zinc-50/70 border-b border-zinc-200">
              <TableRow className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                <TableHead className="py-3.5 px-4 w-[110px]">Tanggal</TableHead>
                <TableHead className="py-3.5 px-4 w-[130px]">No. Registrasi</TableHead>
                <TableHead className="py-3.5 px-4 w-[130px]">No. Referensi</TableHead> 
                <TableHead className="py-3.5 px-4 min-w-[200px]">Keterangan (Memo)</TableHead>
                <TableHead className="py-3.5 px-4 w-[90px]">Kode Akun</TableHead>
                <TableHead className="py-3.5 px-4 min-w-[150px]">Nama Akun</TableHead>
                <TableHead className="py-3.5 px-4 w-[120px]">Tipe Akun</TableHead>
                <TableHead className="py-3.5 px-4 w-[120px] text-right">Debit (Rp)</TableHead>
                <TableHead className="py-3.5 px-4 w-[120px] text-right">Kredit (Rp)</TableHead>
                <TableHead className="py-3.5 px-4 w-[90px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-medium text-zinc-700 divide-y divide-zinc-100">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center text-zinc-400 italic">
                    Memuat data transaksi dari server...
                  </TableCell>
                </TableRow>
              ) : filteredJurnal.length > 0 ? (
                filteredJurnal.map((jurnal) => {
                  const itemsArray = Array.isArray(jurnal.items) ? jurnal.items : [];
                  const totalItems = itemsArray.length > 0 ? itemsArray.length : 1;
                  const isJurnalEditing = editingJurnalId === jurnal.id;

                  const itemsToRender = itemsArray.length > 0 ? itemsArray : [{ no_akun: "-", nama_akun: "Detail kosong", debit: 0, kredit: 0 }];

                  return itemsToRender.map((item: any, idx: number) => {
                    return (
                      <TableRow key={`${jurnal.id}-${idx}`} className="hover:bg-zinc-50/60 transition-colors">
                        
                        {idx === 0 && (
                          <>
                            <TableCell rowSpan={totalItems} className="py-4 px-4 align-top bg-zinc-50/30 border-r border-zinc-100 font-mono text-zinc-600">
                              {isJurnalEditing ? (
                                <Input 
                                  type="date"
                                  value={editHeaderForm.tanggal || ""}
                                  onChange={(e) => handleHeaderChange("tanggal", e.target.value)}
                                  className="h-8 text-xs font-mono bg-white border-zinc-300 rounded-md"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.tanggal ? new Date(jurnal.tanggal).toLocaleDateString('id-ID') : "-"}
                                </div>
                              )}
                            </TableCell>
                            
                            <TableCell rowSpan={totalItems} className="py-4 px-4 align-top bg-zinc-50/30 border-r border-zinc-100 font-mono text-blue-600 font-semibold">
                              {isJurnalEditing ? (
                                <Input 
                                  type="text"
                                  value={editHeaderForm.no_registrasi || ""}
                                  onChange={(e) => handleHeaderChange("no_registrasi", e.target.value)}
                                  className="h-8 text-xs font-mono bg-white border-zinc-300 rounded-md"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Hash className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.no_registrasi || "-"}
                                </div>
                              )}
                            </TableCell>

                            <TableCell rowSpan={totalItems} className="py-4 px-4 align-top bg-zinc-50/30 border-r border-zinc-100 font-mono text-emerald-600">
                              {isJurnalEditing ? (
                                <Input 
                                  type="text"
                                  value={editHeaderForm.no_referensi || ""}
                                  onChange={(e) => handleHeaderChange("no_referensi", e.target.value)}
                                  className="h-8 text-xs font-mono bg-white border-zinc-300 rounded-md"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Bookmark className="h-3.5 w-3.5 text-zinc-400" />
                                  {jurnal.no_referensi || "-"}
                                </div>
                              )}
                            </TableCell>
                            
                            <TableCell rowSpan={totalItems} className="py-4 px-4 align-top bg-zinc-50/30 border-r border-zinc-100 text-zinc-600 max-w-[250px]">
                              {isJurnalEditing ? (
                                <Input 
                                  type="text"
                                  value={editHeaderForm.keterangan || ""}
                                  onChange={(e) => handleHeaderChange("keterangan", e.target.value)}
                                  className="h-8 text-xs uppercase bg-white border-zinc-300 rounded-md"
                                />
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                                  <span className="uppercase leading-relaxed break-words">{jurnal.keterangan || "-"}</span>
                                </div>
                              )}
                            </TableCell>
                          </>
                        )}

                        {/* DETAIL BARIS AKUN */}
                        <TableCell className="py-3 px-4 font-mono text-zinc-600 border-r border-zinc-100 whitespace-nowrap">
                          {isJurnalEditing ? (
                            <>
                              <Input 
                                type="text"
                                list={`edit-coa-${jurnal.id}-${idx}`}
                                value={editItemsForm[idx]?.no_akun ?? ""}
                                onChange={(e) => handleItemChange(idx, "no_akun", e.target.value)}
                                className="h-8 text-xs font-mono bg-white border-zinc-300 rounded-md"
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
                        
                        <TableCell className={`py-3 px-4 border-r border-zinc-100 font-medium uppercase ${item.kredit > 0 ? "pl-8 text-zinc-500 italic" : "text-zinc-900"}`}>
                          {isJurnalEditing ? (
                            <Input 
                              readOnly
                              type="text"
                              value={editItemsForm[idx]?.nama_akun ?? ""}
                              className="h-8 text-xs uppercase bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed rounded-md"
                            />
                          ) : (
                            item.nama_akun
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4 border-r border-zinc-100 whitespace-nowrap">
                          {isJurnalEditing ? (
                            <Input 
                              readOnly
                              type="text"
                              value={editItemsForm[idx]?.nama_kelompok ?? "General"}
                              className="h-8 text-xs uppercase bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed rounded-md"
                            />
                          ) : (
                            <Badge variant="outline" className="rounded-md font-medium text-[10px] bg-zinc-50 border-zinc-200 text-zinc-600 px-2 py-0.5">
                              {item.nama_kelompok || "General"}
                            </Badge>
                          )}
                        </TableCell>
                        
                        <TableCell className="py-3 px-4 text-right font-mono text-zinc-900 border-r border-zinc-100 whitespace-nowrap">
                          {isJurnalEditing ? (
                            <Input 
                              type="number"
                              value={editItemsForm[idx]?.debit ?? 0} 
                              onChange={(e) => handleItemChange(idx, "debit", Number(e.target.value))}
                              className="h-8 text-xs bg-white border-zinc-300 rounded-md text-right font-mono"
                            />
                          ) : (
                            item.debit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(item.debit) : "-"
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-right font-mono text-zinc-900 border-r border-zinc-100 whitespace-nowrap">
                          {isJurnalEditing ? (
                            <Input 
                              type="number"
                              value={editItemsForm[idx]?.kredit ?? 0} 
                              onChange={(e) => handleItemChange(idx, "kredit", Number(e.target.value))}
                              className="h-8 text-xs bg-white border-zinc-300 rounded-md text-right font-mono"
                            />
                          ) : (
                            item.kredit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(item.kredit) : "-"
                          )}
                        </TableCell>

                        {idx === 0 && (
                          <TableCell rowSpan={totalItems} className="py-3 px-3 text-center align-middle bg-zinc-50/30 whitespace-nowrap">
                            {isJurnalEditing ? (
                              <div className="flex flex-col gap-1.5 w-24 mx-auto">
                                <Button size="sm" onClick={() => saveEditJurnal(jurnal.id)} disabled={loading} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold gap-1 shadow-sm">
                                  <Check className="h-3 w-3" /> SIMPAN
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEditJurnal} disabled={loading} className="h-7 text-zinc-500 hover:bg-zinc-200 rounded-md text-[10px] font-bold">
                                  Batal
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => startEditJurnal(jurnal)} 
                                  disabled={loading} 
                                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg"
                                  title="Edit Jurnal"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => handleRemoveJurnalUtah(jurnal.id, jurnal.no_registrasi)} 
                                  disabled={loading} 
                                  className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                  title="Hapus Jurnal"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-zinc-400 italic">
                    Tidak ada rekaman transaksi jurnal pada rentang waktu ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* PANEL INDIKATOR TOTAL KUMULATIF (FOOTER SUMMARY) */}
      {!loading && filteredJurnal.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm w-full">
          <div className="flex items-center gap-3">
            {totalAccumulasi.isBalanced ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> TOTAL BALANCE
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide">
                <AlertTriangle className="h-4 w-4 text-rose-600" /> TIDAK BALANCE
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-600">
            <div className="space-y-0.5 text-right">
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Total Debit</p>
              <p className="font-mono text-sm font-bold text-zinc-900">
                Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalAccumulasi.debit)}
              </p>
            </div>
            
            <div className="h-8 w-px bg-zinc-200 hidden sm:block"></div>

            <div className="space-y-0.5 text-right">
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Total Kredit</p>
              <p className="font-mono text-sm font-bold text-zinc-900">
                Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalAccumulasi.kredit)}
              </p>
            </div>

            {!totalAccumulasi.isBalanced && (
              <>
                <div className="h-8 w-px bg-zinc-200 hidden sm:block"></div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] text-rose-500 uppercase font-semibold">Selisih (Variance)</p>
                  <p className="font-mono text-sm font-bold text-rose-600">
                    Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(Math.abs(totalAccumulasi.debit - totalAccumulasi.kredit))}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}