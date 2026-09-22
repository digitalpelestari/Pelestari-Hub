"use server"

import { db } from "@/lib/db"

export interface BiayaBulanan {
  bulan: string
  biaya: number
}

export interface CashflowBulanan {
  bulan: string
  masuk: number
  keluar: number
}

export interface DashboardSummary {
  invoicePelatihan: number
  invoiceKonsultan: number
  nilaiInvoicePelatihan: number
  nilaiInvoiceKonsultan: number
  uangMasuk: number
  biayaBulanan: BiayaBulanan[]
  cashflowBulanan: CashflowBulanan[]
}

export async function getDashboardSummary(): Promise<{
  success: boolean
  data?: DashboardSummary
  error?: string
}> {
  try {
    // ============================================================
    // 1. RINGKASAN INVOICE
    // ============================================================

    const [invoiceRows] = await db.query(`
      SELECT
        COUNT(
          CASE
            WHEN jenis_kegiatan = 'pelatihan'
            THEN 1
          END
        ) AS invoicePelatihan,

        COUNT(
          CASE
            WHEN jenis_kegiatan = 'konsultan'
            THEN 1
          END
        ) AS invoiceKonsultan,

        COALESCE(
          SUM(
            CASE
              WHEN jenis_kegiatan = 'pelatihan'
              THEN COALESCE(total, 0)
              ELSE 0
            END
          ),
          0
        ) AS nilaiInvoicePelatihan,

        COALESCE(
          SUM(
            CASE
              WHEN jenis_kegiatan = 'konsultan'
              THEN COALESCE(total, 0)
              ELSE 0
            END
          ),
          0
        ) AS nilaiInvoiceKonsultan,

        COALESCE(
          SUM(
            COALESCE(bayar_1, 0) +
            COALESCE(bayar_2, 0)
          ),
          0
        ) AS uangMasuk

      FROM tb_invoice
    `)

    const invoiceRow = (invoiceRows as any[])[0]

    // ============================================================
    // 2. GRAFIK BIAYA BULANAN
    // ============================================================

    const [biayaRows] = await db.query(`
      SELECT
        MONTH(tanggal) AS bulanNomor,
        COALESCE(SUM(total), 0) AS biaya
      FROM tb_rincian_direksi
      WHERE YEAR(tanggal) = YEAR(CURDATE())
      GROUP BY MONTH(tanggal)
      ORDER BY MONTH(tanggal)
    `)

    const biayaMap = new Map<number, number>()

    for (const row of biayaRows as any[]) {
      biayaMap.set(
        Number(row.bulanNomor),
        Number(row.biaya ?? 0)
      )
    }

    // ============================================================
    // 3. CASHFLOW UANG MASUK PER BULAN
    // ============================================================

    const [masukRows] = await db.query(`
      SELECT
        MONTH(
          CASE
            WHEN bayar_2 IS NOT NULL AND bayar_2 > 0
              THEN tanggal_bayar_2
            ELSE tanggal_bayar_1
          END
        ) AS bulanNomor,

        COALESCE(
          SUM(
            COALESCE(bayar_1, 0) +
            COALESCE(bayar_2, 0)
          ),
          0
        ) AS masuk

      FROM tb_invoice

      WHERE YEAR(
        CASE
          WHEN bayar_2 IS NOT NULL AND bayar_2 > 0
            THEN tanggal_bayar_2
          ELSE tanggal_bayar_1
        END
      ) = YEAR(CURDATE())

      GROUP BY MONTH(
        CASE
          WHEN bayar_2 IS NOT NULL AND bayar_2 > 0
            THEN tanggal_bayar_2
          ELSE tanggal_bayar_1
        END
      )

      ORDER BY bulanNomor
    `)

    const masukMap = new Map<number, number>()

    for (const row of masukRows as any[]) {
      masukMap.set(
        Number(row.bulanNomor),
        Number(row.masuk ?? 0)
      )
    }

    // ============================================================
    // 4. GABUNGKAN DATA 12 BULAN
    // ============================================================

    const namaBulan = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ]

    const biayaBulanan: BiayaBulanan[] = []
    const cashflowBulanan: CashflowBulanan[] = []

    for (let bulan = 1; bulan <= 12; bulan++) {
      const biaya = biayaMap.get(bulan) ?? 0
      const masuk = masukMap.get(bulan) ?? 0

      biayaBulanan.push({
        bulan: namaBulan[bulan - 1],
        biaya,
      })

      cashflowBulanan.push({
        bulan: namaBulan[bulan - 1],
        masuk,
        keluar: biaya,
      })
    }

    // ============================================================
    // 5. RETURN
    // ============================================================

    return {
      success: true,

      data: {
        invoicePelatihan: Number(
          invoiceRow.invoicePelatihan ?? 0
        ),

        invoiceKonsultan: Number(
          invoiceRow.invoiceKonsultan ?? 0
        ),

        nilaiInvoicePelatihan: Number(
          invoiceRow.nilaiInvoicePelatihan ?? 0
        ),

        nilaiInvoiceKonsultan: Number(
          invoiceRow.nilaiInvoiceKonsultan ?? 0
        ),

        uangMasuk: Number(
          invoiceRow.uangMasuk ?? 0
        ),

        biayaBulanan,
        cashflowBulanan,
      },
    }
  } catch (error) {
    console.error("getDashboardSummary error:", error)

    return {
      success: false,
      error: "Gagal mengambil data dashboard",
    }
  }
}