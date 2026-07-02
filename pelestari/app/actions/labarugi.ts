"use server"

import { db } from "@/lib/db";

export interface LabaRugiItem {
  no_akun: string;
  nama_akun: string;
  kelompok_biaya: string;
  saldo: number;
}

export interface LabaRugiData {
  pendapatanPelatihan: number;
  pendapatanKonsultan: number;
  totalPendapatan: number;
  bebanOperasional: LabaRugiItem[];
  totalBebanOperasional: number;
  pnbpDanPajak: LabaRugiItem[];
  totalPnbpDanPajak: number;
  labaBersih: number;
}

export async function getLabaRugiData(year: string = "2026"): Promise<LabaRugiData> {
  try {
    // ========================================================
    // 1. QUERY PENDAPATAN: AMBIL DARI TOTAL INVOICE YANG KELUAR
    // ========================================================
    // FIX: Menghapus filter status lunas, jadi semua invoice keluar langsung di-SUM totalnya
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
    // 2. QUERY MASTER AKUN BEBAN & BIAYA (KEPALA 2, 3, 4)
    // ========================================================
    const queryAkun = `
      SELECT 
        a.no_akun,
        a.nama_akun,
        IFNULL(k.kelompok_biaya, 'Operasional') as kelompok_biaya,
        a.saldo
      FROM tb_akun a
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
      WHERE a.saldo <> 0 
        AND (a.no_akun LIKE '2%' OR a.no_akun LIKE '3%' OR a.no_akun LIKE '4%')
      ORDER BY a.no_akun ASC
    `;

    const [akunRows]: any = await db.query(queryAkun);

    let bebanOperasional: LabaRugiItem[] = [];
    let pnbpDanPajak: LabaRugiItem[] = [];
    let totalBebanOperasional = 0;
    let totalPnbpDanPajak = 0;

    akunRows.forEach((row: any) => {
      // Abaikan akun Kas/Bank/Modal karena untuk laporan Neraca
      if (row.no_akun === "1000" || row.no_akun === "1001" || row.no_akun === "1003") {
        return;
      }

      const item: LabaRugiItem = {
        no_akun: row.no_akun,
        nama_akun: row.nama_akun,
        kelompok_biaya: row.kelompok_biaya,
        saldo: Math.abs(Number(row.saldo) || 0)
      };

      if (row.nama_akun.toLowerCase().includes("pajak") || row.no_akun.startsWith("9")) {
        pnbpDanPajak.push(item);
        totalPnbpDanPajak += item.saldo;
      } else {
        bebanOperasional.push(item);
        totalBebanOperasional += item.saldo;
      }
    });

    // Formulasi Laba Bersih
    const labaBersih = totalPendapatan - totalBebanOperasional - totalPnbpDanPajak;

    return {
      pendapatanPelatihan,
      pendapatanKonsultan,
      totalPendapatan,
      bebanOperasional,
      totalBebanOperasional,
      pnbpDanPajak,
      totalPnbpDanPajak,
      labaBersih
    };

  } catch (error) {
    console.error("CRITICAL_ERR_LABA_RUGI:", error);
    return {
      pendapatanPelatihan: 0, pendapatanKonsultan: 0, totalPendapatan: 0,
      bebanOperasional: [], totalBebanOperasional: 0,
      pnbpDanPajak: [], totalPnbpDanPajak: 0,
      labaBersih: 0
    };
  }
}