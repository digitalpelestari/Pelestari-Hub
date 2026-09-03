"use server";

import { db } from "@/lib/db";

export type ReferensiTipe = "invoice" | "po";

export interface ReferensiInvoiceData {
  tipe: "invoice";
  nomor: string;
  perusahaan_tujuan: string;
  npwp: string | null;
  alamat_perusahaan: string | null;
  tanggal: string;
  tanggal_jatuhtempo: string | null;
  total: number;
  bayar_1: number;
  bayar_2: number;
  sisa_tagihan: number;
  status: string;
}

export interface ReferensiPoData {
  tipe: "po";
  nomor: string;
  vendor_nama: string;
  vendor_pic: string | null;
  vendor_email: string | null;
  tanggal_po: string;
  jatuh_tempo: string | null;
  tempo_hari: number | null;
  total_harga: number;
  status_pembayaran: string;
}

export type ReferensiMatch =
  | { found: "invoice"; data: ReferensiInvoiceData }
  | { found: "po"; data: ReferensiPoData }
  | { found: null };

/**
 * Lookup No. Referensi ke tabel tb_invoice lalu tb_po.
 * Dipakai oleh halaman Kasir untuk auto-detect invoice/PO dan mengisi otomatis baris jurnal.
 */
export async function lookupReferensi(noRef: string): Promise<ReferensiMatch> {
  const trimmed = (noRef || "").trim();
  if (trimmed.length < 3) return { found: null };

  const like = `%${trimmed}%`;

  try {
    const [invoices]: any = await db.query(
      `SELECT nomor_invoice, perusahaan_tujuan, npwp, alamat_perusahaan,
              tanggal, tanggal_jatuhtempo, total, bayar_1, bayar_2, status
       FROM tb_invoice
       WHERE nomor_invoice LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [like]
    );

    if (Array.isArray(invoices) && invoices.length > 0) {
      const inv = invoices[0];
      const total = Number(inv.total) || 0;
      const b1 = Number(inv.bayar_1) || 0;
      const b2 = Number(inv.bayar_2) || 0;
      const sisa = total - b1 - b2;
      return {
        found: "invoice",
        data: {
          tipe: "invoice",
          nomor: inv.nomor_invoice,
          perusahaan_tujuan: inv.perusahaan_tujuan || "",
          npwp: inv.npwp || null,
          alamat_perusahaan: inv.alamat_perusahaan || null,
          tanggal: inv.tanggal,
          tanggal_jatuhtempo: inv.tanggal_jatuhtempo || null,
          total,
          bayar_1: b1,
          bayar_2: b2,
          sisa_tagihan: sisa,
          status: inv.status || "",
        },
      };
    }

    const [pos]: any = await db.query(
      `SELECT nomor_po, vendor_nama, vendor_pic, vendor_email,
              tanggal_po, jatuh_tempo, tempo_hari, total_harga, status_pembayaran
       FROM tb_po
       WHERE nomor_po LIKE ?
       ORDER BY id_po DESC
       LIMIT 1`,
      [like]
    );

    if (Array.isArray(pos) && pos.length > 0) {
      const po = pos[0];
      return {
        found: "po",
        data: {
          tipe: "po",
          nomor: po.nomor_po,
          vendor_nama: po.vendor_nama || "",
          vendor_pic: po.vendor_pic || null,
          vendor_email: po.vendor_email || null,
          tanggal_po: po.tanggal_po,
          jatuh_tempo: po.jatuh_tempo || null,
          tempo_hari: po.tempo_hari != null ? Number(po.tempo_hari) : null,
          total_harga: Number(po.total_harga) || 0,
          status_pembayaran: po.status_pembayaran || "",
        },
      };
    }

    return { found: null };
  } catch (error: any) {
    console.error("LOOKUP_REFERENSI_ERROR:", error.message);
    return { found: null };
  }
}