
"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// READ ALL
export async function getKelompokBiaya() {
  try {
    const [rows]: any = await db.query("SELECT * FROM tb_kelompok_biaya ORDER BY id DESC");
    return rows;
  } catch (error) {
    return [];
  }
}

// CREATE
export async function createKelompokBiaya(name: string) {
  try {
    await db.query("INSERT INTO tb_kelompok_biaya (kelompok_biaya) VALUES (?)", [name]);
    revalidatePath("/dashboard/kelompok-biaya");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// UPDATE
export async function updateKelompokBiaya(id: number, name: string) {
  try {
    await db.query("UPDATE tb_kelompok_biaya SET kelompok_biaya = ? WHERE id = ?", [name, id]);
    revalidatePath("/dashboard/kelompok-biaya");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// DELETE
export async function deleteKelompokBiaya(id: number) {
  try {
    await db.query("DELETE FROM tb_kelompok_biaya WHERE id = ?", [id]);
    revalidatePath("/dashboard/kelompok-biaya");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}