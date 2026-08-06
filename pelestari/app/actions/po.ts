"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
// 2. ACTION: SIMPAN PO BARU (Murni Catatan GA, Tanpa Sentuh Saldo Akun)
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

    // A. Simpan data ke tabel induk (tb_po)
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

    // (Logika otomatisasi penambahan saldo tb_akun 21100 telah dihapus total di sini)

    await connection.commit();
    revalidatePath("/dashboard/purchase-order"); 
    return { success: true, message: "Purchase Order berhasil disimpan sebagai catatan GA!" };
  } catch (error: any) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    return { success: false, message: error.message };
  } finally {
    if (connection) connection.release();
  }
}

// =========================================================================
// 3. ACTION: UPDATE STATUS BAYAR (Hanya Ubah Status di Modul GA)
// =========================================================================
export async function updatePaymentStatusAction(
  id_po: number, 
  status_baru: string, 
  tempo_hari_baru: number,
  tanggal_bayar_baru: string | null
) {
  let connection;
  try {
    connection = await db.getConnection();
    
    const [poRows]: any = await connection.execute(
      "SELECT tanggal_po, total_harga, status_pembayaran FROM tb_po WHERE id_po = ?", 
      [id_po]
    );
    
    if (poRows.length === 0) {
      connection.release();
      return { success: false, message: "Data Purchase Order tidak ditemukan!" };
    }
    
    const { tanggal_po } = poRows[0];
    let jatuhTempoDate = null;

    // === MANIPULASI TANGGAL AMAN TIMEZONE (WIB) ===
    if (Number(tempo_hari_baru) > 0) {
      const originDate = new Date(tanggal_po);
      const year = originDate.getFullYear();
      const month = originDate.getMonth();
      const day = originDate.getDate();

      const calculatedDate = new Date(year, month, day);
      calculatedDate.setDate(calculatedDate.getDate() + Number(tempo_hari_baru));

      const resYear = calculatedDate.getFullYear();
      const resMonth = String(calculatedDate.getMonth() + 1).padStart(2, '0');
      const resDay = String(calculatedDate.getDate()).padStart(2, '0');
      
      jatuhTempoDate = `${resYear}-${resMonth}-${resDay}`;
    } else {
      jatuhTempoDate = new Date(tanggal_po).toISOString().split("T")[0];
    }
    // ========================================================

    const tglBayarFinal = status_baru === "SUDAH BAYAR" ? tanggal_bayar_baru : null;

    await connection.beginTransaction();

    // UPDATE HANYA KE TABEL PO (Murni Status Catatan GA)
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
    return { 
      success: true, 
      message: "Status pembayaran berhasil diperbarui di catatan GA!" 
    };
  } catch (error: any) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    return { success: false, message: error.message };
  } finally {
    if (connection) connection.release();
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
// 5. ACTION: HAPUS PO SECARA PERMANEN (Tanpa Sentuh Saldo Akun)
// =========================================================================
export async function deletePurchaseOrderAction(id_po: number) {
  let connection;
  try {
    connection = await db.getConnection();
    
    const [poRows]: any = await connection.execute(
      "SELECT id_po FROM tb_po WHERE id_po = ?",
      [id_po]
    );

    if (poRows.length === 0) {
      connection.release();
      return { success: false, message: "Data PO tidak ditemukan!" };
    }

    await connection.beginTransaction();

    // Hapus data anak (items) baru data induk (po) tanpa mengubah tb_akun
    await connection.execute("DELETE FROM tb_po_item WHERE id_po = ?", [id_po]);
    await connection.execute("DELETE FROM tb_po WHERE id_po = ?", [id_po]);

    await connection.commit();
    revalidatePath("/dashboard/purchase-order");
    return { success: true, message: "Dokumen PO berhasil dihapus dari catatan GA." };
  } catch (error: any) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    return { success: false, message: error.message };
  } finally {
    if (connection) connection.release();
  }
}