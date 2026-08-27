// app/actions/export-buku-kas.ts
"use server"

import ExcelJS from "exceljs"
import { getJurnalList } from "@/app/actions/jurnal"

export async function exportBukuKasToExcel(startDate?: string, endDate?: string) {
  try {
const rawJurnal = await getJurnalList(startDate, endDate)

if (!rawJurnal.success) {
  throw new Error(rawJurnal.message || "Gagal mengambil data jurnal")
}

const list = Array.isArray(rawJurnal.data)
  ? rawJurnal.data
  : []

    // 1. Urutkan transaksi dari terlama ke terbaru untuk running saldo
    const sorted = [...list].sort((a: any, b: any) => {
      const dateA = new Date(a.tanggal).getTime()
      const dateB = new Date(b.tanggal).getTime()
      return dateA === dateB ? a.id - b.id : dateA - dateB
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Pengeluaran Kas")

    // 2. Set Lebar Kolom
    worksheet.columns = [
      { key: "no", width: 6 },
      { key: "no_regist", width: 18 },
      { key: "tanggal", width: 14 },
      { key: "kelompok_biaya", width: 30 },
      { key: "jenis_biaya", width: 28 },
      { key: "keterangan", width: 45 },
      { key: "debit", width: 18 },
      { key: "kredit", width: 18 },
      { key: "total_saldo", width: 20 },
    ]

    // 3. Header Title Bar
    worksheet.mergeCells("A1:I1")
    const titleCell = worksheet.getCell("A1")
    titleCell.value = `Pengeluaran Kas (${startDate || "Awal"} s/d ${endDate || "Sekarang"})`
    titleCell.font = { name: "Calibri", size: 12, bold: true }
    titleCell.alignment = { horizontal: "center", vertical: "middle" }

    // 4. Header Tabel
    const headerRow = worksheet.addRow([
      "No",
      "No Regist",
      "Tanggal",
      "Kelompok Biaya",
      "Jenis Biaya",
      "Keterangan",
      "Debit",
      "Kredit",
      "Total Saldo",
    ])

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E5631" }, // Hijau tua persis Excel
      }
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      }
    })

    // 5. Isi Data Baris & Perhitungan Saldo
    let runningSaldo = 0

    sorted.forEach((jurnal: any, idx: number) => {
      const items = Array.isArray(jurnal.items) ? jurnal.items : []
      const kasItem = items.find((i: any) =>
        String(i.no_akun) === "11100" ||
        String(i.no_akun) === "11200" ||
        (i.nama_akun && i.nama_akun.toLowerCase().includes("kas")) ||
        (i.nama_akun && i.nama_akun.toLowerCase().includes("petty"))
      )
      const lawanItem = items.find((i: any) => i !== kasItem) || items[0] || {}

      const debit = kasItem ? Number(kasItem.debit) || 0 : 0
      const kredit = kasItem ? Number(kasItem.kredit) || 0 : 0
      runningSaldo = runningSaldo + debit - kredit
      const isTopUp = debit > 0

      const formattedDate = jurnal.tanggal
        ? new Date(jurnal.tanggal).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          })
        : "-"

      const row = worksheet.addRow([
        idx + 1,
        jurnal.no_registrasi || "-",
        formattedDate,
        lawanItem.nama_kelompok || lawanItem.kelompok_biaya || (isTopUp ? "Kas / Petty Cash" : "Biaya Operasional"),
        lawanItem.nama_akun || (isTopUp ? "Petty Cash" : "Operasional"),
        jurnal.keterangan || "-",
        debit > 0 ? debit : null,
        kredit > 0 ? kredit : null,
        runningSaldo,
      ])

      // Format Angka Rupiah
      row.getCell(7).numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)'
      row.getCell(8).numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)'
      row.getCell(9).numFmt = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)'

      // Alignments & Borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
        if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
          cell.alignment = { horizontal: "center", vertical: "middle" }
        } else if (colNumber >= 7) {
          cell.alignment = { horizontal: "right", vertical: "middle" }
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" }
        }

        // Highlight Kuning untuk Top Up Kas (seperti template Excel perusahaan)
        if (isTopUp) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFF00" }, // Kuning
          }
          cell.font = { bold: true }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    return {
      success: true,
      base64,
      fileName: `Pengeluaran_Kas_${startDate || "All"}_sd_${endDate || "Now"}.xlsx`,
    }
  } catch (error: any) {
    console.error("Gagal export excel:", error)
    return { success: false, message: error.message }
  }
}