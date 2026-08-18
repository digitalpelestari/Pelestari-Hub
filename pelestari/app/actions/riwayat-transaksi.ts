// app/actions/riwayat-transaksi.ts
"use server"

import { db } from "@/lib/db"

export interface RiwayatSemuaTransaksi {
  id: number
  tanggal: string
  no_registrasi: string
  no_referensi: string
  keterangan: string
  sumber_dana: string   // Akun posisi KREDIT (misal: Bank, Kas, Utang, Pendapatan)
  tujuan_alokasi: string // Akun posisi DEBIT (misal: ATK, Akomodasi, Kas, Piutang)
  nominal: number
  items: any[]
}

export async function getRiwayatSemuaJurnal(startDate?: string, endDate?: string) {
  try {
    let query = `
      SELECT 
        j.id,
        j.tanggal,
        j.no_registrasi,
        j.no_referensi,
        j.keterangan,
        ji.id as item_id,
        ji.no_akun,
        ji.debit,
        ji.kredit,
        a.nama_akun,
        a.tipe_akun
      FROM tb_jurnal j
      JOIN tb_jurnal_item ji ON j.id = ji.jurnal_id
      LEFT JOIN tb_akun a ON ji.no_akun = a.no_akun
      WHERE 1=1
    `
    const params: any[] = []

    if (startDate && endDate) {
      query += ` AND j.tanggal BETWEEN ? AND ?`
      params.push(startDate, endDate)
    }

    query += ` ORDER BY j.tanggal DESC, j.id DESC`

    const [rows]: any = await db.execute(query, params)

    // Kelompokkan per Jurnal Header
    const grouped = rows.reduce((acc: any, row: any) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          tanggal: row.tanggal,
          no_registrasi: row.no_registrasi,
          no_referensi: row.no_referensi,
          keterangan: row.keterangan,
          items: []
        }
      }
      acc[row.id].items.push(row)
      return acc
    }, {})

    // Format menjadi baris transaksi riwayat
    const list: RiwayatSemuaTransaksi[] = Object.values(grouped).map((jurnal: any) => {
      const debitItems = jurnal.items.filter((i: any) => Number(i.debit) > 0)
      const kreditItems = jurnal.items.filter((i: any) => Number(i.kredit) > 0)

      // Nama Akun Posisi Debit (Tujuan Alokasi / Biaya / Aset masuk)
      const tujuan = debitItems.map((i: any) => i.nama_akun || i.no_akun).join(", ") || "-"
      
      // Nama Akun Posisi Kredit (Sumber Dana / Kas Keluar / Pendapatan)
      const sumber = kreditItems.map((i: any) => i.nama_akun || i.no_akun).join(", ") || "-"

      // Hitung total nilai transaksi jurnal tersebut
      const totalNominal = debitItems.reduce((sum: number, i: any) => sum + Number(i.debit || 0), 0)

      return {
        id: jurnal.id,
        tanggal: jurnal.tanggal,
        no_registrasi: jurnal.no_registrasi,
        no_referensi: jurnal.no_referensi,
        keterangan: jurnal.keterangan,
        sumber_dana: sumber,
        tujuan_alokasi: tujuan,
        nominal: totalNominal,
        items: jurnal.items
      }
    })

    return { success: true, data: list }
  } catch (error: any) {
    console.error("Gagal mengambil riwayat transaksi:", error)
    return { success: false, data: [], message: error.message }
  }
}