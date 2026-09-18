"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// =========================================================================
// 1. FUNGSI: IMPORT DATA EXCEL INVOICES BULK
// =========================================================================
export async function importInvoices(dataArray: any[]) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of dataArray) {
      const query = `INSERT INTO tb_invoice (
        nomor_invoice,
        batch,
        jenis_kegiatan,
        tanggal,
        tanggal_jatuhtempo,
        perusahaan_tujuan,
        npwp,
        alamat_perusahaan,
        file_faktur,
        cl,
        keterangan,
        is_dpp,
        is_pph23,
        is_ppn11,
        is_pnbp,
        nominal_pnbp,
        total,
        status,
        bayar_1,
        bayar_2
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        item.nomor_invoice,
        item.batch || "N/A",
        item.jenis_kegiatan || "-",
        item.tanggal,
        item.tanggal_jatuhtempo,
        item.perusahaan_tujuan,
        item.npwp || "-",
        item.alamat_perusahaan || "-",
        item.file_faktur || null,
        item.cl || null,
        item.keterangan || "-",

        item.is_dpp ? 1 : 0,
        item.is_pph23 ? 1 : 0,
        item.is_ppn11 ? 1 : 0,
        item.is_pnbp ? 1 : 0,

        Number(item.nominal_pnbp) || 0,
        Number(item.total) || 0,

        item.status || "Belum Lunas",

        Number(item.bayar_1) || 0,
        Number(item.bayar_2) || 0,
      ];

      const [result]: any = await connection.query(query, values);
      const invoiceId = result.insertId;

      const jumlahPeserta1 = Number(item.jumlah_peserta) || 0;
      const hargaPeserta1 = Number(item.harga_peserta) || 0;
      const keterangan1 = item.jenis_kegiatan || item.keterangan || "-";

      if (keterangan1 || jumlahPeserta1 > 0 || hargaPeserta1 > 0) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            keterangan1,
            jumlahPeserta1,
            hargaPeserta1,
          ]
        );
      }

      const jumlahPeserta2 = Number(item.jumlah_peserta_2) || 0;
      const hargaPeserta2 = Number(item.harga_peserta_2) || 0;
      const keterangan2 = item.keterangan_2 || "";

      if (keterangan2 || jumlahPeserta2 > 0 || hargaPeserta2 > 0) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            keterangan2,
            jumlahPeserta2,
            hargaPeserta2,
          ]
        );
      }
    }

    await connection.commit();
    revalidatePath("/dashboard/finance/invoices");

    return {
      success: true,
      message: `${dataArray.length} data berhasil diimpor`,
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("IMPORT_ERROR:", error.message);
    return {
      success: false,
      message: "Gagal impor: " + error.message,
    };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 2. FUNGSI: AMBIL URUTAN NOMOR INVOICE
// =========================================================================
export async function getNextInvoiceNumber() {
  try {
    const [rows]: any = await db.query("SELECT COUNT(id) as total FROM tb_invoice");
    const count = rows.length > 0 ? rows[0].total : 0;
    return count + 1;
  } catch (error) {
    console.error("Gagal mengambil urutan nomor:", error);
    return 1;
  }
}

// =========================================================================
// 3. FUNGSI: TAMBAH INVOICE FORM
// =========================================================================
export async function createInvoice(formData: any) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [result]: any = await connection.query(
      `INSERT INTO tb_invoice (
        nomor_invoice,
        batch,
        tanggal,
        jenis_kegiatan,
        tanggal_jatuhtempo,
        perusahaan_tujuan,
        npwp,
        alamat_perusahaan,
        file_faktur,
        cl,
        is_dpp,
        is_pph23,
        is_ppn11,
        is_pnbp,
        nominal_pnbp,
        total,
        bayar_1,
        tanggal_bayar_1,
        bayar_2,
        tanggal_bayar_2,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        formData.nomor_invoice,
        formData.batch,
        formData.tanggal,
        formData.jenis_kegiatan,
        formData.tanggal_jatuhtempo,
        formData.perusahaan_tujuan,
        formData.npwp,
        formData.alamat_perusahaan,
        formData.file_faktur || null,
        formData.cl || null,
        formData.is_dpp ? 1 : 0,
        formData.is_pph23 ? 1 : 0,
        formData.is_ppn11 ? 1 : 0,
        formData.is_pnbp ? 1 : 0,
        formData.nominal_pnbp || 0,
        formData.total || 0,
        formData.bayar_1 || 0,
        formData.tanggal_bayar_1 || null,
        formData.bayar_2 || 0,
        formData.tanggal_bayar_2 || null,
        formData.status || "Belum Lunas",
      ]
    );

    const newInvoiceId = result.insertId;

    for (const item of formData.items) {
      await connection.query(
        `INSERT INTO tb_invoice_details (
          invoice_id,
          item_deskripsi,
          item_jumlah,
          item_harga
        ) VALUES (?, ?, ?, ?)`,
        [
          newInvoiceId,
          item.item_deskripsi,
          item.item_jumlah,
          item.item_harga,
        ]
      );
    }

    const akunPiutang = "12100";
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?",
      [formData.total || 0, akunPiutang]
    );

    await connection.commit();
    revalidatePath("/dashboard/finance/invoices");

    return {
      success: true,
      id: newInvoiceId,
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("CREATE_INVOICE_ERROR:", error.message);
    return {
      success: false,
      message: "Gagal simpan invoice: " + error.message,
    };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 4. FUNGSI: HAPUS DATA INVOICE
// =========================================================================
export async function deleteInvoice(id: number) {
  try {
    const query = `DELETE FROM tb_invoice WHERE id = ?`;
    await db.query(query, [id]);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true, message: "Invoice berhasil dihapus" };
  } catch (error) {
    console.error("Gagal menghapus invoice:", error);
    return { success: false, message: "Gagal menghapus data dari database" };
  }
}

// =========================================================================
// 5. FUNGSI: UPDATE / EDIT INVOICE DATA
// =========================================================================
export async function updateInvoice(id: number, data: any) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const query = `
      UPDATE tb_invoice SET 
        batch = ?,
        jenis_kegiatan = ?,
        perusahaan_tujuan = ?,
        npwp = ?,
        alamat_perusahaan = ?,
        file_faktur = ?,
        cl = ?,
        is_dpp = ?,
        is_pph23 = ?,
        is_ppn11 = ?,
        is_pnbp = ?,
        nominal_pnbp = ?,
        bayar_1 = ?,
        tanggal_bayar_1 = ?,
        bayar_2 = ?,
        tanggal_bayar_2 = ?,
        total = ?,
        status = ?
      WHERE id = ?
    `;

    const values = [
      data.batch,
      data.jenis_kegiatan,
      data.perusahaan_tujuan,
      data.npwp,
      data.alamat_perusahaan,
      data.file_faktur || null,
      data.cl || null,
      data.is_dpp ? 1 : 0,
      data.is_pph23 ? 1 : 0,
      data.is_ppn11 ? 1 : 0,
      data.is_pnbp ? 1 : 0,
      data.nominal_pnbp || 0,
      data.bayar_1 || 0,
      data.tanggal_bayar_1 || null,
      data.bayar_2 || 0,
      data.tanggal_bayar_2 || null,
      data.total || 0,
      data.status || "Belum Lunas",
      id,
    ];

    await connection.query(query, values);

    await connection.query(
      `DELETE FROM tb_invoice_details WHERE invoice_id = ?`,
      [id]
    );

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            id,
            item.item_deskripsi,
            item.item_jumlah,
            item.item_harga,
          ]
        );
      }
    }

    await connection.commit();
    revalidatePath("/dashboard/finance/invoices");

    return {
      success: true,
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("UPDATE_INVOICE_ERROR:", error.message);
    return {
      success: false,
      message: error.message,
    };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 6. FUNGSI: DETEKSI DETIL INVOICE BY ID
// =========================================================================
export async function getInvoiceById(id: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_invoice WHERE id = ?",
      [id]
    );

    if (!rows[0]) {
      return null;
    }

    const [details]: any = await db.query(
      `SELECT
        id,
        invoice_id,
        item_deskripsi,
        item_jumlah,
        item_harga
      FROM tb_invoice_details
      WHERE invoice_id = ?
      ORDER BY id ASC`,
      [id]
    );

    return {
      ...rows[0],
      items: details,
    };
  } catch (error) {
    console.error("GET_INVOICE_BY_ID_ERROR:", error);
    return null;
  }
}

// =========================================================================
// 7. FUNGSI: AMBIL SEMUA LIST DATA INVOICE + HITUNG UMUR PIUTANG
// =========================================================================
export async function getInvoices() {
  try {
    const [rows]: any = await db.query(`
      SELECT
        i.*,
        d.id AS detail_id,
        d.item_deskripsi,
        d.item_jumlah,
        d.item_harga
      FROM tb_invoice i
      LEFT JOIN tb_invoice_details d
        ON d.invoice_id = i.id
      ORDER BY i.id DESC, d.id ASC
    `);

    const invoiceMap = new Map<number, any>();

    for (const row of rows) {
      if (!invoiceMap.has(row.id)) {
        const { detail_id, item_deskripsi, item_jumlah, item_harga, ...header } = row;
        invoiceMap.set(row.id, { ...header, items: [] });
      }

      if (row.detail_id) {
        invoiceMap.get(row.id).items.push({
          id: row.detail_id,
          item_deskripsi: row.item_deskripsi,
          item_jumlah: row.item_jumlah,
          item_harga: row.item_harga,
        });
      }
    }

    const dataLengkap = Array.from(invoiceMap.values()).map((inv: any) => {
      const tglInvoice = new Date(inv.tanggal);
      const tglSekarang = new Date();
      const selisihMilidetik = tglSekarang.getTime() - tglInvoice.getTime();
      const hitungHari = Math.floor(selisihMilidetik / (1000 * 60 * 60 * 24));

      return {
        ...inv,
        umur_piutang: hitungHari > 0 ? hitungHari : 0,
      };
    });

    return dataLengkap;
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    return [];
  }
}

export async function updateInvoiceFile(
  id: number,
  field: "file_faktur" | "cl",
  fileUrl: string
) {
  try {
    const query = `UPDATE tb_invoice SET ${field} = ? WHERE id = ?`;
    await db.query(query, [fileUrl, id]);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_FILE_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}