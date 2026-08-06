"use server"

import { db } from "@/lib/db";

export interface AkunItem {
  no_akun: string;
  nama_akun: string;
  saldo: number;
}

export interface LabaRugiData {
  pendapatanPelatihan: number;
  pendapatanKonsultan: number;
  totalPendapatan: number;
  
  bebanOperasional: AkunItem[];
  subTotalBeban: number;
  
  bebanPenyusutan: AkunItem[];
  totalBebanUsaha: number; // Sub Total Beban + Penyusutan
  
  pnbpDanPajak: AkunItem[];
  totalPnbpDanPajak: number;
  
  labaBersih: number;
}

export async function getLabaRugiData(year: string = "2026"): Promise<LabaRugiData> {
  try {
    // ========================================================
    // 1. QUERY PENDAPATAN
    // ========================================================
    const queryInvoice = `
      SELECT 
        LOWER(jenis_kegiatan) as kegiatan,
        SUM(COALESCE(total, 0)) as total_invoice_keluar
      FROM tb_invoice
      WHERE YEAR(created_at) = ? 
      GROUP BY jenis_kegiatan
    `;
    
    const [invoiceRows]: any = await db.query(queryInvoice, [year]);

    let pendapatanPelatihan = 0;
    let pendapatanKonsultan = 0;

    invoiceRows.forEach((row: any) => {
      const namaKegiatan = row.kegiatan || "";
      if (namaKegiatan.includes("pelatihan")) {
        pendapatanPelatihan += Number(row.total_invoice_keluar) || 0;
      } else if (namaKegiatan.includes("konsultan") || namaKegiatan.includes("konsultasi")) {
        pendapatanKonsultan += Number(row.total_invoice_keluar) || 0;
      }
    });

    const totalPendapatan = pendapatanPelatihan + pendapatanKonsultan;

    // ========================================================
    // 2. QUERY MASTER AKUN (GROUPING NAMA YANG SAMA)
    // ========================================================
    const queryAkun = `
      SELECT 
        a.no_akun,
        a.nama_akun,
        a.saldo
      FROM tb_akun a
      WHERE a.no_akun NOT LIKE '1%' 
        AND a.no_akun NOT LIKE '3%'
        AND a.no_akun NOT LIKE '4%' 
    `;

    const [akunRows]: any = await db.query(queryAkun);

    // Menggunakan Map untuk mengelompokkan berdasarkan Nama Akun agar tidak duplikat
    const mapBeban = new Map<string, AkunItem>();
    const mapPenyusutan = new Map<string, AkunItem>();
    const mapPajak = new Map<string, AkunItem>();
    
    let subTotalBeban = 0;
    let totalPenyusutan = 0;
    let totalPnbpDanPajak = 0;

    akunRows.forEach((row: any) => {
      // Bersihkan spasi berlebih di nama akun agar grouping akurat
      const namaAkun = row.nama_akun.trim();
      const saldo = Math.abs(Number(row.saldo) || 0);
      const namaAkunLower = namaAkun.toLowerCase();

      // Deteksi kategori berdasarkan nama akun
      if (namaAkunLower.includes("pnbp") || namaAkunLower.includes("pajak terhutang")) {
        totalPnbpDanPajak += saldo;
        if (mapPajak.has(namaAkun)) {
          mapPajak.get(namaAkun)!.saldo += saldo;
        } else {
          mapPajak.set(namaAkun, { no_akun: row.no_akun, nama_akun: namaAkun, saldo });
        }
      } 
      else if (namaAkunLower.includes("penyusutan")) {
        totalPenyusutan += saldo;
        if (mapPenyusutan.has(namaAkun)) {
          mapPenyusutan.get(namaAkun)!.saldo += saldo;
        } else {
          mapPenyusutan.set(namaAkun, { no_akun: row.no_akun, nama_akun: namaAkun, saldo });
        }
      } 
      else {
        subTotalBeban += saldo;
        if (mapBeban.has(namaAkun)) {
          mapBeban.get(namaAkun)!.saldo += saldo;
        } else {
          mapBeban.set(namaAkun, { no_akun: row.no_akun, nama_akun: namaAkun, saldo });
        }
      }
    });

    // Convert Map kembali menjadi Array dan Urutkan sesuai Alphabet (A-Z)
    const bebanOperasional = Array.from(mapBeban.values()).sort((a, b) => a.nama_akun.localeCompare(b.nama_akun));
    const bebanPenyusutan = Array.from(mapPenyusutan.values()).sort((a, b) => a.nama_akun.localeCompare(b.nama_akun));
    const pnbpDanPajak = Array.from(mapPajak.values()).sort((a, b) => a.nama_akun.localeCompare(b.nama_akun));

    const totalBebanUsaha = subTotalBeban + totalPenyusutan;
    const labaBersih = totalPendapatan - totalBebanUsaha - totalPnbpDanPajak;

    return {
      pendapatanPelatihan,
      pendapatanKonsultan,
      totalPendapatan,
      
      bebanOperasional,
      subTotalBeban,
      
      bebanPenyusutan,
      totalBebanUsaha,
      
      pnbpDanPajak,
      totalPnbpDanPajak,
      
      labaBersih
    };

  } catch (error) {
    console.error("CRITICAL_ERR_LABA_RUGI:", error);
    return {
      pendapatanPelatihan: 0, pendapatanKonsultan: 0, totalPendapatan: 0,
      bebanOperasional: [], subTotalBeban: 0,
      bebanPenyusutan: [], totalBebanUsaha: 0,
      pnbpDanPajak: [], totalPnbpDanPajak: 0,
      labaBersih: 0
    };
  }
}