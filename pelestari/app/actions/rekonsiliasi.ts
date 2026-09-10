"use server";

import { db } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import { revalidatePath } from "next/cache";

// ============================================================================
// KONSTANTA
// ============================================================================

/** Kode akun (no_akun) di COA untuk rekening Bank. */
const KODE_AKUN_BANK = {
  AKTIF: "11200",
  PASIF: "11300",
} as const

// ============================================================================
// TYPES
// ============================================================================

export type TipeTransaksi = "KREDIT" | "DEBIT";
export type StatusRekon = "TERHUBUNG" | "BELUM_TERHUBUNG";

export interface TransaksiRekonDTO {
  id: number;
  tanggal: string; // YYYY-MM-DD
  keterangan: string;
  nominal: number;
  tipe: TipeTransaksi;
  status: StatusRekon;
  /** id lawan transaksi yang sudah match: jurnal_item_id (sisi bank) / bank_transaksi_id (sisi GL) */
  pasanganId: number | null;
}

interface BankTransaksiRow extends RowDataPacket {
  id: number;
  tanggal: string;
  keterangan: string;
  nominal: string;
  tipe: TipeTransaksi;
  jurnal_item_id: number | null; // hasil LEFT JOIN tb_rekonsiliasi
}

interface JurnalDetailRow extends RowDataPacket {
  id: number; // id di tb_jurnal_item (bukan id header tb_jurnal)
  tanggal: string; // dari tb_jurnal.tanggal
  keterangan: string;
  debit: string;
  kredit: string;
  bank_transaksi_id: number | null; // hasil LEFT JOIN tb_rekonsiliasi
}

/**
 * Range tanggal aman untuk kolom DATE maupun DATETIME/TIMESTAMP.
 * Menerima satu tanggal (dipakai sebagai mulai=akhir) atau dua tanggal (range).
 */
function rangeTanggal(tanggalMulai: string, tanggalSampai: string = tanggalMulai) {
  return {
    mulai: `${tanggalMulai} 00:00:00`,
    akhir: `${tanggalSampai} 23:59:59.999999`,
  }
}

/**
 * Format tanggal ke YYYY-MM-DD menggunakan waktu LOKAL server, BUKAN UTC.
 * Sengaja tidak pakai `.toISOString()` di sini karena itu selalu mengonversi
 * ke UTC dan bisa menggeser tanggal +/-1 hari tergantung timezone server
 * (mis. server di UTC sementara data dientry dalam WIB/UTC+7).
 * Semua perbandingan tanggal di file ini WAJIB lewat fungsi ini supaya konsisten.
 */
function formatTanggal(rowTanggal: string | Date) {
  if (rowTanggal instanceof Date) {
    const tahun = rowTanggal.getFullYear()
    const bulan = String(rowTanggal.getMonth() + 1).padStart(2, "0")
    const hari = String(rowTanggal.getDate()).padStart(2, "0")

    return `${tahun}-${bulan}-${hari}`
  }

  return String(rowTanggal).slice(0, 10)
}

/** debit > 0 -> DEBIT, selain itu KREDIT. Nominal diambil dari kolom yang > 0. */
function tipeDanNominalDariJurnalDetail(debit: string, kredit: string) {
  const nilaiDebit = Number(debit);
  const nilaiKredit = Number(kredit);
  if (nilaiDebit > 0) {
    return { tipe: "DEBIT" as const, nominal: nilaiDebit };
  }
  return { tipe: "KREDIT" as const, nominal: nilaiKredit };
}

// ============================================================================
// 1. AMBIL DATA HARIAN (BANK + GL) LENGKAP DENGAN STATUS
// ============================================================================

export async function getDataRekonsiliasiHarian(
  tanggalMulai: string,
  tanggalSampai: string,
  noAkunBank: string = KODE_AKUN_BANK.AKTIF
) {
  const { mulai, akhir } = rangeTanggal(tanggalMulai, tanggalSampai)

  const [bankRows] = await db.execute<BankTransaksiRow[]>(
    `SELECT
        bt.id,
        bt.tanggal,
        bt.keterangan,
        bt.nominal,
        bt.tipe,
        r.jurnal_item_id
     FROM tb_bank_transaksi bt
     JOIN tb_akun a
       ON a.id = bt.akun_id
     LEFT JOIN tb_rekonsiliasi r
       ON r.bank_transaksi_id = bt.id
     WHERE a.no_akun = ?
       AND bt.tanggal BETWEEN ? AND ?
     ORDER BY bt.id ASC`,
    [noAkunBank, mulai, akhir]
  )

  const [glRows] = await db.execute<JurnalDetailRow[]>(
    `SELECT
        jd_lawan.id,
        j.tanggal,
        COALESCE(jd_lawan.keterangan, j.keterangan) AS keterangan,
        jd_lawan.debit,
        jd_lawan.kredit,
        r.bank_transaksi_id
     FROM tb_jurnal_item jd_bank
     JOIN tb_jurnal j
       ON j.id = jd_bank.jurnal_id
     JOIN tb_jurnal_item jd_lawan
       ON jd_lawan.jurnal_id = jd_bank.jurnal_id
      AND jd_lawan.id <> jd_bank.id
     LEFT JOIN tb_rekonsiliasi r
       ON r.jurnal_item_id = jd_lawan.id
     WHERE jd_bank.no_akun = ?
       AND j.tanggal BETWEEN ? AND ?
     ORDER BY jd_lawan.id ASC`,
    [noAkunBank, mulai, akhir]
  )

  const bank: TransaksiRekonDTO[] = bankRows.map((row) => ({
    id: row.id,
    tanggal: formatTanggal(row.tanggal),
    keterangan: row.keterangan,
    nominal: Number(row.nominal),
    tipe: row.tipe,
    status: row.jurnal_item_id
      ? "TERHUBUNG"
      : "BELUM_TERHUBUNG",
    pasanganId: row.jurnal_item_id,
  }))

  const gl: TransaksiRekonDTO[] = glRows.map((row) => {
    const { tipe, nominal } =
      tipeDanNominalDariJurnalDetail(
        row.debit,
        row.kredit
      )

    return {
      id: row.id,
      tanggal: formatTanggal(row.tanggal),
      keterangan: row.keterangan ?? "-",
      nominal,
      tipe,
      status: row.bank_transaksi_id
        ? "TERHUBUNG"
        : "BELUM_TERHUBUNG",
      pasanganId: row.bank_transaksi_id,
    }
  })

  return { bank, gl }
}

// ============================================================================
// 2. COCOKKAN MANUAL (1 TRANSAKSI BANK <-> 1 BARIS JURNAL DETAIL)
// ============================================================================

export async function cocokkanTransaksi(
  bankTransaksiId: number,
  jurnalDetailId: number
) {
  const connection: PoolConnection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // ================================================================
    // 1. Ambil transaksi bank
    // ================================================================
    const [bankRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT
          bt.id,
          bt.tanggal,
          bt.nominal,
          bt.tipe,
          a.no_akun
        FROM tb_bank_transaksi bt
        JOIN tb_akun a
          ON a.id = bt.akun_id
        WHERE bt.id = ?
        LIMIT 1
      `,
      [bankTransaksiId]
    )

    if (bankRows.length === 0) {
      await connection.rollback()
      throw new Error("Transaksi bank tidak ditemukan.")
    }

    const bank = bankRows[0]

    // ================================================================
    // 2. Ambil transaksi jurnal
    //    Baris jurnal yang dipilih harus berasal dari jurnal yang punya
    //    baris lawan dengan no_akun = akun bank yang sama.
    // ================================================================
    const [glRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT
          jd.id,
          j.tanggal,
          jd.debit,
          jd.kredit
        FROM tb_jurnal_item jd
        JOIN tb_jurnal j
          ON j.id = jd.jurnal_id
        WHERE jd.id = ?
          AND jd.no_akun <> ?
          AND EXISTS (
            SELECT 1
            FROM tb_jurnal_item jd_bank
            WHERE jd_bank.jurnal_id = jd.jurnal_id
              AND jd_bank.no_akun = ?
          )
        LIMIT 1
      `,
      [jurnalDetailId, bank.no_akun, bank.no_akun]
    )

    if (glRows.length === 0) {
      await connection.rollback()
      throw new Error(
        "Transaksi jurnal tidak ditemukan atau bukan lawan transaksi dari akun bank ini."
      )
    }

    const gl = glRows[0]

    // ================================================================
    // 3. Pastikan keduanya belum pernah direkonsiliasi
    // ================================================================
    const [existing] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_rekonsiliasi
        WHERE bank_transaksi_id = ?
           OR jurnal_item_id = ?
        FOR UPDATE
      `,
      [bankTransaksiId, jurnalDetailId]
    )

    if (existing.length > 0) {
      await connection.rollback()
      throw new Error(
        "Salah satu transaksi sudah direkonsiliasi sebelumnya. Batalkan dulu jika ingin mengganti pasangan."
      )
    }

    // ================================================================
    // 4. Tentukan tipe dan nominal jurnal
    // ================================================================
    const { tipe: tipeGL, nominal: nominalGL } =
      tipeDanNominalDariJurnalDetail(String(gl.debit), String(gl.kredit))

    const nominalBank = Number(bank.nominal)

    // ================================================================
    // 5. Validasi tanggal
    // ================================================================
    const tanggalBank = formatTanggal(bank.tanggal)
    const tanggalGL = formatTanggal(gl.tanggal)

    if (tanggalBank !== tanggalGL) {
      await connection.rollback()
      throw new Error(
        `Transaksi tidak dapat dicocokkan karena tanggal berbeda (bank: ${tanggalBank}, jurnal: ${tanggalGL}).`
      )
    }

    // ================================================================
    // 6. Validasi tipe
    // ================================================================
    if (tipeGL !== bank.tipe) {
      await connection.rollback()
      throw new Error(
        `Tipe transaksi tidak sesuai. Koran ${bank.tipe}, jurnal ${tipeGL}.`
      )
    }

    // ================================================================
    // 7. Validasi nominal
    // ================================================================
    if (nominalBank !== nominalGL) {
      await connection.rollback()
      throw new Error(
        `Transaksi tidak dapat dicocokkan karena nominal berbeda (bank: ${nominalBank}, jurnal: ${nominalGL}).`
      )
    }

    // ================================================================
    // 8. Semua valid → simpan pasangan
    // ================================================================
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO tb_rekonsiliasi
        (bank_transaksi_id, jurnal_item_id)
        VALUES (?, ?)
      `,
      [bankTransaksiId, jurnalDetailId]
    )

    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  revalidatePath("/rekonsiliasi-bank")
}

// ============================================================================
// 3. BATALKAN PENCOCOKAN (UNMATCH)
// ============================================================================

export async function batalkanPencocokan(bankTransaksiId: number) {
  const [result] = await db.execute<ResultSetHeader>(
    `DELETE FROM tb_rekonsiliasi WHERE bank_transaksi_id = ?`,
    [bankTransaksiId]
  );

  if (result.affectedRows === 0) {
    throw new Error("Data rekonsiliasi tidak ditemukan untuk transaksi ini.");
  }

  revalidatePath("/rekonsiliasi-bank");
}

// ============================================================================
// 4. COCOKKAN OTOMATIS (RENTANG TANGGAL)
//    PERBAIKAN:
//    - Sekarang menerima tanggalMulai & tanggalSampai (bukan satu tanggal),
//      supaya SELALU sinkron dengan rentang yang sedang ditampilkan di layar.
//    - Perbandingan tanggal antara transaksi bank & jurnal memakai
//      formatTanggal() (waktu lokal), bukan .toISOString() (UTC), supaya
//      tidak geser hari akibat timezone server.
// ============================================================================

export async function cocokkanOtomatisHarian(
  tanggalMulai: string,
  tanggalSampai: string = tanggalMulai,
  noAkunBank: string = KODE_AKUN_BANK.AKTIF
) {
  const { mulai, akhir } = rangeTanggal(tanggalMulai, tanggalSampai)
  const connection: PoolConnection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // ================================================================
    // 1. Ambil transaksi bank yang belum direkonsiliasi
    // ================================================================
    const [bankBelum] = await connection.execute<RowDataPacket[]>(
      `
        SELECT
          bt.id,
          bt.nominal,
          bt.tipe,
          bt.tanggal
        FROM tb_bank_transaksi bt
        JOIN tb_akun a
          ON a.id = bt.akun_id
        LEFT JOIN tb_rekonsiliasi r
          ON r.bank_transaksi_id = bt.id
        WHERE a.no_akun = ?
          AND bt.tanggal BETWEEN ? AND ?
          AND r.id IS NULL
        ORDER BY bt.id ASC
        FOR UPDATE
      `,
      [noAkunBank, mulai, akhir]
    )

    // ================================================================
    // 2. Ambil jurnal item lawan yang belum direkonsiliasi
    // ================================================================
    const [glBelum] = await connection.execute<RowDataPacket[]>(
      `
        SELECT
          jd_lawan.id,
          j.tanggal,
          jd_lawan.debit,
          jd_lawan.kredit
        FROM tb_jurnal_item jd_bank
        JOIN tb_jurnal j
          ON j.id = jd_bank.jurnal_id
        JOIN tb_jurnal_item jd_lawan
          ON jd_lawan.jurnal_id = jd_bank.jurnal_id
         AND jd_lawan.id <> jd_bank.id
        LEFT JOIN tb_rekonsiliasi r
          ON r.jurnal_item_id = jd_lawan.id
        WHERE jd_bank.no_akun = ?
          AND j.tanggal BETWEEN ? AND ?
          AND r.id IS NULL
        ORDER BY jd_lawan.id ASC
        FOR UPDATE
      `,
      [noAkunBank, mulai, akhir]
    )

    const glTersedia = glBelum.map((row) => ({
      id: Number(row.id),
      tanggal: formatTanggal(row.tanggal), // sudah dinormalisasi di sini
      ...tipeDanNominalDariJurnalDetail(String(row.debit), String(row.kredit)),
    }))

    // ================================================================
    // 3. Cari pasangan (tanggal, tipe, nominal harus sama persis)
    // ================================================================
    const pasangan: {
      bankTransaksiId: number
      jurnalDetailId: number
    }[] = []

    for (const bank of bankBelum) {
      const tanggalBank = formatTanggal(bank.tanggal)

      const idx = glTersedia.findIndex(
        (gl) =>
          gl.tipe === bank.tipe &&
          gl.nominal === Number(bank.nominal) &&
          gl.tanggal === tanggalBank
      )

      if (idx !== -1) {
        pasangan.push({
          bankTransaksiId: Number(bank.id),
          jurnalDetailId: glTersedia[idx].id,
        })

        // Jangan sampai satu jurnal dipakai untuk dua transaksi bank
        glTersedia.splice(idx, 1)
      }
    }

    // ================================================================
    // 4. Simpan hasil pencocokan
    // ================================================================
    if (pasangan.length > 0) {
      const values = pasangan.map((p) => [p.bankTransaksiId, p.jurnalDetailId])

      await connection.query(
        `
          INSERT INTO tb_rekonsiliasi
          (bank_transaksi_id, jurnal_item_id)
          VALUES ?
        `,
        [values]
      )
    }

    await connection.commit()

    if (pasangan.length > 0) {
      revalidatePath("/rekonsiliasi-bank")
    }

    return {
      jumlahCocok: pasangan.length,
    }
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

// ============================================================================
// 5. TUTUP BUKU (RENTANG TANGGAL)
//    PERBAIKAN: menerima tanggalMulai & tanggalSampai supaya sinkron dengan
//    rentang yang ditampilkan, bukan tanggal aktif yang bisa berbeda.
// ============================================================================

export async function tutupBukuHarian(
  tanggalMulai: string,
  tanggalSampai: string = tanggalMulai,
  noAkunBank: string = KODE_AKUN_BANK.AKTIF
) {
  const { mulai, akhir } = rangeTanggal(tanggalMulai, tanggalSampai)

  try {
    // ================================================================
    // 1. Cek transaksi bank yang belum terhubung
    // ================================================================
    const [akunRows] = await db.execute<RowDataPacket[]>(
    `
        SELECT nama_akun
        FROM tb_akun
        WHERE no_akun = ?
          AND is_aktif = 1
        LIMIT 1
      `,
      [noAkunBank]
    )

    const [bankBelum] = await db.execute<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS jumlah
        FROM tb_bank_transaksi bt
        JOIN tb_akun a
          ON a.id = bt.akun_id
        LEFT JOIN tb_rekonsiliasi r
          ON r.bank_transaksi_id = bt.id
        WHERE a.no_akun = ?
          AND bt.tanggal BETWEEN ? AND ?
          AND r.id IS NULL
      `,
      [noAkunBank, mulai, akhir]
    )

    const namaAkunBank = akunRows[0]?.nama_akun ?? "Bank"

    // ================================================================
    // 2. Cek jurnal lawan yang belum terhubung
    // ================================================================
    const [glBelum] = await db.execute<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS jumlah
        FROM tb_jurnal_item jd_bank
        JOIN tb_jurnal j
          ON j.id = jd_bank.jurnal_id
        JOIN tb_jurnal_item jd_lawan
          ON jd_lawan.jurnal_id = jd_bank.jurnal_id
         AND jd_lawan.id <> jd_bank.id
        LEFT JOIN tb_rekonsiliasi r
          ON r.jurnal_item_id = jd_lawan.id
        WHERE jd_bank.no_akun = ?
          AND j.tanggal BETWEEN ? AND ?
          AND r.id IS NULL
      `,
      [noAkunBank, mulai, akhir]
    )

    const jumlahBankBelum = Number(bankBelum[0]?.jumlah ?? 0)
    const jumlahGlBelum = Number(glBelum[0]?.jumlah ?? 0)

    // ================================================================
    // 3. Tidak boleh tutup jika masih ada yang belum match
    // ================================================================
    if (jumlahBankBelum > 0 || jumlahGlBelum > 0) {
      return {
        success: false,
        message:
          `Rekonsiliasi belum selesai. ` +
          `Bank belum terhubung: ${jumlahBankBelum}, ` +
          `Jurnal belum terhubung: ${jumlahGlBelum}.`,
      }
    }

    return {
      success: true,
      message:
        tanggalMulai === tanggalSampai
          ? `Rekonsiliasi Bank ${namaAkunBank} tanggal ${tanggalMulai} berhasil diselesaikan.`
          : `Rekonsiliasi Bank ${namaAkunBank} periode ${tanggalMulai} s/d ${tanggalSampai} berhasil diselesaikan.`,
    }
  } catch (error) {
    console.error("Gagal menutup buku:", error)

    return {
      success: false,
      message: "Gagal menyelesaikan rekonsiliasi.",
    }
  }
}

// ============================================================================
// 6. SIMPAN HASIL PARSING PDF REKENING KORAN
// ============================================================================

interface HasilParsingBank {
  keterangan: string;
  nominal: number;
  tipe: TipeTransaksi;
}

export async function simpanHasilImportBank(
  tanggal: string,
  daftarTransaksi: HasilParsingBank[],
  noAkunBank: string
) {
  if (daftarTransaksi.length === 0) {
    return {
      success: true,
      message: "Tidak ada transaksi untuk disimpan.",
      jumlahDisimpan: 0,
    }
  }

  if (
    noAkunBank !== KODE_AKUN_BANK.AKTIF &&
    noAkunBank !== KODE_AKUN_BANK.PASIF
  ) {
    return {
      success: false,
      message: "Akun bank tidak valid.",
    }
  }

  const [akunRows] = await db.execute<RowDataPacket[]>(
    `
      SELECT id
      FROM tb_akun
      WHERE no_akun = ?
        AND is_aktif = 1
      LIMIT 1
    `,
    [noAkunBank]
  )

  if (akunRows.length === 0) {
    return {
      success: false,
      message: "Akun bank tidak ditemukan.",
    }
  }

  const akunId = akunRows[0].id

  const values = daftarTransaksi.map((t) => [
    akunId,
    tanggal,
    t.keterangan,
    t.nominal,
    t.tipe,
  ])

  await db.query(
    `
      INSERT INTO tb_bank_transaksi
      (akun_id, tanggal, keterangan, nominal, tipe)
      VALUES ?
    `,
    [values]
  )

  revalidatePath("/rekonsiliasi-bank")

  return {
    success: true,
    message: `${daftarTransaksi.length} transaksi bank telah disimpan.`,
    jumlahDisimpan: daftarTransaksi.length,
  }
}

// ============================================================================
// 7. CRUD TRANSAKSI BANK MANUAL
// ============================================================================

export async function tambahTransaksiBank(data: {
  tanggal: string
  keterangan: string
  nominal: number
  tipe: "KREDIT" | "DEBIT"
  noAkunBank: string
}) {
  if (
    data.noAkunBank !== KODE_AKUN_BANK.AKTIF &&
    data.noAkunBank !== KODE_AKUN_BANK.PASIF
  ) {
    return {
      success: false,
      message: "Akun bank tidak valid.",
    }
  }

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [akunRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_akun
        WHERE no_akun = ?
        AND is_aktif = 1
        LIMIT 1
      `,
      [data.noAkunBank]
    )

    if (akunRows.length === 0) {
      await connection.rollback()
      return {
        success: false,
        message: "Akun bank tidak ditemukan.",
      }
    }

    const akunId = akunRows[0].id

    await connection.execute(
      `
        INSERT INTO tb_bank_transaksi
        (akun_id, tanggal, keterangan, nominal, tipe)
        VALUES (?, ?, ?, ?, ?)
      `,
      [akunId, data.tanggal, data.keterangan, data.nominal, data.tipe]
    )

    await connection.commit()

    revalidatePath("/rekonsiliasi-bank")

    return {
      success: true,
      message: "Transaksi bank berhasil ditambahkan.",
    }
  } catch (error) {
    await connection.rollback()
    console.error("Gagal menambahkan transaksi bank:", error)
    return {
      success: false,
      message: "Gagal menambahkan transaksi bank.",
    }
  } finally {
    connection.release()
  }
}

export async function editTransaksiBank(data: {
  id: number
  tanggal: string
  keterangan: string
  nominal: number
  tipe: "KREDIT" | "DEBIT"
}) {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [transaksiRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_bank_transaksi
        WHERE id = ?
        LIMIT 1
      `,
      [data.id]
    )

    if (transaksiRows.length === 0) {
      await connection.rollback()
      return {
        success: false,
        message: "Transaksi bank tidak ditemukan.",
      }
    }

    const [rekonRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_rekonsiliasi
        WHERE bank_transaksi_id = ?
        LIMIT 1
      `,
      [data.id]
    )

    if (rekonRows.length > 0) {
      await connection.rollback()
      return {
        success: false,
        message:
          "Transaksi sudah dicocokkan. Batalkan pencocokan terlebih dahulu.",
      }
    }

    await connection.execute(
      `
        UPDATE tb_bank_transaksi
        SET
          tanggal = ?,
          keterangan = ?,
          nominal = ?,
          tipe = ?
        WHERE id = ?
      `,
      [data.tanggal, data.keterangan, data.nominal, data.tipe, data.id]
    )

    await connection.commit()

    revalidatePath("/rekonsiliasi-bank")

    return {
      success: true,
      message: "Transaksi bank berhasil diperbarui.",
    }
  } catch (error) {
    await connection.rollback()
    console.error("Gagal mengedit transaksi bank:", error)
    return {
      success: false,
      message: "Gagal mengedit transaksi bank.",
    }
  } finally {
    connection.release()
  }
}

export async function hapusTransaksiBank(id: number) {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [transaksiRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_bank_transaksi
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    )

    if (transaksiRows.length === 0) {
      await connection.rollback()
      return {
        success: false,
        message: "Transaksi bank tidak ditemukan.",
      }
    }

    const [rekonRows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM tb_rekonsiliasi
        WHERE bank_transaksi_id = ?
        LIMIT 1
      `,
      [id]
    )

    if (rekonRows.length > 0) {
      await connection.rollback()
      return {
        success: false,
        message:
          "Transaksi sudah dicocokkan. Batalkan pencocokan terlebih dahulu.",
      }
    }

    await connection.execute(
      `
        DELETE FROM tb_bank_transaksi
        WHERE id = ?
      `,
      [id]
    )

    await connection.commit()

    revalidatePath("/rekonsiliasi-bank")

    return {
      success: true,
      message: "Transaksi bank berhasil dihapus.",
    }
  } catch (error) {
    await connection.rollback()
    console.error("Gagal menghapus transaksi bank:", error)
    return {
      success: false,
      message: "Gagal menghapus transaksi bank.",
    }
  } finally {
    connection.release()
  }
}