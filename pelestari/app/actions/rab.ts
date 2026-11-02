"use server";

import { revalidatePath } from "next/cache";

import { deleteFileFromR2Action, uploadFileToR2Action } from "@/app/actions/upload-r2";
import { db } from "@/lib/db";

import type { ResultSetHeader, RowDataPacket } from "mysql2";

const STATUS = {
    DRAFT: "Draft",
    MENUNGGU_MANAGER: "Menunggu Persetujuan Manager",
    REVISI: "Revisi Oleh Manager",
    MENGIRIM_REVISI: "Mengirimkan Revisi",
    MENUNGGU_FINANCE: "Menunggu Verifikasi Finance",
    REVISI_FINANCE: "Revisi Oleh Finance",
    DISETUJUI: "Disetujui",
    DITOLAK: "Ditolak",
} as const;

// Bukti transfer diunggah ke Cloudflare R2 lewat uploadFileToR2Action,
// lalu URL publiknya disimpan di kolom bukti_transfer.
const BUKTI_MAKS_BYTE = 2 * 1024 * 1024; // 2 MB
const BUKTI_TIPE: Record<string, string> = {
    "application/pdf": ".pdf",
};

type RincianInput = {
    id_rab?: number;
    jenis_biaya: string;
    kelompok_biaya: string;
    satuan: string;
    harga: number;
    jumlah: number;
    durasi: number;
    keterangan?: string | null;
    penjelasan_keterangan?: string | null;
};

type PengajuanInput = {
    nomor_rab: string;
    nama_kegiatan: string;
    tanggal: string;
    lokasi: string;
    rincian: RincianInput[];
};

interface PengajuanRow extends RowDataPacket {
    id_pengajuan: number;
    nomor_rab: string;
    nama_kegiatan: string;
    tanggal: string;
    lokasi: string;
    status_persetujuan: string;
    catatan_revisi_manager: string | null;
    catatan_revisi_finance: string | null;
    catatan_penolakan_manager: string | null;
    catatan_penolakan_finance: string | null;
    bukti_transfer: string | null;
    created_at: Date;
    updated_at: Date;
}

interface RincianRow extends RowDataPacket {
    id_rab: number;
    id_pengajuan: number;
    jenis_biaya: string;
    kelompok_biaya: string;
    satuan: string;
    harga: number;
    jumlah: number;
    durasi: number;
    subtotal: number;
    total: number;
    keterangan: string | null;
    penjelasan_keterangan: string | null;
}

function validasiPengajuan(data: PengajuanInput) {
    if (
        !data.nomor_rab?.trim() ||
        !data.nama_kegiatan?.trim() ||
        !data.tanggal ||
        !data.lokasi?.trim()
    ) {
        throw new Error("Data pengajuan RAB wajib dilengkapi.");
    }

    if (!Array.isArray(data.rincian) || data.rincian.length === 0) {
        throw new Error("Minimal harus ada satu rincian biaya.");
    }

    for (const item of data.rincian) {
        if (
            !item.jenis_biaya?.trim() ||
            !item.kelompok_biaya?.trim() ||
            !item.satuan?.trim()
        ) {
            throw new Error("Jenis biaya, kelompok biaya, dan satuan wajib diisi.");
        }

        for (const [field, value] of Object.entries({
            harga: item.harga,
            jumlah: item.jumlah,
            durasi: item.durasi,
        })) {
            if (
                !Number.isSafeInteger(value) ||
                value < 0 ||
                (field !== "harga" && value < 1)
            ) {
                throw new Error(`Nilai ${field} tidak valid.`);
            }
        }

        const subtotal = item.harga * item.jumlah * item.durasi;

        if (!Number.isSafeInteger(subtotal)) {
            throw new Error("Subtotal biaya terlalu besar.");
        }
    }

    const total = data.rincian.reduce(
        (sum, item) => sum + item.harga * item.jumlah * item.durasi,
        0
    );

    if (!Number.isSafeInteger(total)) {
        throw new Error("Total RAB terlalu besar.");
    }
}

async function simpanRincian(
    connection: Awaited<ReturnType<typeof db.getConnection>>,
    idPengajuan: number,
    rincian: RincianInput[]
) {
    const total = rincian.reduce(
        (sum, item) => sum + item.harga * item.jumlah * item.durasi,
        0
    );

    for (const item of rincian) {
        const subtotal = item.harga * item.jumlah * item.durasi;

        await connection.execute(
            `INSERT INTO tb_rab (
                id_pengajuan,
                jenis_biaya,
                kelompok_biaya,
                satuan,
                harga,
                jumlah,
                durasi,
                subtotal,
                total,
                keterangan,
                penjelasan_keterangan
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idPengajuan,
                item.jenis_biaya.trim(),
                item.kelompok_biaya.trim(),
                item.satuan.trim(),
                item.harga,
                item.jumlah,
                item.durasi,
                subtotal,
                total,
                item.keterangan?.trim() || null,
                item.penjelasan_keterangan?.trim() || null,
            ]
        );
    }
}

export async function getRAB() {
    const [pengajuan] = await db.execute<PengajuanRow[]>(
        `SELECT
            id_pengajuan,
            nomor_rab,
            nama_kegiatan,
            tanggal,
            lokasi,
            status_persetujuan,
            catatan_revisi_manager,
            catatan_revisi_finance,
            catatan_penolakan_manager,
            catatan_penolakan_finance,
            bukti_transfer,
            created_at,
            updated_at
        FROM tb_pengajuan_rab
        ORDER BY created_at DESC`
    );

    const [rincian] = await db.execute<RincianRow[]>(
        `SELECT
            id_rab,
            id_pengajuan,
            jenis_biaya,
            kelompok_biaya,
            satuan,
            harga,
            jumlah,
            durasi,
            subtotal,
            total,
            keterangan,
            penjelasan_keterangan
        FROM tb_rab
        WHERE id_pengajuan IS NOT NULL
        ORDER BY id_rab ASC`
    );

    return pengajuan.map((item) => {
        const items = rincian.filter(
            (detail) => detail.id_pengajuan === item.id_pengajuan
        );

        return {
            ...item,
            tanggal: String(item.tanggal).slice(0, 10),
            rincian: items,
            total: items.reduce((sum, detail) => sum + detail.subtotal, 0),
        };
    });
}

export async function createRAB(data: PengajuanInput) {
    validasiPengajuan(data);

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO tb_pengajuan_rab (
                nomor_rab,
                nama_kegiatan,
                tanggal,
                lokasi,
                status_persetujuan) VALUES (?, ?, ?, ?, ?)`,
            [
                data.nomor_rab.trim(),
                data.nama_kegiatan.trim(),
                data.tanggal,
                data.lokasi.trim(),
                STATUS.DRAFT,
            ]
        );

        await simpanRincian(connection, result.insertId, data.rincian);

        await connection.commit();

        revalidatePath("/rab");

        return {
            success: true,
            message: "Pengajuan RAB berhasil dibuat.",
            id_pengajuan: result.insertId,
        };
    } catch (error) {
        await connection.rollback();

        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ER_DUP_ENTRY"
        ) {
            throw new Error("Nomor RAB sudah digunakan.");
        }

        throw error;
    } finally {
        connection.release();
    }
}

export async function updateRAB(idPengajuan: number, data: PengajuanInput) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    validasiPengajuan(data);

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<PengajuanRow[]>(
            `SELECT id_pengajuan, status_persetujuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
             FOR UPDATE`,
            [idPengajuan]
        );

        if (rows.length === 0) {
            throw new Error("Pengajuan RAB tidak ditemukan.");
        }

        if (
            rows[0].status_persetujuan !== STATUS.DRAFT &&
            rows[0].status_persetujuan !== STATUS.REVISI &&
            rows[0].status_persetujuan !== STATUS.REVISI_FINANCE
        ) {
            throw new Error(
                "RAB hanya dapat diubah jika berstatus Draft atau sedang dalam revisi."
            );
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET nomor_rab = ?,
                 nama_kegiatan = ?,
                 tanggal = ?,
                 lokasi = ? WHERE id_pengajuan = ?`,
            [
                data.nomor_rab.trim(),
                data.nama_kegiatan.trim(),
                data.tanggal,
                data.lokasi.trim(),
                idPengajuan,
            ]
        );

        await connection.execute(`DELETE FROM tb_rab WHERE id_pengajuan = ?`, [
            idPengajuan,
        ]);

        await simpanRincian(connection, idPengajuan, data.rincian);

        await connection.commit();

        revalidatePath("/rab");

        return {
            success: true,
            message: "Pengajuan RAB berhasil diperbarui.",
        };
    } catch (error) {
        await connection.rollback();

        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ER_DUP_ENTRY"
        ) {
            throw new Error("Nomor RAB sudah digunakan.");
        }

        throw error;
    } finally {
        connection.release();
    }
}

export async function deleteRAB(idPengajuan: number) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<PengajuanRow[]>(
            `SELECT id_pengajuan, status_persetujuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
             FOR UPDATE`,
            [idPengajuan]
        );

        if (rows.length === 0) {
            throw new Error("Pengajuan RAB tidak ditemukan.");
        }

        if (rows[0].status_persetujuan !== STATUS.DRAFT) {
            throw new Error("Hanya RAB berstatus Draft yang dapat dihapus.");
        }

        await connection.execute(`DELETE FROM tb_rab WHERE id_pengajuan = ?`, [
            idPengajuan,
        ]);

        await connection.execute(
            `DELETE FROM tb_pengajuan_rab WHERE id_pengajuan = ?`,
            [idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");

        return {
            success: true,
            message: "Pengajuan RAB berhasil dihapus.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Dari Draft -> "Menunggu Persetujuan Manager".
// Dari status revisi (Manager/Finance) -> "Mengirimkan Revisi".
export async function submitRAB(idPengajuan: number) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE tb_pengajuan_rab
         SET status_persetujuan = CASE
                 WHEN status_persetujuan = ? THEN ?
                 ELSE ?
             END
         WHERE id_pengajuan = ?
           AND status_persetujuan IN (?, ?, ?)
           AND EXISTS (
               SELECT 1
               FROM tb_rab
               WHERE tb_rab.id_pengajuan = tb_pengajuan_rab.id_pengajuan
           )`,
        [
            STATUS.DRAFT,
            STATUS.MENUNGGU_MANAGER,
            STATUS.MENGIRIM_REVISI,
            idPengajuan,
            STATUS.DRAFT,
            STATUS.REVISI,
            STATUS.REVISI_FINANCE,
        ]
    );

    if (result.affectedRows === 0) {
        throw new Error(
            "Pengajuan tidak ditemukan, tidak memiliki rincian biaya, atau statusnya tidak dapat diajukan."
        );
    }

    revalidatePath("/rab");
    revalidatePath("/manager/rab");

    return {
        success: true,
        message: "RAB berhasil diajukan kepada Manager.",
    };
}

export async function approveRAB(idPengajuan: number) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan IN (?, ?)
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_MANAGER, STATUS.MENGIRIM_REVISI]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?
             WHERE id_pengajuan = ?`,
            [STATUS.MENUNGGU_FINANCE, idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");

        return {
            success: true,
            message: "RAB disetujui dan diteruskan ke Finance.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function reviseRAB(idPengajuan: number, catatan: string) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    if (!catatan?.trim()) {
        throw new Error("Catatan revisi wajib diisi.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan IN (?, ?)
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_MANAGER, STATUS.MENGIRIM_REVISI]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?,
                 catatan_revisi_manager = ?
             WHERE id_pengajuan = ?`,
            [STATUS.REVISI, catatan.trim(), idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");

        return {
            success: true,
            message: "RAB dikembalikan untuk revisi.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function rejectRAB(idPengajuan: number, catatan: string) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    if (!catatan?.trim()) {
        throw new Error("Alasan penolakan wajib diisi.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan IN (?, ?)
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_MANAGER, STATUS.MENGIRIM_REVISI]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?,
                 catatan_penolakan_manager = ?
             WHERE id_pengajuan = ?`,
            [STATUS.DITOLAK, catatan.trim(), idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");

        return {
            success: true,
            message: "Pengajuan RAB berhasil ditolak.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Finance memverifikasi RAB dengan mengunggah bukti transfer.
// Status baru berubah menjadi "Disetujui" setelah file tersimpan.
export async function verifyRAB(idPengajuan: number, formData: FormData) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    const bukti = formData.get("bukti_transfer");

    if (!(bukti instanceof File) || bukti.size === 0) {
        throw new Error("Bukti transfer wajib diunggah.");
    }

    const ekstensi = BUKTI_TIPE[bukti.type];

    if (!ekstensi) {
        throw new Error("Format bukti transfer harus JPG, PNG, WEBP, atau PDF.");
    }

    if (bukti.size > BUKTI_MAKS_BYTE) {
        throw new Error("Ukuran bukti transfer maksimal 2 MB.");
    }

    const connection = await db.getConnection();
    let urlBukti: string | null = null;

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan = ?
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_FINANCE]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        const dataUnggah = new FormData();
        dataUnggah.append("file", bukti);
        dataUnggah.append("prefix", "bukti-transfer");

        const hasilUnggah = await uploadFileToR2Action(dataUnggah);

        if (!hasilUnggah.success || !hasilUnggah.url) {
            throw new Error(
                hasilUnggah.message || "Gagal mengunggah bukti transfer."
            );
        }

        urlBukti = hasilUnggah.url;

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?,
                 bukti_transfer = ?
             WHERE id_pengajuan = ?`,
            [STATUS.DISETUJUI, urlBukti, idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");
        revalidatePath("/finance/rab");

        return {
            success: true,
            message: "Bukti transfer tersimpan. RAB disetujui oleh Finance.",
        };
    } catch (error) {
        await connection.rollback();

        // Hapus objek di R2 yang sudah terlanjur terunggah bila proses gagal.
        if (urlBukti) {
            await deleteFileFromR2Action(urlBukti);
        }

        throw error;
    } finally {
        connection.release();
    }
}

export async function reviseRABFinance(idPengajuan: number, catatan: string) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    if (!catatan?.trim()) {
        throw new Error("Catatan revisi Finance wajib diisi.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan = ?
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_FINANCE]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?,
                 catatan_revisi_finance = ?
             WHERE id_pengajuan = ?`,
            [STATUS.REVISI_FINANCE, catatan.trim(), idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");
        revalidatePath("/finance/rab");

        return {
            success: true,
            message:
                "RAB dikembalikan ke Pelatihan untuk diperbaiki. Setelah diajukan ulang, RAB harus melalui persetujuan Manager kembali.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function rejectRABFinance(idPengajuan: number, catatan: string) {
    if (!Number.isSafeInteger(idPengajuan) || idPengajuan < 1) {
        throw new Error("ID pengajuan tidak valid.");
    }

    if (!catatan?.trim()) {
        throw new Error("Alasan penolakan Finance wajib diisi.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT id_pengajuan
             FROM tb_pengajuan_rab
             WHERE id_pengajuan = ?
               AND status_persetujuan = ?
             FOR UPDATE`,
            [idPengajuan, STATUS.MENUNGGU_FINANCE]
        );

        if (rows.length === 0) {
            throw new Error("RAB tidak ditemukan atau sudah diproses.");
        }

        await connection.execute(
            `UPDATE tb_pengajuan_rab
             SET status_persetujuan = ?,
                 catatan_penolakan_finance = ?
             WHERE id_pengajuan = ?`,
            [STATUS.DITOLAK, catatan.trim(), idPengajuan]
        );

        await connection.commit();

        revalidatePath("/rab");
        revalidatePath("/manager/rab");
        revalidatePath("/finance/rab");

        return {
            success: true,
            message: "Pengajuan RAB berhasil ditolak oleh Finance.",
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}