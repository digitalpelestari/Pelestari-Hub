"use server"

import { db } from "@/lib/db";

// Interface untuk item rincian individual (anak)
export interface SubAkunItem {
  no_akun: string;
  nama_akun: string;
  saldo: number;
}

// Interface untuk baris utama / induk (parent)
export interface AkunItem {
  no_akun: string;
  nama_akun: string;
  saldo: number;
  rincian?: SubAkunItem[];
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

export async function getLabaRugiData(
  year: string = "2026",
  month: string = "all"
): Promise<LabaRugiData> {
  try {
    // ========================================================
    // 1. QUERY PENDAPATAN (INVOICE)
    // ========================================================
    let queryInvoice = `
      SELECT 
        LOWER(jenis_kegiatan) as kegiatan,
        SUM(COALESCE(total, 0)) as total_invoice_keluar
      FROM tb_invoice
      WHERE YEAR(created_at) = ?
    `;
    const invoiceParams: any[] = [year];

    // Filter bulan jika bukan "all"
    if (month !== "all") {
      queryInvoice += ` AND MONTH(created_at) = ?`;
      invoiceParams.push(month);
    }

    queryInvoice += ` GROUP BY jenis_kegiatan`;
    
    const [invoiceRows]: any = await db.query(queryInvoice, invoiceParams);

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
    // 2. QUERY MASTER AKUN & PENGELOMPOKAN BEBAN DENGAN RINCIAN
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

    const mapBeban = new Map<string, AkunItem>();
    const mapPenyusutan = new Map<string, AkunItem>();
    const mapPajak = new Map<string, AkunItem>();
    
    let subTotalBeban = 0;
    let totalPenyusutan = 0;
    let totalPnbpDanPajak = 0;

    // Helper untuk memasukkan rincian akun ke map kategori induk
    const insertIntoMap = (
      targetMap: Map<string, AkunItem>,
      groupKey: string,
      noAkun: string,
      namaAkun: string,
      saldo: number
    ) => {
      const subItem: SubAkunItem = {
        no_akun: noAkun,
        nama_akun: namaAkun,
        saldo: saldo
      };

      if (targetMap.has(groupKey)) {
        const parent = targetMap.get(groupKey)!;
        parent.saldo += saldo;
        parent.rincian?.push(subItem);
      } else {
        targetMap.set(groupKey, {
          no_akun: noAkun,
          nama_akun: groupKey,
          saldo: saldo,
          rincian: [subItem]
        });
      }
    };

    akunRows.forEach((row: any) => {
      const namaAkun = (row.nama_akun || "").trim();
      const noAkun = String(row.no_akun || "");
      const saldo = Math.abs(Number(row.saldo) || 0);
      const namaAkunLower = namaAkun.toLowerCase();

      // Lewatkan saldo 0 agar laporan tetap rapi
      if (saldo === 0) return;

      // Kategori 1: PNBP & Pajak
      if (namaAkunLower.includes("pnbp") || namaAkunLower.includes("pajak terhutang")) {
        totalPnbpDanPajak += saldo;
        insertIntoMap(mapPajak, namaAkun, noAkun, namaAkun, saldo);
      } 
      // Kategori 2: Penyusutan
      else if (namaAkunLower.includes("penyusutan")) {
        totalPenyusutan += saldo;
        insertIntoMap(mapPenyusutan, namaAkun, noAkun, namaAkun, saldo);
      } 
      // Kategori 3: Beban Operasional Lainnya
      else {
        subTotalBeban += saldo;

        // Grouping kustom untuk ATK & Perlengkapan sejenis
        let groupName = namaAkun;
        if (namaAkunLower.includes("atk") || namaAkunLower.includes("alat tulis")) {
          groupName = "Beban ATK & Perlengkapan";
        }

        insertIntoMap(mapBeban, groupName, noAkun, namaAkun, saldo);
      }
    });

    // Helper untuk merapikan urutan alfabetis
    const formatDanUrutkan = (map: Map<string, AkunItem>) => {
      return Array.from(map.values())
        .map((item) => ({
          ...item,
          rincian: item.rincian ? item.rincian.sort((a, b) => a.nama_akun.localeCompare(b.nama_akun)) : []
        }))
        .sort((a, b) => a.nama_akun.localeCompare(b.nama_akun));
    };

    const bebanOperasional = formatDanUrutkan(mapBeban);
    const bebanPenyusutan = formatDanUrutkan(mapPenyusutan);
    const pnbpDanPajak = formatDanUrutkan(mapPajak);

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
      pendapatanPelatihan: 0,
      pendapatanKonsultan: 0,
      totalPendapatan: 0,
      bebanOperasional: [],
      subTotalBeban: 0,
      bebanPenyusutan: [],
      totalBebanUsaha: 0,
      pnbpDanPajak: [],
      totalPnbpDanPajak: 0,
      labaBersih: 0
    };
  }
}