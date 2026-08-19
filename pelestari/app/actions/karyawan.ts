"use server"
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache"


export interface KaryawanData {
  nip: string
  nama: string
  jabatan: string
  divisi: string
  email: string
  nik: string
  no_rekening: string
  nama_bank: string
  tempat_lahir: string
  tanggal_lahir: string
  alamat: string
  no_hp: string
  no_bpjs_kesehatan: string
  no_bpjs_ketenagakerjaan: string
  tanggal_masuk: string
}

// 1. GET ALL
export async function getKaryawanListAction() {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_karyawan ORDER BY nip ASC"
    )
    return { success: true, data: rows as KaryawanData[] }
  } catch (error: any) {
    console.error("Error getKaryawanList:", error)
    return { success: false, message: error.message || "Gagal mengambil data dari database" }
  }
}

// 2. GET DETAIL
export async function getKaryawanDetailAction(nip: string) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_karyawan WHERE nip = ? LIMIT 1",
      [nip]
    )
    if (!rows.length) return { success: false, message: "Karyawan tidak ditemukan" }
    return { success: true, data: rows[0] as KaryawanData }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 3. CREATE
export async function createKaryawanAction(payload: KaryawanData) {
  try {
    const query = `
      INSERT INTO tb_karyawan (
        nip, nama, divisi, jabatan, email, nik, 
        no_rekening, nama_bank, tempat_lahir, tanggal_lahir, 
        alamat, no_hp, no_bpjs_kesehatan, no_bpjs_ketenagakerjaan, tanggal_masuk
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const values = [
      payload.nip,
      payload.nama,
      payload.divisi,
      payload.jabatan,
      payload.email,
      payload.nik,
      payload.no_rekening,
      payload.nama_bank,
      payload.tempat_lahir,
      payload.tanggal_lahir || null,
      payload.alamat,
      payload.no_hp,
      payload.no_bpjs_kesehatan,
      payload.no_bpjs_ketenagakerjaan,
      payload.tanggal_masuk || null,
    ]

    await db.query(query, values)
    revalidatePath("/karyawan")
    return { success: true, message: "Karyawan berhasil disimpan" }
  } catch (error: any) {
    console.error("Error createKaryawan:", error)
    return { success: false, message: error.message || "Gagal menyimpan karyawan ke database" }
  }
}

// 4. UPDATE
export async function updateKaryawanAction(nip: string, payload: Partial<KaryawanData>) {
  try {
    const query = `
      UPDATE tb_karyawan SET 
        nama = ?, divisi = ?, jabatan = ?, email = ?, nik = ?, 
        no_rekening = ?, nama_bank = ?, tempat_lahir = ?, tanggal_lahir = ?, 
        alamat = ?, no_hp = ?, no_bpjs_kesehatan = ?, no_bpjs_ketenagakerjaan = ?, tanggal_masuk = ?
      WHERE nip = ?
    `
    const values = [
      payload.nama,
      payload.divisi,
      payload.jabatan,
      payload.email,
      payload.nik,
      payload.no_rekening,
      payload.nama_bank,
      payload.tempat_lahir,
      payload.tanggal_lahir || null,
      payload.alamat,
      payload.no_hp,
      payload.no_bpjs_kesehatan,
      payload.no_bpjs_ketenagakerjaan,
      payload.tanggal_masuk || null,
      nip,
    ]

    await db.query(query, values)
    revalidatePath("/karyawan")
    return { success: true, message: "Data karyawan berhasil diupdate" }
  } catch (error: any) {
    console.error("Error updateKaryawan:", error)
    return { success: false, message: error.message || "Gagal update data" }
  }
}

// 5. DELETE
export async function deleteKaryawanAction(nip: string) {
  try {
    await db.query("DELETE FROM tb_karyawan WHERE nip = ?", [nip])
    revalidatePath("/karyawan")
    return { success: true, message: "Karyawan berhasil dihapus" }
  } catch (error: any) {
    console.error("Error deleteKaryawan:", error)
    return { success: false, message: error.message || "Gagal menghapus data" }
  }
}