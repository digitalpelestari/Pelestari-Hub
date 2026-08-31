"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export interface AbsensiHarianData {
  id: number
  karyawan_nip: string
  tanggal: string
  jam_masuk: string | null
  jam_keluar: string | null
  status_id: number
  keterangan: string | null
  nip: string
  nama: string
  divisi: string
  jabatan: string
  nama_status: string
}

export interface CreateAbsensiHarianPayload {
  karyawan_nip: string
  tanggal: string
  jam_masuk?: string | null
  jam_keluar?: string | null
  status_id: number
  keterangan?: string | null
}

export interface UpdateAbsensiHarianPayload {
  karyawan_nip?: string
  tanggal?: string
  jam_masuk?: string | null
  jam_keluar?: string | null
  status_id?: number
  keterangan?: string | null
}

function normalizeAbsensiDate(date: Date | string | null): string {
  if (!date) return ""

  if (date instanceof Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return String(date).substring(0, 10)
}

async function getAbsensiBaseQuery() {
  return `
    SELECT
      a.id,
      a.karyawan_nip,
      a.tanggal,
      a.jam_masuk,
      a.jam_keluar,
      a.status_id,
      a.keterangan,
      k.nip,
      k.nama,
      k.divisi,
      k.jabatan,
      s.nama_status
    FROM tb_absensi_harian a
    LEFT JOIN tb_karyawan k ON a.karyawan_nip = k.nip
    LEFT JOIN tb_status_kehadiran s ON a.status_id = s.id
  `
}

export async function getAbsensiHarian() {
  try {
    const [rows]: any = await db.query(
      `${await getAbsensiBaseQuery()} ORDER BY a.tanggal DESC`
    )

    const data = rows.map((row: any) => ({
      ...row,
      tanggal: normalizeAbsensiDate(row.tanggal),
    }))

    return {
      success: true,
      data: data as AbsensiHarianData[],
    }
  } catch (error: any) {
    console.error("Error getAbsensiHarian:", error)

    return {
      success: false,
      message:
        error.message || "Gagal mengambil data absensi harian",
      data: [],
    }
  }
}

export async function getAbsensiHarianById(id: number) {
  try {
    const [rows]: any = await db.query(
      `${await getAbsensiBaseQuery()} WHERE a.id = ? LIMIT 1`,
      [id]
    )
    if (!rows.length) return { success: false, message: "Data absensi harian tidak ditemukan" }
    return { success: true, data: rows[0] as AbsensiHarianData }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getAbsensiByKaryawan(karyawanNip: number) {
  try {
    const [rows]: any = await db.query(
      `${await getAbsensiBaseQuery()} WHERE a.karyawan_nip = ? ORDER BY a.tanggal DESC`,
      [karyawanNip]
    )
    return { success: true, data: rows as AbsensiHarianData[] }
  } catch (error: any) {
    console.error("Error getAbsensiByKaryawan:", error)
    return { success: false, message: error.message || "Gagal mengambil data absensi karyawan", data: [] }
  }
}

export async function getAbsensiByTanggal(tanggal: string) {
  try {
    const [rows]: any = await db.query(
      `${await getAbsensiBaseQuery()} WHERE a.tanggal = ? ORDER BY k.nama ASC`,
      [tanggal]
    )
    return { success: true, data: rows as AbsensiHarianData[] }
  } catch (error: any) {
    console.error("Error getAbsensiByTanggal:", error)
    return { success: false, message: error.message || "Gagal mengambil data absensi tanggal", data: [] }
  }
}

export async function createAbsensiHarian(payload: CreateAbsensiHarianPayload) {
  if (!payload.karyawan_nip || !payload.tanggal || !payload.status_id) {
    return { success: false, message: "karyawan_nip, tanggal, dan status_id wajib diisi" }
  }

  try {
    const [karyawanRows]: any = await db.query(
      "SELECT nip FROM tb_karyawan WHERE nip = ? LIMIT 1",
      [payload.karyawan_nip]
    )
    if (!karyawanRows.length) {
      return { success: false, message: "Karyawan tidak ditemukan" }
    }

    const [statusRows]: any = await db.query(
      "SELECT id FROM tb_status_kehadiran WHERE id = ? LIMIT 1",
      [payload.status_id]
    )
    if (!statusRows.length) {
      return { success: false, message: "Status kehadiran tidak ditemukan" }
    }

    const [duplicateRows]: any = await db.query(
      "SELECT id FROM tb_absensi_harian WHERE karyawan_nip = ? AND tanggal = ? LIMIT 1",
      [payload.karyawan_nip, payload.tanggal]
    )
    if (duplicateRows.length > 0) {
      return {
        success: false,
        message: `Karyawan ini sudah memiliki data absensi pada tanggal ${payload.tanggal}`
      }
    }

    await db.query(
      `INSERT INTO tb_absensi_harian (karyawan_nip, tanggal, jam_masuk, jam_keluar, status_id, keterangan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.karyawan_nip,
        payload.tanggal,
        payload.jam_masuk || null,
        payload.jam_keluar || null,
        payload.status_id,
        payload.keterangan || null,
      ]
    )

    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Data absensi harian berhasil ditambahkan" }
  } catch (error: any) {
    console.error("Error createAbsensiHarian:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return { success: false, message: "Data absensi untuk karyawan dan tanggal ini sudah ada" }
    }
    return { success: false, message: error.message || "Gagal menambahkan data absensi harian" }
  }
}

export async function updateAbsensiHarian(id: number, payload: UpdateAbsensiHarianPayload) {
  if (!payload.karyawan_nip && !payload.tanggal && payload.status_id === undefined) {
    return { success: false, message: "Tidak ada data yang diperbarui" }
  }

  try {
    const [existingRows]: any = await db.query(
      "SELECT karyawan_nip, tanggal FROM tb_absensi_harian WHERE id = ? LIMIT 1",
      [id]
    )
    if (!existingRows.length) {
      return { success: false, message: "Data absensi harian tidak ditemukan" }
    }

    const existing = existingRows[0]
    const karyawanNip = payload.karyawan_nip ?? existing.karyawan_nip
    const tanggal = payload.tanggal ?? existing.tanggal
    const statusId = payload.status_id ?? existing.status_id

    const [karyawanRows]: any = await db.query(
      "SELECT nip FROM tb_karyawan WHERE nip = ? LIMIT 1",
      [karyawanNip]
    )
    if (!karyawanRows.length) {
      return { success: false, message: "Karyawan tidak ditemukan" }
    }

    const [statusRows]: any = await db.query(
      "SELECT id FROM tb_status_kehadiran WHERE id = ? LIMIT 1",
      [statusId]
    )
    if (!statusRows.length) {
      return { success: false, message: "Status kehadiran tidak ditemukan" }
    }

    const [duplicateRows]: any = await db.query(
      "SELECT id FROM tb_absensi_harian WHERE karyawan_nip = ? AND tanggal = ? AND id != ? LIMIT 1",
      [karyawanNip, tanggal, id]
    )
    if (duplicateRows.length > 0) {
      return {
        success: false,
        message: `Karyawan ini sudah memiliki data absensi lain pada tanggal ${tanggal}`
      }
    }

    const fields: string[] = []
    const values: any[] = []

    if (payload.karyawan_nip !== undefined) {
      fields.push("karyawan_nip = ?")
      values.push(payload.karyawan_nip)
    }
    if (payload.tanggal !== undefined) {
      fields.push("tanggal = ?")
      values.push(payload.tanggal)
    }
    if (payload.jam_masuk !== undefined) {
      fields.push("jam_masuk = ?")
      values.push(payload.jam_masuk || null)
    }
    if (payload.jam_keluar !== undefined) {
      fields.push("jam_keluar = ?")
      values.push(payload.jam_keluar || null)
    }
    if (payload.status_id !== undefined) {
      fields.push("status_id = ?")
      values.push(payload.status_id)
    }
    if (payload.keterangan !== undefined) {
      fields.push("keterangan = ?")
      values.push(payload.keterangan || null)
    }

    values.push(id)
    await db.query(
      `UPDATE tb_absensi_harian SET ${fields.join(", ")} WHERE id = ?`,
      values
    )

    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Data absensi harian berhasil diperbarui" }
  } catch (error: any) {
    console.error("Error updateAbsensiHarian:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return { success: false, message: "Data absensi untuk karyawan dan tanggal ini sudah ada" }
    }
    return { success: false, message: error.message || "Gagal memperbarui data absensi harian" }
  }
}

export async function deleteAbsensiHarian(id: number) {
  try {
    const [existingRows]: any = await db.query(
      "SELECT id FROM tb_absensi_harian WHERE id = ? LIMIT 1",
      [id]
    )
    if (!existingRows.length) {
      return { success: false, message: "Data absensi harian tidak ditemukan" }
    }

    await db.query("DELETE FROM tb_absensi_harian WHERE id = ?", [id])
    revalidatePath("/dashboard/hr/absensi")
    return { success: true, message: "Data absensi harian berhasil dihapus" }
  } catch (error: any) {
    console.error("Error deleteAbsensiHarian:", error)
    return { success: false, message: error.message || "Gagal menghapus data absensi harian" }
  }
}
