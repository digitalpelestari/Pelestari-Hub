"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getLabaRugiData } from "@/app/actions/labarugi"

const BULAN_NAMES: Record<string, string> = {
    "1": "Januari",
    "2": "Februari",
    "3": "Maret",
    "4": "April",
    "5": "Mei",
    "6": "Juni",
    "7": "Juli",
    "8": "Agustus",
    "9": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Desember",
}

/**
 * ============================================================
 * NORMAL BALANCE
 * ============================================================
 */
function isNormalDebit(noAkun: string): boolean {
    const akun = String(noAkun).trim()

    /**
     * Debit-normal:
     * - 12100 Piutang
     * - 14001 PPh23
     * - 5xxx Beban
     * - 6xxx Beban
     * - 31101 Dividen
     */
    if (
        akun === "12100" ||
        akun === "14001"
    ) {
        return true
    }

    /**
     * Kredit-normal:
     * - seluruh 4xxx Pendapatan
     * - 71106 PPN
     * - 81100 PNBP
     * - 13002 Laba Ditahan
     * - 13003 Laba Tahun Berjalan
     * - 13004 Ikhtisar Laba/Rugi
     */
    if (
        akun.startsWith("4") ||
        akun === "71106" ||
        akun === "81100" ||
        akun === "13002" ||
        akun === "13003" ||
        akun === "13004"
    ) {
        return false
    }

    /**
     * Default:
     * akun normal debit.
     */
    return true
}

/**
 * ============================================================
 * CALCULATE SALDO DELTA
 * ============================================================
 */
function calculateSaldoDelta(
    noAkun: string,
    debit: number,
    kredit: number
): number {

    if (
        isNormalDebit(noAkun)
    ) {
        return debit - kredit
    }

    return kredit - debit
}

/**
 * ============================================================
 * FORMAT RUPIAH
 * ============================================================
 */
function formatRupiah(
    value: number
): string {

    const amount =
        Math.abs(
            Number(value || 0)
        )

    return `Rp ${amount.toLocaleString("id-ID")}`
}

/**
 * ============================================================
 * GET CLOSING DATE
 * ============================================================
 */
function getClosingDate(
    year: string,
    month: string
): string {

    const date =
        new Date(
            Number(year),
            Number(month),
            0
        )

    return (
        `${date.getFullYear()}-` +
        `${String(
            date.getMonth() + 1
        ).padStart(2, "0")}-` +
        `${String(
            date.getDate()
        ).padStart(2, "0")}`
    )
}

/**
 * ============================================================
 * PREVIEW IKHTISAR
 * ============================================================
 */
export async function getPreviewIkhtisar(
    year: string,
    month: string
) {

    try {

        const reportData =
            await getLabaRugiData(
                year,
                month
            )

        const labaBersih =
            Number(
                reportData?.labaBersih || 0
            )

        const totalPendapatan =
            Number(
                reportData?.totalPendapatan || 0
            )

        const totalBebanUsaha =
            Number(
                reportData?.totalBebanUsaha || 0
            )

        const totalPnbpDanPajak =
            Number(
                reportData?.totalPnbpDanPajak || 0
            )

        const totalBeban =
            totalBebanUsaha +
            totalPnbpDanPajak

        const [rows]: any =
            await db.query(
                `
                SELECT
                    no_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13003',
                    '13004'
                )
                `
            )

        let saldo13003 = 0
        let saldo13004 = 0

        if (
            Array.isArray(rows)
        ) {

            for (
                const row of rows
            ) {

                if (
                    String(row.no_akun) ===
                    "13003"
                ) {

                    saldo13003 =
                        Number(
                            row.saldo || 0
                        )
                }

                if (
                    String(row.no_akun) ===
                    "13004"
                ) {

                    saldo13004 =
                        Number(
                            row.saldo || 0
                        )
                }
            }
        }

        return {
            success: true,

            data: {
                totalPendapatan,
                totalBeban,
                labaBersih,
                saldo13003,
                saldo13004,
            },
        }

    } catch (error: any) {

        console.error(
            "Gagal membaca preview laba rugi:",
            error
        )

        return {
            success: false,
            message:
                error?.message ||
                "Gagal memuat data.",
        }
    }
}

/**
 * ============================================================
 * GET CLOSING ACCOUNTS
 * ============================================================
 *
 * Pendapatan:
 * - 4xxx
 *
 * Beban:
 * - 5xxx
 * - 6xxx
 * - 71102 Pajak
 *
 * Tidak termasuk:
 * - 71106 PPN
 * - 81100 PNBP
 */
async function getClosingAccounts(
    year: string,
    month: string
) {

    const startDate =
        new Date(
            Number(year),
            Number(month) - 1,
            1
        )

    const endDate =
        new Date(
            Number(year),
            Number(month),
            1
        )

    const [rows]: any =
        await db.query(
            `
            SELECT
                ji.no_akun,
                a.nama_akun,
                SUM(ji.debit) AS total_debit,
                SUM(ji.kredit) AS total_kredit
            FROM tb_jurnal_item ji
            INNER JOIN tb_jurnal j
                ON j.id = ji.jurnal_id
            INNER JOIN tb_akun a
                ON a.no_akun = ji.no_akun
            WHERE j.tanggal >= ?
              AND j.tanggal < ?

              AND (
                    j.no_registrasi IS NULL
                    OR j.no_registrasi NOT LIKE 'CL\\_%'
              )

              AND (
                    ji.no_akun LIKE '4%'
                    OR ji.no_akun LIKE '5%'
                    OR ji.no_akun LIKE '6%'
                    OR ji.no_akun = '71102'
              )

            GROUP BY
                ji.no_akun,
                a.nama_akun

            ORDER BY
                ji.no_akun
            `,
            [
                startDate,
                endDate,
            ]
        )

    const accounts: {
        noAkun: string
        namaAkun: string
        tipe: "pendapatan" | "beban"
        nilai: number
    }[] = []

    for (
        const row of rows
    ) {

        const noAkun =
            String(
                row.no_akun
            )

        const namaAkun =
            String(
                row.nama_akun ?? ""
            ).trim()

        const debit =
            Number(
                row.total_debit ?? 0
            )

        const kredit =
            Number(
                row.total_kredit ?? 0
            )

        /**
         * ========================================================
         * PENDAPATAN
         * ========================================================
         *
         * Semua akun 4xxx adalah pendapatan.
         */
        if (
            noAkun.startsWith("4")
        ) {

            const nilai =
                kredit - debit

            if (
                nilai > 0
            ) {

                accounts.push({
                    noAkun,
                    namaAkun,
                    tipe: "pendapatan",
                    nilai,
                })
            }

            continue
        }

        /**
         * ========================================================
         * BEBAN
         * ========================================================
         *
         * Debit - Kredit.
         *
         * Termasuk:
         * - 5xxx
         * - 6xxx
         * - 71102
         */
        const nilai =
            debit - kredit

        if (
            nilai > 0
        ) {

            accounts.push({
                noAkun,
                namaAkun,
                tipe: "beban",
                nilai,
            })
        }
    }

    return accounts
}

/**
 * ============================================================
 * INSERT JURNAL
 * ============================================================
 */
async function insertJurnal(
    connection: any,
    tanggal: string,
    noRegistrasi: string,
    noReferensi: string,
    keterangan: string
): Promise<number> {

    const [result]: any =
        await connection.query(
            `
            INSERT INTO tb_jurnal (
                tanggal,
                no_registrasi,
                no_referensi,
                keterangan
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                tanggal,
                noRegistrasi,
                noReferensi,
                keterangan,
            ]
        )

    return Number(
        result.insertId
    )
}

/**
 * ============================================================
 * INSERT JURNAL ITEMS
 * ============================================================
 */
async function insertJurnalItems(
    connection: any,
    jurnalId: number,
    items: {
        noAkun: string
        debit: number
        kredit: number
        keterangan: string
    }[]
) {

    for (
        const item of items
    ) {

        await connection.query(
            `
            INSERT INTO tb_jurnal_item (
                jurnal_id,
                no_akun,
                debit,
                kredit,
                keterangan
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                jurnalId,
                item.noAkun,
                item.debit,
                item.kredit,
                item.keterangan,
            ]
        )
    }
}

/**
 * ============================================================
 * UPDATE SALDO AKUN
 * ============================================================
 */
async function updateAccountSaldo(
    connection: any,
    noAkun: string,
    debit: number,
    kredit: number
) {

    const delta =
        calculateSaldoDelta(
            noAkun,
            debit,
            kredit
        )

    if (
        delta === 0
    ) {
        return
    }

    await connection.query(
        `
        UPDATE tb_akun
        SET saldo =
            COALESCE(saldo, 0) + ?
        WHERE no_akun = ?
        `,
        [
            delta,
            noAkun,
        ]
    )
}

/**
 * ============================================================
 * CLOSING BULANAN
 * ============================================================
 */
export async function executeTwoStepClosing(
    year: string,
    month: string
) {

    const connection =
        await db.getConnection()

    let transactionStarted =
        false

    try {

        const monthLabel =
            BULAN_NAMES[month] ||
            `Bulan ${month}`

        const reportData =
            await getLabaRugiData(
                year,
                month
            )

        const labaBersih =
            Number(
                reportData?.labaBersih || 0
            )

        const totalPendapatanReport =
            Number(
                reportData?.totalPendapatan || 0
            )

        const totalBebanUsahaReport =
            Number(
                reportData?.totalBebanUsaha || 0
            )

        const totalPnbpDanPajakReport =
            Number(
                reportData?.totalPnbpDanPajak || 0
            )

        const totalBebanReport =
            totalBebanUsahaReport +
            totalPnbpDanPajakReport

        if (
            labaBersih === 0
        ) {

            return {
                success: false,
                message:
                    `Laba/Rugi ${monthLabel} ${year} ` +
                    `adalah Rp 0. Tidak ada closing yang perlu diproses.`,
            }
        }

        const closingAccounts =
            await getClosingAccounts(
                year,
                month
            )

        if (
            closingAccounts.length === 0
        ) {

            return {
                success: false,
                message:
                    `Tidak ditemukan detail pendapatan atau beban ` +
                    `untuk ${monthLabel} ${year}.`,
            }
        }

        const totalPendapatanDetail =
            closingAccounts
                .filter(
                    (account) =>
                        account.tipe ===
                        "pendapatan"
                )
                .reduce(
                    (sum, account) =>
                        sum + account.nilai,
                    0
                )

        const totalBebanDetail =
            closingAccounts
                .filter(
                    (account) =>
                        account.tipe ===
                        "beban"
                )
                .reduce(
                    (sum, account) =>
                        sum + account.nilai,
                    0
                )

        const labaBersihDetail =
            totalPendapatanDetail -
            totalBebanDetail

        if (
            Math.abs(
                totalPendapatanDetail -
                totalPendapatanReport
            ) > 1
        ) {

            throw new Error(
                `Total pendapatan detail tidak sama dengan ` +
                `Laporan Laba Rugi. ` +
                `Laporan: ${formatRupiah(
                    totalPendapatanReport
                )}, ` +
                `Detail: ${formatRupiah(
                    totalPendapatanDetail
                )}.`
            )
        }

        if (
            Math.abs(
                totalBebanDetail -
                totalBebanReport
            ) > 1
        ) {

            throw new Error(
                `Total beban detail tidak sama dengan ` +
                `Laporan Laba Rugi. ` +
                `Laporan: ${formatRupiah(
                    totalBebanReport
                )}, ` +
                `Detail: ${formatRupiah(
                    totalBebanDetail
                )}.`
            )
        }

        if (
            Math.abs(
                labaBersihDetail -
                labaBersih
            ) > 1
        ) {

            throw new Error(
                `Laba Bersih detail tidak sama dengan ` +
                `Laporan Laba Rugi. ` +
                `Laporan: ${formatRupiah(
                    labaBersih
                )}, ` +
                `Detail: ${formatRupiah(
                    labaBersihDetail
                )}.`
            )
        }

        const periode =
            `${year}-${String(
                month
            ).padStart(2, "0")}`

        const noRegistrasi =
            `CL_${String(
                month
            ).padStart(
                2,
                "0"
            )}/${String(
                year
            ).slice(-2)}`

        const tanggalClosing =
            getClosingDate(
                year,
                month
            )

        const keterangan =
            `Closing Laba Rugi ${monthLabel} ${year}`

        const [
            existingClosing,
        ]: any =
            await connection.query(
                `
                SELECT id
                FROM tb_jurnal
                WHERE no_registrasi = ?
                LIMIT 1
                `,
                [
                    noRegistrasi,
                ]
            )

        if (
            Array.isArray(
                existingClosing
            ) &&
            existingClosing.length > 0
        ) {

            return {
                success: false,
                message:
                    `Closing ${monthLabel} ${year} sudah pernah dilakukan.`,
            }
        }

        await connection.beginTransaction()

        transactionStarted =
            true

        const [
            akunRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_akun,
                    nama_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13003',
                    '13004'
                )
                FOR UPDATE
                `
            )

        const akunSet =
            new Set<string>()

        if (
            Array.isArray(akunRows)
        ) {

            for (
                const row of akunRows
            ) {

                akunSet.add(
                    String(
                        row.no_akun
                    )
                )
            }
        }

        if (
            !akunSet.has("13003")
        ) {

            throw new Error(
                "Akun 13003 Laba Tahun Berjalan tidak ditemukan."
            )
        }

        if (
            !akunSet.has("13004")
        ) {

            throw new Error(
                "Akun 13004 Ikhtisar Laba/Rugi tidak ditemukan."
            )
        }

        const detailCodes =
            closingAccounts.map(
                (account) =>
                    account.noAkun
            )

        const placeholders =
            detailCodes
                .map(
                    () => "?"
                )
                .join(",")

        const [
            detailRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_akun
                FROM tb_akun
                WHERE no_akun IN (${placeholders})
                FOR UPDATE
                `,
                detailCodes
            )

        const detailSet =
            new Set<string>()

        if (
            Array.isArray(
                detailRows
            )
        ) {

            for (
                const row of detailRows
            ) {

                detailSet.add(
                    String(
                        row.no_akun
                    )
                )
            }
        }

        const missingAccounts =
            closingAccounts.filter(
                (account) =>
                    !detailSet.has(
                        account.noAkun
                    )
            )

        if (
            missingAccounts.length > 0
        ) {

            throw new Error(
                "Akun berikut tidak ditemukan di tb_akun: " +
                missingAccounts
                    .map(
                        (account) =>
                            `${account.noAkun} ${account.namaAkun}`
                    )
                    .join(", ")
            )
        }

        const step1Items: {
            noAkun: string
            debit: number
            kredit: number
            keterangan: string
        }[] = []

        for (
            const account of closingAccounts
        ) {

            if (
                account.tipe !==
                "pendapatan"
            ) {
                continue
            }

            if (
                account.nilai <= 0
            ) {
                continue
            }

            step1Items.push({
                noAkun:
                    account.noAkun,

                debit:
                    account.nilai,

                kredit:
                    0,

                keterangan:
                    `Penutupan ${account.namaAkun} ` +
                    `${monthLabel} ${year}`,
            })

            step1Items.push({
                noAkun:
                    "13004",

                debit:
                    0,

                kredit:
                    account.nilai,

                keterangan:
                    `Penutupan ${account.namaAkun} ` +
                    `${monthLabel} ${year}`,
            })
        }

        for (
            const account of closingAccounts
        ) {

            if (
                account.tipe !==
                "beban"
            ) {
                continue
            }

            if (
                account.nilai <= 0
            ) {
                continue
            }

            step1Items.push({
                noAkun:
                    "13004",

                debit:
                    account.nilai,

                kredit:
                    0,

                keterangan:
                    `Penutupan ${account.namaAkun} ` +
                    `${monthLabel} ${year}`,
            })

            step1Items.push({
                noAkun:
                    account.noAkun,

                debit:
                    0,

                kredit:
                    account.nilai,

                keterangan:
                    `Penutupan ${account.namaAkun} ` +
                    `${monthLabel} ${year}`,
            })
        }

        const step1Debit =
            step1Items.reduce(
                (sum, item) =>
                    sum + item.debit,
                0
            )

        const step1Kredit =
            step1Items.reduce(
                (sum, item) =>
                    sum + item.kredit,
                0
            )

        if (
            step1Debit !==
            step1Kredit
        ) {

            throw new Error(
                `Jurnal Step 1 tidak balance. ` +
                `Debit: ${formatRupiah(
                    step1Debit
                )}, ` +
                `Kredit: ${formatRupiah(
                    step1Kredit
                )}.`
            )
        }

        const jurnalStep1 =
            await insertJurnal(
                connection,
                tanggalClosing,
                noRegistrasi,
                `${periode}-STEP1`,
                `${keterangan} - Penutupan Pendapatan dan Beban`
            )

        await insertJurnalItems(
            connection,
            jurnalStep1,
            step1Items
        )

        for (
            const item of step1Items
        ) {

            await updateAccountSaldo(
                connection,
                item.noAkun,
                item.debit,
                item.kredit
            )
        }

        const nilaiClosing =
            Math.abs(
                labaBersih
            )

        let step2Items: {
            noAkun: string
            debit: number
            kredit: number
            keterangan: string
        }[]

        if (
            labaBersih > 0
        ) {

            step2Items = [
                {
                    noAkun:
                        "13004",

                    debit:
                        nilaiClosing,

                    kredit:
                        0,

                    keterangan:
                        `Pemindahan Laba ${monthLabel} ${year} ` +
                        `ke Laba Tahun Berjalan`,
                },
                {
                    noAkun:
                        "13003",

                    debit:
                        0,

                    kredit:
                        nilaiClosing,

                    keterangan:
                        `Pemindahan Laba ${monthLabel} ${year} ` +
                        `ke Laba Tahun Berjalan`,
                },
            ]

        } else {

            step2Items = [
                {
                    noAkun:
                        "13003",

                    debit:
                        nilaiClosing,

                    kredit:
                        0,

                    keterangan:
                        `Pemindahan Rugi ${monthLabel} ${year} ` +
                        `ke Laba Tahun Berjalan`,
                },
                {
                    noAkun:
                        "13004",

                    debit:
                        0,

                    kredit:
                        nilaiClosing,

                    keterangan:
                        `Pemindahan Rugi ${monthLabel} ${year} ` +
                        `ke Laba Tahun Berjalan`,
                },
            ]
        }

        const step2Debit =
            step2Items.reduce(
                (sum, item) =>
                    sum + item.debit,
                0
            )

        const step2Kredit =
            step2Items.reduce(
                (sum, item) =>
                    sum + item.kredit,
                0
            )

        if (
            step2Debit !==
            step2Kredit
        ) {

            throw new Error(
                `Jurnal Step 2 tidak balance. ` +
                `Debit: ${formatRupiah(
                    step2Debit
                )}, ` +
                `Kredit: ${formatRupiah(
                    step2Kredit
                )}.`
            )
        }

        const jurnalStep2 =
            await insertJurnal(
                connection,
                tanggalClosing,
                `${noRegistrasi}_2`,
                `${periode}-STEP2`,
                `${keterangan} - Pemindahan ke Laba Tahun Berjalan`
            )

        await insertJurnalItems(
            connection,
            jurnalStep2,
            step2Items
        )

        for (
            const item of step2Items
        ) {

            await updateAccountSaldo(
                connection,
                item.noAkun,
                item.debit,
                item.kredit
            )
        }

        const [
            finalRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13003',
                    '13004'
                )
                `
            )

        let finalSaldo13003 = 0
        let finalSaldo13004 = 0

        if (
            Array.isArray(finalRows)
        ) {

            for (
                const row of finalRows
            ) {

                if (
                    String(
                        row.no_akun
                    ) === "13003"
                ) {

                    finalSaldo13003 =
                        Number(
                            row.saldo || 0
                        )
                }

                if (
                    String(
                        row.no_akun
                    ) === "13004"
                ) {

                    finalSaldo13004 =
                        Number(
                            row.saldo || 0
                        )
                }
            }
        }

        if (
            finalSaldo13004 !== 0
        ) {

            throw new Error(
                `Saldo 13004 setelah closing bukan Rp 0. ` +
                `Saldo sekarang: ${formatRupiah(
                    finalSaldo13004
                )}.`
            )
        }

        await connection.commit()

        revalidatePath("/neraca")
        revalidatePath("/closing")
        revalidatePath("/jurnal")
        revalidatePath("/riwayat-transaksi")

        const status =
            labaBersih > 0
                ? "LABA"
                : "RUGI"

        return {
            success: true,

            message:
                `Closing ${monthLabel} ${year} berhasil. ` +
                `${status}: ${formatRupiah(
                    labaBersih
                )}. ` +
                `Step 1 dan Step 2 berhasil dibuat. ` +
                `Saldo 13004 telah kembali Rp 0.`,

            data: {
                year,
                month,
                periode,
                noRegistrasi,
                jurnalStep1,
                jurnalStep2,
                totalPendapatan:
                    totalPendapatanReport,
                totalBeban:
                    totalBebanReport,
                labaBersih,
                saldo13003:
                    finalSaldo13003,
                saldo13004:
                    finalSaldo13004,
            },
        }

    } catch (error: any) {

        if (
            transactionStarted
        ) {
            await connection.rollback()
        }

        console.error(
            "Gagal eksekusi closing:",
            error
        )

        return {
            success: false,
            message:
                error?.message ||
                "Terjadi kesalahan saat memproses closing.",
        }

    } finally {

        connection.release()
    }
}

/**
 * ============================================================
 * CLOSING TAHUNAN
 * ============================================================
 *
 * Konsep:
 *
 * Closing bulanan:
 *
 * Pendapatan/Beban
 *        ↓
 *      13004
 *        ↓
 *      13003
 *
 * Closing tahunan:
 *
 * 13003 Laba Tahun Berjalan
 *        ↓
 *      13002
 *
 * Dividen:
 *
 * 31101 Dividen
 *        ↓
 *      13002
 *
 * Dividen TIDAK mengurangi laba tahun berjalan.
 * Dividen mengurangi laba ditahan.
 */
export async function executeAnnualClosing(
    year: string
) {
    const connection =
        await db.getConnection()

    let transactionStarted =
        false
    
    try {
        const tahun =
            String(year).trim()

        /**
         * ========================================================
         * 1. VALIDASI TAHUN
         * ========================================================
         */
        if (
            !/^\d{4}$/.test(
                tahun
            )
        ) {
            return {
                success: false,
                message:
                    "Tahun closing tidak valid.",
            }
        }

        const tahunNumber =
            Number(tahun)

        const noRegistrasi =
            `CL_TAHUNAN/${tahun}`

        const tanggalClosing =
            `${tahun}-12-31`

        const keterangan =
            `Closing Tahunan ${tahun}`

        /**
         * ========================================================
         * 2. CEK DUPLIKASI CLOSING TAHUNAN
         * ========================================================
         */
        const [
            existingClosing,
        ]: any =
            await connection.query(
                `
                SELECT
                    id
                FROM tb_jurnal
                WHERE no_registrasi = ?
                LIMIT 1
                `,
                [
                    noRegistrasi,
                ]
            )

        if (
            Array.isArray(
                existingClosing
            ) &&
            existingClosing.length > 0
        ) {
            return {
                success: false,
                message:
                    `Closing tahunan ${tahun} sudah pernah dilakukan.`,
            }
        }

        /**
         * ========================================================
         * 3. VALIDASI 12 CLOSING BULANAN
         * ========================================================
         */
        const monthlyRegistrations =
            Array.from(
                {
                    length: 12,
                },
                (_, index) =>
                    `CL_${String(
                        index + 1
                    ).padStart(
                        2,
                        "0"
                    )}/${String(
                        tahunNumber
                    ).slice(-2)}`
            )

        const monthlyPlaceholders =
            monthlyRegistrations
                .map(
                    () => "?"
                )
                .join(",")

        const [
            monthlyRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_registrasi
                FROM tb_jurnal
                WHERE no_registrasi IN (
                    ${monthlyPlaceholders}
                )
                `,
                monthlyRegistrations
            )

        const monthlyClosingSet =
            new Set<string>()

        if (
            Array.isArray(
                monthlyRows
            )
        ) {
            for (
                const row of monthlyRows
            ) {
                monthlyClosingSet.add(
                    String(
                        row.no_registrasi
                    )
                )
            }
        }

        const missingMonths: string[] =
            []

        for (
            let month = 1;
            month <= 12;
            month++
        ) {
            const registration =
                `CL_${String(
                    month
                ).padStart(
                    2,
                    "0"
                )}/${String(
                    tahunNumber
                ).slice(-2)}`

            if (
                !monthlyClosingSet.has(
                    registration
                )
            ) {
                missingMonths.push(
                    BULAN_NAMES[
                    String(month)
                    ] ||
                    `Bulan ${month}`
                )
            }
        }

        if (
            missingMonths.length > 0
        ) {
            throw new Error(
                `Closing tahunan ${tahun} belum dapat dilakukan. ` +
                `Closing bulanan yang belum selesai: ` +
                `${missingMonths.join(", ")}.`
            )
        }

        /**
         * ========================================================
         * 4. BEGIN TRANSACTION
         * ========================================================
         */
        await connection.beginTransaction()

        transactionStarted =
            true

        /**
         * ========================================================
         * 5. LOCK AKUN YANG DIPERLUKAN
         * ========================================================
         *
         * 13002 = Laba Ditahan
         * 13003 = Laba Tahun Berjalan
         * 13004 = Ikhtisar Laba/Rugi
         *
         * 31101 tetap dibaca untuk informasi saldo,
         * tetapi TIDAK divalidasi harus menjadi Rp0.
         */
        const [
            akunRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_akun,
                    nama_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13002',
                    '13003',
                    '13004',
                    '31101'
                )
                FOR UPDATE
                `
            )

        let saldo13002 = 0
        let saldo13003 = 0
        let saldo13004 = 0
        let saldo31101 = 0

        const akunSet =
            new Set<string>()

        if (
            Array.isArray(akunRows)
        ) {
            for (
                const row of akunRows
            ) {
                const noAkun =
                    String(
                        row.no_akun
                    )

                akunSet.add(
                    noAkun
                )

                const saldo =
                    Number(
                        row.saldo || 0
                    )

                if (
                    noAkun === "13002"
                ) {
                    saldo13002 =
                        saldo
                }

                if (
                    noAkun === "13003"
                ) {
                    saldo13003 =
                        saldo
                }

                if (
                    noAkun === "13004"
                ) {
                    saldo13004 =
                        saldo
                }

                if (
                    noAkun === "31101"
                ) {
                    saldo31101 =
                        saldo
                }
            }
        }

        /**
         * ========================================================
         * 6. VALIDASI AKUN
         * ========================================================
         */
        if (
            !akunSet.has(
                "13002"
            )
        ) {
            throw new Error(
                "Akun 13002 Laba Ditahan tidak ditemukan."
            )
        }

        if (
            !akunSet.has(
                "13003"
            )
        ) {
            throw new Error(
                "Akun 13003 Laba Tahun Berjalan tidak ditemukan."
            )
        }

        if (
            !akunSet.has(
                "13004"
            )
        ) {
            throw new Error(
                "Akun 13004 Ikhtisar Laba/Rugi tidak ditemukan."
            )
        }

        if (
            !akunSet.has(
                "31101"
            )
        ) {
            throw new Error(
                "Akun 31101 Dividen tidak ditemukan."
            )
        }

        /**
         * ========================================================
         * 7. VALIDASI 13004
         * ========================================================
         *
         * Setelah semua closing bulanan selesai,
         * Ikhtisar Laba/Rugi harus sudah Rp0.
         */
        if (
            saldo13004 !== 0
        ) {
            throw new Error(
                `Closing tahunan tidak dapat dilakukan karena ` +
                `saldo 13004 Ikhtisar Laba/Rugi masih ` +
                `${formatRupiah(
                    saldo13004
                )}. ` +
                `Saldo 13004 harus Rp 0.`
            )
        }

        /**
         * ========================================================
         * 8. VALIDASI 13003
         * ========================================================
         *
         * Saldo 13003 merupakan laba/rugi tahun berjalan.
         */
        if (
            saldo13003 === 0
        ) {
            throw new Error(
                `Saldo 13003 Laba Tahun Berjalan untuk ${tahun} ` +
                `adalah Rp 0. Tidak ada laba/rugi yang dapat ` +
                `dipindahkan ke Laba Ditahan.`
            )
        }

        /**
         * ========================================================
         * 9. AMBIL TOTAL DIVIDEN TAHUN BERJALAN
         * ========================================================
         *
         * PENTING:
         *
         * Jangan menggunakan saldo tb_akun 31101
         * sebagai total dividen tahun berjalan.
         *
         * Total dividen dihitung dari mutasi:
         *
         * 31101 DEBIT
         *
         * pada jurnal tahun yang bersangkutan.
         *
         * Closing tidak ikut dihitung.
         */
        const [
            dividenRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    COALESCE(
                        SUM(ji.debit),
                        0
                    ) AS total_dividen
                FROM tb_jurnal_item ji
                INNER JOIN tb_jurnal j
                    ON j.id = ji.jurnal_id
                WHERE ji.no_akun = '31101'
                  AND YEAR(j.tanggal) = ?
                  AND (
                        j.no_registrasi IS NULL
                        OR j.no_registrasi NOT LIKE 'CL\\_%'
                  )
                `,
                [
                    tahunNumber,
                ]
            )

        const totalDividen =
            Number(
                dividenRows?.[0]?.total_dividen || 0
            )

        /**
         * ========================================================
         * 10. TENTUKAN LABA / RUGI
         * ========================================================
         */
        const nilaiClosing =
            Math.abs(
                saldo13003
            )

        const status =
            saldo13003 > 0
                ? "LABA"
                : "RUGI"

        /**
         * ========================================================
         * 11. BENTUK ITEMS JURNAL TAHUNAN
         * ========================================================
         */
        const stepItems: {
            noAkun: string
            debit: number
            kredit: number
            keterangan: string
        }[] = []

        /**
         * ========================================================
         * 12. TUTUP LABA / RUGI TAHUN BERJALAN
         * ========================================================
         *
         * JIKA LABA:
         *
         * Dr 13003
         *     Cr 13002
         *
         * JIKA RUGI:
         *
         * Dr 13002
         *     Cr 13003
         */
        if (
            saldo13003 > 0
        ) {
            /**
             * LABA
             */
            stepItems.push({
                noAkun:
                    "13003",

                debit:
                    nilaiClosing,

                kredit:
                    0,

                keterangan:
                    `Pemindahan Laba Tahun Berjalan ${tahun} ` +
                    `ke Laba Ditahan`,
            })

            stepItems.push({
                noAkun:
                    "13002",

                debit:
                    0,

                kredit:
                    nilaiClosing,

                keterangan:
                    `Pemindahan Laba Tahun Berjalan ${tahun} ` +
                    `ke Laba Ditahan`,
            })

        } else {
            /**
             * RUGI
             */
            stepItems.push({
                noAkun:
                    "13002",

                debit:
                    nilaiClosing,

                kredit:
                    0,

                keterangan:
                    `Pemindahan Rugi Tahun Berjalan ${tahun} ` +
                    `ke Laba Ditahan`,
            })

            stepItems.push({
                noAkun:
                    "13003",

                debit:
                    0,

                kredit:
                    nilaiClosing,

                keterangan:
                    `Pemindahan Rugi Tahun Berjalan ${tahun} ` +
                    `ke Laba Ditahan`,
            })
        }

        /**
         * ========================================================
         * 13. TUTUP DIVIDEN
         * ========================================================
         *
         * Dividen BUKAN beban.
         *
         * Dividen juga TIDAK mengurangi 13003.
         *
         * Jurnal:
         *
         * Dr 13002 Laba Ditahan
         *     Cr 31101 Dividen
         *
         * Nilai dividen berasal dari total mutasi debit 31101
         * selama tahun berjalan.
         */
        if (
            totalDividen > 0
        ) {
            stepItems.push({
                noAkun:
                    "13002",

                debit:
                    totalDividen,

                kredit:
                    0,

                keterangan:
                    `Penutupan Dividen Tahun ${tahun}`,
            })

            stepItems.push({
                noAkun:
                    "31101",

                debit:
                    0,

                kredit:
                    totalDividen,

                keterangan:
                    `Penutupan Dividen Tahun ${tahun}`,
            })
        }

        /**
         * ========================================================
         * 14. VALIDASI JURNAL BALANCE
         * ========================================================
         */
        const totalDebit =
            stepItems.reduce(
                (sum, item) =>
                    sum + item.debit,
                0
            )

        const totalKredit =
            stepItems.reduce(
                (sum, item) =>
                    sum + item.kredit,
                0
            )

        if (
            totalDebit !==
            totalKredit
        ) {
            throw new Error(
                `Jurnal closing tahunan tidak balance. ` +
                `Debit: ${formatRupiah(
                    totalDebit
                )}, ` +
                `Kredit: ${formatRupiah(
                    totalKredit
                )}.`
            )
        }

        /**
         * ========================================================
         * 15. INSERT HEADER JURNAL
         * ========================================================
         */
        const jurnalClosing =
            await insertJurnal(
                connection,
                tanggalClosing,
                noRegistrasi,
                `${tahun}-ANNUAL`,
                keterangan
            )

        /**
         * ========================================================
         * 16. INSERT DETAIL JURNAL
         * ========================================================
         */
        await insertJurnalItems(
            connection,
            jurnalClosing,
            stepItems
        )

        /**
         * ========================================================
         * 17. UPDATE SALDO AKUN
         * ========================================================
         *
         * Termasuk:
         *
         * 13003
         * 13002
         * 31101
         *
         * Tetapi tidak ada validasi bahwa saldo 31101
         * harus menjadi Rp0 karena saldo akun tersebut
         * bukan sumber perhitungan total dividen.
         */
        for (
            const item of stepItems
        ) {
            await updateAccountSaldo(
                connection,
                item.noAkun,
                item.debit,
                item.kredit
            )
        }

        /**
         * ========================================================
         * 18. CEK SALDO AKHIR
         * ========================================================
         */
        const [
            finalRows,
        ]: any =
            await connection.query(
                `
                SELECT
                    no_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13002',
                    '13003',
                    '13004',
                    '31101'
                )
                `
            )

        let finalSaldo13002 = 0
        let finalSaldo13003 = 0
        let finalSaldo13004 = 0
        let finalSaldo31101 = 0

        if (
            Array.isArray(
                finalRows
            )
        ) {
            for (
                const row of finalRows
            ) {
                const noAkun =
                    String(
                        row.no_akun
                    )

                const saldo =
                    Number(
                        row.saldo || 0
                    )

                if (
                    noAkun === "13002"
                ) {
                    finalSaldo13002 =
                        saldo
                }

                if (
                    noAkun === "13003"
                ) {
                    finalSaldo13003 =
                        saldo
                }

                if (
                    noAkun === "13004"
                ) {
                    finalSaldo13004 =
                        saldo
                }

                if (
                    noAkun === "31101"
                ) {
                    finalSaldo31101 =
                        saldo
                }
            }
        }

        /**
         * ========================================================
         * 19. VALIDASI 13003
         * ========================================================
         */
        if (
            finalSaldo13003 !== 0
        ) {
            throw new Error(
                `Saldo 13003 setelah closing tahunan bukan Rp 0. ` +
                `Saldo sekarang: ${formatRupiah(
                    finalSaldo13003
                )}.`
            )
        }

        /**
         * ========================================================
         * 20. VALIDASI 13004
         * ========================================================
         */
        if (
            finalSaldo13004 !== 0
        ) {
            throw new Error(
                `Saldo 13004 setelah closing tahunan bukan Rp 0. ` +
                `Saldo sekarang: ${formatRupiah(
                    finalSaldo13004
                )}.`
            )
        }

        /**
         * ========================================================
         * CATATAN 31101
         * ========================================================
         *
         * TIDAK ADA VALIDASI:
         *
         * finalSaldo31101 === 0
         *
         * karena total dividen ditentukan berdasarkan mutasi
         * jurnal tahun berjalan, bukan saldo akhir tb_akun.
         */

        /**
         * ========================================================
         * 21. COMMIT
         * ========================================================
         */
        await connection.commit()

        /**
         * ========================================================
         * 22. REVALIDATE
         * ========================================================
         */
        revalidatePath(
            "/neraca"
        )

        revalidatePath(
            "/closing"
        )

        revalidatePath(
            "/jurnal"
        )

        revalidatePath(
            "/riwayat-transaksi"
        )

        /**
         * ========================================================
         * 23. RESPONSE
         * ========================================================
         */
        return {
            success: true,

            message:
                `Closing tahunan ${tahun} berhasil. ` +
                `${status}: ${formatRupiah(
                    saldo13003
                )}. ` +
                `Dividen: ${formatRupiah(
                    totalDividen
                )}. ` +
                `Laba/Rugi tahun berjalan telah dipindahkan ` +
                `ke Laba Ditahan.`,

            data: {
                year:
                    tahun,

                noRegistrasi:
                    noRegistrasi,

                jurnalClosing:
                    jurnalClosing,

                status:
                    status,

                labaRugi:
                    saldo13003,

                totalDividen:
                    totalDividen,

                saldoAwal13002:
                    saldo13002,

                saldoAkhir13002:
                    finalSaldo13002,

                saldoAwal13003:
                    saldo13003,

                saldoAkhir13003:
                    finalSaldo13003,

                saldoAkhir13004:
                    finalSaldo13004,

                saldoAwal31101:
                    saldo31101,

                saldoAkhir31101:
                    finalSaldo31101,
            },
        }

    } catch (error: any) {

        if (
            transactionStarted
        ) {
            await connection.rollback()
        }

        console.error(
            "Gagal eksekusi closing tahunan:",
            error
        )

        return {
            success: false,
            message:
                error?.message ||
                "Terjadi kesalahan saat memproses closing tahunan.",
        }

    } finally {

        connection.release()
    }
}

/**
 * ============================================================
 * PREVIEW CLOSING TAHUNAN
 * ============================================================
 *
 * Preview:
 *
 * 13002 = saldo Laba Ditahan sebelum closing
 * 13003 = laba/rugi tahun berjalan
 * 13004 = Ikhtisar Laba Rugi
 * 31101 = total dividen tahun berjalan
 *
 * Simulasi:
 *
 * 13002 akhir =
 *     13002 awal
 *     + laba/rugi tahun berjalan
 *     - dividen
 *
 * 13003 akhir = 0
 * 13004 akhir = 0
 * 31101 akhir = 0
 */
export async function getPreviewClosingTahunan(
    year: string
) {

    try {

        const tahun =
            String(year).trim()

        if (
            !/^\d{4}$/.test(
                tahun
            )
        ) {

            return {
                success: false,
                message:
                    "Tahun tidak valid.",
                data: null,
            }
        }

        const tahunNumber =
            Number(tahun)

        /**
         * ========================================================
         * 1. CEK 12 CLOSING BULANAN
         * ========================================================
         */
        const monthlyRegistrations =
            Array.from(
                {
                    length: 12,
                },
                (_, index) =>
                    `CL_${String(
                        index + 1
                    ).padStart(
                        2,
                        "0"
                    )}/${String(
                        tahunNumber
                    ).slice(-2)}`
            )

        const monthlyPlaceholders =
            monthlyRegistrations
                .map(
                    () => "?"
                )
                .join(",")

        const [
            monthlyRows,
        ]: any =
            await db.query(
                `
                SELECT
                    no_registrasi
                FROM tb_jurnal
                WHERE no_registrasi IN (
                    ${monthlyPlaceholders}
                )
                `,
                monthlyRegistrations
            )

        const monthlyClosingSet =
            new Set<string>()

        if (
            Array.isArray(
                monthlyRows
            )
        ) {

            for (
                const row of monthlyRows
            ) {

                monthlyClosingSet.add(
                    String(
                        row.no_registrasi
                    )
                )
            }
        }

        const missingMonths: string[] =
            []

        for (
            let month = 1;
            month <= 12;
            month++
        ) {

            const registration =
                `CL_${String(
                    month
                ).padStart(
                    2,
                    "0"
                )}/${String(
                    tahunNumber
                ).slice(-2)}`

            if (
                !monthlyClosingSet.has(
                    registration
                )
            ) {

                missingMonths.push(
                    BULAN_NAMES[
                    String(month)
                    ] ||
                    `Bulan ${month}`
                )
            }
        }

        /**
         * ========================================================
         * 2. AMBIL SALDO EKUITAS
         * ========================================================
         */
        const [
            rows,
        ]: any =
            await db.query(
                `
                SELECT
                    no_akun,
                    saldo
                FROM tb_akun
                WHERE no_akun IN (
                    '13002',
                    '13003',
                    '13004',
                    '31101'
                )
                ORDER BY no_akun
                `
            )

        let saldo13002 = 0
        let saldo13003 = 0
        let saldo13004 = 0
        let saldo31101 = 0

        if (
            Array.isArray(rows)
        ) {

            for (
                const row of rows
            ) {

                const noAkun =
                    String(
                        row.no_akun
                    )

                const saldo =
                    Number(
                        row.saldo || 0
                    )

                if (
                    noAkun === "13002"
                ) {
                    saldo13002 =
                        saldo
                }

                if (
                    noAkun === "13003"
                ) {
                    saldo13003 =
                        saldo
                }

                if (
                    noAkun === "13004"
                ) {
                    saldo13004 =
                        saldo
                }

                if (
                    noAkun === "31101"
                ) {
                    saldo31101 =
                        saldo
                }
            }
        }

        /**
         * ========================================================
         * 3. AMBIL TOTAL DIVIDEN
         * ========================================================
         *
         * Dividen diambil dari mutasi jurnal,
         * bukan saldo akun.
         */
        const [
            dividenRows,
        ]: any =
            await db.query(
                `
                SELECT
                    COALESCE(
                        SUM(ji.debit),
                        0
                    ) AS total_dividen
                FROM tb_jurnal_item ji
                INNER JOIN tb_jurnal j
                    ON j.id = ji.jurnal_id
                WHERE ji.no_akun = '31101'
                  AND YEAR(j.tanggal) = ?
                  AND (
                        j.no_registrasi IS NULL
                        OR j.no_registrasi NOT LIKE 'CL\\_%'
                  )
                `,
                [
                    tahunNumber,
                ]
            )

        const totalDividen =
            Number(
                dividenRows?.[0]?.total_dividen || 0
            )

        /**
         * ========================================================
         * 4. SIMULASI HASIL CLOSING
         * ========================================================
         */
        const saldo13002Setelah =
            saldo13002 +
            saldo13003 -
            totalDividen

        const saldo13003Setelah =
            0

        const saldo13004Setelah =
            0

        const saldo31101Setelah =
            0

        const status =
            saldo13003 > 0
                ? "LABA"
                : saldo13003 < 0
                    ? "RUGI"
                    : "NIHIL"

        /**
         * ========================================================
         * 5. RETURN
         * ========================================================
         */
        return {
            success: true,

            data: {
                tahun,

                closingBulananLengkap:
                    missingMonths.length === 0,

                missingMonths,

                saldo13002,

                saldo13003,

                saldo13004,

                saldo31101,

                totalDividen,

                status,

                labaRugiTahunBerjalan:
                    saldo13003,

                saldo13002Setelah,

                saldo13003Setelah,

                saldo13004Setelah,

                saldo31101Setelah,
            },
        }

    } catch (error: any) {

        console.error(
            "Gagal mengambil preview closing tahunan:",
            error
        )

        return {
            success: false,
            message:
                error?.message ||
                "Gagal mengambil preview closing tahunan.",
            data: null,
        }
    }
}