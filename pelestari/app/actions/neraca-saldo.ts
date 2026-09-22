"use server";

import { db } from "@/lib/db";

export interface NeracaSaldoItem {
    no_akun: string;
    nama_akun: string;
    debit: number;
    kredit: number;
    saldo: number;
}

export async function getNeracaSaldo(
    tanggalMulai?: string,
    tanggalSelesai?: string
): Promise<{
    success: boolean;
    data: NeracaSaldoItem[];
    error?: string;
}> {
    try {
        let whereClause = "";
        const params: string[] = [];

        if (tanggalMulai && tanggalSelesai) {
            whereClause = `
                WHERE j.tanggal BETWEEN ? AND ?
            `;

            params.push(tanggalMulai, tanggalSelesai);
        }

        const [rows]: any = await db.query(
            `
            SELECT
                a.no_akun,
                a.nama_akun,
                COALESCE(SUM(d.debit), 0) AS debit,
                COALESCE(SUM(d.kredit), 0) AS kredit

            FROM tb_akun a

            LEFT JOIN tb_jurnal_item d
                ON d.no_akun = a.no_akun

            LEFT JOIN tb_jurnal j
                ON j.id = d.jurnal_id

            ${whereClause}

            GROUP BY
                a.no_akun,
                a.nama_akun

            ORDER BY a.no_akun ASC
            `,
            params
        );

        const data: NeracaSaldoItem[] = rows.map((row: any) => {
            const debit = Number(row.debit || 0);
            const kredit = Number(row.kredit || 0);

            return {
                no_akun: row.no_akun,
                nama_akun: row.nama_akun,
                debit,
                kredit,
                saldo: debit - kredit,
            };
        });

        return {
            success: true,
            data,
        };
    } catch (error: any) {
        console.error("GET_NERACA_SALDO_ERROR:", error);

        return {
            success: false,
            data: [],
            error: error.message || "Gagal mengambil neraca saldo",
        };
    }
}