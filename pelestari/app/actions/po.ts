"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ResultSetHeader } from "mysql2";

// =========================================================================
// 1. ACTION: AMBIL SEMUA LIST PO + HITUNG REMINDER SISA HARI
// =========================================================================
export async function getPurchaseOrdersAction() {
  try {
    const [rows]: any = await db.execute(`
      SELECT *, 
      DATEDIFF(jatuh_tempo, CURDATE()) as sisa_hari
      FROM tb_po 
      ORDER BY id_po DESC
    `);
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, message: error.message, data: [] };
  }
}

// =========================================================================
// 2. ACTION: SIMPAN PO BARU (Otomatis Tambah Saldo Utang Usaha 8000)
// =========================================================================
export async function createPurchaseOrderAction(payload: any) {
  const connection = await db.getConnection();
  try {
    const {
      nomor_po, tanggal_po, vendor_nama, vendor_pic, vendor_email,
      alamat_pengantaran, penerima_nama, sub_total, ppn, total_harga,
      tempo_hari, items
    } = payload;

    // Kalkulasi Tanggal Jatuh Tempo otomatis
    let jatuhTempoDate = null;
    if (tempo_hari > 0) {
      const date = new Date(tanggal_po);
      date.setDate(date.getDate() + Number(tempo_hari));
      jatuhTempoDate = date.toISOString().split("T")[0]; // Format YYYY-MM-DD
    } else {
      jatuhTempoDate = tanggal_po;
    }

    await connection.beginTransaction();

    // A. Simpan data ke tabel induk (tb_po) - Kunci Status 'Belum Bayar'
    const [poResult]: any = await connection.execute(
      `INSERT INTO tb_po (nomor_po, tanggal_po, vendor_nama, vendor_pic, vendor_email, 
       alamat_pengantaran, penerima_nama, sub_total, ppn, total_harga, status_pembayaran, tempo_hari, jatuh_tempo, tanggal_bayar) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Bayar', ?, ?, NULL)`,
      [
        nomor_po, tanggal_po, vendor_nama, vendor_pic, vendor_email,
        alamat_pengantaran, penerima_nama, sub_total, ppn, total_harga,
        tempo_hari, jatuhTempoDate
      ]
    );
    const insertedPoId = poResult.insertId;

    // B. Looping simpan item detail (tb_po_item)
    for (const item of items) {
      await connection.execute(
        `INSERT INTO tb_po_item (id_po, transaksi, ukuran, quantity, unit_price, total) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [insertedPoId, item.transaksi, item.ukuran, item.quantity, item.unit_price, item.total]
      );
    }

    // C. OTOMATISASI UTANG: Tambahkan total_harga langsung ke saldo tb_akun 8000
    const [updateAccount]: any = await connection.execute(
      `UPDATE tb_akun 
       SET saldo = saldo + ? 
       WHERE no_akun = '8000'`,
      [Number(total_harga)]
    );

    if (updateAccount.affectedRows === 0) {
      throw new Error("Gagal otomatisasi! Akun kode 8000 (Utang Usaha) tidak ditemukan di tb_akun.");
    }

    await connection.commit();
    revalidatePath("/dashboard/purchase-order"); 
    return { success: true, message: "Purchase Order berhasil disimpan & saldo Utang Usaha otomatis bertambah!" };
  } catch (error: any) {
    await connection.rollback();
    return { success: false, message: error.message };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 3. ACTION: UPDATE STATUS BAYAR (Termasuk Sinkronisasi Tanggal Bayar ke DB)
// =========================================================================
export async function updatePaymentStatusAction(
  id_po: number, 
  status_baru: string, 
  tempo_hari_baru: number,
  tanggal_bayar_baru: string | null
) {
  const connection = await db.getConnection();
  try {
    const [poRows]: any = await connection.execute(
      "SELECT tanggal_po, total_harga, status_pembayaran FROM tb_po WHERE id_po = ?", 
      [id_po]
    );
    
    if (poRows.length === 0) {
      return { success: false, message: "Data Purchase Order tidak ditemukan!" };
    }
    
    const { tanggal_po, total_harga, status_pembayaran: status_lama } = poRows[0];
    let jatuhTempoDate = null;

    // === PERBAIKAN MANIPULASI TANGGAL AMAN TIMEZONE (WIB) ===
    if (Number(tempo_hari_baru) > 0) {
      // Pecah string tanggal_po asli agar tidak terkena efek timezone jam 00:00
      const originDate = new Date(tanggal_po);
      const year = originDate.getFullYear();
      const month = originDate.getMonth();
      const day = originDate.getDate();

      // Buat objek date baru murni berdasarkan waktu lokal komputer
      const calculatedDate = new Date(year, month, day);
      calculatedDate.setDate(calculatedDate.getDate() + Number(tempo_hari_baru));

      // Format manual ke YYYY-MM-DD tanpa menggunakan .toISOString()
      const resYear = calculatedDate.getFullYear();
      const resMonth = String(calculatedDate.getMonth() + 1).padStart(2, '0');
      const resDay = String(calculatedDate.getDate()).padStart(2, '0');
      
      jatuhTempoDate = `${resYear}-${resMonth}-${resDay}`;
    } else {
      // Jika tempo 0 hari, langsung gunakan tanggal PO asli (dalam format string YYYY-MM-DD)
      jatuhTempoDate = new Date(tanggal_po).toISOString().split("T")[0];
    }
    // ========================================================

    const tglBayarFinal = status_baru === "SUDAH BAYAR" ? tanggal_bayar_baru : null;

    await connection.beginTransaction();

    if ((status_lama === "Belum Bayar" || status_lama === "BELUM BAYAR") && status_baru === "SUDAH BAYAR") {
      await connection.execute(
        "UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = '8000'",
        [Number(total_harga)]
      );
    } else if (status_lama === "SUDAH BAYAR" && (status_baru === "Belum Bayar" || status_baru === "BELUM BAYAR")) {
      await connection.execute(
        "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = '8000'",
        [Number(total_harga)]
      );
    }

    await connection.execute(
      `UPDATE tb_po 
       SET status_pembayaran = ?, 
           tempo_hari = ?, 
           jatuh_tempo = ?,
           tanggal_bayar = ? 
       WHERE id_po = ?`,
      [status_baru, Number(tempo_hari_baru), jatuhTempoDate, tglBayarFinal, id_po]
    );

    await connection.commit();
    revalidatePath("/dashboard/ga/purchase-order");
    return { success: true, message: "Status pembayaran, tanggal realisasi, dan saldo berhasil diperbarui!" };
  } catch (error: any) {
    await connection.rollback();
    return { success: false, message: error.message };
  } finally {
    connection.release();
  }
}

// =========================================================================
// 4. ACTION: AMBIL RINCIAN ITEM BARANG PO
// =========================================================================
export async function getPoItemsAction(id_po: number) {
  try {
    const [rows]: any = await db.execute(
      "SELECT * FROM tb_po_item WHERE id_po = ?",
      [id_po]
    );
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, message: error.message, data: [] };
  }
}

// =========================================================================
// 5. ACTION: HAPUS PO SECARA PERMANEN (Otomatis Potong Saldo Akun 8000)
// =========================================================================
export async function deletePurchaseOrderAction(id_po: number) {
  const connection = await db.getConnection();
  try {
    const [poRows]: any = await connection.execute(
      "SELECT total_harga, status_pembayaran FROM tb_po WHERE id_po = ?",
      [id_po]
    );

    if (poRows.length === 0) {
      return { success: false, message: "Data PO tidak ditemukan!" };
    }

    const { total_harga, status_pembayaran } = poRows[0];

    await connection.beginTransaction();

    // Jika dihapus saat statusnya masih Belum Bayar, kurangi saldo 8000 agar laporan klop
    if (status_pembayaran === "Belum Bayar" || status_pembayaran === "BELUM BAYAR") {
      await connection.execute(
        "UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = '8000'",
        [Number(total_harga)]
      );
    }

    // Hapus data anak (items) baru data induk (po)
    await connection.execute("DELETE FROM tb_po_item WHERE id_po = ?", [id_po]);
    await connection.execute("DELETE FROM tb_po WHERE id_po = ?", [id_po]);

    await connection.commit();
    revalidatePath("/dashboard/purchase-order");
    return { success: true, message: "Dokumen PO berhasil dihapus dan saldo utang otomatis dikurangi!" };
  } catch (error: any) {
    await connection.rollback();
    return { success: false, message: error.message };
  } finally {
    connection.release();
  }
}