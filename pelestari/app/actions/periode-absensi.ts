"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export interface PeriodeAbsensiData {
  id: number
  nama_periode: string
  tanggal_mulai: string
  tanggal_selesai: string
}

export interface CreatePeriodeAbsensiPayload {
  nama_periode: string
  tanggal_mulai: string
  tanggal_selesai: string
}

export interface UpdatePeriodeAbsensiPayload {
  nama_periode?: string
  tanggal_mulai?: string
  tanggal_selesai?: string
}

export async function getPeriodeAbsensi() {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_periode_absensi ORDER BY tanggal_mulai DESC"
    )
    return { success: true, data: rows as PeriodeAbsensiData[] }
  } catch (error: any) {
    console.error("Error getPeriodeAbsensi:", error)
    return { success: false, message: error.message || "Gagal mengambil data periode absensi" }
  }
}

export async function getPeriodeAbsensiById(id: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_periode_absensi WHERE id = ? LIMIT 1",
      [id]
    )
    if (!rows.length) return { success: false, message: "Periode absensi tidak ditemukan" }
    return { success: true, data: rows[0] as PeriodeAbsensiData }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createPeriodeAbsensi(payload: CreatePeriodeAbsensiPayload) {
  if (!payload.nama_periode || payload.nama_periode.trim() === "") {
    return { success: false, message: "Nama periode wajib diisi" }
  }

  if (payload.tanggal_mulai > payload.tanggal_selesai) {
    return { success: false, message: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai" }
  }

  try {
    await db.query(
      `INSERT INTO tb_periode_absensi (nama_periode, tanggal_mulai, tanggal_selesai)
       VALUES (?, ?, ?)`,
      [payload.nama_periode.trim(), payload.tanggal_mulai, payload.tanggal_selesai]
    )
    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Periode absensi berhasil ditambahkan" }
  } catch (error: any) {
    console.error("Error createPeriodeAbsensi:", error)
    return { success: false, message: error.message || "Gagal menambahkan periode absensi" }
  }
}

export async function updatePeriodeAbsensi(id: number, payload: UpdatePeriodeAbsensiPayload) {
  if (payload.nama_periode !== undefined && (!payload.nama_periode || payload.nama_periode.trim() === "")) {
    return { success: false, message: "Nama periode wajib diisi" }
  }

  if (payload.tanggal_mulai && payload.tanggal_selesai && payload.tanggal_mulai > payload.tanggal_selesai) {
    return { success: false, message: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai" }
  }

  const fields: string[] = []
  const values: any[] = []

  if (payload.nama_periode !== undefined) {
    fields.push("nama_periode = ?")
    values.push(payload.nama_periode.trim())
  }
  if (payload.tanggal_mulai !== undefined) {
    fields.push("tanggal_mulai = ?")
    values.push(payload.tanggal_mulai)
  }
  if (payload.tanggal_selesai !== undefined) {
    fields.push("tanggal_selesai = ?")
    values.push(payload.tanggal_selesai)
  }

  if (fields.length === 0) {
    return { success: false, message: "Tidak ada data yang diperbarui" }
  }

  try {
    values.push(id)
    await db.query(
      `UPDATE tb_periode_absensi SET ${fields.join(", ")} WHERE id = ?`,
      values
    )
    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Periode absensi berhasil diperbarui" }
  } catch (error: any) {
    console.error("Error updatePeriodeAbsensi:", error)
    return { success: false, message: error.message || "Gagal memperbarui periode absensi" }
  }
}

export async function deletePeriodeAbsensi(id: number) {
  try {
    const [absensiRows]: any = await db.query(
      "SELECT COUNT(*) AS total FROM tb_absensi_harian WHERE periode_id = ?",
      [id]
    )
    const totalAbsensi = absensiRows[0]?.total || 0

    if (totalAbsensi > 0) {
      return {
        success: false,
        message: `Tidak dapat menghapus periode karena masih memiliki ${totalAbsensi} data absensi harian`
      }
    }

    const [deleted]: any = await db.query(
      "DELETE FROM tb_periode_absensi WHERE id = ?",
      [id]
    )

    if (deleted.affectedRows === 0) {
      return { success: false, message: "Periode absensi tidak ditemukan" }
    }

    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Periode absensi berhasil dihapus" }
  } catch (error: any) {
    console.error("Error deletePeriodeAbsensi:", error)
    return { success: false, message: error.message || "Gagal menghapus periode absensi" }
  }
}
