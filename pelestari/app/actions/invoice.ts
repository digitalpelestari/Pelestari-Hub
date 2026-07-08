"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto"; // Tambahkan generator UUID bawaan Node.js

// =========================================================================
// 1. FUNGSI: IMPORT DATA EXCEL INVOICES BULK
// =========================================================================
export async function importInvoices(dataArray: any[]) {
  try {
    for (const item of dataArray) {
      const newInvoiceId = randomUUID(); // Generate UUID untuk setiap baris excel

      const query = `INSERT INTO tb_invoice (
        id, nomor_invoice, batch, jenis_kegiatan, tanggal, tanggal_jatuhtempo, 
        perusahaan_tujuan, npwp, alamat_perusahaan, keterangan, 
        jumlah_peserta, harga_peserta, keterangan_2, jumlah_peserta_2, 
        harga_peserta_2, is_pph23, is_ppn11, is_pnbp, nominal_pnbp, 
        total, status, bayar_1, bayar_2
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        newInvoiceId, // Suntikkan UUID manual
        item.nomor_invoice,
        item.batch || "N/A",
        item.jenis_kegiatan || "-", 
        item.tanggal, // Format wajib YYYY-MM-DD
        item.tanggal_jatuhtempo,
        item.perusahaan_tujuan,
        item.npwp || "-",
        item.alamat_perusahaan || "-",
        item.keterangan || "-",
        Number(item.jumlah_peserta) || 0,
        Number(item.harga_peserta) || 0,
        item.keterangan_2 || null,
        Number(item.jumlah_peserta_2) || 0,
        Number(item.harga_peserta_2) || 0,
        item.is_pph23 ? 1 : 0,
        item.is_ppn11 ? 1 : 0,
        item.is_pnbp ? 1 : 0,
        Number(item.nominal_pnbp) || 0,
        Number(item.total) || 0,
        item.status || 'Belum Lunas',
        Number(item.bayar_1) || 0,
        Number(item.bayar_2) || 0
      ];

      await db.query(query, values);
    }

    revalidatePath("/dashboard/finance/invoices");
    return { success: true, message: `${dataArray.length} data berhasil diimpor` };
  } catch (error: any) {
    console.error("IMPORT_ERROR:", error.message);
    return { success: false, message: "Gagal impor: " + error.message };
  }
}

// =========================================================================
// 2. FUNGSI: AMBIL URUTAN (Dipertahankan jika aplikasi frontend membutuhkan)
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
// 3. FUNGSI: TAMBAH INVOICE FORM (SISI SERVER)
// =========================================================================
export async function createInvoice(formData: any) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const newInvoiceId = randomUUID(); // 1. Buat UUID string unik di sini

    // 2. Simpan Data Utama ke Tabel tb_invoice (Tambahkan kolom id di insert query)
    const queryInvoice = `INSERT INTO tb_invoice (
      id,
      nomor_invoice, 
      batch, 
      tanggal,
      jenis_kegiatan,
      tanggal_jatuhtempo, 
      perusahaan_tujuan, 
      npwp, 
      alamat_perusahaan, 
      keterangan, 
      jumlah_peserta, 
      harga_peserta, 
      keterangan_2, 
      jumlah_peserta_2, 
      harga_peserta_2,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const valuesInvoice = [
      newInvoiceId, // 3. Masukkan data UUID ke urutan parameter pertama (?)
      formData.nomor_invoice,
      formData.batch,
      formData.tanggal,
      formData.jenis_kegiatan,
      formData.tanggal_jatuhtempo,
      formData.perusahaan_tujuan,
      formData.npwp,
      formData.alamat_perusahaan,
      formData.keterangan,
      formData.jumlah_peserta,
      formData.harga_peserta,
      formData.keterangan_2 || null,
      formData.jumlah_peserta_2 || 0,
      formData.harga_peserta_2 || 0,
      formData.is_pph23 ? 1 : 0,
      formData.is_ppn11 ? 1 : 0,
      formData.is_pnbp ? 1 : 0,
      formData.nominal_pnbp || 0,
      formData.total,
      formData.bayar_1 || 0,
      formData.tanggal_bayar_1 || null,
      formData.bayar_2 || 0,
      formData.tanggal_bayar_2 || null,
      formData.status || 'Belum Lunas'
    ];

    await connection.query(queryInvoice, valuesInvoice);

    // --- SINKRONISASI SALDO MASTER AKUN PIUTANG ---
    const akunPiutang = "6000"; 
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", 
      [formData.total, akunPiutang]
    );

    await connection.commit();
    revalidatePath("/dashboard/finance/invoices");

    return { success: true };
  } catch (error: any) {
    await connection.rollback();
    console.error("CREATE_INVOICE_ERROR:", error.message);
    return { success: false, message: "Gagal simpan invoice: " + error.message };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 4. FUNGSI: HAPUS DATA INVOICE (id diubah bertipe data string)
// =========================================================================
export async function deleteInvoice(id: string) {
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
// 5. FUNGSI: UPDATE / EDIT INVOICE DATA (id diubah bertipe data string)
// =========================================================================
export async function updateInvoice(id: string, data: any) {
  try {
    const query = `
      UPDATE tb_invoice SET 
        batch = ?, jenis_kegiatan = ?, perusahaan_tujuan = ?, npwp = ?, alamat_perusahaan = ?, 
        keterangan = ?, jumlah_peserta = ?, harga_peserta = ?, 
        keterangan_2 = ?, jumlah_peserta_2 = ?, harga_peserta_2 = ?, 
        is_pph23 = ?, is_ppn11 = ?, is_pnbp = ?, nominal_pnbp = ?,
        bayar_1 = ?, tanggal_bayar_1 = ?, 
        bayar_2 = ?, tanggal_bayar_2 = ?, 
        total = ?, status = ? 
      WHERE id = ?
    `;

    const values = [
      data.batch, data.jenis_kegiatan, data.perusahaan_tujuan, data.npwp, data.alamat_perusahaan,
      data.keterangan, data.jumlah_peserta, data.harga_peserta,
      data.keterangan_2 || null, data.jumlah_peserta_2 || 0, data.harga_peserta_2 || 0,
      data.is_pph23 ? 1 : 0, data.is_ppn11 ? 1 : 0, data.is_pnbp ? 1 : 0, data.nominal_pnbp || 0,
      data.bayar_1 || 0, data.tanggal_bayar_1 || null, 
      data.bayar_2 || 0, data.tanggal_bayar_2 || null, 
      data.total, data.status,
      id
    ];

    await db.query(query, values);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true };
  } catch (error: any) {
    console.error("SQL_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// =========================================================================
// 6. FUNGSI: DETEKSI DETIL INVOICE BY ID (id diubah bertipe data string)
// =========================================================================
export async function getInvoiceById(id: string) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_invoice WHERE id = ?", 
      [id]
    );
    return rows[0];
  } catch (error) {
    return null;
  }
}

// =========================================================================
// 7. FUNGSI: AMBIL SEMUA LIST DATA INVOICE + HITUNG UMUR PIUTANG
// =========================================================================
export async function getInvoices() {
  try {
    const [rows]: any = await db.query("SELECT * FROM tb_invoice ORDER BY created_at DESC");
    
    const dataLengkap = rows.map((inv: any) => {
      const tglInvoice = new Date(inv.tanggal);
      const tglSekarang = new Date();
      
      const selisihMilidetik = tglSekarang.getTime() - tglInvoice.getTime();
      const hitungHari = Math.floor(selisihMilidetik / (1000 * 60 * 60 * 24));
      
      return {
        ...inv,
        umur_piutang: hitungHari > 0 ? hitungHari : 0
      };
    });

    return dataLengkap;
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    return [];
  }
}

// =========================================================================
// 8. FUNGSI: UPDATE DATA MANUAL PEMBAYARAN (id diubah bertipe data string)
// =========================================================================
export async function updatePayment(id: string, data: any) {
  try {
    const query = `
      UPDATE tb_invoice SET 
        bayar_1 = ?, tanggal_bayar_1 = ?, 
        bayar_2 = ?, tanggal_bayar_2 = ?, 
        status = ? 
      WHERE id = ?
    `;
    const values = [
      data.bayar_1, data.tanggal_bayar_1 || null,
      data.bayar_2, data.tanggal_bayar_2 || null,
      data.status,
      id
    ];
    await db.query(query, values);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// =========================================================================
// 9. FUNGSI: EKSEKUSI PEMBAYARAN DAN OTOMATISASI JURNAL AKUNTANSI (invoiceId: string)
// =========================================================================
interface PembayaranOtomatisPayload {
  invoiceId: string; // Diubah ke string agar cocok dengan tipe UUID
  jumlahBayar: number;
  jenisPembayaran: "DP" | "Pelunasan";
  rekeningBankAkun: string; 
  piutangAkun: string;      
  keteranganJurnal: string; 
}

export async function prosesBayarDanJurnalOtomatis(payload: PembayaranOtomatisPayload) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const [invoiceRows]: any = await connection.query(
      "SELECT nomor_invoice, total, bayar_1, bayar_2 FROM tb_invoice WHERE id = ?", 
      [payload.invoiceId]
    );
    if (invoiceRows.length === 0) throw new Error("Target invoice tidak ditemukan.");
    const invoice = invoiceRows[0];

    let updateInvoiceQuery = "";
    let updateParams = [];
    const noRegJurnal = `BKM-${invoice.nomor_invoice}`; 

    if (payload.jenisPembayaran === "DP") {
      updateInvoiceQuery = `
        UPDATE tb_invoice SET 
          bayar_1 = ?, 
          tanggal_bayar_1 = NOW(), 
          status = 'Belum Lunas' 
        WHERE id = ?
      `;
      updateParams = [payload.jumlahBayar, payload.invoiceId];
    } else {
      updateInvoiceQuery = `
        UPDATE tb_invoice SET 
          bayar_2 = ?, 
          tanggal_bayar_2 = NOW(), 
          status = 'Lunas' 
        WHERE id = ?
      `;
      updateParams = [payload.jumlahBayar, payload.invoiceId];
    }
    await connection.query(updateInvoiceQuery, updateParams);

    const jurnalHeaderQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, keterangan) 
      VALUES (CURDATE(), ?, ?)
    `;
    const [jurnalResult]: any = await connection.query(jurnalHeaderQuery, [
      noRegJurnal,
      payload.keteranganJurnal
    ]);
    const jurnalId = jurnalResult.insertId;

    const itemQuery = `
      INSERT INTO tb_jurnal_item (jurnal_id, no_akun, debit, kredit) 
      VALUES (?, ?, ?, ?)
    `;
    await connection.query(itemQuery, [jurnalId, payload.rekeningBankAkun, payload.jumlahBayar, 0]);
    
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", 
      [payload.jumlahBayar, payload.rekeningBankAkun]
    );

    await connection.query(itemQuery, [jurnalId, payload.piutangAkun, 0, payload.jumlahBayar]);
    
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", 
      [payload.jumlahBayar, payload.piutangAkun]
    );

    await connection.commit();
    
    revalidatePath("/dashboard/finance/invoices");
    revalidatePath("/dashboard/finance/jurnal");
    
    return { success: true, message: "Pembayaran diproses & Buku Besar otomatis dijurnal!" };

  } catch (error: any) {
    await connection.rollback();
    console.error("PROSES_BAYAR_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal memproses pembayaran otomatis: " + error.message };
  } finally {
    connection.release();
  }
}