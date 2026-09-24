"use server"

import { db } from "@/lib/db"

export interface NeracaSaldoItem {
    no_akun: string
    nama_akun: string

    saldo_awal_debit: number
    saldo_awal_kredit: number

    pergerakan_debit: number
    pergerakan_kredit: number

    saldo_akhir_debit: number
    saldo_akhir_kredit: number
}

function getToday(): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })

    return formatter.format(new Date())
}

function getStartOfYear(): string {
    const today = getToday()
    const year = today.substring(0, 4)

    return `${year}-01-01`
}

export async function getNeracaSaldo(
    tanggalMulai?: string,
    tanggalSelesai?: string
): Promise<{
    success: boolean
    data: NeracaSaldoItem[]
    error?: string
}> {
    try {
        /*
        |--------------------------------------------------------------------------
        | Tentukan Periode
        |--------------------------------------------------------------------------
        |
        | Jika filter kosong:
        |   Saldo Awal = sebelum 1 Januari tahun berjalan
        |   Pergerakan = 1 Januari sampai hari ini
        |   Saldo Akhir = sampai hari ini
        |
        */

        const startDate = tanggalMulai || getStartOfYear()
        const endDate = tanggalSelesai || getToday()

        if (startDate > endDate) {
            return {
                success: false,
                data: [],
                error:
                    "Tanggal mulai tidak boleh lebih besar dari tanggal selesai.",
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Query
        |--------------------------------------------------------------------------
        |
        | opening:
        |   seluruh transaksi sebelum periode
        |
        | movement:
        |   seluruh transaksi dalam periode
        |
        */

        const [rows]: any = await db.query(
            `
            SELECT
                a.no_akun,
                a.nama_akun,

                COALESCE(
                    SUM(
                        CASE
                            WHEN j.tanggal < ?
                            THEN d.debit
                            ELSE 0
                        END
                    ),
                    0
                ) AS saldo_awal_debit_raw,

                COALESCE(
                    SUM(
                        CASE
                            WHEN j.tanggal < ?
                            THEN d.kredit
                            ELSE 0
                        END
                    ),
                    0
                ) AS saldo_awal_kredit_raw,

                COALESCE(
                    SUM(
                        CASE
                            WHEN j.tanggal >= ?
                            AND j.tanggal < DATE_ADD(?, INTERVAL 1 DAY)
                            THEN d.debit
                            ELSE 0
                        END
                    ),
                    0
                ) AS pergerakan_debit,

                COALESCE(
                    SUM(
                        CASE
                            WHEN j.tanggal >= ?
                            AND j.tanggal < DATE_ADD(?, INTERVAL 1 DAY)
                            THEN d.kredit
                            ELSE 0
                        END
                    ),
                    0
                ) AS pergerakan_kredit

            FROM tb_akun a

            LEFT JOIN tb_jurnal_item d
                ON d.no_akun = a.no_akun

            LEFT JOIN tb_jurnal j
                ON j.id = d.jurnal_id

            GROUP BY
                a.no_akun,
                a.nama_akun

            ORDER BY
                a.no_akun ASC
            `,
            [
                startDate,
                startDate,
                startDate,
                endDate,
                startDate,
                endDate,
            ]
        )

        const data: NeracaSaldoItem[] = rows
            .map((row: any) => {
                /*
                |--------------------------------------------------------------------------
                | Raw Saldo Awal
                |--------------------------------------------------------------------------
                */

                const saldoAwalDebitRaw = Number(
                    row.saldo_awal_debit_raw || 0
                )

                const saldoAwalKreditRaw = Number(
                    row.saldo_awal_kredit_raw || 0
                )

                /*
                |--------------------------------------------------------------------------
                | Pergerakan
                |--------------------------------------------------------------------------
                */

                const pergerakanDebit = Number(
                    row.pergerakan_debit || 0
                )

                const pergerakanKredit = Number(
                    row.pergerakan_kredit || 0
                )

                /*
                |--------------------------------------------------------------------------
                | Saldo Awal Bersih
                |--------------------------------------------------------------------------
                |
                | Debit - Kredit
                |
                */

                const saldoAwalNet =
                    saldoAwalDebitRaw -
                    saldoAwalKreditRaw

                let saldoAwalDebit = 0
                let saldoAwalKredit = 0

                if (saldoAwalNet > 0) {
                    saldoAwalDebit = saldoAwalNet
                } else if (saldoAwalNet < 0) {
                    saldoAwalKredit = Math.abs(saldoAwalNet)
                }

                /*
                |--------------------------------------------------------------------------
                | Saldo Akhir Bersih
                |--------------------------------------------------------------------------
                |
                | Saldo Awal
                | + Debit Pergerakan
                | - Kredit Pergerakan
                |
                */

                const saldoAkhirNet =
                    saldoAwalNet +
                    pergerakanDebit -
                    pergerakanKredit

                let saldoAkhirDebit = 0
                let saldoAkhirKredit = 0

                if (saldoAkhirNet > 0) {
                    saldoAkhirDebit = saldoAkhirNet
                } else if (saldoAkhirNet < 0) {
                    saldoAkhirKredit = Math.abs(
                        saldoAkhirNet
                    )
                }

                return {
                    no_akun: row.no_akun,
                    nama_akun: row.nama_akun,

                    saldo_awal_debit: saldoAwalDebit,
                    saldo_awal_kredit: saldoAwalKredit,

                    pergerakan_debit: pergerakanDebit,
                    pergerakan_kredit: pergerakanKredit,

                    saldo_akhir_debit: saldoAkhirDebit,
                    saldo_akhir_kredit: saldoAkhirKredit,
                }
            })
            .filter(
                (item: NeracaSaldoItem) =>
                    item.saldo_awal_debit !== 0 ||
                    item.saldo_awal_kredit !== 0 ||
                    item.pergerakan_debit !== 0 ||
                    item.pergerakan_kredit !== 0 ||
                    item.saldo_akhir_debit !== 0 ||
                    item.saldo_akhir_kredit !== 0
            )

        return {
            success: true,
            data,
        }
    } catch (error: any) {
        console.error(
            "GET_NERACA_SALDO_ERROR:",
            error
        )

        return {
            success: false,
            data: [],
            error:
                error?.message ||
                "Gagal mengambil data neraca saldo.",
        }
    }
}