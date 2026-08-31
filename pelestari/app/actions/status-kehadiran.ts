"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export interface StatusKehadiranData {
  id: number
  nama_status: string
}

export interface CreateStatusKehadiranPayload {
  nama_status: string
}

export interface UpdateStatusKehadiranPayload {
  nama_status?: string
}

export async function getStatusKehadiran() {
  try {
    const [rows]: any = await db.query(
      "SELECT id, nama_status FROM tb_status_kehadiran ORDER BY nama_status ASC"
    )
    return { success: true, data: rows as StatusKehadiranData[] }
  } catch (error: any) {
    console.error("Error getStatusKehadiran:", error)
    return { success: false, message: error.message || "Gagal mengambil data status kehadiran" }
  }
}

export async function getStatusKehadiranList(search?: string, page?: number, pageSize?: number) {
  const isPaginationEnabled = page !== undefined && pageSize !== undefined
  const currentPage = Math.max(1, page || 1)
  const currentPageSize = Math.max(1, pageSize || 20)
  const offset = (currentPage - 1) * currentPageSize

  const conditions: string[] = []
  const params: any[] = []

  if (search?.trim()) {
    const searchValue = `%${search.trim()}%`
    conditions.push("LOWER(nama_status) LIKE LOWER(?)")
    params.push(searchValue)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const [countRows]: any = await db.query(
      `SELECT COUNT(*) AS total FROM tb_status_kehadiran ${whereClause}`,
      params
    )
    const total = Number(countRows[0]?.total || 0)

    const [rows]: any = await db.query(
      `SELECT id, nama_status FROM tb_status_kehadiran ${whereClause} ORDER BY nama_status ASC LIMIT ? OFFSET ?`,
      [...params, currentPageSize, offset]
    )

    return {
      success: true,
      data: rows as StatusKehadiranData[],
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.ceil(total / currentPageSize),
      },
    }
  } catch (error: any) {
    console.error("Error getStatusKehadiranList:", error)
    return { success: false, message: error.message || "Gagal mengambil data status kehadiran", data: [], pagination: null }
  }
}

export async function getStatusKehadiranById(id: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT id, nama_status FROM tb_status_kehadiran WHERE id = ? LIMIT 1",
      [id]
    )
    if (!rows.length) return { success: false, message: "Status kehadiran tidak ditemukan" }
    return { success: true, data: rows[0] as StatusKehadiranData }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createStatusKehadiran(payload: CreateStatusKehadiranPayload) {
  if (!payload.nama_status || payload.nama_status.trim() === "") {
    return { success: false, message: "Nama status wajib diisi" }
  }


  try {
    await db.query(
      `INSERT INTO tb_status_kehadiran (nama_status)
       VALUES (?)`,
      [payload.nama_status.trim()]
    )
    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Status kehadiran berhasil ditambahkan" }
  } catch (error: any) {
    console.error("Error createStatusKehadiran:", error)
    return { success: false, message: error.message || "Gagal menambahkan status kehadiran" }
  }
}

export async function updateStatusKehadiran(id: number, payload: UpdateStatusKehadiranPayload) {
  if (payload.nama_status !== undefined && (!payload.nama_status || payload.nama_status.trim() === "")) {
    return { success: false, message: "Nama status wajib diisi" }
  }

  const fields: string[] = []
  const values: any[] = []

  if (payload.nama_status !== undefined) {
    fields.push("nama_status = ?")
    values.push(payload.nama_status.trim())
  }

  if (fields.length === 0) {
    return { success: false, message: "Tidak ada data yang diperbarui" }
  }

  try {
    values.push(id)
    await db.query(
      `UPDATE tb_status_kehadiran SET ${fields.join(", ")} WHERE id = ?`,
      values
    )
    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Status kehadiran berhasil diperbarui" }
  } catch (error: any) {
    console.error("Error updateStatusKehadiran:", error)
    return { success: false, message: error.message || "Gagal memperbarui status kehadiran" }
  }
}

export async function deleteStatusKehadiran(id: number) {
  try {
    const [absensiRows]: any = await db.query(
      "SELECT COUNT(*) AS total FROM tb_absensi_harian WHERE status_id = ?",
      [id]
    )
    const totalAbsensi = absensiRows[0]?.total || 0

    if (totalAbsensi > 0) {
      return {
        success: false,
        message: `Tidak dapat menghapus status karena masih digunakan oleh ${totalAbsensi} data absensi harian`
      }
    }

    const [deleted]: any = await db.query(
      "DELETE FROM tb_status_kehadiran WHERE id = ?",
      [id]
    )

    if (deleted.affectedRows === 0) {
      return { success: false, message: "Status kehadiran tidak ditemukan" }
    }

    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Status kehadiran berhasil dihapus" }
  } catch (error: any) {
    console.error("Error deleteStatusKehadiran:", error)
    return { success: false, message: error.message || "Gagal menghapus status kehadiran" }
  }
}
