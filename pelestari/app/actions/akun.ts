"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// 1. GET ALL AKUN + NAMA KELOMPOK BIAYA
export async function getAkunList() {
  try {
    const query = `
      SELECT a.*, k.kelompok_biaya AS nama_kelompok 
      FROM tb_akun a
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
      ORDER BY a.no_akun ASC
    `;
    const [rows]: any = await db.query(query);
    return rows;
  } catch (error: any) {
    console.error("GET_AKUN_ERROR:", error.message);
    return [];
  }
}

// 2. CREATE AKUN
export async function createAkun(data: { no_akun: string; nama_akun: string; kelompok_biaya_id: number; saldo: number }) {
  try {
    const query = `INSERT INTO tb_akun (no_akun, nama_akun, kelompok_biaya_id, saldo) VALUES (?, ?, ?, ?)`;
    await db.query(query, [data.no_akun, data.nama_akun, data.kelompok_biaya_id, data.saldo]);
    
    revalidatePath("/dashboard/akun");
    return { success: true };
  } catch (error: any) {
    console.error("CREATE_AKUN_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// 3. UPDATE AKUN
export async function updateAkun(id: number, data: { no_akun: string; nama_akun: string; kelompok_biaya_id: number; saldo: number; is_aktif: number }) {
  try {
    const query = `
      UPDATE tb_akun SET 
        no_akun = ?, nama_akun = ?, kelompok_biaya_id = ?, saldo = ?, is_aktif = ? 
      WHERE id = ?
    `;
    await db.query(query, [data.no_akun, data.nama_akun, data.kelompok_biaya_id, data.saldo, data.is_aktif, id]);
    
    revalidatePath("/dashboard/akun");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_AKUN_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// 4. DELETE AKUN
export async function deleteAkun(id: number) {
  try {
    await db.query("DELETE FROM tb_akun WHERE id = ?", [id]);
    revalidatePath("/dashboard/akun");
    return { success: true };
  } catch (error: any) {
    console.error("DELETE_AKUN_ERROR:", error.message);
    return { success: false, message: "Gagal menghapus: Data mungkin sedang digunakan transaksi lain." };
  }
}