"use server";

import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createJurnalUmum } from "@/app/actions/jurnal";
import { findBestMatch, FuzzyCandidate } from "@/lib/fuzzyMatch";
import type { ImportPreviewRow, ImportPreviewResult } from "@/app/actions/import-jurnal.types";

/* ============================================================
 * MAPPING REKENING -> AKUN KAS/BANK
 * ============================================================ */
const REKENING_MAPPING: Record<string, string> = {
    "pasif": "11300",       // Pasif
    "aktif": "11200",       // Aktif
    "pelatihan": "99-0001", // Rekening Pelatihan
};

const AKUN_KAS_KECIL = "11100";
const AKUN_PIUTANG_USAHA = "12100";
const NAMA_PENERIMA_CI = "PT Peduli Lestari Indonesia";

/* ============================================================
 * HELPER: BACA SHEET EXCEL SECARA DINAMIS
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
                const noRegistrasi = toText(getCellValue(row, headerMap, "Nomor Register"));
                if (!noRegistrasi) continue;

                const tanggal = toDateString(getCellValue(row, headerMap, "Tanggal"));
                const rekeningExcel = toText(getCellValue(row, headerMap, "Rekening"));
                const namaPemohon = toText(getCellValue(row, headerMap, "Nama Pengirim"));
                const debit = toNumber(getCellValue(row, headerMap, "Debit"));
                const detail = toText(getCellValue(row, headerMap, "Detail"));
                const perusahaan = toText(getCellValue(row, headerMap, "Perusahaan"));
                const teksSumberLawan = toText(getCellValue(row, headerMap, "Jenis Pekerjaan", "Divisi"));

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
                    keterangan: [detail, perusahaan].filter(Boolean).join(" - "),
                    status: "siap",
                };

                if (!tanggal) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Tanggal tidak valid";
                } else if (!noAkunKasBank) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = `Rekening "${rekeningExcel}" belum dimapping ke akun Kas/Bank`;
                } else if (debit <= 0) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Nominal debit kosong / nol";
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
                const noRegistrasi = toText(getCellValue(row, headerMap, "Nomor Register")); 
                if (!noRegistrasi) continue;

                const tanggal = toDateString(getCellValue(row, headerMap, "Tanggal"));
                const rekeningExcel = toText(getCellValue(row, headerMap, "Rekening"));
                const penerima = toText(getCellValue(row, headerMap, "Penerima"));
                const pemohon = toText(getCellValue(row, headerMap, "User"));
                const kredit = toNumber(getCellValue(row, headerMap, "Kredit"));
                const keteranganExcel = toText(getCellValue(row, headerMap, "Keterangan"));
                const kelompokBiaya = toText(getCellValue(row, headerMap, "Kelompok Biaya"));
                const jenisBiaya = toText(getCellValue(row, headerMap, "Jenis Biaya"));

                const rekeningKey = rekeningExcel.toLowerCase();
                const noAkunKasBank = REKENING_MAPPING[rekeningKey] || null;

                let noAkunLawan: string | null = null;
                let namaAkunLawan: string | null = null;
                let skorMatchLawan: number | null = null;

                try {
                    if (kelompokBiaya.trim().toLowerCase() === "rab" && jenisBiaya.trim().toLowerCase() === "pelatihan") {
                        noAkunLawan = "99-0001";
                        namaAkunLawan = "Pelatihan";
                        skorMatchLawan = 1;
                    } else {
                        let matchKelompok: any = null;
                        if (kelompokBiaya) {
                            matchKelompok = findBestMatch(kelompokBiaya, kandidatKelompok, 0.30, 0.05);
                        }

                        if (!matchKelompok && kelompokBiaya) {
                            const searchK = kelompokBiaya.toLowerCase();
                            const foundK = kelompokRows.find((k: any) => 
                                k && k.kelompok_biaya && (k.kelompok_biaya.toLowerCase().includes(searchK) || searchK.includes(k.kelompok_biaya.toLowerCase()))
                            );
                            if (foundK) {
                                matchKelompok = { item: foundK, score: 0.8 };
                            } else if (kelompokRows.length > 0) {
                                matchKelompok = { item: kelompokRows[0], score: 0.4 };
                            }
                        }

                        if (matchKelompok && matchKelompok.item) {
                            const namaKelompokTarget = matchKelompok.item.kelompok_biaya;
                            const akunDalamKelompok = akunRows.filter(
                                (a: any) => a && a.nama_kelompok === namaKelompokTarget
                            );

                            if (akunDalamKelompok.length > 0) {
                                const kandidatAkun: FuzzyCandidate<any>[] = akunDalamKelompok.map((a: any) => ({
                                    item: a,
                                    label: a.nama_akun || "",
                                }));

                                let matchAkun: any = null;
                                if (jenisBiaya) {
                                    matchAkun = findBestMatch(jenisBiaya, kandidatAkun, 0.30, 0.05);
                                }

                                if (!matchAkun && jenisBiaya) {
                                    const searchJ = jenisBiaya.toLowerCase();
                                    const foundA = akunDalamKelompok.find((a: any) => 
                                        (a.nama_akun && a.nama_akun.toLowerCase().includes(searchJ)) ||
                                        searchJ.includes(a.nama_akun ? a.nama_akun.toLowerCase() : "")
                                    );
                                    if (foundA) {
                                        matchAkun = { item: foundA, score: 0.7 };
                                    }
                                }

                                if (!matchAkun && akunDalamKelompok.length > 0) {
                                    matchAkun = { item: akunDalamKelompok[0], score: 0.5 };
                                }

                                if (matchAkun && matchAkun.item) {
                                    noAkunLawan = matchAkun.item.no_akun || null;
                                    namaAkunLawan = matchAkun.item.nama_akun || null;
                                    skorMatchLawan = Number((matchAkun.score ?? 0.5).toFixed(2));
                                }
                            }
                        }
                    }
                } catch (matchErr) {
                    console.error("Match error on CO row:", matchErr);
                }

                const preview: ImportPreviewRow = {
                    rowKey: `CO-${r}`,
                    jenis: "CO",
                    noRegistrasi: String(noRegistrasi).trim(),
                    tanggal: tanggal || "",
                    rekeningExcel,
                    noAkunKasBank,
                    namaPemohon: pemohon,
                    skorMatchRekening: noAkunKasBank ? 1 : null, 
                    namaPihak: penerima,
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
                const noRegistrasi = toText(getCellValue(row, headerMap, "No Register", "Nomor Register"));
                if (!noRegistrasi || !noRegistrasi.toUpperCase().startsWith("KK")) continue;

                const tanggal = toDateString(getCellValue(row, headerMap, "Tanggal"));
                const kelompokBiaya = toText(getCellValue(row, headerMap, "Kelompok Biaya"));
                const jenisBiaya = toText(getCellValue(row, headerMap, "Jenis Biaya"));
                const keterangan = toText(getCellValue(row, headerMap, "Keterangan"));
                const kredit = toNumber(getCellValue(row, headerMap, "Kredit"));

                let noAkunLawan: string | null = null;
                let namaAkunLawan: string | null = null;
                let skorMatchLawan: number | null = null;

                try {
                    if (kelompokBiaya.trim().toLowerCase() === "rab" && jenisBiaya.trim().toLowerCase() === "pelatihan") {
                        noAkunLawan = "99-0001";
                        namaAkunLawan = "Pelatihan";
                        skorMatchLawan = 1;
                    } else {
                        let matchKelompok: any = null;
                        if (kelompokBiaya) {
                            matchKelompok = findBestMatch(kelompokBiaya, kandidatKelompok, 0.30, 0.05);
                        }

                        if (matchKelompok && matchKelompok.item) {
                            const namaKelompokTarget = matchKelompok.item.kelompok_biaya;
                            const akunDalamKelompok = akunRows.filter(
                                (a: any) => a && a.nama_kelompok === namaKelompokTarget
                            );

                            if (akunDalamKelompok.length > 0) {
                                const kandidatAkun: FuzzyCandidate<any>[] = akunDalamKelompok.map((a: any) => ({
                                    item: a,
                                    label: a.nama_akun || "",
                                }));

                                let matchAkun: any = null;
                                if (jenisBiaya) {
                                    matchAkun = findBestMatch(jenisBiaya, kandidatAkun, 0.30, 0.05);
                                }

                                if (!matchAkun && akunDalamKelompok.length > 0) {
                                    matchAkun = { item: akunDalamKelompok[0], score: 0.5 };
                                }

                                if (matchAkun && matchAkun.item) {
                                    noAkunLawan = matchAkun.item.no_akun || null;
                                    namaAkunLawan = matchAkun.item.nama_akun || null;
                                    skorMatchLawan = Number((matchAkun.score ?? 0.5).toFixed(2));
                                }
                            }
                        }
                    }
                } catch (matchErr) {
                    console.error("Match error on KK row:", matchErr);
                }

                const preview: ImportPreviewRow = {
                    rowKey: `KK-${r}`,
                    jenis: "KK",
                    noRegistrasi: String(noRegistrasi).trim(),
                    tanggal: tanggal || "",
                    rekeningExcel: "Kas Kecil",
                    noAkunKasBank: AKUN_KAS_KECIL,
                    skorMatchRekening: 1,
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
                    preview.alasanDilewati = `Tidak ditemukan akun beban yang cocok untuk kelompok biaya "${kelompokBiaya || "(kosong)"}"`;
                } else if (kredit <= 0) {
                    preview.status = "dilewati";
                    preview.alasanDilewati = "Nominal kredit kosong / nol";
                }

                kkRows.push(preview);
            }
        }

        const semuaRows = [...ciRows, ...coRows, ...kkRows];
        const totalBaris = semuaRows.length;
        const siap = semuaRows.filter((r) => r.status === "siap").length;

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
            summary: { totalBaris: 0, siap: 0, dilewati: 0 },
        };
    }
}

/* ============================================================
 * ACTION: COMMIT IMPORT (DENGAN GROUPING BERDASARKAN NOMOR REGISTER)
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

async function resolvePemohonId(namaPemohon: string): Promise<number | null> {
    const nama = (namaPemohon || "").trim();
    if (!nama) return null;

    const [rows]: any = await db.query(
        `SELECT id FROM tb_pemohon WHERE LOWER(nama_pemohon) = LOWER(?) LIMIT 1`,
        [nama]
    );
    if (rows.length > 0) return Number(rows[0].id);

    const [insertResult]: any = await db.query(
        `INSERT INTO tb_pemohon (nama_pemohon) VALUES (?)`,
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

    // Kelompokkan baris berdasarkan Jenis dan Nomor Register yang sama
    const groupedMap = new Map<string, ImportPreviewRow[]>();

    for (const row of rows) {
        if (row.status !== "siap" || !row.noAkunKasBank || !row.noAkunLawan) {
            hasil.gagal++;
            hasil.pesanGagal.push(`${row.noRegistrasi || 'Baris'}: baris tidak siap untuk diimpor`);
            continue;
        }

        const groupKey = `${row.jenis}:${row.noRegistrasi}`;
        if (!groupedMap.has(groupKey)) {
            groupedMap.set(groupKey, []);
        }
        groupedMap.get(groupKey)!.push(row);
    }

    // Proses setiap grup sebagai 1 transaksi jurnal tunggal dengan banyak items
    for (const [groupKey, groupRows] of groupedMap.entries()) {
        const firstRow = groupRows[0];
        try {
            const penerimaId = await resolvePihakId(firstRow.namaPihak);
            const pemohonId = firstRow.jenis === "CI" || firstRow.jenis === "CO" ? await resolvePemohonId(firstRow.namaPemohon) : null;

            const items: any[] = [];
            let totalNominal = 0;

            if (firstRow.jenis === "CI") {
                // Untuk Kas Masuk (CI): Akun Kas/Bank didebit total, akun lawan dikredit per baris
                for (const r of groupRows) {
                    items.push({
                        accountCode: r.noAkunLawan,
                        debit: 0,
                        kredit: r.nominal,
                        keterangan: r.keterangan,
                    });
                    totalNominal += r.nominal;
                }
                items.unshift({
                    accountCode: firstRow.noAkunKasBank,
                    debit: totalNominal,
                    kredit: 0,
                    keterangan: firstRow.keterangan || "Import Pemasukan (CI)",
                });
            } else {
                // Untuk Kas Keluar (CO) & Petty Cash (KK): Akun beban didebit per baris, Kas/Bank dikredit total
                for (const r of groupRows) {
                    items.push({
                        accountCode: r.noAkunLawan,
                        debit: r.nominal,
                        kredit: 0,
                        keterangan: r.keterangan,
                    });
                    totalNominal += r.nominal;
                }
                items.push({
                    accountCode: firstRow.noAkunKasBank,
                    debit: 0,
                    kredit: totalNominal,
                    keterangan: firstRow.keterangan || (firstRow.jenis === "CO" ? "Import Pengeluaran (CO)" : "Import Petty Cash (KK)"),
                });
            }

            const result = await createJurnalUmum({
                tanggal: firstRow.tanggal,
                noRegistrasi: firstRow.noRegistrasi,
                noReferensi: "",
                penerimaId,
                pemohonId,
                keterangan: firstRow.keterangan || (firstRow.jenis === "CI" ? "Import Pemasukan (CI)" : firstRow.jenis === "CO" ? "Import Pengeluaran (CO)" : "Import Petty Cash (KK)"),
                items,
            });

            if (result.success) {
                hasil.berhasil++;
            } else if (result.message?.includes("sudah ada di jurnal")) {
                hasil.duplikat++;
            } else {
                hasil.gagal++;
                hasil.pesanGagal.push(`${firstRow.noRegistrasi}: ${result.message}`);
            }
        } catch (error: any) {
            hasil.gagal++;
            hasil.pesanGagal.push(`${firstRow.noRegistrasi}: ${error.message}`);
        }
    }

    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");

    return {
        success: hasil.gagal === 0,
        message: `Import selesai. Berhasil: ${hasil.berhasil}, Duplikat: ${hasil.duplikat}, Gagal: ${hasil.gagal}.`,
        ...hasil,
    };
}

//done