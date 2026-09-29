"use server"

import { db } from "@/lib/db"
import type {
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise"
import { revalidatePath } from "next/cache"

// ============================================================================
// KONSTANTA
// ============================================================================

const KODE_AKUN_BANK = {
  AKTIF: "11200",
  PASIF: "11300",
  PETTY_CASH: "11100",
} as const

// ============================================================================
// TYPES
// ============================================================================

export interface SaldoAkunDTO {
  id: number
  noAkun: string
  namaAkun: string
  saldo: number
}

interface AkunRow extends RowDataPacket {
  id: number
  no_akun: string
  nama_akun: string
  saldo: string | number
}

// ============================================================================
// 1. AMBIL SALDO AKUN
//
// SUMBER:
//     tb_akun.saldo
//
// Tidak mengambil dari jurnal.
// Tidak mengambil dari tb_bank_transaksi.
// ============================================================================

export async function getSaldoAkun(
  noAkun: string
): Promise<{
  success: boolean
  data?: SaldoAkunDTO
  message?: string
}> {
  try {
    // ------------------------------------------------------------------------
    // Validasi nomor akun
    // ------------------------------------------------------------------------

    if (!noAkun) {
      return {
        success: false,
        message: "Nomor akun wajib diisi.",
      }
    }

    // ------------------------------------------------------------------------
    // Ambil saldo langsung dari tb_akun
    // ------------------------------------------------------------------------

    const [rows] = await db.execute<AkunRow[]>(
      `
        SELECT
          id,
          no_akun,
          nama_akun,
          saldo
        FROM tb_akun
        WHERE no_akun = ?
          AND is_aktif = 1
        LIMIT 1
      `,
      [noAkun]
    )

    if (rows.length === 0) {
      return {
        success: false,
        message: `Akun ${noAkun} tidak ditemukan.`,
      }
    }

    const akun = rows[0]

    return {
      success: true,
      data: {
        id: Number(akun.id),
        noAkun: akun.no_akun,
        namaAkun: akun.nama_akun,
        saldo: Number(akun.saldo),
      },
    }
  } catch (error) {
    console.error("getSaldoAkun error:", error)

    return {
      success: false,
      message: "Gagal mengambil saldo akun.",
    }
  }
}

// ============================================================================
// 2. SIMPAN REKONSILIASI
//
// Rekonsiliasi hanya membandingkan:
//
//     tb_akun.saldo
//           VS
//     saldo rekening koran
//
// Tidak membuat jurnal.
// Tidak membaca jurnal.
// Tidak membaca tb_bank_transaksi.
// Tidak mengubah tb_akun.saldo.
// ============================================================================

export async function simpanRekonsiliasi(data: {
  tanggal: string
  akunId: number
  saldoRekeningKoran: number
}) {
  try {
    // ------------------------------------------------------------------------
    // Validasi tanggal
    // ------------------------------------------------------------------------

    if (!data.tanggal) {
      return {
        success: false,
        message: "Tanggal rekonsiliasi wajib diisi.",
      }
    }

    // ------------------------------------------------------------------------
    // Validasi akun
    // ------------------------------------------------------------------------

    if (!data.akunId || data.akunId <= 0) {
      return {
        success: false,
        message: "Akun tidak valid.",
      }
    }

    // ------------------------------------------------------------------------
    // Validasi saldo rekening koran
    // ------------------------------------------------------------------------

    if (!Number.isFinite(data.saldoRekeningKoran)) {
      return {
        success: false,
        message: "Saldo rekening koran tidak valid.",
      }
    }

    if (data.saldoRekeningKoran < 0) {
      return {
        success: false,
        message: "Saldo rekening koran tidak boleh kurang dari 0.",
      }
    }

    // ------------------------------------------------------------------------
    // Ambil saldo akun TERKINI langsung dari tb_akun
    // ------------------------------------------------------------------------

    const [akunRows] = await db.execute<AkunRow[]>(
      `
        SELECT
          id,
          no_akun,
          nama_akun,
          saldo
        FROM tb_akun
        WHERE id = ?
          AND is_aktif = 1
        LIMIT 1
      `,
      [data.akunId]
    )

    if (akunRows.length === 0) {
      return {
        success: false,
        message: "Akun tidak ditemukan.",
      }
    }

    const akun = akunRows[0]

    // ------------------------------------------------------------------------
    // Saldo akun berasal langsung dari tb_akun
    // ------------------------------------------------------------------------

    const saldoAkun = Number(akun.saldo)

    // ------------------------------------------------------------------------
    // Saldo rekening koran berasal dari input user
    // ------------------------------------------------------------------------

    const saldoRekeningKoran = Number(data.saldoRekeningKoran)

    // ------------------------------------------------------------------------
    // Hitung selisih
    //
    // Positif  = rekening koran lebih besar
    // Negatif  = saldo akun lebih besar
    // Nol      = balance
    // ------------------------------------------------------------------------

    const selisih = saldoRekeningKoran - saldoAkun

    const status = selisih === 0
      ? "BALANCE"
      : "SELISIH"

    // ------------------------------------------------------------------------
    // Simpan hasil rekonsiliasi
    //
    // Jika akun + tanggal sudah pernah direkonsiliasi,
    // data akan diperbarui.
    // ------------------------------------------------------------------------

    await db.execute<ResultSetHeader>(
      `
        INSERT INTO tb_rekonsiliasi (
          akun_id,
          tanggal,
          saldo_akun,
          saldo_rekening_koran,
          selisih,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          saldo_akun = VALUES(saldo_akun),
          saldo_rekening_koran = VALUES(saldo_rekening_koran),
          selisih = VALUES(selisih),
          status = VALUES(status),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        akun.id,
        data.tanggal,
        saldoAkun,
        saldoRekeningKoran,
        selisih,
        status,
      ]
    )

    // ------------------------------------------------------------------------
    // Refresh halaman
    // ------------------------------------------------------------------------

    revalidatePath("/rekonsiliasi-bank")

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    return {
      success: true,
      message:
        status === "BALANCE"
          ? "Rekonsiliasi berhasil disimpan. Saldo balance."
          : "Rekonsiliasi berhasil disimpan, tetapi terdapat selisih.",
      data: {
        akunId: Number(akun.id),
        noAkun: akun.no_akun,
        namaAkun: akun.nama_akun,
        tanggal: data.tanggal,
        saldoAkun,
        saldoRekeningKoran,
        selisih,
        status,
      },
    }
  } catch (error) {
    console.error("simpanRekonsiliasi error:", error)

    return {
      success: false,
      message: "Gagal menyimpan rekonsiliasi.",
    }
  }
}

// ============================================================================
// 3. AMBIL HASIL REKONSILIASI BERDASARKAN TANGGAL
//
// Digunakan jika nanti halaman perlu menampilkan hasil rekon yang sudah
// tersimpan.
// ============================================================================

interface RekonsiliasiRow extends RowDataPacket {
  id: number
  akun_id: number
  tanggal: string
  saldo_akun: string | number
  saldo_rekening_koran: string | number
  selisih: string | number
  status: string
  created_at: string | Date
  updated_at: string | Date
}

export async function getRekonsiliasi(
  tanggal: string,
  akunId: number
) {
  try {
    const [rows] = await db.execute<RekonsiliasiRow[]>(
      `
        SELECT
          id,
          akun_id,
          tanggal,
          saldo_akun,
          saldo_rekening_koran,
          selisih,
          status,
          created_at,
          updated_at
        FROM tb_rekonsiliasi
        WHERE tanggal = ?
          AND akun_id = ?
        LIMIT 1
      `,
      [tanggal, akunId]
    )

    if (rows.length === 0) {
      return {
        success: true,
        data: null,
      }
    }

    const row = rows[0]

    return {
      success: true,
      data: {
        id: Number(row.id),
        akunId: Number(row.akun_id),
        tanggal: String(row.tanggal).slice(0, 10),
        saldoAkun: Number(row.saldo_akun),
        saldoRekeningKoran: Number(row.saldo_rekening_koran),
        selisih: Number(row.selisih),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }
  } catch (error) {
    console.error("getRekonsiliasi error:", error)

    return {
      success: false,
      data: null,
      message: "Gagal mengambil data rekonsiliasi.",
    }
  }
}

// ============================================================================
// 4. HAPUS REKONSILIASI
//
// Hanya menghapus catatan rekonsiliasi.
// Tidak mengubah saldo akun.
// ============================================================================

export async function hapusRekonsiliasi(id: number) {
  try {
    if (!id || id <= 0) {
      return {
        success: false,
        message: "ID rekonsiliasi tidak valid.",
      }
    }

    const [result] = await db.execute<ResultSetHeader>(
      `
        DELETE FROM tb_rekonsiliasi
        WHERE id = ?
      `,
      [id]
    )

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: "Data rekonsiliasi tidak ditemukan.",
      }
    }

    revalidatePath("/rekonsiliasi-bank")

    return {
      success: true,
      message: "Data rekonsiliasi berhasil dihapus.",
    }
  } catch (error) {
    console.error("hapusRekonsiliasi error:", error)

    return {
      success: false,
      message: "Gagal menghapus rekonsiliasi.",
    }
  }
}