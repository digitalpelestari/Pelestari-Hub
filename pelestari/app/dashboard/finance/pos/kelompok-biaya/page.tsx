"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Edit2, Plus, Save, X, Search, SortAsc, List } from "lucide-react"
import { 
  getKelompokBiaya, 
  createKelompokBiaya, 
  updateKelompokBiaya, 
  deleteKelompokBiaya 
} from "@/app/actions/kelompok-biaya"

export default function KelompokBiayaPage() {
  const [list, setList] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [entriesPerPage, setEntriesPerPage] = useState("10")
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshData = async () => {
    const data = await getKelompokBiaya()
    setList(data)
  }

  useEffect(() => { refreshData() }, [])

  const filteredList = useMemo(() => {
    const result = list
      .filter((item) =>
        item.kelompok_biaya.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => a.kelompok_biaya.localeCompare(b.kelompok_biaya))
    
    const limit = parseInt(entriesPerPage)
    return result.slice(0, limit)
  }, [list, searchQuery, entriesPerPage])

  const handleSave = async () => {
    if (!input) return
    setLoading(true)
    if (editId) {
      await updateKelompokBiaya(editId, input)
    } else {
      await createKelompokBiaya(input)
    }
    setInput("")
    setEditId(null)
    await refreshData()
    setLoading(false)
  }

  return (
    <div className="p-6 w-full space-y-6 font-sans text-zinc-900">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-black">Master Kelompok Biaya</h1>
          <p className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase italic mt-0.5">
            Finance Parameters System
          </p>
        </div>
      </div>

      {/* TOP CONTROLS: INPUT & SEARCH */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border shadow-sm bg-zinc-50/50 rounded-md">
          <CardContent className="p-4 flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1">Kategori Biaya</label>
              <Input 
                placeholder="Tambah/Edit kategori..." 
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                className="h-10 text-sm font-bold bg-white border-zinc-300 focus:ring-1 focus:ring-black rounded-sm"
              />
            </div>
            <Button onClick={handleSave} disabled={loading} className="h-10 bg-black text-white px-8 text-xs font-black italic rounded-sm transition-all active:scale-95">
              {editId ? <Save className="mr-2 h-3.5 w-3.5"/> : <Plus className="mr-2 h-3.5 w-3.5"/>}
              {editId ? "UPDATE" : "SIMPAN"}
            </Button>
            {editId && <Button variant="outline" onClick={() => { setEditId(null); setInput(""); }} className="h-10 border rounded-sm px-3 bg-white"><X className="h-4 w-4"/></Button>}
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-white rounded-md">
          <CardContent className="p-4 flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase italic text-zinc-500 ml-1">Cari Nama</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <Input 
                  placeholder="Ketik untuk memfilter list..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 text-sm font-medium bg-zinc-50/50 border-zinc-300 focus:ring-1 focus:ring-black rounded-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABLE AREA */}
      <div className="space-y-2">
        {/* ROW LIMIT SELECTOR - Sekarang nempel di atas tabel sebelah kanan */}
        <div className="flex justify-between items-center px-1">
           <div className="flex items-center gap-2">
              <SortAsc className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-black text-zinc-400 uppercase italic">Sorted A-Z</span>
           </div>
           <div className="flex items-center gap-3">
              <label className="text-[10px] font-black uppercase italic text-zinc-400">Baris:</label>
          <Select 
  value={entriesPerPage|| ""} 
  onValueChange={(val) => setEntriesPerPage(val as any)}
>
                <SelectTrigger className="h-8 w-[80px] bg-zinc-100 border-none text-[10px] font-black rounded-sm shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10" className="text-[10px] font-bold">10</SelectItem>
                  <SelectItem value="50" className="text-[10px] font-bold">50</SelectItem>
                  <SelectItem value="100" className="text-[10px] font-bold">100</SelectItem>
                </SelectContent>
              </Select>
           </div>
        </div>

        <div className="border border-zinc-300 rounded-sm overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow className="hover:bg-zinc-50 border-b border-zinc-300">
                <TableHead className="w-[60px] text-zinc-800 font-black uppercase text-[10px] text-center py-4">No</TableHead>
                <TableHead className="text-zinc-800 font-black uppercase text-[10px] tracking-widest">Nama Kelompok Biaya</TableHead>
                <TableHead className="w-[120px] text-zinc-800 font-black uppercase text-[10px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length > 0 ? (
                filteredList.map((item, index) => (
                  <TableRow key={item.id} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="text-center font-mono text-[11px] font-bold text-zinc-400 py-3">
                      {(index + 1).toString().padStart(2, '0')}
                    </TableCell>
                    <TableCell className="font-bold  text-[11px] tracking-tight text-zinc-700 py-3">
                      {item.kelompok_biaya}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-zinc-200 rounded-sm" onClick={() => { setEditId(item.id); setInput(item.kelompok_biaya); }}>
                          <Edit2 className="h-3.5 w-3.5 text-zinc-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-sm" onClick={async () => { if(confirm(`Hapus data?`)) { await deleteKelompokBiaya(item.id); refreshData(); }}}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-32 text-center text-zinc-400 text-[10px] font-bold uppercase italic tracking-[0.2em]">Data tidak ditemukan</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-[9px] text-zinc-400 italic flex justify-between px-1">
        <p>* Menampilkan {filteredList.length} dari total {list.length} data.</p>
      </div>
    </div>
  )
}