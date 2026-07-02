"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// 1. GET ALL DATA (READ)
export async function getJenisBiaya() {
  try {
    const [rows]: any = await db.query("SELECT * FROM tb_jenis_biaya ORDER BY id DESC");
    return rows;
  } catch (error: any) {
    console.error("GET_JENIS_BIAYA_ERROR:", error.message);
    return [];
  }
}

// 2. CREATE DATA
export async function createJenisBiaya(name: string) {
  try {
    await db.query("INSERT INTO tb_jenis_biaya (jenis_biaya) VALUES (?)", [name]);
    
    // Melakukan refresh data pada halaman jenis-biaya secara instant
    revalidatePath("/dashboard/pos/jenis-biaya");
    return { success: true };
  } catch (error: any) {
    console.error("CREATE_JENIS_BIAYA_ERROR:", error.message);
    return { success: false, message: "Gagal simpan ke database: " + error.message };
  }
}

// 3. UPDATE DATA
export async function updateJenisBiaya(id: number, name: string) {
  try {
    await db.query("UPDATE tb_jenis_biaya SET jenis_biaya = ? WHERE id = ?", [name, id]);
    
    revalidatePath("/dashboard/pos/jenis-biaya");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_JENIS_BIAYA_ERROR:", error.message);
    return { success: false, message: "Gagal update data: " + error.message };
  }
}

// 4. DELETE DATA
export async function deleteJenisBiaya(id: number) {
  try {
    await db.query("DELETE FROM tb_jenis_biaya WHERE id = ?", [id]);
    
    revalidatePath("/dashboard/jenis-biaya");
    return { success: true };
  } catch (error: any) {
    console.error("DELETE_JENIS_BIAYA_ERROR:", error.message);
    return { success: false, message: "Gagal menghapus data: " + error.message };
  }
}