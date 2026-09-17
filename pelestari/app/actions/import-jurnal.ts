"use server";

import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createJurnalUmum } from "@/app/actions/jurnal";
import { findBestMatch, FuzzyCandidate } from "@/lib/fuzzyMatch";
import type { ImportPreviewRow, ImportPreviewResult } from "@/app/actions/import-jurnal.types";

/* ============================================================
 * MAPPING REKENING -> AKUN KAS/BANK
 * ============================================================
 * Mapping nama "Rekening" pada sheet CI/CO Excel -> no_akun Kas/Bank di COA.
 * Tidak disimpan di tabel DB — cukup edit objek ini kalau ada nama rekening
 * baru yang muncul saat import (lihat daftar "belum termapping" di halaman
 * import), lalu redeploy.
 *
 * PENTING:
 * - Key HARUS huruf kecil semua (lowercase), karena nama rekening dari
 *   Excel juga di-lowercase dulu sebelum dicocokkan.
 * - Value adalah no_akun yang benar-benar ada di tabel tb_akun (kepala '1').
 */
const REKENING_MAPPING: Record<string, string> = {
    "pasif": "11300", // Pasif
    "aktif": "11200", // Aktif
};

const AKUN_KAS_KECIL = "11100";
const AKUN_PIUTANG_USAHA = "13000";
const NAMA_PENERIMA_CI = "PT Peduli Lestari Indonesia";

/* ============================================================
 * TIPE DATA
 * ============================================================
 * Interface ImportPreviewRow & ImportPreviewResult dipindah ke
 * import-jurnal.types.ts, karena file "use server" tidak boleh
 * export apa pun selain async function.
 */

/* ============================================================
 * HELPER: BACA SHEET EXCEL SECARA DINAMIS (BERDASARKAN NAMA HEADER)
 * ============================================================ */

function findSheetByPrefix(workbook: ExcelJS.Workbook, prefix: "CI" | "CO" | "PETTY CASH"): ExcelJS.Worksheet | null {
    return (
        workbook.worksheets.find((ws) => ws.name.trim().toUpperCase().startsWith(prefix)) || null
    );
}

function findHeaderRowIndex(worksheet: ExcelJS.Worksheet): number {
    for (let r = 1; r <= 10; r++) {
        const row = worksheet.getRow(r);
        let found = false;

        row.eachCell((cell) => {
            const value = String(cell.value ?? "")
                .trim()
                .toLowerCase();

            if (
                value === "nomor register" ||
                value === "no register"
            ) {
                found = true;
            }
        });

        if (found) return r;
    }

    throw new Error(
        `Header "Nomor Register" / "No Register" tidak ditemukan di sheet "${worksheet.name}"`
    );
}

function buildHeaderMap(worksheet: ExcelJS.Worksheet, headerRowIdx: number): Map<string, number> {
    const map = new Map<string, number>();
    const row = worksheet.getRow(headerRowIdx);
    row.eachCell((cell, colNumber) => {
        const key = String(cell.value ?? "").trim().toLowerCase();
        if (key) map.set(key, colNumber);
    });
    return map;
}

/** Ambil nilai cell berdasarkan nama header, dengan fallback ke beberapa nama header sekaligus */
function getCellValue(row: ExcelJS.Row, headerMap: Map<string, number>, ...headerNames: string[]): any {
    for (const name of headerNames) {
        const col = headerMap.get(name.trim().toLowerCase());
        if (col) {
            const val = row.getCell(col).value;
            if (val !== null && val !== undefined && String(val).trim() !== "") return val;
        }
    }
    return null;
}

function toDateString(value: any): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    return Number(cleaned) || 0;
}
function toText(value: any): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        if (value.result !== undefined) {
            return String(value.result).trim();
        }

        if (Array.isArray(value.richText)) {
            return value.richText
                .map((item: any) => item.text || "")
                .join("")
                .trim();
        }

        if (value.text !== undefined) {
            return String(value.text).trim();
        }
    }

    return String(value).trim();
}
/* ============================================================
 * ACTION: PREVIEW IMPORT
 * ============================================================ */

export async function previewImportJurnal(base64File: string): Promise<ImportPreviewResult> {
    try {
        const buffer = Buffer.from(base64File, "base64");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);

        // --- Ambil master data yang dibutuhkan untuk matching ---
        // Mapping rekening diambil dari konstanta REKENING_MAPPING di atas (bukan tabel DB),
        // dicocokkan secara fuzzy (bukan exact match) supaya toleran typo/variasi penulisan.
        const kandidatRekening: FuzzyCandidate<string>[] = Object.entries(REKENING_MAPPING).map(
            ([nama, noAkun]) => ({ item: noAkun, label: nama })
        );

        const [akunRows]: any = await db.query(
            `SELECT a.no_akun, a.nama_akun, k.kelompok_biaya AS nama_kelompok
       FROM tb_akun a
       LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
       WHERE a.is_aktif = 1`
        );

        const [kelompokRows]: any = await db.query(
            "SELECT id, kelompok_biaya FROM tb_kelompok_biaya"
        );

        const [penerimaRows]: any = await db.query(
            "SELECT nama_penerima FROM tb_penerima"
        );
        const penerimaSet = new Set<string>(
            penerimaRows.map((p: any) => String(p.nama_penerima).trim().toLowerCase())
        );

        // Kandidat kelompok biaya untuk sheet CO
        const kandidatKelompok: FuzzyCandidate<any>[] = kelompokRows.map((k: any) => ({
            item: k,
            label: k.kelompok_biaya,
        }));

        /* -------- PARSE SHEET CI (Cash In / Pemasukan) -------- */
        const ciRows: ImportPreviewRow[] = [];
        const sheetCI = findSheetByPrefix(workbook, "CI");
        if (sheetCI) {
            const headerRowIdx = findHeaderRowIndex(sheetCI);
            const headerMap = buildHeaderMap(sheetCI, headerRowIdx);

            for (let r = headerRowIdx + 1; r <= sheetCI.rowCount; r++) {
                const row = sheetCI.getRow(r);

                const noRegistrasi = toText(
                    getCellValue(row, headerMap, "Nomor Register")
                );

                if (!noRegistrasi) continue;

                const tanggal = toDateString(
                    getCellValue(row, headerMap, "Tanggal")
                );

                const rekeningExcel = toText(
                    getCellValue(row, headerMap, "Rekening")
                );

                const namaPemohon = toText(
                    getCellValue(row, headerMap, "Nama Pengirim")
                );

                const debit = toNumber(
                    getCellValue(row, headerMap, "Debit")
                );

                const detail = toText(
                    getCellValue(row, headerMap, "Detail")
                );

                const perusahaan = toText(
                    getCellValue(row, headerMap, "Perusahaan")
                );

                const teksSumberLawan = toText(
                    getCellValue(
                        row,
                        headerMap,
                        "Jenis Pekerjaan",
                        "Divisi"
                    )
                );

                const rekeningKey = rekeningExcel.toLowerCase();
                const noAkunKasBank = REKENING_MAPPING[rekeningKey] || null;
                const preview: ImportPreviewRow = {
                    rowKey: `CI-${r}`,
                    jenis: "CI",
                    noRegistrasi,
                    tanggal: tanggal || "",
                    rekeningExcel,
                    noAkunKasBank,
                    skorMatchRekening: noAkunKasBank ? 1 : null,
                    namaPihak: NAMA_PENERIMA_CI,
                    isPihakBaru: false,
                    teksSumberLawan,
                    namaPemohon,
                    noAkunLawan: AKUN_PIUTANG_USAHA,
                    namaAkunLawan: "Piutang Usaha",
                    skorMatchLawan: 1,
                    nominal: debit,
                    keterangan: [detail, perusahaan]
                        .filter(Boolean)
                        .join(" - "),
                    status: "siap",
                };

                if (!tanggal) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Tanggal tidak valid";
                } else if (!noAkunKasBank) {
                    preview.status = "dilewati";
                    preview.alasanDilewati =
                        `Rekening "${rekeningExcel}" belum dimapping ke akun Kas/Bank`;
                } else if (debit <= 0) {
                    preview.status = "dilewati";
                    preview.alasanDilewati =
                        "Nominal debit kosong / nol";
                }

                ciRows.push(preview);
            }
        }
        /* -------- PARSE SHEET CO (Cash Out / Pengeluaran) -------- */
        const coRows: ImportPreviewRow[] = [];
        const sheetCO = findSheetByPrefix(workbook, "CO");
        if (sheetCO) {
            const headerRowIdx = findHeaderRowIndex(sheetCO);
            const headerMap = buildHeaderMap(sheetCO, headerRowIdx);

            for (let r = headerRowIdx + 1; r <= sheetCO.rowCount; r++) {
                const row = sheetCO.getRow(r);
                const noRegistrasi = toText(
                    getCellValue(
                        row,
                        headerMap,
                        "Nomor Register"
                    )
                ); if (!noRegistrasi) continue;

                const tanggal = toDateString(getCellValue(row, headerMap, "Tanggal"));
                const rekeningExcel = toText(
                    getCellValue(row, headerMap, "Rekening")
                );

                const penerima = toText(
                    getCellValue(row, headerMap, "Penerima")
                );

                const pemohon = toText(
                    getCellValue(row, headerMap, "User")
                );

                const kredit = toNumber(
                    getCellValue(row, headerMap, "Kredit")
                );

                const keteranganExcel = toText(
                    getCellValue(row, headerMap, "Keterangan")
                );

                const kelompokBiaya = toText(
                    getCellValue(row, headerMap, "Kelompok Biaya")
                );

                const jenisBiaya = toText(
                    getCellValue(row, headerMap, "Jenis Biaya")
                );

                const rekeningKey = rekeningExcel.toLowerCase();
                const noAkunKasBank = REKENING_MAPPING[rekeningKey] || null;

                // Tahap 1: cocokkan Kelompok Biaya -> tb_kelompok_biaya
                const matchKelompok = findBestMatch(kelompokBiaya, kandidatKelompok, 0.35);

                let noAkunLawan: string | null = null;
                let namaAkunLawan: string | null = null;
                let skorMatchLawan: number | null = null;

                if (matchKelompok) {
                    // Tahap 2: dalam kelompok yang cocok, perhalus pilihan akun pakai teks Jenis Biaya
                    const akunDalamKelompok = akunRows.filter(
                        (a: any) => a.nama_kelompok === matchKelompok.item.kelompok_biaya
                    );
                    const kandidatAkunDalamKelompok: FuzzyCandidate<any>[] = akunDalamKelompok.map(
                        (a: any) => ({ item: a, label: a.nama_akun })
                    );
                    const matchAkun = findBestMatch(jenisBiaya, kandidatAkunDalamKelompok, 0.25);

                    if (matchAkun) {
                        noAkunLawan = matchAkun.item.no_akun;
                        namaAkunLawan = matchAkun.item.nama_akun;
                        skorMatchLawan = Number(matchAkun.score.toFixed(2));
                    } else if (akunDalamKelompok.length > 0) {
                        // fallback: akun pertama dalam kelompok yang cocok
                        noAkunLawan = akunDalamKelompok[0].no_akun;
                        namaAkunLawan = akunDalamKelompok[0].nama_akun;
                        skorMatchLawan = Number(matchKelompok.score.toFixed(2));
                    }
                }

                const preview: ImportPreviewRow = {
                    rowKey: `CO-${r}`,
                    jenis: "CO",
                    noRegistrasi: String(noRegistrasi).trim(),
                    tanggal: tanggal || "",
                    rekeningExcel,
                    noAkunKasBank,
                    namaPemohon: pemohon,
                    skorMatchRekening: noAkunKasBank ? 1 : null, namaPihak: penerima,
                    isPihakBaru: penerima ? !penerimaSet.has(penerima.toLowerCase()) : false,
                    teksSumberLawan: kelompokBiaya,
                    noAkunLawan,
                    namaAkunLawan,
                    skorMatchLawan,
                    nominal: kredit,
                    keterangan: keteranganExcel,
                    status: "siap",
                };

                if (!tanggal) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Tanggal tidak valid";
                } else if (!noAkunKasBank) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = `Rekening "${rekeningExcel}" belum dimapping ke akun Kas/Bank`;
                } else if (!noAkunLawan) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = `Tidak ditemukan akun beban yang cocok untuk kelompok biaya "${kelompokBiaya || "(kosong)"}"`;
                } else if (kredit <= 0) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Nominal kredit kosong / nol";
                }

                coRows.push(preview);
            }
        }
        /* -------- PARSE SHEET PETTY CASH (KK) -------- */
        const kkRows: ImportPreviewRow[] = [];
        const sheetKK = findSheetByPrefix(workbook, "PETTY CASH");

        if (sheetKK) {
            const headerRowIdx = findHeaderRowIndex(sheetKK);
            const headerMap = buildHeaderMap(sheetKK, headerRowIdx);

            for (let r = headerRowIdx + 1; r <= sheetKK.rowCount; r++) {
                const row = sheetKK.getRow(r);

                const noRegistrasi = toText(
                    getCellValue(row, headerMap, "No Register", "Nomor Register")
                );

                if (!noRegistrasi) continue;

                // Hanya ambil transaksi KK
                if (!noRegistrasi.toUpperCase().startsWith("KK")) {
                    continue;
                }

                const tanggal = toDateString(
                    getCellValue(row, headerMap, "Tanggal")
                );

                const kelompokBiaya = toText(
                    getCellValue(row, headerMap, "Kelompok Biaya")
                );

                const jenisBiaya = toText(
                    getCellValue(row, headerMap, "Jenis Biaya")
                );

                const keterangan = toText(
                    getCellValue(row, headerMap, "Keterangan")
                );

                // Debit sengaja tidak digunakan
                // PIC sengaja tidak digunakan
                // Total Saldo sengaja tidak digunakan
                const kredit = toNumber(
                    getCellValue(row, headerMap, "Kredit")
                );

                /* -----------------------------------------
                 * MATCH KELOMPOK BIAYA
                 * ----------------------------------------- */
                const matchKelompok = findBestMatch(
                    kelompokBiaya,
                    kandidatKelompok,
                    0.35
                );

                let noAkunLawan: string | null = null;
                let namaAkunLawan: string | null = null;
                let skorMatchLawan: number | null = null;

                if (matchKelompok) {
                    const akunDalamKelompok = akunRows.filter(
                        (a: any) =>
                            a.nama_kelompok ===
                            matchKelompok.item.kelompok_biaya
                    );

                    const kandidatAkunDalamKelompok: FuzzyCandidate<any>[] =
                        akunDalamKelompok.map((a: any) => ({
                            item: a,
                            label: a.nama_akun,
                        }));

                    const matchAkun = findBestMatch(
                        jenisBiaya,
                        kandidatAkunDalamKelompok,
                        0.25
                    );

                    if (matchAkun) {
                        noAkunLawan = matchAkun.item.no_akun;
                        namaAkunLawan = matchAkun.item.nama_akun;
                        skorMatchLawan = Number(
                            matchAkun.score.toFixed(2)
                        );
                    } else if (akunDalamKelompok.length > 0) {
                        noAkunLawan = akunDalamKelompok[0].no_akun;
                        namaAkunLawan = akunDalamKelompok[0].nama_akun;
                        skorMatchLawan = Number(
                            matchKelompok.score.toFixed(2)
                        );
                    }
                }

                const preview: ImportPreviewRow = {
                    rowKey: `KK-${r}`,
                    jenis: "KK",

                    noRegistrasi: String(noRegistrasi).trim(),

                    tanggal: tanggal || "",

                    // Petty Cash tidak punya kolom Rekening
                    rekeningExcel: "Kas Kecil",

                    // Langsung menggunakan akun Kas Kecil
                    noAkunKasBank: AKUN_KAS_KECIL,
                    skorMatchRekening: 1,

                    // Tidak ada Penerima/PIC yang digunakan
                    namaPihak: "",
                    isPihakBaru: false,

                    namaPemohon: "",

                    teksSumberLawan: kelompokBiaya,

                    noAkunLawan,
                    namaAkunLawan,
                    skorMatchLawan,

                    nominal: kredit,

                    keterangan,

                    status: "siap",
                };

                if (!tanggal) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Tanggal tidak valid";
                } else if (!noAkunLawan) {
                    preview.status = "dilewati";
                    preview.alasanDilewati =
                        `Tidak ditemukan akun beban yang cocok untuk kelompok biaya "${kelompokBiaya || "(kosong)"}"`;
                } else if (kredit <= 0) {
                    preview.status = "dilewati";
                    preview.alasanDilewati =
                        "Nominal kredit kosong / nol";
                }

                kkRows.push(preview);
            }
        }
        const semuaRows = [...ciRows, ...coRows, ...kkRows];

        const totalBaris = semuaRows.length;

        const siap = semuaRows.filter(
            (r) => r.status === "siap"
        ).length;

        return {
            success: true,
            ci: ciRows,
            co: coRows,
            kk: kkRows,
            rekeningBelumDimapping: [],
            summary: {
                totalBaris,
                siap,
                dilewati: totalBaris - siap,
            },
        };
    } catch (error: any) {
        console.error("previewImportJurnal error:", error);

        return {
            success: false,
            message: error?.message || "Gagal membaca file Excel.",
            ci: [],
            co: [],
            kk: [],
            rekeningBelumDimapping: [],
            summary: {
                totalBaris: 0,
                siap: 0,
                dilewati: 0,
            },
        };
    }
}

/* ============================================================
 * ACTION: COMMIT IMPORT (baris yang sudah dikonfirmasi user)
 * ============================================================ */

async function resolvePihakId(namaPihak: string): Promise<number | null> {
    const nama = (namaPihak || "").trim();
    if (!nama) return null;

    const [rows]: any = await db.query(
        "SELECT id FROM tb_penerima WHERE LOWER(nama_penerima) = LOWER(?) LIMIT 1",
        [nama]
    );
    if (rows.length > 0) return Number(rows[0].id);

    const [insertResult]: any = await db.query(
        "INSERT INTO tb_penerima (nama_penerima) VALUES (?)",
        [nama]
    );
    return Number(insertResult.insertId);
}

async function resolvePemohonId(
    namaPemohon: string
): Promise<number | null> {
    const nama = (namaPemohon || "").trim();

    if (!nama) return null;

    const [rows]: any = await db.query(
        `SELECT id
         FROM tb_pemohon
         WHERE LOWER(nama_pemohon) = LOWER(?)
         LIMIT 1`,
        [nama]
    );

    if (rows.length > 0) {
        return Number(rows[0].id);
    }

    const [insertResult]: any = await db.query(
        `INSERT INTO tb_pemohon (nama_pemohon)
         VALUES (?)`,
        [nama]
    );

    return Number(insertResult.insertId);
}

export async function commitImportJurnal(rows: ImportPreviewRow[]) {
    const hasil = {
        berhasil: 0,
        gagal: 0,
        duplikat: 0,
        pesanGagal: [] as string[],
    };

    for (const row of rows) {
        if (
            row.status !== "siap" ||
            !row.noAkunKasBank ||
            !row.noAkunLawan
        ) {
            hasil.gagal++;
            hasil.pesanGagal.push(
                `${row.noRegistrasi}: baris tidak siap untuk diimpor`
            );
            continue;
        }

        try {
            const penerimaId = await resolvePihakId(row.namaPihak);

            const pemohonId =
                row.jenis === "CI" || row.jenis === "CO"
                    ? await resolvePemohonId(row.namaPemohon)
                    : null;

            const items =
                row.jenis === "CI"
                    ? [
                        {
                            accountCode: row.noAkunKasBank,
                            debit: row.nominal,
                            kredit: 0,
                            keterangan: row.keterangan,
                        },
                        {
                            accountCode: row.noAkunLawan,
                            debit: 0,
                            kredit: row.nominal,
                            keterangan: row.keterangan,
                        },
                    ]
                    : [
                        {
                            accountCode: row.noAkunLawan,
                            debit: row.nominal,
                            kredit: 0,
                            keterangan: row.keterangan,
                        },
                        {
                            accountCode: row.noAkunKasBank,
                            debit: 0,
                            kredit: row.nominal,
                            keterangan: row.keterangan,
                        },
                    ];

            const result = await createJurnalUmum({
                tanggal: row.tanggal,
                noRegistrasi: row.noRegistrasi,
                noReferensi: "",
                penerimaId,
                pemohonId,
                keterangan:
                    row.keterangan ||
                    (row.jenis === "CI"
                        ? "Import Pemasukan (CI)"
                        : row.jenis === "CO"
                            ? "Import Pengeluaran (CO)"
                            : "Import Petty Cash (KK)"),
                items,
            });

            if (result.success) {
                hasil.berhasil++;
            } else if (
                result.message?.includes("sudah ada di jurnal")
            ) {
                hasil.duplikat++;
            } else {
                hasil.gagal++;
                hasil.pesanGagal.push(
                    `${row.noRegistrasi}: ${result.message}`
                );
            }
        } catch (error: any) {
            hasil.gagal++;
            hasil.pesanGagal.push(
                `${row.noRegistrasi}: ${error.message}`
            );
        }
    }

    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");

    return {
        success: hasil.gagal === 0,
        message:
            `Import selesai. Berhasil: ${hasil.berhasil}, ` +
            `Duplikat: ${hasil.duplikat}, ` +
            `Gagal: ${hasil.gagal}.` +
            (
                hasil.duplikat > 0
                    ? ` ${hasil.duplikat} transaksi sudah pernah ada di jurnal dan tidak dimasukkan kembali.`
                    : ""
            ),
        ...hasil,
    };
}

/* ============================================================
 * CATATAN: MAPPING REKENING -> AKUN KAS/BANK
 * ============================================================
 * Mapping tidak disimpan di DB, cukup edit konstanta REKENING_MAPPING di
 * bagian atas file ini kalau ada nama rekening baru yang belum termapping,
 * lalu redeploy. Halaman preview import akan menampilkan daftar nama
 * rekening yang belum ada di mapping tersebut.
 */