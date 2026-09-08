"use server"

import { db } from "@/lib/db";

// =========================================================================
// HELPER: nama bulan Indonesia singkat, index 1-12
// =========================================================================
const NAMA_BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

// Mengisi 12 bulan penuh (Jan-Des) walau data dari DB tidak lengkap,
// supaya chart tidak "putus" di bulan yang tidak ada transaksi.
function lengkapiBulan<T extends Record<string, any>>(
  rows: { bulan: number; [key: string]: any }[],
  defaultFields: Omit<T, "bulan">
): T[] {
  const map = new Map<number, any>();
  rows.forEach((r) => map.set(Number(r.bulan), r));

  return Array.from({ length: 12 }, (_, i) => {
    const bulanKe = i + 1;
    const existing = map.get(bulanKe);
    return {
      bulan: NAMA_BULAN[i],
      ...defaultFields,
      ...(existing
        ? Object.fromEntries(
            Object.keys(defaultFields).map((key) => [
              key,
              Number(existing[key]) || 0,
            ])
          )
        : {}),
    } as unknown as T;
  });
}

// =========================================================================
// FUNGSI UTAMA: RINGKASAN DASHBOARD
// =========================================================================
export async function getDashboardSummary() {
  try {
    // -----------------------------------------------------------------
    // 1. GRAFIK BIAYA BULANAN
    // tb_jurnal -> tb_jurnal_item -> tb_akun -> tb_kelompok_biaya
    // Ambil akun yang tergolong BEBAN, tahun berjalan
    // -----------------------------------------------------------------
    const [biayaRows]: any = await db.query(
      `SELECT 
         MONTH(j.tanggal) as bulan,
         SUM(i.debit) as biaya
       FROM tb_jurnal j
       JOIN tb_jurnal_item i ON j.id = i.jurnal_id
       JOIN tb_akun a ON i.no_akun = a.no_akun
       WHERE a.kelompok_biaya_id IN (
         SELECT id FROM tb_kelompok_biaya WHERE kelompok_biaya LIKE '%BEBAN%'
       )
       AND YEAR(j.tanggal) = YEAR(CURDATE())
       GROUP BY MONTH(j.tanggal)
       ORDER BY bulan`
    );

    const biayaBulanan = lengkapiBulan<{ bulan: string; biaya: number }>(
      biayaRows,
      { biaya: 0 }
    );

    // -----------------------------------------------------------------
    // 2. CASHFLOW BULANAN
    // tb_jurnal + tb_jurnal_item: kredit = uang masuk, debit = uang keluar
    // -----------------------------------------------------------------
    const [cashflowRows]: any = await db.query(
      `SELECT 
         MONTH(j.tanggal) as bulan,
         SUM(CASE WHEN i.kredit > 0 THEN i.kredit ELSE 0 END) as masuk,
         SUM(CASE WHEN i.debit > 0 THEN i.debit ELSE 0 END) as keluar
       FROM tb_jurnal j
       JOIN tb_jurnal_item i ON j.id = i.jurnal_id
       WHERE YEAR(j.tanggal) = YEAR(CURDATE())
       GROUP BY MONTH(j.tanggal)
       ORDER BY bulan`
    );

    const cashflowBulanan = lengkapiBulan<{
      bulan: string;
      masuk: number;
      keluar: number;
    }>(cashflowRows, { masuk: 0, keluar: 0 });

    // -----------------------------------------------------------------
    // 3. TOTAL PRODUKSI TAHUNAN
    // Asumsi: total peserta (jumlah_peserta + jumlah_peserta_2) dari
    // seluruh invoice tahun berjalan. SESUAIKAN jika definisi "produksi"
    // di perusahaan Anda berbeda (mis. cukup COUNT(id) invoice saja).
    // -----------------------------------------------------------------
    const [produksiRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(jumlah_peserta), 0) + COALESCE(SUM(jumlah_peserta_2), 0) as total_produksi
       FROM tb_invoice
       WHERE YEAR(tanggal) = YEAR(CURDATE())`
    );
    const totalProduksiTahunan = Number(produksiRows?.[0]?.total_produksi) || 0;

    // -----------------------------------------------------------------
    // 4. TOTAL UTANG OUTSTANDING
    // Dari tb_invoice yang belum lunas (piutang ke customer)
    // + tb_po yang belum lunas (utang ke supplier), jika tabel tersedia.
    // -----------------------------------------------------------------
    const [utangInvoiceRows]: any = await db.query(
      `SELECT 
         COALESCE(SUM(total - (COALESCE(bayar_1,0) + COALESCE(bayar_2,0))), 0) as sisa
       FROM tb_invoice
       WHERE status != 'Lunas'`
    );
    const outstandingInvoice = Number(utangInvoiceRows?.[0]?.sisa) || 0;

    // tb_po opsional: query dibungkus try/catch sendiri supaya jika tabel/kolom
    // belum ada atau namanya berbeda, dashboard tetap jalan (tidak error total).
    // SESUAIKAN nama kolom sesuai skema tb_po Anda yang sebenarnya.
    let outstandingPO = 0;
    try {
      const [utangPORows]: any = await db.query(
        `SELECT 
           COALESCE(SUM(total - COALESCE(dibayar, 0)), 0) as sisa
         FROM tb_po
         WHERE status_pembayaran != 'Lunas'`
      );
      outstandingPO = Number(utangPORows?.[0]?.sisa) || 0;
    } catch (err) {
      console.warn(
        "Lewati perhitungan utang tb_po (tabel/kolom belum sesuai):",
        (err as any)?.message
      );
    }

    const totalUtangOutstanding = outstandingInvoice + outstandingPO;

    return {
      success: true,
      data: {
        biayaBulanan,
        cashflowBulanan,
        totalProduksiTahunan,
        totalUtangOutstanding,
      },
    };
  } catch (error: any) {
    console.error("DASHBOARD_SUMMARY_ERROR:", error.message);
    return {
      success: false,
      message: "Gagal mengambil ringkasan dashboard: " + error.message,
    };
  }
}