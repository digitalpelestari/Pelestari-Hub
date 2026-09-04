"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// READ ALL
export async function getPemohon() {
  try {
    const [rows]: any = await db.query("SELECT * FROM tb_pemohon ORDER BY id DESC");
    return rows;
  } catch (error) {
    return [];
  }
}

// CREATE
export async function createPemohon(nama: string) {
  try {
    if (!nama || !nama.trim()) {
      return { success: false, message: "Nama pemohon tidak boleh kosong" };
    }
    await db.query("INSERT INTO tb_pemohon (nama_pemohon) VALUES (?)", [nama.trim()]);
    revalidatePath("/dashboard/finance/data-master/pemohon");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// UPDATE
export async function updatePemohon(id: number, nama: string) {
  try {
    if (!nama || !nama.trim()) {
      return { success: false, message: "Nama pemohon tidak boleh kosong" };
    }
    await db.query("UPDATE tb_pemohon SET nama_pemohon = ? WHERE id = ?", [nama.trim(), id]);
    revalidatePath("/dashboard/finance/data-master/pemohon");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// DELETE
export async function deletePemohon(id: number) {
  try {
    await db.query("DELETE FROM tb_pemohon WHERE id = ?", [id]);
    revalidatePath("/dashboard/finance/data-master/pemohon");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}