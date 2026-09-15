"use server";

import { db } from "@/lib/db";

export interface CashFlowData {
  labelBulan: string;
  labelTahun: string;

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
  bulan: string = "",
  tahun: string = "",
  startDate?: string,
  endDate?: string
): Promise<CashFlowData> {
  try {
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

    let dateFrom: string;
    let dateTo: string;
    let labelBulan: string;
    let labelTahun: string;

    if (startDate && endDate) {
      dateFrom = startDate;
      dateTo = endDate;
      const startParts = startDate.split("-");
      labelBulan = labelBulanMap[startParts[1]] || startParts[1];
      labelTahun = startParts[0];
    } else {
      const month = String(bulan).padStart(2, "0");
      dateFrom = `${tahun}-${month}-01`;
      dateTo = `${tahun}-${month}-${new Date(Number(tahun), Number(month), 0).getDate()}`;
      labelBulan = labelBulanMap[month] || month;
      labelTahun = tahun;
    }

    const dateRange = startDate && endDate
      ? "DATE(j.tanggal) BETWEEN ? AND ?"
      : "MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?";

    const cashflowParams: any[] = startDate && endDate
      ? [startDate, endDate]
      : [String(bulan).padStart(2, "0"), tahun];

    const [invoiceRows]: any = await db.query(
      `SELECT 
         SUM(COALESCE(bayar_1, 0) + COALESCE(bayar_2, 0)) as total_pembayaran
        FROM tb_invoice 
        WHERE ${startDate && endDate ? "DATE(created_at) BETWEEN ? AND ?" : "YEAR(created_at) = ? AND MONTH(created_at) = ?"}`,
      cashflowParams.slice(0, 2)
    );
    const kasMasukDariPelanggan = Number(invoiceRows[0]?.total_pembayaran) || 0;

    const [expenseRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.debit), 0) as total_pengeluaran
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE ${dateRange}
          AND (i.no_akun LIKE '5%' OR i.no_akun LIKE '6%' OR i.no_akun LIKE '7%')`,
      cashflowParams
    );
    const pengeluaranOperasional = Number(expenseRows[0]?.total_pengeluaran) || 0;

    const [investInRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.debit), 0) as total_masuk
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE ${dateRange}
          AND (i.no_akun LIKE '1%' AND i.no_akun NOT IN ('11100', '11200', '12100'))`,
      cashflowParams
    );
    const kasMasukInvestasi = Number(investInRows[0]?.total_masuk) || 0;

    const [investOutRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.kredit), 0) as total_keluar
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE ${dateRange}
          AND (i.no_akun LIKE '1%' AND i.no_akun NOT IN ('11100', '11200', '12100'))`,
      cashflowParams
    );
    const kasKeluarInvestasi = Number(investOutRows[0]?.total_keluar) || 0;

    const [finInRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.debit), 0) as total_masuk
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE ${dateRange}
          AND i.no_akun LIKE '3%'`,
      cashflowParams
    );
    const kasMasukPembiayaan = Number(finInRows[0]?.total_masuk) || 0;

    const [finOutRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.kredit), 0) as total_keluar
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE ${dateRange}
          AND i.no_akun LIKE '3%'`,
      cashflowParams
    );
    const kasKeluarPembiayaan = Number(finOutRows[0]?.total_keluar) || 0;

    const kasBersihOperasional = kasMasukDariPelanggan - pengeluaranOperasional;
    const kasBersihInvestasi = kasMasukInvestasi - kasKeluarInvestasi;
    const kasBersihPembiayaan = kasMasukPembiayaan - kasKeluarPembiayaan;

    const kasBersihPerubahan = kasBersihOperasional + kasBersihInvestasi + kasBersihPembiayaan;

    const [prevKasRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(i.debit), 0) as total_debit,
         COALESCE(SUM(i.kredit), 0) as total_kredit
        FROM tb_jurnal_item i
        INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
        WHERE DATE(j.tanggal) <= ?
          AND i.no_akun IN ('11100', '11200')`,
      [dateFrom]
    );
    const totalDebitKas = Number(prevKasRows[0]?.total_debit) || 0;
    const totalKreditKas = Number(prevKasRows[0]?.total_kredit) || 0;
    const kasAwalPeriode = totalDebitKas - totalKreditKas;

    const kasDanSetaraKas = kasAwalPeriode + kasBersihPerubahan;

    return {
      labelBulan,
      labelTahun,
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
      labelBulan: "Januari",
      labelTahun: "2026",
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
