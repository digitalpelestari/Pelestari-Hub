"use server";

import { db } from "@/lib/db";

export interface CashFlowData {
  bulan: string;
  tahun: string;
  labelBulan: string;

  kasMasukDariPelanggan: number;
  pengeluaranOperasional: number;
  kasBersihOperasional: number;

  kasMasukInvestasi: number;
  kasKeluarInvestasi: number;
  kasBersihInvestasi: number;

  kasMasukPembiayaan: number;
  kasKeluarPembiayaan: number;
  kasBersihPembiayaan: number;

  kasBersihPerubahan: number;
  kasAwalPeriode: number;
  kasDanSetaraKas: number;
}

export async function getCashFlowData(
  bulan: string = "1",
  tahun: string = "2026"
): Promise<CashFlowData> {
  try {
    const month = String(bulan).padStart(2, "0");
    const dateFrom = `${tahun}-${month}-01`;
    const dateTo = `${tahun}-${month}-31`;

    const labelBulanMap: Record<string, string> = {
      "01": "Januari",
      "02": "Februari",
      "03": "Maret",
      "04": "April",
      "05": "Mei",
      "06": "Juni",
      "07": "Juli",
      "08": "Agustus",
      "09": "September",
      "10": "Oktober",
      "11": "November",
      "12": "Desember",
    };

    const [invoiceRows]: any = await db.query(
      `SELECT 
        SUM(COALESCE(bayar_1, 0) + COALESCE(bayar_2, 0)) as total_pembayaran
       FROM tb_invoice 
       WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?`,
      [tahun, month]
    );
    const kasMasukDariPelanggan = Number(invoiceRows[0]?.total_pembayaran) || 0;

    const [expenseRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.debit), 0) as total_pengeluaran
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
         AND (i.no_akun LIKE '5%' OR i.no_akun LIKE '6%' OR i.no_akun LIKE '7%')`,
      [month, tahun]
    );
    const pengeluaranOperasional = Number(expenseRows[0]?.total_pengeluaran) || 0;

    const [investInRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.debit), 0) as total_masuk
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
         AND (i.no_akun LIKE '1%' AND i.no_akun NOT IN ('11100', '11200', '12100'))`,
      [month, tahun]
    );
    const kasMasukInvestasi = Number(investInRows[0]?.total_masuk) || 0;

    const [investOutRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.kredit), 0) as total_keluar
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
         AND (i.no_akun LIKE '1%' AND i.no_akun NOT IN ('11100', '11200', '12100'))`,
      [month, tahun]
    );
    const kasKeluarInvestasi = Number(investOutRows[0]?.total_keluar) || 0;

    const [finInRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.debit), 0) as total_masuk
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
         AND i.no_akun LIKE '3%'`,
      [month, tahun]
    );
    const kasMasukPembiayaan = Number(finInRows[0]?.total_masuk) || 0;

    const [finOutRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.kredit), 0) as total_keluar
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
         AND i.no_akun LIKE '3%'`,
      [month, tahun]
    );
    const kasKeluarPembiayaan = Number(finOutRows[0]?.total_keluar) || 0;

    const kasBersihOperasional = kasMasukDariPelanggan - pengeluaranOperasional;
    const kasBersihInvestasi = kasMasukInvestasi - kasKeluarInvestasi;
    const kasBersihPembiayaan = kasMasukPembiayaan - kasKeluarPembiayaan;

    const kasBersihPerubahan = kasBersihOperasional + kasBersihInvestasi + kasBersihPembiayaan;

    const prevMonth = String(Math.max(1, Number(month) - 1)).padStart(2, "0");
    const prevYear = Number(month) === 1 ? String(Number(tahun) - 1) : tahun;
    const prevDateFrom = `${prevYear}-${prevMonth}-01`;
    const prevDateTo = `${prevYear}-${prevMonth}-31`;

    const [prevKasRows]: any = await db.query(
      `SELECT 
        COALESCE(SUM(i.debit), 0) as total_debit,
        COALESCE(SUM(i.kredit), 0) as total_kredit
       FROM tb_jurnal_item i
       INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
       WHERE DATE(j.tanggal) <= ?
         AND i.no_akun IN ('11100', '11200')`,
      [prevDateTo]
    );
    const totalDebitKas = Number(prevKasRows[0]?.total_debit) || 0;
    const totalKreditKas = Number(prevKasRows[0]?.total_kredit) || 0;
    const kasAwalPeriode = totalDebitKas - totalKreditKas;

    const kasDanSetaraKas = kasAwalPeriode + kasBersihPerubahan;

    return {
      bulan,
      tahun,
      labelBulan: labelBulanMap[month] || month,
      kasMasukDariPelanggan,
      pengeluaranOperasional,
      kasBersihOperasional,
      kasMasukInvestasi,
      kasKeluarInvestasi,
      kasBersihInvestasi,
      kasMasukPembiayaan,
      kasKeluarPembiayaan,
      kasBersihPembiayaan,
      kasBersihPerubahan,
      kasAwalPeriode,
      kasDanSetaraKas,
    };
  } catch (error) {
    console.error("Gagal memuat data cashflow:", error);
    return {
      bulan: "1",
      tahun: "2026",
      labelBulan: "Januari",
      kasMasukDariPelanggan: 0,
      pengeluaranOperasional: 0,
      kasBersihOperasional: 0,
      kasMasukInvestasi: 0,
      kasKeluarInvestasi: 0,
      kasBersihInvestasi: 0,
      kasMasukPembiayaan: 0,
      kasKeluarPembiayaan: 0,
      kasBersihPembiayaan: 0,
      kasBersihPerubahan: 0,
      kasAwalPeriode: 0,
      kasDanSetaraKas: 0,
    };
  }
}
