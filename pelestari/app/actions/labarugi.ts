"use server"

import { db } from "@/lib/db";

export interface SubAkunItem {
  no_akun: string;
  nama_akun: string;
  kelompok_biaya_id: number | string | null;
  kelompok_biaya: string;
  saldo: number;
}

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
  totalBebanUsaha: number;

  pnbpDanPajak: AkunItem[];
  totalPnbpDanPajak: number;

  labaBersih: number;
}

export async function getLabaRugiData(
  year: string = "2026",
  month: string = "all"
): Promise<LabaRugiData> {
  try {
    // 1. PENDAPATAN DARI JURNAL (akun 4xxx)
    const queryPendapatan = `
      SELECT 
        ji.no_akun,
        a.nama_akun,
        SUM(ji.kredit) - SUM(ji.debit) AS saldo
      FROM tb_jurnal_item ji
      INNER JOIN tb_jurnal j ON j.id = ji.jurnal_id
      INNER JOIN tb_akun a ON a.no_akun = ji.no_akun
      WHERE ji.no_akun LIKE '4%'
        AND YEAR(j.tanggal) = ?
        ${month !== "all" ? "AND MONTH(j.tanggal) = ?" : ""}
      GROUP BY ji.no_akun, a.nama_akun
    `;

    const pendapatanParams: any[] = [year];
    if (month !== "all") {
      pendapatanParams.push(month);
    }

    const [pendapatanRows]: any = await db.query(queryPendapatan, pendapatanParams);

    let pendapatanPelatihan = 0;
    let pendapatanKonsultan = 0;

    pendapatanRows.forEach((row: any) => {
      const namaAkun = (row.nama_akun || "").toLowerCase();
      const saldo = Number(row.saldo) || 0;

      if (namaAkun.includes("pelatihan")) {
        pendapatanPelatihan += saldo;
      } else if (namaAkun.includes("konsultan") || namaAkun.includes("konsultasi")) {
        pendapatanKonsultan += saldo;
      }
      // "Pendapatan Lain-lain" (41102) sengaja tidak masuk kategori manapun,
      // sama seperti perilaku original dengan tb_invoice
    });

    const totalPendapatan = pendapatanPelatihan + pendapatanKonsultan;

    // 2. QUERY MASTER AKUN + SALDO DARI JURNAL (BEBAN, SESUAI PERIODE)
    const queryAkun = `
      SELECT 
        a.no_akun,
        a.nama_akun,
        a.kelompok_biaya_id,
        COALESCE(kb.kelompok_biaya, 'Biaya Operasional Kantor') AS kelompok_biaya,
        COALESCE(jd.total_debit, 0) - COALESCE(jd.total_kredit, 0) AS saldo
      FROM tb_akun a
      LEFT JOIN tb_kelompok_biaya kb ON a.kelompok_biaya_id = kb.id
      LEFT JOIN (
        SELECT 
          ji.no_akun,
          SUM(ji.debit) AS total_debit,
          SUM(ji.kredit) AS total_kredit
        FROM tb_jurnal_item ji
        INNER JOIN tb_jurnal j ON j.id = ji.jurnal_id
        WHERE YEAR(j.tanggal) = ?
        ${month !== "all" ? "AND MONTH(j.tanggal) = ?" : ""}
        GROUP BY ji.no_akun
      ) jd ON jd.no_akun = a.no_akun
      WHERE a.no_akun NOT LIKE '1%' 
        AND a.no_akun NOT LIKE '2%'
        AND a.no_akun NOT LIKE '3%'
        AND a.no_akun NOT LIKE '4%' 
    `;

    const akunParams: any[] = [year];
    if (month !== "all") {
      akunParams.push(month);
    }

    const [akunRows]: any = await db.query(queryAkun, akunParams);

    const mapBeban = new Map<string, AkunItem>();
    const mapPenyusutan = new Map<string, AkunItem>();
    const mapPajak = new Map<string, AkunItem>();

    let subTotalBeban = 0;
    let totalPenyusutan = 0;
    let totalPnbpDanPajak = 0;

    const insertIntoMap = (
      targetMap: Map<string, AkunItem>,
      groupKey: string,
      noAkun: string,
      namaAkun: string,
      kelompokId: number | string | null,
      kelompokBiaya: string,
      saldo: number
    ) => {
      const subItem: SubAkunItem = {
        no_akun: noAkun,
        nama_akun: namaAkun,
        kelompok_biaya_id: kelompokId,
        kelompok_biaya: kelompokBiaya,
        saldo: saldo,
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
          rincian: [subItem],
        });
      }
    };

    akunRows.forEach((row: any) => {
      const namaAkun = (row.nama_akun || "").trim();
      const noAkun = String(row.no_akun || "");
      const kelompokId = row.kelompok_biaya_id ?? null;
      const kelompokBiaya = (row.kelompok_biaya || "").trim();
      const saldo = Math.abs(Number(row.saldo) || 0);
      const namaAkunLower = namaAkun.toLowerCase();

      if (saldo === 0) return;

      if (namaAkunLower.includes("pnbp") || namaAkunLower.includes("pajak terhutang")) {
        totalPnbpDanPajak += saldo;
        insertIntoMap(mapPajak, namaAkun, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
      } else if (namaAkunLower.includes("penyusutan")) {
        totalPenyusutan += saldo;
        insertIntoMap(mapPenyusutan, namaAkun, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
      } else {
        subTotalBeban += saldo;
        const groupName = namaAkun;
        insertIntoMap(mapBeban, groupName, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
      }
    });

    const formatDanUrutkan = (map: Map<string, AkunItem>) => {
      return Array.from(map.values())
        .map((item) => ({
          ...item,
          rincian: item.rincian
            ? item.rincian.sort((a, b) => a.no_akun.localeCompare(b.no_akun))
            : [],
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
      labaBersih,
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
      labaBersih: 0,
    };
  }
}