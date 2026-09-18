"use server"

import { db } from "@/lib/db"

export interface GajiItem {
  id: number
  nip: string
  namaKaryawan: string
  jabatan: string
  tanggalMulai: string
  tanggalSelesai: string
  gajiPokok: number
  tunjangan: number
  potongan: number
  jumlahPenerimaan: number
  jumlahPotongan: number
  jumlahDiterima: number
}

export async function getRiwayatGaji(
  nip: string
): Promise<GajiItem[]> {
  try {
    const [rows] = await db.execute(
      `
      SELECT
        pg.id,
        k.nip,
        k.nama_karyawan AS namaKaryawan,
        k.jabatan,

        pg.tanggal_mulai AS tanggalMulai,
        pg.tanggal_selesai AS tanggalSelesai,

        COALESCE(pgh.gaji_pokok, 0) AS gajiPokok,

        (
          COALESCE(pgh.tunjangan_jabatan, 0) +
          COALESCE(pgh.tunjangan_transport_tetap, 0) +
          COALESCE(pgh.tunjangan_pengabdian, 0) +
          COALESCE(pgh.tunjangan_transport_tidak_tetap, 0) +
          COALESCE(pgh.uang_saku, 0) +
          COALESCE(pgh.lembur_overtime, 0) +
          COALESCE(pgh.lain_lain, 0) +
          COALESCE(pgh.bpjs_tk_jht, 0)
        ) AS tunjangan,

        COALESCE(pgh.jumlah_penerimaan, 0) AS jumlahPenerimaan,

        COALESCE(pt.jumlah_potongan, 0) AS jumlahPotongan,

        (
          COALESCE(pgh.jumlah_penerimaan, 0) -
          COALESCE(pt.jumlah_potongan, 0)
        ) AS jumlahDiterima

      FROM tb_periode_gaji pg

      INNER JOIN tb_karyawan k
        ON k.nip = pg.nip

      LEFT JOIN tb_penghasilan pgh
        ON pgh.id_periode = pg.id

      LEFT JOIN tb_potongan pt
        ON pt.id_periode = pg.id

      WHERE pg.nip = ?

      ORDER BY pg.tanggal_mulai DESC
      `,
      [nip]
    )

    return rows as GajiItem[]
  } catch (error) {
    console.error("Gagal mengambil riwayat gaji:", error)

    throw new Error("Gagal mengambil data riwayat gaji")
  }
}