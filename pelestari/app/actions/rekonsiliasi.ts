"use server";

import { db } from "@/lib/db";

export type StatusRekonsiliasi =
  | "BELUM_BAYAR"
  | "LUNAS"
  | "SESUAI"
  | "SELISIH_INVOICE"
  | "SELISIH_JURNAL";

export interface RekonsiliasiInvoice {
  id: number;
  nomor_invoice: string;
  tanggal: string;
  total: number;

  bayar_1: number;
  bayar_2: number;

  total_bayar_invoice: number;
  total_bayar_jurnal: number;

  selisih: number;

  status: string;
  status_rekonsiliasi: StatusRekonsiliasi;
}

export async function rekonsiliasiInvoice(
  startDate?: string,
  endDate?: string,
  search?: string,
  statusFilter?: StatusRekonsiliasi
) {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push("i.tanggal >= ?");
      params.push(startDate);
    }

    if (endDate) {
      conditions.push("i.tanggal <= ?");
      params.push(endDate);
    }

    if (search) {
      conditions.push(`
        (
          i.nomor_invoice LIKE ?
          OR CAST(i.id AS CHAR) LIKE ?
        )
      `);

      const keyword = `%${search}%`;

      params.push(keyword);
      params.push(keyword);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const query = `
      SELECT
        i.id,
        i.nomor_invoice,
        i.tanggal,
        i.total,

        COALESCE(i.bayar_1, 0) AS bayar_1,
        COALESCE(i.bayar_2, 0) AS bayar_2,

        (
          COALESCE(i.bayar_1, 0) +
          COALESCE(i.bayar_2, 0)
        ) AS total_bayar_invoice,

        COALESCE(j.total_jurnal, 0) AS total_bayar_jurnal,

        (
          (
            COALESCE(i.bayar_1, 0) +
            COALESCE(i.bayar_2, 0)
          )
          -
          COALESCE(j.total_jurnal, 0)
        ) AS selisih,

        i.status

      FROM tb_invoice i

      LEFT JOIN (
        SELECT
          j.invoice_id,
          SUM(ji.kredit) AS total_jurnal

        FROM tb_jurnal j

        INNER JOIN tb_jurnal_item ji
          ON ji.jurnal_id = j.id

        INNER JOIN tb_akun a
          ON a.no_akun = ji.no_akun

        INNER JOIN tb_kelompok_biaya kb
          ON kb.id = a.kelompok_biaya_id

        WHERE
          j.invoice_id IS NOT NULL
          AND kb.kelompok_biaya LIKE '%PIUTANG%'

        GROUP BY j.invoice_id
      ) j
        ON j.invoice_id = i.id

      ${whereClause}

      ORDER BY i.tanggal DESC, i.id DESC
    `;

    const [rows]: any = await db.query(query, params);

    const data: RekonsiliasiInvoice[] = rows.map((row: any) => {
      const total = Number(row.total) || 0;
      const totalBayarInvoice =
        Number(row.total_bayar_invoice) || 0;
      const totalBayarJurnal =
        Number(row.total_bayar_jurnal) || 0;

      const selisih =
        totalBayarInvoice - totalBayarJurnal;

      let statusRekonsiliasi: StatusRekonsiliasi;

      if (
        totalBayarInvoice === 0 &&
        totalBayarJurnal === 0
      ) {
        statusRekonsiliasi = "BELUM_BAYAR";
      } else if (
        Math.abs(selisih) <= 1 &&
        totalBayarInvoice >= total
      ) {
        statusRekonsiliasi = "LUNAS";
      } else if (Math.abs(selisih) <= 1) {
        statusRekonsiliasi = "SESUAI";
      } else if (totalBayarInvoice > totalBayarJurnal) {
        statusRekonsiliasi = "SELISIH_INVOICE";
      } else {
        statusRekonsiliasi = "SELISIH_JURNAL";
      }

      return {
        id: Number(row.id),
        nomor_invoice: row.nomor_invoice,
        tanggal: row.tanggal,
        total,

        bayar_1: Number(row.bayar_1) || 0,
        bayar_2: Number(row.bayar_2) || 0,

        total_bayar_invoice: totalBayarInvoice,
        total_bayar_jurnal: totalBayarJurnal,

        selisih,

        status: row.status,
        status_rekonsiliasi: statusRekonsiliasi,
      };
    });

    const filteredData = statusFilter
      ? data.filter(
          (item) =>
            item.status_rekonsiliasi === statusFilter
        )
      : data;

    const summary = {
      totalInvoice: filteredData.length,

      sesuai: filteredData.filter(
        (x) =>
          x.status_rekonsiliasi === "SESUAI"
      ).length,

      lunas: filteredData.filter(
        (x) =>
          x.status_rekonsiliasi === "LUNAS"
      ).length,

      belumBayar: filteredData.filter(
        (x) =>
          x.status_rekonsiliasi === "BELUM_BAYAR"
      ).length,

      selisihInvoice: filteredData.filter(
        (x) =>
          x.status_rekonsiliasi ===
          "SELISIH_INVOICE"
      ).length,

      selisihJurnal: filteredData.filter(
        (x) =>
          x.status_rekonsiliasi ===
          "SELISIH_JURNAL"
      ).length,

      totalSelisih: filteredData.reduce(
        (total, item) =>
          total + item.selisih,
        0
      ),
    };

    return {
      success: true,
      data: filteredData,
      summary,
    };
  } catch (error) {
    console.error(
      "Error rekonsiliasi invoice:",
      error
    );

    return {
      success: false,
      message:
        "Gagal melakukan rekonsiliasi invoice",
      data: [],
      summary: null,
    };
  }
}