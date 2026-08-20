"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

// =========================================================================
// 1. ACTION: AMBIL SEMUA DATA KARYAWAN
// =========================================================================
export async function getKaryawanAction() {
  try {
    const [rows]: any = await db.execute(
      "SELECT nip, nama, divisi, jabatan FROM tb_karyawan ORDER BY nama ASC"
    )
    return { success: true, data: rows }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// =========================================================================
// 2. ACTION: AMBIL SEMUA PERJALANAN DINAS
// =========================================================================
export async function getPerjalananListAction() {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, message: "Unauthorized", data: [] }
    }
    const id_user = session.user.id
    const role = String(session.user.role || "").toLowerCase()

    let query = `
      SELECT s.nomor, s.id_user, s.manager_nip,
             s.keperluan, s.tujuan, s.tempat,
             s.start_date, s.end_date,
             s.created_at, s.updated_at,
              k.nama AS manager_nama,
              k.divisi AS manager_divisi,
              k.jabatan AS manager_jabatan,
              u.nama AS user_nama
       FROM tb_sppd s
       LEFT JOIN tb_karyawan k ON s.manager_nip = k.nip
       LEFT JOIN tb_login u ON s.id_user = u.id_user
    `
    const params: any[] = []

    if (role !== "admin") {
      query += " WHERE s.id_user = ?"
      params.push(id_user)
    }

    query += "\nORDER BY s.created_at DESC"

    const [sppdRows]: any = await db.execute(query, params)

    const result = await Promise.all(
      sppdRows.map(async (sppd: any) => {
        // DIUBAH: Menambahkan k.jabatan agar terbaca di tabel & cetak SPPD
        const [anggotaRows]: any = await db.execute(
          `
          SELECT sk.nip, k.nama, k.divisi, k.jabatan
          FROM tb_sppd_karyawan sk
          JOIN tb_karyawan k ON sk.nip = k.nip
          WHERE sk.nomor_sppd = ?
          ORDER BY k.nama ASC
          `,
          [sppd.nomor]
        )

        return {
          ...sppd,
          anggota: anggotaRows,
        }
      })
    )

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// =========================================================================
// 3. ACTION: AMBIL DETAIL PERJALANAN DINAS BY NOMOR
// =========================================================================
export async function getPerjalananDetailAction(nomor: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, message: "Unauthorized" }
    }
    const id_user = session.user.id
    const role = String(session.user.role || "").toLowerCase()

    let query = `
      SELECT s.nomor, s.id_user, s.manager_nip,
             s.keperluan, s.tujuan, s.tempat,
             s.start_date, s.end_date,
             s.created_at, s.updated_at,
              k.nama AS manager_nama,
              k.divisi AS manager_divisi,
              k.jabatan AS manager_jabatan,
              u.nama AS user_nama
       FROM tb_sppd s
       LEFT JOIN tb_karyawan k ON s.manager_nip = k.nip
       LEFT JOIN tb_login u ON s.id_user = u.id_user
       WHERE s.nomor = ?
    `
    const params: any[] = [nomor]

    if (role !== "admin") {
      query += " AND s.id_user = ?"
      params.push(id_user)
    }

    query += "\nLIMIT 1"

    const [sppdRows]: any = await db.execute(query, params)

    if (sppdRows.length === 0) {
      return { success: false, message: "SPPD tidak ditemukan" }
    }

    const sppd = sppdRows[0]

    // DIUBAH: Menambahkan k.jabatan untuk format print SPPD
    const [anggotaRows]: any = await db.execute(
      `
      SELECT sk.nip, k.nama, k.divisi, k.jabatan
      FROM tb_sppd_karyawan sk
      JOIN tb_karyawan k ON sk.nip = k.nip
      WHERE sk.nomor_sppd = ?
      ORDER BY k.nama ASC
      `,
      [nomor]
    )

    return { success: true, data: { ...sppd, anggota: anggotaRows } }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// =========================================================================
// 4. ACTION: BUAT PERJALANAN DINAS BARU
// =========================================================================
export async function createPerjalananAction(payload: {
  nomor: string
  manager_nip: string
  keperluan: string
  tujuan: string
  tempat: string
  start_date: string
  end_date: string
  karyawan: string[]
}) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, message: "Unauthorized" }
  }

  const id_user = session.user.id

  const { nomor, manager_nip, keperluan, tujuan, tempat, start_date, end_date, karyawan } = payload

  if (!nomor || !manager_nip || !keperluan || !tujuan || !tempat || !start_date || !end_date) {
    return { success: false, message: "Semua field utama wajib diisi" }
  }

  if (!Array.isArray(karyawan) || karyawan.length === 0) {
    return { success: false, message: "Pilih minimal satu karyawan" }
  }

  if (end_date < start_date) {
    return { success: false, message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" }
  }

  try {
    const [existing]: any = await db.execute(
      "SELECT nomor FROM tb_sppd WHERE nomor = ?",
      [nomor]
    )

    if (existing.length > 0) {
      return { success: false, message: "Nomor SPPD sudah ada" }
    }

    await db.execute(
      "INSERT INTO tb_sppd (nomor, id_user, manager_nip, keperluan, tujuan, tempat, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [nomor, id_user, manager_nip, keperluan, tujuan, tempat, start_date, end_date]
    )

    const insertPivotPromises = karyawan.map((nip: string) =>
      db.execute(
        "INSERT IGNORE INTO tb_sppd_karyawan (nomor_sppd, nip) VALUES (?, ?)",
        [nomor, nip]
      )
    )

    await Promise.all(insertPivotPromises)

    revalidatePath("/dashboard/karyawan/perjalanan-dinas")
    return { success: true, message: "SPPD berhasil dibuat", nomor }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// =========================================================================
// 5. ACTION: UPDATE PERJALANAN DINAS
// =========================================================================
export async function updatePerjalananAction(
  nomor: string,
  payload: {
    manager_nip: string
    keperluan: string
    tujuan: string
    tempat: string
    start_date: string
    end_date: string
    karyawan: string[]
  }
) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, message: "Unauthorized" }
  }
  const role = String(session.user.role || "").toLowerCase()
  const id_user = session.user.id

  const { manager_nip, keperluan, tujuan, tempat, start_date, end_date, karyawan } = payload

  if (!manager_nip || !keperluan || !tujuan || !tempat || !start_date || !end_date) {
    return { success: false, message: "Semua field utama wajib diisi" }
  }

  if (!Array.isArray(karyawan) || karyawan.length === 0) {
    return { success: false, message: "Pilih minimal satu karyawan" }
  }

  if (end_date < start_date) {
    return { success: false, message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" }
  }

  try {
    let updateQuery =
      "UPDATE tb_sppd SET manager_nip = ?, keperluan = ?, tujuan = ?, tempat = ?, start_date = ?, end_date = ?, updated_at = NOW() WHERE nomor = ?"
    const updateParams: any[] = [manager_nip, keperluan, tujuan, tempat, start_date, end_date, nomor]

    if (role !== "admin") {
      updateQuery += " AND id_user = ?"
      updateParams.push(id_user)
    }

    await db.execute(updateQuery, updateParams)

    await db.execute(
      "DELETE FROM tb_sppd_karyawan WHERE nomor_sppd = ?",
      [nomor]
    )

    const insertPivotPromises = karyawan.map((nip: string) =>
      db.execute(
        "INSERT IGNORE INTO tb_sppd_karyawan (nomor_sppd, nip) VALUES (?, ?)",
        [nomor, nip]
      )
    )

    await Promise.all(insertPivotPromises)

    revalidatePath("/dashboard/karyawan/perjalanan-dinas")
    return { success: true, message: "SPPD berhasil diperbarui", nomor }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// =========================================================================
// 6. ACTION: HAPUS PERJALANAN DINAS
// =========================================================================
export async function deletePerjalananAction(nomor: string) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, message: "Unauthorized" }
  }
  const role = String(session.user.role || "").toLowerCase()
  const id_user = session.user.id

  try {
    await db.execute(
      "DELETE FROM tb_sppd_karyawan WHERE nomor_sppd = ?",
      [nomor]
    )

    let deleteQuery = "DELETE FROM tb_sppd WHERE nomor = ?"
    const deleteParams: any[] = [nomor]

    if (role !== "admin") {
      deleteQuery += " AND id_user = ?"
      deleteParams.push(id_user)
    }

    await db.execute(deleteQuery, deleteParams)

    revalidatePath("/dashboard/karyawan/perjalanan-dinas")
    return { success: true, message: "SPPD berhasil dihapus" }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}