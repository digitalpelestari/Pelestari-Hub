"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// --- FUNGSI BARU: AMBIL NOMOR URUT BERIKUTNYA ---
export async function importInvoices(dataArray: any[]) {
  try {
    // Opsional: Gunakan loop dengan pengecekan tipe data
    for (const item of dataArray) {
      // PERBAIKAN: Menambahkan kolom 'jenis_kegiatan' agar selaras dengan total parameter VALUES (?)
      const query = `INSERT INTO tb_invoice (
        nomor_invoice, batch, jenis_kegiatan, tanggal, tanggal_jatuhtempo, 
        perusahaan_tujuan, npwp, alamat_perusahaan, keterangan, 
        jumlah_peserta, harga_peserta, keterangan_2, jumlah_peserta_2, 
        harga_peserta_2, is_pph23, is_ppn11, is_pnbp, nominal_pnbp, 
        total, status, bayar_1, bayar_2
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        item.nomor_invoice,
        item.batch || "N/A",
        item.jenis_kegiatan || "-", // Dipetakan ke kolom jenis_kegiatan
        item.tanggal, // Format harus YYYY-MM-DD
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

    revalidatePath("/dashboard/invoices");
    return { success: true, message: `${dataArray.length} data berhasil diimpor` };
  } catch (error: any) {
    console.error("IMPORT_ERROR:", error.message);
    return { success: false, message: "Gagal impor: " + error.message };
  }
}

export async function getNextInvoiceNumber() {
  try {
    const [rows]: any = await db.query("SELECT id FROM tb_invoice ORDER BY id DESC LIMIT 1");
    const lastId = rows.length > 0 ? rows[0].id : 0;
    return lastId + 1;
  } catch (error) {
    console.error("Gagal mengambil urutan nomor:", error);
    return 1; 
  }
}

export async function createInvoice(formData: any) {
  // Mengambil koneksi manual dari pool database untuk mengaktifkan transaction rollback
  const connection = await db.getConnection();
  
  try {
    // 1. Mulai Transaksi Database
    await connection.beginTransaction();

    // 2. Simpan Data Utama ke Tabel tb_invoice
    const queryInvoice = `INSERT INTO tb_invoice (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const valuesInvoice = [
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

    // =========================================================================
    // --- SINKRONISASI SALDO: HANYA UPDATE AKUN PIUTANG (TANPA JURNAL OTOMATIS)
    // =========================================================================
    const akunPiutang = "6000"; 

    // Langsung update menambah saldo riil akun Piutang di master tb_akun
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", 
      [formData.total, akunPiutang]
    );

    // 3. Jika proses insert invoice dan update saldo piutang aman, simpan permanen ke MySQL
    await connection.commit();
    
    // Refresh Cache Next.js agar data terbaru langsung muncul di dashboard
    revalidatePath("/dashboard/invoices");

    return { success: true };
  } catch (error: any) {
    // Batalkan semua perubahan jika terjadi error dalam rangkaian di atas
    await connection.rollback();
    console.error("CREATE_INVOICE_ERROR:", error.message);
    return { success: false, message: "Gagal simpan invoice: " + error.message };
  } finally {
    // Kembalikan koneksi ke pool database
    connection.release();
  }
}

export async function deleteInvoice(id: number) {
  try {
    const query = `DELETE FROM tb_invoice WHERE id = ?`;
    await db.query(query, [id]);
    revalidatePath("/dashboard/invoices");
    return { success: true, message: "Invoice berhasil dihapus" };
  } catch (error) {
    console.error("Gagal menghapus invoice:", error);
    return { success: false, message: "Gagal menghapus data dari database" };
  }
}

export async function updateInvoice(id: number, data: any) {
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
    revalidatePath("/dashboard/invoices");
    return { success: true };
  } catch (error: any) {
    console.error("SQL_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function getInvoiceById(id: number) {
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

export async function updatePayment(id: number, data: any) {
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
    revalidatePath("/dashboard/invoices");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// =========================================================================
// --- FUNGSI BARU: EKSEKUSI PEMBAYARAN DAN STRATEGI JURNAL OTOMATIS ---
// =========================================================================
interface PembayaranOtomatisPayload {
  invoiceId: number;
  jumlahBayar: number;
  jenisPembayaran: "DP" | "Pelunasan";
  rekeningBankAkun: string; // Masukkan nomor COA Bank tujuan (misal: "111.02")
  piutangAkun: string;      // Masukkan nomor COA Piutang Usaha (misal: "112.01")
  keteranganJurnal: string; // Deskripsi kustom untuk isi pembukuan jurnal umum
}

export async function prosesBayarDanJurnalOtomatis(payload: PembayaranOtomatisPayload) {
  const connection = await db.getConnection();
  
  try {
    // 1. Mulai Rangkaian Transaksi Database Aman
    await connection.beginTransaction();

    // 2. Ambil snapshot data invoice target
    const [invoiceRows]: any = await connection.query(
      "SELECT nomor_invoice, total, bayar_1, bayar_2 FROM tb_invoice WHERE id = ?", 
      [payload.invoiceId]
    );
    if (invoiceRows.length === 0) throw new Error("Target invoice tidak ditemukan.");
    const invoice = invoiceRows[0];

    // 3. Hitung & Update Parameter Pembayaran di Tabel Invoice
    let updateInvoiceQuery = "";
    let updateParams = [];
    const noRegJurnal = `BKM-${invoice.nomor_invoice}`; // Bukti Kas Masuk otomatis

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
      // Jika pelunasan, isi bayar_2 dan kunci status ke 'Lunas'
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

    // 4. GENERATE JURNAL: Buat baris header baru di tb_jurnal
    const jurnalHeaderQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, keterangan) 
      VALUES (CURDATE(), ?, ?)
    `;
    const [jurnalResult]: any = await connection.query(jurnalHeaderQuery, [
      noRegJurnal,
      payload.keteranganJurnal
    ]);
    const jurnalId = jurnalResult.insertId;

    // 5. GENERATE JURNAL ITEM: Insert sisi DEBIT (Uang bertambah masuk ke Rekening Bank)
    const itemQuery = `
      INSERT INTO tb_jurnal_item (jurnal_id, no_akun, debit, kredit) 
      VALUES (?, ?, ?, ?)
    `;
    await connection.query(itemQuery, [jurnalId, payload.rekeningBankAkun, payload.jumlahBayar, 0]);
    
    // Sinkronisasi otomatis menambah Saldo Buku Besar Master Akun Bank
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", 
      [payload.jumlahBayar, payload.rekeningBankAkun]
    );

    // 6. GENERATE JURNAL ITEM: Insert sisi KREDIT (Piutang Usaha berkurang)
    await connection.query(itemQuery, [jurnalId, payload.piutangAkun, 0, payload.jumlahBayar]);
    
    // Sinkronisasi otomatis mengurangi Saldo Buku Besar Master Akun Piutang
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", 
      [payload.jumlahBayar, payload.piutangAkun]
    );

    // Jika seluruh rangkaian mutasi aman, commit permanen ke MySQL
    await connection.commit();
    
    // Refresh Cache Next.js
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/jurnal");
    
    return { success: true, message: "Pembayaran diproses & Buku Besar otomatis dijurnal!" };

  } catch (error: any) {
    // Batalkan seluruh rangkaian jika ada salah satu operasi query gagal
    await connection.rollback();
    console.error("PROSES_BAYAR_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal memproses pembayaran otomatis: " + error.message };
  } finally {
    // Kembalikan koneksi ke pool
    connection.release();
  }
}