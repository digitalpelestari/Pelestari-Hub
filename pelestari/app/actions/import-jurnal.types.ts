/**
 * app/actions/import-jurnal.types.ts
 *
 * Tipe data untuk fitur import jurnal dipisah dari import-jurnal.ts karena
 * file yang punya "use server" HANYA boleh export async function —
 * export interface/type/const dari file "use server" akan bikin Next.js
 * error saat build ("The default export is not a React Component" dsb).
 */

export interface ImportPreviewRow {
    rowKey: string; // id unik utk React key & referensi saat commit
    jenis: "CI" | "CO" | "KK";
    noRegistrasi: string;
    tanggal: string; // yyyy-mm-dd
    rekeningExcel: string;
    noAkunKasBank: string | null;
    skorMatchRekening: number | null;
    namaPihak: string; // Nama Pengirim (CI) / Penerima (CO)
    namaPemohon: string;
    isPihakBaru: boolean;
    teksSumberLawan: string; // "Jenis Pekerjaan"(CI) / "Kelompok Biaya"(CO) yang dipakai utk fuzzy match
    noAkunLawan: string | null;
    namaAkunLawan: string | null;
    skorMatchLawan: number | null;
    nominal: number;
    keterangan: string;
    status: "siap" | "dilewati";
    alasanDilewati?: string;
}

export interface ImportPreviewResult {
    success: boolean;
    message?: string;
    ci: ImportPreviewRow[];
    co: ImportPreviewRow[];
    kk: ImportPreviewRow[];
    rekeningBelumDimapping: string[];
    summary: {
        totalBaris: number;
        siap: number;
        dilewati: number;
    };
}