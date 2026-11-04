"use server";

import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
    createJurnalUmum,
    createJurnalDenganReferensiInvoiceOnly,
} from "@/app/actions/jurnal";
import {
    findBestMatch,
    FuzzyCandidate,
} from "@/lib/fuzzyMatch";
import type {
    ImportPreviewRow,
    ImportPreviewResult,
} from "@/app/actions/import-jurnal.types";

/* ============================================================
 * MAPPING REKENING -> AKUN KAS/BANK
 * ============================================================ */
const NAMA_PENERIMA_CI = "PT Peduli Lestari Indonesia";
const REKENING_MAPPING: Record<string, string> = {
    pasif: "11300",
    aktif: "11200",
    pelatihan: "99-0001",
};

const AKUN_KAS_KECIL = "11100";
const AKUN_PIUTANG_USAHA = "12100";

/* ============================================================
 * HELPER: BACA EXCEL BERDASARKAN PREFIX NO REGISTER
 *
 *   BD_...  -> CI  (pemasukan)
 *   BK_...  -> CO  (pengeluaran)
 *   KK_...  -> KK  (petty cash)
 *
 * Nama sheet tidak lagi dipakai. Semua sheet dibaca, lalu tiap
 * baris diklasifikasikan dari prefix nomor register-nya.
 * ============================================================ */

type JenisJurnal = "CI" | "CO" | "KK";

const PREFIX_JENIS: Record<string, JenisJurnal> = {
    BD: "CI",
    BK: "CO",
    KK: "KK",
};

function detectJenisFromRegister(noRegistrasi: string): JenisJurnal | null {
    const m = noRegistrasi
        .trim()
        .toUpperCase()
        .match(/^(BD|BK|KK)[_\-\s]/);

    return m ? PREFIX_JENIS[m[1]] : null;
}

function normalizeHeader(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[.\s_-]+/g, " ");
}

const HEADER_NO_REGISTER = [
    "nomor register",
    "no register",
    "nomor registrasi",
    "no registrasi",
];

// Versi aman: tidak melempar error. Sheet tanpa header (cover, rekap) dilewati.
function tryFindHeaderRowIndex(worksheet: ExcelJS.Worksheet): number {
    for (let r = 1; r <= 10; r++) {
        let found = false;

        worksheet.getRow(r).eachCell((cell) => {
            if (HEADER_NO_REGISTER.includes(normalizeHeader(cell.value))) {
                found = true;
            }
        });

        if (found) return r;
    }

    return -1;
}

function buildHeaderMap(
    worksheet: ExcelJS.Worksheet,
    headerRowIdx: number
): Map<string, number> {
    const map = new Map<string, number>();
    const row = worksheet.getRow(headerRowIdx);

    row.eachCell((cell, colNumber) => {
        const key = normalizeHeader(cell.value);

        if (key) {
            map.set(key, colNumber);
        }
    });

    return map;
}

function getCellValue(
    row: ExcelJS.Row,
    headerMap: Map<string, number>,
    ...headerNames: string[]
): any {
    for (const name of headerNames) {
        const col = headerMap.get(normalizeHeader(name));

        if (col !== undefined) {
            const val = row.getCell(col).value;

            if (
                val !== null &&
                val !== undefined &&
                String(val).trim() !== ""
            ) {
                return val;
            }
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

    if (typeof value === "object" && (value as any).result !== undefined) {
        return toNumber((value as any).result);
    }

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

        if (value.hyperlink !== undefined) {
            return String(value.text ?? value.hyperlink).trim();
        }
    }

    return String(value).trim();
}

interface BarisExcel {
    sheet: ExcelJS.Worksheet;
    headerMap: Map<string, number>;
    row: ExcelJS.Row;
    r: number;
    noRegistrasi: string;
}

function collectRowsByRegisterPrefix(
    workbook: ExcelJS.Workbook
): Record<JenisJurnal, BarisExcel[]> {
    const hasil: Record<JenisJurnal, BarisExcel[]> = {
        CI: [],
        CO: [],
        KK: [],
    };

    for (const sheet of workbook.worksheets) {
        const headerRowIdx = tryFindHeaderRowIndex(sheet);

        if (headerRowIdx < 0) {
            console.log(
                `SHEET DILEWATI (tanpa header register): ${sheet.name}`
            );
            continue;
        }

        const headerMap = buildHeaderMap(sheet, headerRowIdx);

        for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);

            const noRegistrasi = toText(
                getCellValue(row, headerMap, ...HEADER_NO_REGISTER)
            );

            if (!noRegistrasi) continue;

            const jenis = detectJenisFromRegister(noRegistrasi);

            if (!jenis) {
                console.log(
                    `BARIS DIABAIKAN (prefix tidak dikenal): ${sheet.name} baris ${r} -> "${noRegistrasi}"`
                );
                continue;
            }

            hasil[jenis].push({ sheet, headerMap, row, r, noRegistrasi });
        }
    }

    return hasil;
}

/* ============================================================
 * HELPER: AKUN PIUTANG (CI)
 * ============================================================ */

/**
 * Tentukan piutang berdasarkan kolom terkait transaksi, bukan default
 * Piutang Usaha jika ada indikasi pegawai.
 * Nama akun dan nomor akun tetap diambil dari COA aktif (tb_akun).
 */
function resolveAkunPiutang(
    akunRows: any[],
    sumber: string,
    jenisPiutangExcel: string
): {
    noAkun: string | null;
    namaAkun: string | null;
    skor: number | null;
    jenis: "pegawai" | "usaha";
} {
    const teks = normalizeHeader(sumber);
    const jenisPiutang = normalizeHeader(jenisPiutangExcel);
    // Mendeteksi "Pegawai" / "Karyawan" tanpa harus diawali "Piutang".
    // Juga mendukung penulisan "Piutang Kpd Pegawai" / "Piutang pada Pegawai".
    const penandaPegawai = /\b(pegawai|karyawan|employee|staff)\b/i;
    const isPiutangPegawai =
        penandaPegawai.test(jenisPiutang) ||
        penandaPegawai.test(teks);

    const akunPiutang = akunRows.filter((akun: any) =>
        /\bpiutang\b/i.test(normalizeHeader(akun?.nama_akun))
    );

    if (isPiutangPegawai) {
        const akunPegawai = akunPiutang.find((akun: any) =>
            penandaPegawai.test(normalizeHeader(akun?.nama_akun))
        );

        // Jangan fallback ke Piutang Usaha saat akun pegawai tidak ditemukan.
        return {
            noAkun:
                akunPegawai?.no_akun != null
                    ? String(akunPegawai.no_akun)
                    : null,
            namaAkun: akunPegawai?.nama_akun || null,
            skor: akunPegawai ? 1 : null,
            jenis: "pegawai",
        };
    }

    const akunUsaha = akunPiutang.find((akun: any) =>
        /\bpiutang\s+usaha\b/i.test(normalizeHeader(akun?.nama_akun))
    );

    return {
        noAkun:
            akunUsaha?.no_akun != null
                ? String(akunUsaha.no_akun)
                : AKUN_PIUTANG_USAHA,
        namaAkun: akunUsaha?.nama_akun || "Piutang Usaha",
        skor: 1,
        jenis: "usaha",
    };
}

/* ============================================================
 * HELPER: AKUN BEBAN UNTUK PETTY CASH (KK)
 *
 * Di sheet petty cash:
 *   - "Kelompok Biaya" = nama kelompok (mis. Biaya Operasional Kantor)
 *   - "Jenis Biaya"    = nama akun (mis. ATK, Ekspedisi)
 *
 * Nama akun yang sama ada di banyak kelompok (ATK, Ekspedisi,
 * Kendaraan dan Transportasi), jadi akun dicari DI DALAM kelompok
 * yang cocok, sama seperti alur CO. Bedanya, tidak ada fallback
 * "ambil yang pertama": kalau tidak cocok, baris dilewati.
 * ============================================================ */

const norm = (s: unknown) =>
    String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function cariAkunBeban(
    kelompokBiaya: string,
    jenisBiaya: string,
    kelompokRows: any[],
    akunRows: any[],
    kandidatKelompok: FuzzyCandidate<any>[]
): { noAkun: string; namaAkun: string; skor: number } | null {
    const namaAkunCari = jenisBiaya || "";

    if (!namaAkunCari) return null;

    // 1) Tentukan kelompok: exact -> fuzzy -> includes
    const kn = norm(kelompokBiaya);

    let kelompok: any =
        kelompokRows.find((k: any) => norm(k?.kelompok_biaya) === kn) ?? null;

    if (!kelompok && kn) {
        const m: any = findBestMatch(
            kelompokBiaya,
            kandidatKelompok,
            0.30,
            0.05
        );
        kelompok = m?.item ?? null;
    }

    if (!kelompok && kn) {
        kelompok =
            kelompokRows.find((k: any) => {
                const n = norm(k?.kelompok_biaya);
                return n && (n.includes(kn) || kn.includes(n));
            }) ?? null;
    }

    // 2) Cari akun di dalam kelompok itu: exact -> fuzzy -> includes
    if (kelompok) {
        const target = norm(kelompok.kelompok_biaya);

        const dalamKelompok = akunRows.filter(
            (a: any) => norm(a?.nama_kelompok) === target
        );

        const an = norm(namaAkunCari);

        const persis = dalamKelompok.find(
            (a: any) => norm(a?.nama_akun) === an
        );

        if (persis) {
            return {
                noAkun: String(persis.no_akun),
                namaAkun: persis.nama_akun,
                skor: 1,
            };
        }

        const fuzzy: any = findBestMatch(
            namaAkunCari,
            dalamKelompok.map((a: any) => ({
                item: a,
                label: a.nama_akun || "",
            })),
            0.30,
            0.05
        );

        if (fuzzy?.item) {
            return {
                noAkun: String(fuzzy.item.no_akun),
                namaAkun: fuzzy.item.nama_akun,
                skor: Number((fuzzy.score ?? 0.5).toFixed(2)),
            };
        }

        const mengandung = dalamKelompok.find((a: any) => {
            const n = norm(a?.nama_akun);
            return n && (n.includes(an) || an.includes(n));
        });

        if (mengandung) {
            return {
                noAkun: String(mengandung.no_akun),
                namaAkun: mengandung.nama_akun,
                skor: 0.7,
            };
        }
    }

    // 3) Cadangan: nama akun unik di seluruh COA
    const samaNama = akunRows.filter(
        (a: any) => norm(a?.nama_akun) === norm(namaAkunCari)
    );

    if (samaNama.length === 1) {
        return {
            noAkun: String(samaNama[0].no_akun),
            namaAkun: samaNama[0].nama_akun,
            skor: 0.8,
        };
    }

    return null;
}

/* ============================================================
 * HELPER: CEK NO REGISTER YANG SUDAH ADA DI JURNAL
 *
 * SESUAIKAN dua konstanta di bawah dengan tabel/kolom yang dipakai
 * createJurnalUmum saat menghasilkan pesan "sudah ada di jurnal".
 * ============================================================ */

const TABEL_JURNAL = "tb_jurnal";
const KOLOM_NO_REGISTRASI = "no_registrasi";

const normNo = (s: unknown) => String(s ?? "").trim().toLowerCase();

async function ambilNoRegistrasiSudahAda(
    daftarNo: string[]
): Promise<Set<string>> {
    const hasil = new Set<string>();

    const unik = [
        ...new Set(
            daftarNo.map((n) => String(n ?? "").trim()).filter(Boolean)
        ),
    ];

    try {
        for (let i = 0; i < unik.length; i += 500) {
            const potongan = unik.slice(i, i + 500);

            const [rows]: any = await db.query(
                `SELECT DISTINCT ${KOLOM_NO_REGISTRASI} AS no_reg
                 FROM ${TABEL_JURNAL}
                 WHERE ${KOLOM_NO_REGISTRASI} IN (?)`,
                [potongan]
            );

            for (const r of rows) {
                hasil.add(normNo(r.no_reg));
            }
        }
    } catch (err) {
        // Jangan menggagalkan preview/impor kalau pengecekan ini error.
        // createJurnalUmum tetap menolak duplikat saat penyimpanan.
        console.error(
            "ambilNoRegistrasiSudahAda gagal (cek TABEL_JURNAL / KOLOM_NO_REGISTRASI):",
            err
        );
    }

    return hasil;
}

/* ============================================================
 * ACTION: PREVIEW IMPORT
 * ============================================================ */

export async function previewImportJurnal(
    base64File: string
): Promise<ImportPreviewResult> {
    console.log("PREVIEW IMPORT JURNAL TERPANGGIL");

    try {
        const buffer = Buffer.from(base64File, "base64");
        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.load(buffer as any);

        console.log(
            "DAFTAR SHEET:",
            workbook.worksheets.map((sheet) => sheet.name)
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
            penerimaRows.map((p: any) =>
                String(p.nama_penerima).trim().toLowerCase()
            )
        );

        const kandidatKelompok: FuzzyCandidate<any>[] =
            kelompokRows.map((k: any) => ({
                item: k,
                label: k.kelompok_biaya,
            }));

        // Klasifikasi semua baris dari semua sheet berdasarkan prefix register.
        const barisPerJenis = collectRowsByRegisterPrefix(workbook);

        console.log("JUMLAH BARIS:", {
            CI: barisPerJenis.CI.length,
            CO: barisPerJenis.CO.length,
            KK: barisPerJenis.KK.length,
        });

        /* -------- PARSE CI (prefix BD_) -------- */

        const ciRows: ImportPreviewRow[] = [];

        for (const { sheet, headerMap, row, r, noRegistrasi } of barisPerJenis.CI) {
            const tanggal = toDateString(
                getCellValue(row, headerMap, "Tanggal")
            );

            const rekeningExcel = toText(
                getCellValue(row, headerMap, "Rekening")
            );

            const namaPengirim = toText(
                getCellValue(row, headerMap, "Nama Pengirim")
            );

            const perusahaan = toText(
                getCellValue(row, headerMap, "Perusahaan")
            );

            // Nama pemohon CI digabung dari perusahaan dan nama pengirim.
            const namaPemohon = [perusahaan, namaPengirim]
                .filter(Boolean)
                .join(" - ");

            const debit = toNumber(
                getCellValue(row, headerMap, "Debit")
            );

            const detail = toText(
                getCellValue(row, headerMap, "Detail")
            );

            const noReferensi = toText(
                getCellValue(
                    row,
                    headerMap,
                    "No Referensi",
                    "No. Referensi",
                    "Nomor Referensi",
                    "No Reference",
                    "Reference"
                )
            );

            console.log(`CI ROW ${sheet.name}#${r}:`, {
                noRegistrasi,
                noReferensi,
            });

            const teksSumberLawan = toText(
                getCellValue(
                    row,
                    headerMap,
                    "Jenis Pekerjaan",
                    "Divisi",
                    "Kategori",
                    "Kategori Transaksi",
                    "Jenis Transaksi"
                )
            );

            const akunPiutangExcel = toText(
                getCellValue(
                    row,
                    headerMap,
                    "Jenis Piutang",
                    "Akun Lawan",
                    "Nama Akun Piutang",
                    "Akun Piutang",
                    "Nama Akun Lawan",
                    "Kode Akun Lawan"
                )
            );

            // Baca penanda akun dari kolom khusus maupun detail transaksi.
            // Bila terdeteksi pegawai/karyawan, wajib dicocokkan ke akun
            // Piutang Pegawai agar tidak jatuh ke Piutang Usaha.
            const indikasiPiutang = toText(
                getCellValue(
                    row,
                    headerMap,
                    "Keterangan",
                    "Uraian",
                    "Keterangan Transaksi"
                )
            );

            // Deteksi label eksplisit di sel lain meskipun nama header berubah.
            const nilaiSel = Array.isArray(row.values)
                ? row.values.slice(1)
                : Object.values(row.values);
            const labelPiutangDariSel = nilaiSel
                .map((value) => toText(value))
                .filter((value) =>
                    /piutang[\s\W]*(pegawai|karyawan|employee|staff)/i.test(
                        value
                    )
                )
                .join(" ");

            const sumberAkunPiutang = [
                teksSumberLawan,
                detail,
                indikasiPiutang,
                labelPiutangDariSel,
            ]
                .filter(Boolean)
                .join(" ");

            const akunPiutang = resolveAkunPiutang(
                akunRows,
                sumberAkunPiutang,
                akunPiutangExcel
            );

            console.log(`DETEKSI PIUTANG CI ${sheet.name}#${r}:`, {
                teksSumberLawan,
                akunPiutangExcel,
                sumberAkunPiutang,
                terpilih: akunPiutang,
            });

            const rekeningKey = rekeningExcel.toLowerCase();
            const noAkunKasBank = REKENING_MAPPING[rekeningKey] || null;

            const preview: ImportPreviewRow = {
                rowKey: `CI-${sheet.id}-${r}`,
                jenis: "CI",
                noRegistrasi: String(noRegistrasi).trim(),
                noReferensi,
                tanggal: tanggal || "",
                rekeningExcel,
                noAkunKasBank,
                skorMatchRekening: noAkunKasBank ? 1 : null,
                // CI memakai Nama Pemohon dari Excel; jangan isi penerima
                // dengan nama perusahaan secara otomatis.
                namaPihak: NAMA_PENERIMA_CI,
                isPihakBaru: false,
                teksSumberLawan,
                namaPemohon,
                noAkunLawan: akunPiutang.noAkun,
                namaAkunLawan: akunPiutang.namaAkun,
                skorMatchLawan: akunPiutang.skor,
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
            } else if (!akunPiutang.noAkun) {
                preview.status = "dilewati";
                preview.alasanDilewati = `Akun Piutang Pegawai tidak ditemukan di daftar akun aktif untuk baris ${noRegistrasi}`;
            } else if (debit <= 0) {
                preview.status = "dilewati";
                preview.alasanDilewati = "Nominal debit kosong / nol";
            }

            ciRows.push(preview);
        }

        /* -------- PARSE CO (prefix BK_) -------- */

        const coRows: ImportPreviewRow[] = [];

        for (const { sheet, headerMap, row, r, noRegistrasi } of barisPerJenis.CO) {
            const tanggal = toDateString(
                getCellValue(row, headerMap, "Tanggal")
            );

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

            let noAkunLawan: string | null = null;
            let namaAkunLawan: string | null = null;
            let skorMatchLawan: number | null = null;

            try {
                if (
                    kelompokBiaya.trim().toLowerCase() === "rab" &&
                    jenisBiaya.trim().toLowerCase() === "pelatihan"
                ) {
                    noAkunLawan = "99-0001";
                    namaAkunLawan = "Pelatihan";
                    skorMatchLawan = 1;
                } else {
                    let matchKelompok: any = null;

                    if (kelompokBiaya) {
                        matchKelompok = findBestMatch(
                            kelompokBiaya,
                            kandidatKelompok,
                            0.30,
                            0.05
                        );
                    }

                    if (!matchKelompok && kelompokBiaya) {
                        const searchK = kelompokBiaya.toLowerCase();

                        const foundK = kelompokRows.find(
                            (k: any) =>
                                k &&
                                k.kelompok_biaya &&
                                (k.kelompok_biaya
                                    .toLowerCase()
                                    .includes(searchK) ||
                                    searchK.includes(
                                        k.kelompok_biaya.toLowerCase()
                                    ))
                        );

                        if (foundK) {
                            matchKelompok = {
                                item: foundK,
                                score: 0.8,
                            };
                        } else if (kelompokRows.length > 0) {
                            matchKelompok = {
                                item: kelompokRows[0],
                                score: 0.4,
                            };
                        }
                    }

                    if (matchKelompok?.item) {
                        const namaKelompokTarget =
                            matchKelompok.item.kelompok_biaya;

                        const akunDalamKelompok = akunRows.filter(
                            (a: any) =>
                                a && a.nama_kelompok === namaKelompokTarget
                        );

                        if (akunDalamKelompok.length > 0) {
                            const kandidatAkun: FuzzyCandidate<any>[] =
                                akunDalamKelompok.map((a: any) => ({
                                    item: a,
                                    label: a.nama_akun || "",
                                }));

                            let matchAkun: any = null;

                            if (jenisBiaya) {
                                matchAkun = findBestMatch(
                                    jenisBiaya,
                                    kandidatAkun,
                                    0.30,
                                    0.05
                                );
                            }

                            if (!matchAkun && jenisBiaya) {
                                const searchJ = jenisBiaya.toLowerCase();

                                const foundA = akunDalamKelompok.find(
                                    (a: any) =>
                                        (a.nama_akun &&
                                            a.nama_akun
                                                .toLowerCase()
                                                .includes(searchJ)) ||
                                        searchJ.includes(
                                            a.nama_akun
                                                ? a.nama_akun.toLowerCase()
                                                : ""
                                        )
                                );

                                if (foundA) {
                                    matchAkun = {
                                        item: foundA,
                                        score: 0.7,
                                    };
                                }
                            }

                            if (!matchAkun) {
                                matchAkun = {
                                    item: akunDalamKelompok[0],
                                    score: 0.5,
                                };
                            }

                            if (matchAkun?.item) {
                                noAkunLawan = matchAkun.item.no_akun || null;
                                namaAkunLawan =
                                    matchAkun.item.nama_akun || null;
                                skorMatchLawan = Number(
                                    (matchAkun.score ?? 0.5).toFixed(2)
                                );
                            }
                        }
                    }
                }
            } catch (matchErr) {
                console.error("Match error on CO row:", matchErr);
            }

            const preview: ImportPreviewRow = {
                rowKey: `CO-${sheet.id}-${r}`,
                jenis: "CO",
                noRegistrasi: String(noRegistrasi).trim(),
                tanggal: tanggal || "",
                noReferensi: "",
                rekeningExcel,
                noAkunKasBank,
                namaPemohon: pemohon,
                skorMatchRekening: noAkunKasBank ? 1 : null,
                namaPihak: penerima,
                isPihakBaru: penerima
                    ? !penerimaSet.has(penerima.toLowerCase())
                    : false,
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

        /* -------- PARSE PETTY CASH (prefix KK_) -------- */

        const kkRows: ImportPreviewRow[] = [];

        for (const { sheet, headerMap, row, r, noRegistrasi } of barisPerJenis.KK) {
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

            const kredit = toNumber(
                getCellValue(row, headerMap, "Kredit")
            );

            // Petty cash: akun dicari di dalam kelompok yang cocok.
            const akun = cariAkunBeban(
                kelompokBiaya,
                jenisBiaya,
                kelompokRows,
                akunRows,
                kandidatKelompok
            );

            let noAkunLawan: string | null = akun?.noAkun ?? null;
            let namaAkunLawan: string | null = akun?.namaAkun ?? null;
            let skorMatchLawan: number | null = akun?.skor ?? null;

            // Pengecualian RAB / Pelatihan tetap dipertahankan.
            if (
                kelompokBiaya.trim().toLowerCase() === "rab" &&
                jenisBiaya.trim().toLowerCase() === "pelatihan"
            ) {
                noAkunLawan = "99-0001";
                namaAkunLawan = "Pelatihan";
                skorMatchLawan = 1;
            }

            const preview: ImportPreviewRow = {
                rowKey: `KK-${sheet.id}-${r}`,
                jenis: "KK",
                noRegistrasi: String(noRegistrasi).trim(),
                tanggal: tanggal || "",
                noReferensi: "",
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
                preview.alasanDilewati = `Akun "${jenisBiaya || "(kosong)"}" tidak ditemukan di kelompok "${kelompokBiaya || "(kosong)"}"`;
            } else if (kredit <= 0) {
                preview.status = "dilewati";
                preview.alasanDilewati = "Nominal kredit kosong / nol";
            }

            kkRows.push(preview);
        }

        const semuaRows = [...ciRows, ...coRows, ...kkRows];

        // Tandai baris yang no register-nya sudah ada di jurnal.
        const sudahAda = await ambilNoRegistrasiSudahAda(
            semuaRows.map((row) => row.noRegistrasi)
        );

        for (const row of semuaRows) {
            if (sudahAda.has(normNo(row.noRegistrasi))) {
                row.isDuplikat = true;
                row.peringatan = `No register ${row.noRegistrasi} sudah ada di jurnal dan tidak akan diimpor ulang`;
            }
        }

        const totalBaris = semuaRows.length;
        const duplikat = semuaRows.filter((row) => row.isDuplikat).length;
        const siap = semuaRows.filter(
            (row) => row.status === "siap" && !row.isDuplikat
        ).length;

        console.log("TOTAL CI:", ciRows.length);
        console.log("TOTAL CO:", coRows.length);
        console.log("TOTAL KK:", kkRows.length);

        return {
            success: true,
            ci: ciRows,
            co: coRows,
            kk: kkRows,
            rekeningBelumDimapping: [],
            summary: {
                totalBaris,
                siap,
                duplikat,
                dilewati: totalBaris - siap - duplikat,
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
 * ACTION: COMMIT IMPORT
 * GROUPING BERDASARKAN JENIS DAN NOMOR REGISTER
 * ============================================================ */

async function resolvePihakId(namaPihak: string): Promise<number | null> {
    const nama = (namaPihak || "").trim();

    if (!nama) return null;

    const [rows]: any = await db.query(
        `SELECT id
         FROM tb_penerima
         WHERE LOWER(nama_penerima) = LOWER(?)
         LIMIT 1`,
        [nama]
    );

    if (rows.length > 0) {
        return Number(rows[0].id);
    }

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
        "INSERT INTO tb_pemohon (nama_pemohon) VALUES (?)",
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

    const groupedMap = new Map<string, ImportPreviewRow[]>();

    // Cek ulang ke database di server (jangan hanya percaya flag dari klien).
    const sudahAda = await ambilNoRegistrasiSudahAda(
        rows.map((row) => row.noRegistrasi)
    );
    const kunciDuplikat = new Set<string>();

    for (const row of rows) {
        if (sudahAda.has(normNo(row.noRegistrasi))) {
            kunciDuplikat.add(`${row.jenis}:${row.noRegistrasi}`);
            continue;
        }

        if (
            row.status !== "siap" ||
            !row.noAkunKasBank ||
            !row.noAkunLawan
        ) {
            hasil.gagal++;

            hasil.pesanGagal.push(
                `${row.noRegistrasi || "Baris"}: baris tidak siap untuk diimpor`
            );

            continue;
        }

        const groupKey = `${row.jenis}:${row.noRegistrasi}`;

        if (!groupedMap.has(groupKey)) {
            groupedMap.set(groupKey, []);
        }

        groupedMap.get(groupKey)!.push(row);
    }

    // Dihitung per jurnal (per no register), bukan per baris Excel.
    hasil.duplikat += kunciDuplikat.size;

    for (const [, groupRows] of groupedMap.entries()) {
        const firstRow = groupRows[0];

        try {
            const noReferensi = (firstRow.noReferensi || "").trim();

            console.log("COMMIT IMPORT:", {
                jenis: firstRow.jenis,
                noRegistrasi: firstRow.noRegistrasi,
                noReferensi,
            });

            if (
                firstRow.jenis === "CI" &&
                groupRows.some(
                    (row) => (row.noReferensi || "").trim() !== noReferensi
                )
            ) {
                hasil.gagal++;

                hasil.pesanGagal.push(
                    `${firstRow.noRegistrasi}: nomor referensi berbeda dalam satu grup jurnal CI.`
                );

                continue;
            }

            const penerimaId = await resolvePihakId(firstRow.namaPihak);

            const pemohonId =
                firstRow.jenis === "CI" || firstRow.jenis === "CO"
                    ? await resolvePemohonId(firstRow.namaPemohon)
                    : null;

            const items: any[] = [];
            let totalNominal = 0;

            if (firstRow.jenis === "CI") {
                // Pemasukan: kas/bank debit, piutang kredit.
                for (const row of groupRows) {
                    items.push({
                        accountCode: row.noAkunLawan,
                        debit: 0,
                        kredit: row.nominal,
                        keterangan: row.keterangan,
                    });

                    totalNominal += row.nominal;
                }

                items.unshift({
                    accountCode: firstRow.noAkunKasBank,
                    debit: totalNominal,
                    kredit: 0,
                    keterangan:
                        firstRow.keterangan || "Import Pemasukan (CI)",
                });
            } else {
                // Pengeluaran: akun lawan debit, kas/bank kredit.
                for (const row of groupRows) {
                    items.push({
                        accountCode: row.noAkunLawan,
                        debit: row.nominal,
                        kredit: 0,
                        keterangan: row.keterangan,
                    });

                    totalNominal += row.nominal;
                }

                items.push({
                    accountCode: firstRow.noAkunKasBank,
                    debit: 0,
                    kredit: totalNominal,
                    keterangan:
                        firstRow.keterangan ||
                        (firstRow.jenis === "CO"
                            ? "Import Pengeluaran (CO)"
                            : "Import Petty Cash (KK)"),
                });
            }

            const payload = {
                tanggal: firstRow.tanggal,
                noRegistrasi: firstRow.noRegistrasi,
                noReferensi,
                penerimaId,
                pemohonId,
                keterangan:
                    firstRow.keterangan ||
                    (firstRow.jenis === "CI"
                        ? "Import Pemasukan (CI)"
                        : firstRow.jenis === "CO"
                            ? "Import Pengeluaran (CO)"
                            : "Import Petty Cash (KK)"),
                items,
            };

            const result =
                firstRow.jenis === "CI" && noReferensi
                    ? await createJurnalDenganReferensiInvoiceOnly(payload)
                    : await createJurnalUmum(payload);

            if (result.success) {
                hasil.berhasil++;
            } else if (result.message?.includes("sudah ada di jurnal")) {
                hasil.duplikat++;
            } else {
                hasil.gagal++;

                hasil.pesanGagal.push(
                    `${firstRow.noRegistrasi}: ${result.message}`
                );
            }
        } catch (error: unknown) {
            hasil.gagal++;

            const pesan =
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan yang tidak diketahui.";

            hasil.pesanGagal.push(`${firstRow.noRegistrasi}: ${pesan}`);
        }
    }

    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    revalidatePath("/dashboard/finance/invoices");

    return {
        success: hasil.gagal === 0,
        message:
            `Import selesai. Berhasil: ${hasil.berhasil}, ` +
            `Duplikat: ${hasil.duplikat}, Gagal: ${hasil.gagal}.`,
        ...hasil,
    };
}