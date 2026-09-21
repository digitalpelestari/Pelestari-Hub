"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface RincianDireksiPayload {
    nomerRegister: string;
    tanggal: string;
    transferBank?: string;
    rekening?: string;
    user?: string;
    approval?: string;
    kelompokBiaya?: string;
    jenisBiaya?: string;
    keterangan?: string;
    penerima?: string;
    kredit?: number;
    total?: number;
}

export async function createRincianDireksi(
    payload: RincianDireksiPayload
) {
    try {
        const {
            nomerRegister,
            tanggal,
            transferBank,
            rekening,
            user,
            approval,
            kelompokBiaya,
            jenisBiaya,
            keterangan,
            penerima,
            kredit = 0,
            total = 0,
        } = payload;

        if (!nomerRegister || !tanggal) {
            return {
                success: false,
                message: "Nomor register dan tanggal wajib diisi.",
            };
        }

        await db.query(
            `
      INSERT INTO tb_rincian_direksi (
        nomer_register,
        tanggal,
        transfer_bank,
        rekening,
        user,
        approval,
        kelompok_biaya,
        jenis_biaya,
        keterangan,
        penerima,
        kredit,
        total
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
            [
                nomerRegister,
                tanggal,
                transferBank || null,
                rekening || null,
                user || null,
                approval || null,
                kelompokBiaya || null,
                jenisBiaya || null,
                keterangan || null,
                penerima || null,
                kredit,
                total,
            ]
        );

        revalidatePath("/dashboard/finance/riwayat/rincian-direksi");

        return {
            success: true,
            message: "Rincian direksi berhasil ditambahkan.",
        };
    } catch (error) {
        console.error("createRincianDireksi error:", error);

        return {
            success: false,
            message: "Gagal menambahkan rincian direksi.",
        };
    }
}

export async function getRincianDireksi() {
    try {
        const [rows] = await db.query(`
   SELECT
    id,
    nomer_register,
    DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal,
    transfer_bank,
    rekening,
    user,
    approval,
    kelompok_biaya,
    jenis_biaya,
    keterangan,
    penerima,
    kredit,
    total
FROM tb_rincian_direksi
ORDER BY tanggal DESC, id DESC
    `);

        return {
            success: true,
            data: rows,
        };
    } catch (error) {
        console.error("getRincianDireksi error:", error);

        return {
            success: false,
            data: [],
            message: "Gagal mengambil data rincian direksi.",
        };
    }
}

export async function getRincianDireksiById(id: number) {
    try {
        const [rows] = await db.query(
            `
     SELECT
    id,
    nomer_register,
    DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal,
    transfer_bank,
    rekening,
    user,
    approval,
    kelompok_biaya,
    jenis_biaya,
    keterangan,
    penerima,
    kredit,
    total
FROM tb_rincian_direksi
WHERE id = ?
      LIMIT 1
      `,
            [id]
        );

        const data = Array.isArray(rows) ? rows[0] : null;

        if (!data) {
            return {
                success: false,
                data: null,
                message: "Data rincian direksi tidak ditemukan.",
            };
        }

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error("getRincianDireksiById error:", error);

        return {
            success: false,
            data: null,
            message: "Gagal mengambil data rincian direksi.",
        };
    }
}

export async function updateRincianDireksi(
    id: number,
    payload: RincianDireksiPayload
) {
    try {
        const {
            nomerRegister,
            tanggal,
            transferBank,
            rekening,
            user,
            approval,
            kelompokBiaya,
            jenisBiaya,
            keterangan,
            penerima,
            kredit = 0,
            total = 0,
        } = payload;

        if (!id) {
            return {
                success: false,
                message: "ID data tidak valid.",
            };
        }

        if (!nomerRegister || !tanggal) {
            return {
                success: false,
                message: "Nomor register dan tanggal wajib diisi.",
            };
        }

        const [result] = await db.query(
            `
      UPDATE tb_rincian_direksi
      SET
        nomer_register = ?,
        tanggal = ?,
        transfer_bank = ?,
        rekening = ?,
        user = ?,
        approval = ?,
        kelompok_biaya = ?,
        jenis_biaya = ?,
        keterangan = ?,
        penerima = ?,
        kredit = ?,
        total = ?
      WHERE id = ?
      `,
            [
                nomerRegister,
                tanggal,
                transferBank || null,
                rekening || null,
                user || null,
                approval || null,
                kelompokBiaya || null,
                jenisBiaya || null,
                keterangan || null,
                penerima || null,
                kredit,
                total,
                id,
            ]
        );

        revalidatePath("/dashboard/finance/riwayat/rincian-direksi");

        return {
            success: true,
            message: "Rincian direksi berhasil diperbarui.",
        };
    } catch (error) {
        console.error("updateRincianDireksi error:", error);

        return {
            success: false,
            message: "Gagal memperbarui rincian direksi.",
        };
    }
}

export async function deleteRincianDireksi(id: number) {
    try {
        if (!id) {
            return {
                success: false,
                message: "ID data tidak valid.",
            };
        }

        await db.query(
            `
      DELETE FROM tb_rincian_direksi
      WHERE id = ?
      `,
            [id]
        );

        revalidatePath("/dashboard/finance/riwayat/rincian-direksi");

        return {
            success: true,
            message: "Rincian direksi berhasil dihapus.",
        };
    } catch (error) {
        console.error("deleteRincianDireksi error:", error);

        return {
            success: false,
            message: "Gagal menghapus rincian direksi.",
        };
    }
}