"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getLabaRugiData } from "@/app/actions/labarugi"

const BULAN_NAMES: Record<string, string> = {
  "1": "Januari", "2": "Februari", "3": "Maret", "4": "April",
  "5": "Mei", "6": "Juni", "7": "Juli", "8": "Agustus",
  "9": "September", "10": "Oktober", "11": "November", "12": "Desember"
}

/**
 * 1. Ambil data kalkulasi Laba Rugi dan cek saldo 13004 & 13003 saat ini
 */
export async function getPreviewIkhtisar(year: string, month: string) {
  try {
    const reportData = await getLabaRugiData(year, month)
    const labaBersih = Number(reportData?.labaBersih || 0)
    const totalPendapatan = Number(reportData?.totalPendapatan || 0)
    const totalBeban = Number((reportData?.totalBebanUsaha || 0) + (reportData?.totalPnbpDanPajak || 0))

    // Ambil saldo akun 13004 dan 13003 di tb_akun
    const [rows]: any = await db.query(
      `SELECT no_akun, saldo FROM tb_akun WHERE no_akun IN ('13003', '13004')`
    )

    let saldo13004 = 0
    let saldo13003 = 0

    if (Array.isArray(rows)) {
      rows.forEach((r: any) => {
        if (r.no_akun === "13004") saldo13004 = Number(r.saldo || 0)
        if (r.no_akun === "13003") saldo13003 = Number(r.saldo || 0)
      })
    }

    return {
      success: true,
      data: {
        totalPendapatan,
        totalBeban,
        labaBersih,
        saldo13004,
        saldo13003
      }
    }
  } catch (error: any) {
    console.error("Gagal membaca preview laba rugi:", error)
    return { success: false, message: error?.message || "Gagal memuat data." }
  }
}

/**
 * 2. Eksekusi 2 Proses Sekaligus (Dalam 1 Transaksi):
 *    Proses 1: Total laba rugi ditampung ke akun 13004 (Ikhtisar L/R)
 *    Proses 2: Saldo 13004 dipindahkan ke 13003 (Laba Tahun Berjalan), lalu 13004 di-set kembali ke 0
 */
export async function executeTwoStepClosing(year: string, month: string) {
  const connection = await db.getConnection()

  try {
    const monthLabel = BULAN_NAMES[month] || `Bulan ${month}`

    // Ambil angka laba bersih dari laporan laba rugi
    const reportData = await getLabaRugiData(year, month)
    const labaBersih = Number(reportData?.labaBersih || 0)

    if (labaBersih === 0) {
      return {
        success: false,
        message: `Total Laba/Rugi bulan ${monthLabel} ${year} adalah Rp 0, tidak ada yang perlu diproses.`
      }
    }

    // Mulai Transaksi Database
    await connection.beginTransaction()

    // -------------------------------------------------------------
    // PROSES 1: Tampung totalan Laba/Rugi ke Akun 13004 (Ikhtisar L/R)
    // -------------------------------------------------------------
    await connection.query(
      `UPDATE tb_akun SET saldo = ? WHERE no_akun = '13004'`,
      [labaBersih]
    )

    // -------------------------------------------------------------
    // PROSES 2: Pindahkan dari Akun 13004 ke Akun 13003 (Laba Berjalan)
    // - Akun 13003 bertambah sebesar labaBersih
    // - Akun 13004 dinolkan kembali (Rp 0) karena penampungan selesai
    // -------------------------------------------------------------
    await connection.query(
      `UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = '13003'`,
      [labaBersih]
    )

    await connection.query(
      `UPDATE tb_akun SET saldo = 0 WHERE no_akun = '13004'`
    )

    // Commit transaksi
    await connection.commit()

    revalidatePath("/neraca")
    revalidatePath("/closing")

    const formattedLaba = labaBersih < 0 
      ? `(Rp ${Math.abs(labaBersih).toLocaleString("id-ID")})` 
      : `Rp ${labaBersih.toLocaleString("id-ID")}`

    return {
      success: true,
      message: `Berhasil! Total L/R ${monthLabel} ${year} sebesar ${formattedLaba} sukses diakumulasikan ke 13004 lalu dipindahkan ke 13003 (Laba Tahun Berjalan). Saldo 13004 kini kembali Rp 0.`
    }
  } catch (error: any) {
    await connection.rollback()
    console.error("Gagal eksekusi closing 2 tahap:", error)
    return {
      success: false,
      message: error?.message || "Terjadi kesalahan saat memproses closing."
    }
  } finally {
    connection.release()
  }
}