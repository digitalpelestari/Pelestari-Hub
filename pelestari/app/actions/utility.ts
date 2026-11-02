"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// 1. AMBIL SEMUA DATA TRACKING
export async function getUtilitiesAction() {
  try {
    const [rows]: any = await db.execute(
      "SELECT * FROM tb_utility_tracking ORDER BY tahun DESC, FIELD(bulan, 'Desember','November','Oktober','September','Agustus','Juli','Juni','Mei','April','Maret','Februari','Januari') DESC, id_utility DESC"
    );
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, message: error.message, data: [] };
  }
}

// 2. SIMPAN DATA BARU
export async function createUtilityAction(payload: any) {
  try {
    const { nama_utility, bulan, tahun, nominal, tanggal_bayar, keterangan } = payload;
    await db.execute(
      `INSERT INTO tb_utility_tracking (nama_utility, bulan, tahun, nominal, tanggal_bayar, keterangan) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nama_utility, bulan, Number(tahun), Number(nominal), tanggal_bayar, keterangan || null]
    );
    revalidatePath("/dashboard/ga/utilities");
    return { success: true, message: "Data utilitas berhasil dicatat!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 3. HAPUS DATA
export async function deleteUtilityAction(id_utility: number) {
  try {
    await db.execute("DELETE FROM tb_utility_tracking WHERE id_utility = ?", [id_utility]);
    revalidatePath("/dashboard/ga/utilities");
    return { success: true, message: "Data utilitas berhasil dihapus!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 4. UPDATE DATA
export async function updateUtilityAction(id_utility: number, payload: any) {
  try {
    const { nama_utility, bulan, tahun, nominal, tanggal_bayar, keterangan } = payload;
    const [result]: any = await db.execute(
      `UPDATE tb_utility_tracking
       SET nama_utility = ?, bulan = ?, tahun = ?, nominal = ?, tanggal_bayar = ?, keterangan = ?
       WHERE id_utility = ?`,
      [
        nama_utility,
        bulan,
        Number(tahun),
        Number(nominal),
        tanggal_bayar,
        keterangan || null,
        id_utility,
      ]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: "Data tidak ditemukan" };
    }

    revalidatePath("/dashboard/ga/utilities");
    return { success: true, message: "Data utilitas berhasil diperbarui!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}