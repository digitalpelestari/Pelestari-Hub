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
 * Range tanggal aman untuk kolom DATE maupun DATETIME/TIMESTAMP
 * (lihat catatan di versi sebelumnya soal kenapa "=" langsung tidak dipakai).
 */
function rangeTanggal(tanggal: string) {
  return { mulai: `${tanggal} 00:00:00`, akhir: `${tanggal} 23:59:59.999999` };
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
function formatTanggal(rowTanggal: string | Date) {
  if (rowTanggal instanceof Date) {
    const tahun = rowTanggal.getFullYear()
    const bulan = String(rowTanggal.getMonth() + 1).padStart(2, "0")
    const hari = String(rowTanggal.getDate()).padStart(2, "0")

    return `${tahun}-${bulan}-${hari}`
  }

  return String(rowTanggal).slice(0, 10)
}
export async function getDataRekonsiliasiHarian(
  tanggal: string,
  noAkunBank: string = KODE_AKUN_BANK.AKTIF
) {
  const { mulai, akhir } = rangeTanggal(tanggal);

  const [bankRows] = await db.execute<BankTransaksiRow[]>(
    `SELECT
        bt.id,
        bt.tanggal,
        bt.keterangan,
        bt.nominal,
        bt.tipe,
        r.jurnal_item_id
     FROM tb_bank_transaksi bt
     LEFT JOIN tb_rekonsiliasi r ON r.bank_transaksi_id = bt.id
     WHERE bt.tanggal BETWEEN ? AND ?
     ORDER BY bt.id ASC`,
    [mulai, akhir]
  );

  const [glRows] = await db.execute<JurnalDetailRow[]>(
    `SELECT
        jd.id,
        j.tanggal,
        COALESCE(jd.keterangan, j.keterangan) AS keterangan,
        jd.debit,
        jd.kredit,
        r.bank_transaksi_id
     FROM tb_jurnal_item jd
     JOIN tb_jurnal j ON j.id = jd.jurnal_id
     LEFT JOIN tb_rekonsiliasi r ON r.jurnal_item_id = jd.id
     WHERE jd.no_akun = ?
       AND j.tanggal BETWEEN ? AND ?
     ORDER BY jd.id ASC`,
    [noAkunBank, mulai, akhir]
  );

  const bank: TransaksiRekonDTO[] = bankRows.map((row) => ({
    id: row.id,
    tanggal: formatTanggal(row.tanggal),
    keterangan: row.keterangan,
    nominal: Number(row.nominal),
    tipe: row.tipe,
    status: row.jurnal_item_id ? "TERHUBUNG" : "BELUM_TERHUBUNG",
    pasanganId: row.jurnal_item_id,
  }));

  const gl: TransaksiRekonDTO[] = glRows.map((row) => {
    const { tipe, nominal } = tipeDanNominalDariJurnalDetail(row.debit, row.kredit);
    return {
      id: row.id,
      tanggal: formatTanggal(row.tanggal),
      keterangan: row.keterangan ?? "-",
      nominal,
      tipe,
      status: row.bank_transaksi_id ? "TERHUBUNG" : "BELUM_TERHUBUNG",
      pasanganId: row.bank_transaksi_id,
    };
  });

  return { bank, gl };
}


// ============================================================================
// 2. COCOKKAN MANUAL (1 TRANSAKSI BANK <-> 1 BARIS JURNAL DETAIL)
// ============================================================================

export async function cocokkanTransaksi(bankTransaksiId: number, jurnalDetailId: number) {
  const connection: PoolConnection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM tb_rekonsiliasi
       WHERE bank_transaksi_id = ? OR jurnal_item_id = ?
       FOR UPDATE`,
      [bankTransaksiId, jurnalDetailId]
    );

    if (existing.length > 0) {
      await connection.rollback();
      throw new Error(
        "Salah satu transaksi sudah direkonsiliasi sebelumnya. Batalkan dulu jika ingin mengganti pasangan."
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO tb_rekonsiliasi (bank_transaksi_id, jurnal_item_id) VALUES (?, ?)`,
      [bankTransaksiId, jurnalDetailId]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  revalidatePath("/rekonsiliasi-bank");
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
// 4. COCOKKAN OTOMATIS (1 HARI PENUH)
// ============================================================================

export async function cocokkanOtomatisHarian(
  tanggal: string,
  noAkunBank: string = KODE_AKUN_BANK.AKTIF
) {
  const { mulai, akhir } = rangeTanggal(tanggal);
  const connection: PoolConnection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [bankBelum] = await connection.execute<BankTransaksiRow[]>(
      `SELECT bt.id, bt.nominal, bt.tipe
       FROM tb_bank_transaksi bt
       LEFT JOIN tb_rekonsiliasi r ON r.bank_transaksi_id = bt.id
       WHERE bt.tanggal BETWEEN ? AND ? AND r.id IS NULL
       ORDER BY bt.id ASC
       FOR UPDATE`,
      [mulai, akhir]
    );

    const [glBelum] = await connection.execute<JurnalDetailRow[]>(
      `SELECT jd.id, jd.debit, jd.kredit
       FROM tb_jurnal_item jd
       JOIN tb_jurnal j ON j.id = jd.jurnal_id
       LEFT JOIN tb_rekonsiliasi r ON r.jurnal_item_id = jd.id
       WHERE jd.no_akun = ?
         AND j.tanggal BETWEEN ? AND ?
         AND r.id IS NULL
       ORDER BY jd.id ASC
       FOR UPDATE`,
      [noAkunBank, mulai, akhir]
    );

    const glTersedia = glBelum.map((row) => ({
      id: row.id,
      ...tipeDanNominalDariJurnalDetail(row.debit, row.kredit),
    }));

    const pasangan: { bankTransaksiId: number; jurnalDetailId: number }[] = [];

    for (const b of bankBelum) {
      const idx = glTersedia.findIndex(
        (g) => g.tipe === b.tipe && g.nominal === Number(b.nominal)
      );
      if (idx !== -1) {
        pasangan.push({ bankTransaksiId: b.id, jurnalDetailId: glTersedia[idx].id });
        glTersedia.splice(idx, 1);
      }
    }

    if (pasangan.length > 0) {
      const values = pasangan.map((p) => [p.bankTransaksiId, p.jurnalDetailId]);
      await connection.query(
        `INSERT INTO tb_rekonsiliasi (bank_transaksi_id, jurnal_item_id) VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    if (pasangan.length > 0) {
      revalidatePath("/rekonsiliasi-bank");
    }

    return { jumlahCocok: pasangan.length };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// ============================================================================
// 5. SIMPAN HASIL PARSING PDF REKENING KORAN
// ============================================================================

interface HasilParsingBank {
  keterangan: string;
  nominal: number;
  tipe: TipeTransaksi;
}

export async function simpanHasilImportBank(
  tanggal: string,
  daftarTransaksi: HasilParsingBank[]
) {
  if (daftarTransaksi.length === 0) {
    return { jumlahDisimpan: 0 };
  }

  const values = daftarTransaksi.map((t) => [
    tanggal,
    t.keterangan,
    t.nominal,
    t.tipe,
  ]);

  await db.query(
    `INSERT INTO tb_bank_transaksi (tanggal, keterangan, nominal, tipe) VALUES ?`,
    [values]
  );

  revalidatePath("/rekonsiliasi-bank");
  return { jumlahDisimpan: daftarTransaksi.length };
}

export async function tambahTransaksiBank(data: {
  tanggal: string
  keterangan: string
  nominal: number
  tipe: "KREDIT" | "DEBIT"
  noAkunBank: string
}) {

   if (data.noAkunBank !== "11200") {
    return {
      success: false,
      message: "Transaksi hanya dapat ditambahkan untuk Bank Aktif.",
    }
  }

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `
        INSERT INTO tb_bank_transaksi
        (tanggal, keterangan, nominal, tipe)
        VALUES (?, ?, ?, ?)
      `,
      [
        data.tanggal,
        data.keterangan,
        data.nominal,
        data.tipe,
      ]
    )

    await connection.commit()

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

    // Cek apakah transaksi ada
    const [transaksiRows] = await connection.execute(
      `
        SELECT id
        FROM tb_bank_transaksi
        WHERE id = ?
        LIMIT 1
      `,
      [data.id]
    )

    const transaksi = (
      transaksiRows as {
        id: number
      }[]
    )[0]

    if (!transaksi) {
      await connection.rollback()

      return {
        success: false,
        message: "Transaksi bank tidak ditemukan.",
      }
    }

    // Jangan izinkan edit jika sudah direkonsiliasi
    const [rekonRows] = await connection.execute(
      `
        SELECT id
        FROM tb_rekonsiliasi
        WHERE bank_transaksi_id = ?
        LIMIT 1
      `,
      [data.id]
    )

    if ((rekonRows as { id: number }[]).length > 0) {
      await connection.rollback()

      return {
        success: false,
        message:
          "Transaksi sudah dicocokkan. Batalkan pencocokan terlebih dahulu.",
      }
    }

    // Update transaksi bank
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
      [
        data.tanggal,
        data.keterangan,
        data.nominal,
        data.tipe,
        data.id,
      ]
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

    // Cek apakah transaksi ada
    const [transaksiRows] = await connection.execute(
      `
        SELECT id
        FROM tb_bank_transaksi
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    )

    const transaksi = (
      transaksiRows as {
        id: number
      }[]
    )[0]

    if (!transaksi) {
      await connection.rollback()

      return {
        success: false,
        message: "Transaksi bank tidak ditemukan.",
      }
    }

    // Jangan boleh hapus transaksi yang sudah direkonsiliasi
    const [rekonRows] = await connection.execute(
      `
        SELECT id
        FROM tb_rekonsiliasi
        WHERE bank_transaksi_id = ?
        LIMIT 1
      `,
      [id]
    )

    if ((rekonRows as { id: number }[]).length > 0) {
      await connection.rollback()

      return {
        success: false,
        message:
          "Transaksi sudah dicocokkan. Batalkan pencocokan terlebih dahulu.",
      }
    }

    // Hapus transaksi bank
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
