"use server";

import * as XLSX from "xlsx";
import { db } from "@/lib/db"; // mysql2/promise pool (lihat lib/db.ts kamu)
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// ============================================================================
// 1. PARSER — baca file xls mesin absensi (multi-sheet, 3 orang per sheet)
// ============================================================================

interface RawAttendanceRow {
  nama: string;
  fingerprintId: string; // ID di mesin absen — cuma buat debugging/log, TIDAK dipakai sbg nip
  tanggal: string; // "YYYY-MM-DD"
  jamMasuk: string | null; // "HH:mm"
  jamKeluar: string | null; // "HH:mm"
}

// Sheet ringkasan yang bukan berisi data per-orang, jadi dilewati
const SUMMARY_SHEETS = ["Jadwal Info", "Stat. Absen", "Lap. Log Absen", "Exception Stat."];

type Grid = any[][];

/** Cari cell pertama yang isinya persis `text`, dimulai dari fromRow, opsional dibatasi rentang kolom. */
function findCell(
  grid: Grid,
  text: string,
  fromRow = 0,
  colRange?: [number, number]
): { row: number; col: number } | null {
  for (let r = fromRow; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (colRange && (c < colRange[0] || c > colRange[1])) continue;
      if (typeof row[c] === "string" && row[c].trim() === text) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/** Cari SEMUA cell yang isinya persis `text` — dipakai untuk menemukan tiap blok "Nama" (= tiap orang). */
function findAllCells(grid: Grid, text: string): { row: number; col: number }[] {
  const hits: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] === "string" && row[c].trim() === text) {
        hits.push({ row: r, col: c });
      }
    }
  }
  return hits;
}

/**
 * Baris tanggal di file cuma berisi "20 RAB", "21 KAM", dst (tanggal + hari, tanpa bulan/tahun).
 * Bulan/tahun diambil dari header "Tgl Absen: 2026-05-20 ~ 2026-05-25".
 * Kalau periode melewati akhir bulan: dayOfMonth >= tanggal awal periode -> bulan awal,
 * kalau lebih kecil -> sudah masuk bulan periode akhir.
 */
function buildDateResolver(periodStart: string, periodEnd: string) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return (dayOfMonth: number): string => {
    const base = dayOfMonth >= start.getDate() ? start : end;
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(dayOfMonth).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
}

function normalizeJam(val: any): string | null {
  const s = String(val ?? "").trim();
  if (!s || s.toLowerCase() === "absen") return null;
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  return null;
}

/** Parse seluruh workbook (semua sheet, semua blok orang per sheet) jadi array flat. */
function parseAttendanceWorkbook(buffer: Buffer): RawAttendanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const results: RawAttendanceRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (SUMMARY_SHEETS.includes(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    const grid: Grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (!grid.length) continue;

    const tglCell = findCell(grid, "Tgl");
    let resolveDate = (d: number) => String(d); // fallback kalau format header beda dari yg diharapkan
    if (tglCell) {
      const periodRaw = String(grid[tglCell.row][tglCell.col + 1] || "").trim();
      const match = periodRaw.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
      if (match) resolveDate = buildDateResolver(match[1], match[2]);
    }

    const namaCells = findAllCells(grid, "Nama");

    for (const { row: namaRow, col: namaCol } of namaCells) {
      const nama = String(grid[namaRow]?.[namaCol + 1] || "").trim();
      if (!nama) continue;

      const idRow = namaRow + 1; // baris "ID" tepat di bawah baris "Nama"
      const fingerprintId = String(grid[idRow]?.[namaCol + 1] || "").trim();

      // "Minggu Tgl" untuk blok ini dicari di sekitar kolom namaCol (blok bisa geser tiap sheet)
      const minggu = findCell(grid, "Minggu Tgl", namaRow, [Math.max(0, namaCol - 10), namaCol + 10]);
      if (!minggu) continue;

      const labelRow = minggu.row + 1; // baris berisi label "Masuk" / "Keluar"
      const masukHit = findCell(grid, "Masuk", labelRow, [minggu.col, minggu.col + 10]);
      if (!masukHit) continue;
      const keluarHit = findCell(grid, "Keluar", labelRow, [masukHit.col + 1, minggu.col + 15]);
      if (!keluarHit) continue;

      for (let r = labelRow + 1; r < grid.length; r++) {
        const tglRaw = grid[r]?.[minggu.col];
        if (!tglRaw) break; // habis data blok ini

        const dayMatch = String(tglRaw).trim().match(/^(\d{1,2})/);
        if (!dayMatch) break;
        const dayOfMonth = parseInt(dayMatch[1], 10);

        results.push({
          nama,
          fingerprintId,
          tanggal: resolveDate(dayOfMonth),
          jamMasuk: normalizeJam(grid[r]?.[masukHit.col]),
          jamKeluar: normalizeJam(grid[r]?.[keluarHit.col]),
        });
      }
    }
  }

  return results;
}

// ============================================================================
// 2. MATCHER — cocokkan nama dari file ke karyawan_nip di tb_karyawan
// ============================================================================

interface KaryawanRef {
  nip: string;
  nama: string;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "") // buang simbol aneh, mis. "EDI~" -> "edi"
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance sederhana untuk fallback fuzzy match. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Cocokkan nama dari file absensi ke daftar karyawan di DB, 3 tahap:
 *   1. Exact match setelah normalisasi
 *   2. Salah satu nama "mengandung" nama lainnya (nama panggilan/singkat)
 *   3. Fuzzy match by edit distance, hanya diterima kalau jaraknya sangat dekat (<=2)
 * Kalau tidak ada yang cocok -> match: null, WAJIB dilaporkan ke user, jangan ditebak paksa.
 */
function matchEmployeeByName(
  namaFromFile: string,
  karyawanList: KaryawanRef[]
): { match: KaryawanRef | null } {
  const target = normalizeName(namaFromFile);
  if (!target) return { match: null };

  const exact = karyawanList.find((k) => normalizeName(k.nama) === target);
  if (exact) return { match: exact };

  const contains = karyawanList.find((k) => {
    const n = normalizeName(k.nama);
    return n.includes(target) || target.includes(n);
  });
  if (contains) return { match: contains };

  let best: KaryawanRef | null = null;
  let bestDist = Infinity;
  for (const k of karyawanList) {
    const dist = levenshtein(target, normalizeName(k.nama));
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  if (best && bestDist <= 2) return { match: best };

  return { match: null };
}

// ============================================================================
// 3. SERVER ACTION — upload file, proses, simpan ke DB
// ============================================================================

// TODO WAJIB DIISI: ganti dengan status_id ASLI dari tb_status_kehadiran kamu.
const STATUS_ID = {
  HADIR: 1,
  TIDAK_HADIR: 2,
  // tambahkan status lain kalau tb_status_kehadiran punya lebih (Izin, Sakit, Cuti, dst)
};

export interface ImportAttendanceResult {
  total_baris_dibaca: number;
  berhasil_disimpan: number;
  tidak_cocok: number;
  detail_tidak_cocok: { nama_di_file: string; tanggal: string }[];
}

export async function importAttendance(formData: FormData): Promise<ImportAttendanceResult> {
  const file = formData.get("file") as File | null;
  if (!file) {
    throw new Error("File tidak ditemukan");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawRows = parseAttendanceWorkbook(buffer);

  // Ambil semua karyawan sekali di awal (matching di memory, bukan query per baris)
  // GANTI nama kolom "nip"/"nama" kalau berbeda di tb_karyawan kamu.
  const [karyawanRows] = await db.query<RowDataPacket[]>(
    "SELECT nip, nama FROM tb_karyawan"
  );
  const karyawanList: KaryawanRef[] = karyawanRows.map((r) => ({
    nip: String(r.nip),
    nama: String(r.nama),
  }));

  const toUpsert: {
    karyawan_nip: string;
    tanggal: string;
    jam_masuk: string | null;
    jam_keluar: string | null;
    status_id: number;
  }[] = [];
  const unmatched: { nama_di_file: string; tanggal: string }[] = [];

  for (const row of rawRows) {
    const { match } = matchEmployeeByName(row.nama, karyawanList);

    if (!match) {
      unmatched.push({ nama_di_file: row.nama, tanggal: row.tanggal });
      continue;
    }

    toUpsert.push({
      karyawan_nip: match.nip,
      tanggal: row.tanggal,
      jam_masuk: row.jamMasuk,
      jam_keluar: row.jamKeluar,
      // Placeholder: ada jam masuk = Hadir, kosong ("Absen") = Tidak Hadir.
      // Sesuaikan dengan aturan HR kamu (mis. deteksi Terlambat, Izin, dll).
      status_id: row.jamMasuk ? STATUS_ID.HADIR : STATUS_ID.TIDAK_HADIR,
    });
  }

  // Upsert per baris berdasarkan (karyawan_nip, tanggal), supaya file periode yang
  // sama bisa diupload ulang tanpa duplikat.
  // WAJIB: tb_absensi harus punya UNIQUE KEY gabungan (karyawan_nip, tanggal), mis.:
  //   ALTER TABLE tb_absensi ADD UNIQUE KEY uq_karyawan_tanggal (karyawan_nip, tanggal);
  // Tanpa itu, "ON DUPLICATE KEY UPDATE" di bawah tidak akan pernah ke-trigger dan
  // upload ulang file periode yang sama akan bikin baris dobel.
  let successCount = 0;
  if (toUpsert.length > 0) {
    const values = toUpsert.map((r) => [
      r.karyawan_nip,
      r.tanggal,
      r.jam_masuk,
      r.jam_keluar,
      r.status_id,
    ]);

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO tb_absensi_harian (karyawan_nip, tanggal, jam_masuk, jam_keluar, status_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         jam_masuk = VALUES(jam_masuk),
         jam_keluar = VALUES(jam_keluar),
         status_id = VALUES(status_id)`,
      [values]
    );

    // affectedRows dari ON DUPLICATE KEY UPDATE: 1 per insert baru, 2 per baris yang diupdate.
    // Jadi ini bukan hitungan baris persis, tapi cukup buat indikasi sukses/tidaknya query.
    successCount = toUpsert.length;
    void result;
  }

  return {
    total_baris_dibaca: rawRows.length,
    berhasil_disimpan: successCount,
    tidak_cocok: unmatched.length,
    detail_tidak_cocok: unmatched,
  };
}