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

// Akun yang sengaja tidak dihitung di laba rugi.
// 71106 (PPN) dikecualikan sementara karena di jurnal invoice dipakai sebagai
// PPN keluaran (kredit). Kosongkan array ini kalau sudah dirapikan.
const AKUN_DIKECUALIKAN: string[] = ["71106"];

export async function getLabaRugiData(
  year: string = "2026",
  month: string = "all"
): Promise<LabaRugiData> {
  try {
    const monthNum = month !== "all" ? Number(month) : null;
    const yearNum = Number(year);

    // 1. PENDAPATAN DARI tb_invoice (basis akrual, periode = tb_invoice.tanggal)
    // Pendapatan = DPP saja. PPN, PPh 23 dan PNBP BUKAN pendapatan.
    // total = DPP + PPN 11% - PPh 23 (2%) + nominal_pnbp, jadi kolom total tidak dipakai.
    const queryPendapatan = `
      SELECT
        i.jenis_kegiatan,
        SUM(
          COALESCE(i.jumlah_peserta, 0)   * COALESCE(i.harga_peserta, 0) +
          COALESCE(i.jumlah_peserta_2, 0) * COALESCE(i.harga_peserta_2, 0) +
          COALESCE(d.dpp_detail, 0)
        ) AS saldo
      FROM tb_invoice i
      LEFT JOIN (
        SELECT invoice_id, SUM(item_jumlah * item_harga) AS dpp_detail
        FROM tb_invoice_details
        GROUP BY invoice_id
      ) d ON d.invoice_id = i.id
      WHERE YEAR(i.tanggal) = ?
        ${monthNum ? "AND MONTH(i.tanggal) = ?" : ""}
      GROUP BY i.jenis_kegiatan
    `;

    const pendapatanParams: any[] = monthNum ? [yearNum, monthNum] : [yearNum];
    const [pendapatanRows]: any = await db.query(queryPendapatan, pendapatanParams);

    let pendapatanPelatihan = 0;
    let pendapatanKonsultan = 0;

    pendapatanRows.forEach((row: any) => {
      const jenis = String(row.jenis_kegiatan || "").toLowerCase();
      const saldo = Number(row.saldo) || 0;

      if (jenis === "pelatihan") {
        pendapatanPelatihan += saldo;
      } else if (jenis === "konsultan") {
        pendapatanKonsultan += saldo;
      }
      // jenis_kegiatan kosong/NULL sengaja tidak dihitung
    });

    const totalPendapatan = pendapatanPelatihan + pendapatanKonsultan;

    // 2. BEBAN (5xxxx, 6xxxx, 7xxxx, 8xxxx) DARI JURNAL SESUAI PERIODE
    const queryAkun = `
      SELECT 
        a.no_akun,
        a.nama_akun,
        a.kelompok_biaya_id,
        COALESCE(kb.kelompok_biaya, 'Tanpa Kelompok') AS kelompok_biaya,
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
          AND (j.no_registrasi IS NULL OR j.no_registrasi NOT LIKE 'CL\\_%')
          ${monthNum ? "AND MONTH(j.tanggal) = ?" : ""}
        GROUP BY ji.no_akun
      ) jd ON jd.no_akun = a.no_akun
      WHERE a.no_akun NOT LIKE '1%' 
        AND a.no_akun NOT LIKE '2%'
        AND a.no_akun NOT LIKE '3%'
        AND a.no_akun NOT LIKE '4%' 
    `;

    const akunParams: any[] = monthNum ? [yearNum, monthNum] : [yearNum];
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
      const saldo = Number(row.saldo) || 0; // tanpa Math.abs

      if (saldo === 0) return;
      if (AKUN_DIKECUALIKAN.includes(noAkun)) return;

      const isPajak = noAkun.startsWith("71") || noAkun.startsWith("81");
      const isPenyusutan = namaAkun.toLowerCase().includes("penyusutan");

      if (isPajak) {
        totalPnbpDanPajak += saldo;
        insertIntoMap(mapPajak, namaAkun, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
      } else if (isPenyusutan) {
        totalPenyusutan += saldo;
        insertIntoMap(mapPenyusutan, namaAkun, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
      } else {
        subTotalBeban += saldo;
        // group berdasarkan kelompok biaya
        insertIntoMap(mapBeban, kelompokBiaya, noAkun, namaAkun, kelompokId, kelompokBiaya, saldo);
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