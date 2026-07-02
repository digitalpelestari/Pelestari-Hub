"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog"
import { Trash2, Edit2, Plus, Save, X, Search } from "lucide-react"
import { getAkunList, createAkun, updateAkun, deleteAkun } from "@/app/actions/akun"
import { getKelompokBiaya } from "@/app/actions/kelompok-biaya"

export default function DaftarAkunPage() {
  const [list, setList] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // State Form Input
  const [noAkun, setNoAkun] = useState("")
  const [namaAkun, setNamaAkun] = useState("")
  const [categoryInput, setCategoryInput] = useState("") // State teks yang diketik user
  const [saldo, setSaldo] = useState("0")
  const [isAktif, setIsAktif] = useState(1)
  const [editId, setEditId] = useState<number | null>(null)

  // State Filter (Sidebar Kiri)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("ALL")
  const [filterAktif, setFilterAktif] = useState("1")

  const loadInitialData = async () => {
    setLoading(true)
    const [dataAkun, dataKategori] = await Promise.all([getAkunList(), getKelompokBiaya()])
    setList(dataAkun)
    setCategories(dataKategori)
    setLoading(false)
  }

  useEffect(() => { loadInitialData() }, [])

  // LOGIKA FILTERING DATA TABLE
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesSearch = 
        item.no_akun.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nama_akun.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = filterType === "ALL" || item.kelompok_biaya_id.toString() === filterType
      
      let matchesStatus = true
      if (filterAktif !== "ALL") {
        matchesStatus = item.is_aktif.toString() === filterAktif
      }

      return matchesSearch && matchesType && matchesStatus
    })
  }, [list, searchQuery, filterType, filterAktif])

  // MENCARI ID BERDASARKAN TEKS YANG DIKETIK/DIPILIH USER
  const selectedCatId = useMemo(() => {
    const found = categories.find(
      (cat) => cat.kelompok_biaya.toLowerCase() === categoryInput.toLowerCase()
    )
    return found ? found.id : null
  }, [categoryInput, categories])

  const handleOpenAddModal = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEditModal = (item: any) => {
    setEditId(item.id)
    setNoAkun(item.no_akun)
    setNamaAkun(item.nama_akun)
    setSaldo(item.saldo.toString())
    setIsAktif(item.is_aktif)
    
    // Cari nama teks kelompok biaya berdasarkan ID untuk ditampilkan di input ketik
    const currentCat = categories.find((cat) => cat.id === item.kelompok_biaya_id)
    setCategoryInput(currentCat ? currentCat.kelompok_biaya : "")
    
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!noAkun || !namaAkun || !categoryInput) {
      return alert("Mohon lengkapi semua kolom wajib!")
    }
    
    if (!selectedCatId) {
      return alert("Tipe Akun tidak valid! Pilih dari list rekomendasi yang muncul saat mengetik.")
    }

    setLoading(true)

    const payload = {
      no_akun: noAkun,
      nama_akun: namaAkun,
      kelompok_biaya_id: selectedCatId, // Mengirimkan ID asli (integer) hasil convert text
      saldo: parseFloat(saldo) || 0,
      is_aktif: isAktif
    }

    let res
    if (editId) {
      res = await updateAkun(editId, payload)
    } else {
      res = await createAkun(payload)
    }

    if (res && !res.success) {
      alert("Gagal memproses data: " + res.message)
    } else {
      setIsDialogOpen(false)
      resetForm()
      const updated = await getAkunList()
      setList(updated)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setNoAkun("")
    setNamaAkun("")
    setCategoryInput("")
    setSaldo("0")
    setIsAktif(1)
    setEditId(null)
  }

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(amount)
  }

  return (
    <div className="flex w-full min-h-screen font-sans bg-zinc-50 text-zinc-900">
      
      {/* SIDEBAR FILTER (SEBELAH KIRI) */}
      <div className="w-[260px] bg-zinc-900 text-zinc-200 p-4 space-y-6 flex-shrink-0 select-none border-r border-zinc-800">
        <div className="border-b border-zinc-800 pb-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Panel Filter COA</p>
        </div>

        {/* Filter Tipe Akun */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tipe Akun:</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 bg-zinc-800 border-none text-xs rounded-sm text-white focus:ring-0">
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Tipe</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.kelompok_biaya}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Non-Aktif */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Non Aktif?</label>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="filterAktif" checked={filterAktif === "0"} onChange={() => setFilterAktif("0")} className="accent-blue-500" />
              <span>Ya (Hanya Non-Aktif)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="filterAktif" checked={filterAktif === "1"} onChange={() => setFilterAktif("1")} className="accent-blue-500" />
              <span>Tidak (Hanya Aktif)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="filterAktif" checked={filterAktif === "ALL"} onChange={() => setFilterAktif("ALL")} className="accent-blue-500" />
              <span>Semua Akun</span>
            </label>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => { setFilterType("ALL"); setFilterAktif("1"); setSearchQuery(""); }} className="w-full h-8 text-[10px] font-black border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 rounded-sm">
          RESET FILTER
        </Button>
      </div>

      {/* KONTEN UTAMA TABLE (SEBELAH KANAN) */}
      <div className="flex-1 p-5 space-y-5">
        
        {/* HEADER & TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-3">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic text-black">Daftar Akun [Chart of Accounts]</h1>
            <p className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase italic">Pelestari Finance Core v3.0</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input 
                placeholder="Cari No. Akun atau Nama..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs bg-white border-zinc-300 rounded-sm focus:ring-1 focus:ring-black"
              />
            </div>
            <Button onClick={handleOpenAddModal} className="h-9 bg-black text-white text-xs font-black italic rounded-sm transition-all active:scale-95 px-4">
              <Plus className="mr-1 h-4 w-4" /> TAMBAH AKUN BARU
            </Button>
          </div>
        </div>

        {/* COMPACT DATA TABLE */}
        <div className="border border-zinc-300 rounded-sm overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-zinc-100">
              <TableRow className="hover:bg-zinc-100 border-b border-zinc-300 text-[10px] font-black uppercase">
                <TableHead className="w-[120px] text-zinc-800 border-r py-3 px-3 font-black">No. Akun</TableHead>
                <TableHead className="text-zinc-800 border-r px-3 font-black">Nama Akun</TableHead>
                <TableHead className="w-[180px] text-zinc-800 border-r px-3 font-black">Tipe Akun</TableHead>
                <TableHead className="w-[160px] text-zinc-800 text-right border-r px-3 font-black">Saldo</TableHead>
                <TableHead className="w-[80px] text-zinc-800 text-center border-r font-black">Status</TableHead>
                <TableHead className="w-[90px] text-zinc-800 text-center font-black">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-[11px] font-bold">
              {loading && list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 italic">Memproses database...</TableCell></TableRow>
              ) : filteredList.length > 0 ? (
                filteredList.map((item) => (
                  <TableRow key={item.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70 transition-colors ${item.is_aktif === 0 ? "opacity-50 bg-zinc-50 italic" : ""}`}>
                    <TableCell className="font-mono text-zinc-600 py-2.5 px-3 border-r">{item.no_akun}</TableCell>
                    <TableCell className="text-zinc-800 uppercase px-3 border-r">{item.nama_akun}</TableCell>
                    <TableCell className="text-zinc-500 uppercase px-3 border-r">{item.nama_kelompok || "Tanpa Kategori"}</TableCell>
                    <TableCell className="text-right font-mono text-zinc-900 px-3 border-r">{formatIDR(item.saldo)}</TableCell>
                    <TableCell className="text-center border-r">
                      <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider ${item.is_aktif === 1 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>
                        {item.is_aktif === 1 ? "Aktif" : "Non-Aktif"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 px-1 text-center">
                      <div className="flex justify-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-sm hover:bg-zinc-100" onClick={() => handleOpenEditModal(item)}>
                          <Edit2 className="h-3 w-3 text-zinc-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-sm hover:bg-red-50 hover:text-red-600" onClick={async () => { if(confirm(`Hapus akun ${item.nama_akun}?`)) { await deleteAkun(item.id); loadInitialData(); }}}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 italic">Tidak ada data akun yang sesuai filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* POPUP MODAL DIALOG DENGAN SEARCHABLE INPUT (DATALIST) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-md border border-zinc-200 bg-white p-6 font-sans text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase italic tracking-tighter text-black">
              {editId ? "Update Data Akun" : "Tambah Akun Keuangan"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500">No. Akun *</label>
              <Input placeholder="Contoh: 1-1101" value={noAkun} onChange={(e) => setNoAkun(e.target.value)} className="h-9 font-mono font-bold rounded-sm border-zinc-300 focus:ring-1 focus:ring-black" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500">Nama Akun *</label>
              <Input placeholder="Nama akun keuangan..." value={namaAkun} onChange={(e) => setNamaAkun(e.target.value)} className="h-9 font-bold rounded-sm border-zinc-300 focus:ring-1 focus:ring-black" />
            </div>
            
            {/* PERBAIKAN: SEKARANG BISA DIKETIK DAN OTOMATIS SEARCH */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500">Tipe (Kelompok Biaya) *</label>
              <Input 
                list="categories-list" // Menghubungkan input dengan elemen datalist di bawah
                placeholder="Ketik untuk mencari tipe akun..." 
                value={categoryInput} 
                onChange={(e) => setCategoryInput(e.target.value)}
                className="h-9 font-bold rounded-sm border-zinc-300 focus:ring-1 focus:ring-black text-xs text-black"
              />
              {/* Wadah Opsi Pencarian */}
              <datalist id="categories-list">
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.kelompok_biaya} />
                ))}
              </datalist>
              {categoryInput && !selectedCatId && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">
                  ⚠️ Nama tidak terdaftar, pilih dari opsi yang muncul!
                </p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500">Saldo Awal</label>
              <Input type="number" placeholder="0" value={saldo} onChange={(e) => setSaldo(e.target.value)} className="h-9 font-mono font-bold rounded-sm border-zinc-300 focus:ring-1 focus:ring-black" />
            </div>

            {editId && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase italic text-zinc-500">Status Aktivasi</label>
                <Select value={isAktif.toString()} onValueChange={(val) => setIsAktif(parseInt(val))}>
                  <SelectTrigger className="h-9 bg-white border-zinc-300 rounded-sm font-bold text-xs focus:ring-0 text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs font-bold">Aktif</SelectItem>
                    <SelectItem value="0" className="text-xs font-bold">Non-Aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-9 border border-zinc-300 rounded-sm text-xs font-bold px-4 bg-white">
              BATAL
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-9 bg-black text-white text-xs font-black italic rounded-sm px-6 transition-all active:scale-95">
              {loading ? "PROSES..." : editId ? "UPDATE DATA" : "SIMPAN DATA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}