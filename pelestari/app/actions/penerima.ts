"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// READ ALL
export async function getPenerima() {
  try {
    const [rows]: any = await db.query("SELECT * FROM tb_penerima ORDER BY id DESC");
    return rows;
  } catch (error) {
    return [];
  }
}

// CREATE
export async function createPenerima(nama: string) {
  try {
    if (!nama || !nama.trim()) {
      return { success: false, message: "Nama penerima tidak boleh kosong" };
    }
    await db.query("INSERT INTO tb_penerima (nama_penerima) VALUES (?)", [nama.trim()]);
    revalidatePath("/dashboard/finance/data-master/penerima");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// UPDATE
export async function updatePenerima(id: number, nama: string) {
  try {
    if (!nama || !nama.trim()) {
      return { success: false, message: "Nama penerima tidak boleh kosong" };
    }
    await db.query("UPDATE tb_penerima SET nama_penerima = ? WHERE id = ?", [nama.trim(), id]);
    revalidatePath("/dashboard/finance/data-master/penerima");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// DELETE
export async function deletePenerima(id: number) {
  try {
    await db.query("DELETE FROM tb_penerima WHERE id = ?", [id]);
    revalidatePath("/dashboard/finance/data-master/penerima");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}