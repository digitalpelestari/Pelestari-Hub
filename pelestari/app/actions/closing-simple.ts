"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getLabaRugiData } from "@/app/actions/labarugi"

const BULAN_NAMES: Record<string, string> = {
  "1": "Januari",
  "2": "Februari",
  "3": "Maret",
  "4": "April",
  "5": "Mei",
  "6": "Juni",
  "7": "Juli",
  "8": "Agustus",
  "9": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember",
}

/**
 * ============================================================
 * HELPER
 * ============================================================
 */

/**
 * Menentukan saldo normal akun.
 *
 * true  = Debit
 * false = Kredit
 */
function isNormalDebit(noAkun: string): boolean {
  const akun = String(noAkun).trim()

  if (akun === "12100" || akun === "14001") {
    return true
  }

  if (
    akun === "41001" ||
    akun === "41002" ||
    akun === "71106" ||
    akun === "81100" ||
    akun === "13003" ||
    akun === "13004"
  ) {
    return false
  }

  return true
}

/**
 * Hitung perubahan saldo tb_akun berdasarkan jurnal.
 */
function calculateSaldoDelta(
  noAkun: string,
  debit: number,
  kredit: number
): number {
  if (isNormalDebit(noAkun)) {
    return debit - kredit
  }

  return kredit - debit
}

/**
 * Format rupiah.
 */
function formatRupiah(value: number): string {
  const amount = Math.abs(Number(value || 0))

  return `Rp ${amount.toLocaleString("id-ID")}`
}

/**
 * Mendapatkan tanggal terakhir suatu periode.
 */
function getClosingDate(
  year: string,
  month: string
): string {
  const date = new Date(
    Number(year),
    Number(month),
    0
  )

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  )
}

/**
 * Mendapatkan batas awal bulan berikutnya.
 */
function getNextMonthDate(
  year: string,
  month: string
): string {
  const date = new Date(
    Number(year),
    Number(month),
    1
  )

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  )
}

/**
 * ============================================================
 * PREVIEW
 * ============================================================
 */

/**
 * Preview Laba Rugi sebelum closing.
 */
export async function getPreviewIkhtisar(
  year: string,
  month: string
) {
  try {
    const reportData =
      await getLabaRugiData(
        year,
        month
      )

    const labaBersih =
      Number(
        reportData?.labaBersih || 0
      )

    const totalPendapatan =
      Number(
        reportData?.totalPendapatan || 0
      )

    const totalBebanUsaha =
      Number(
        reportData?.totalBebanUsaha || 0
      )

    const totalPnbpDanPajak =
      Number(
        reportData?.totalPnbpDanPajak || 0
      )

    const totalBeban =
      totalBebanUsaha +
      totalPnbpDanPajak

    const [rows]: any =
      await db.query(
        `
        SELECT
          no_akun,
          saldo
        FROM tb_akun
        WHERE no_akun IN (
          '13003',
          '13004'
        )
        `
      )

    let saldo13003 = 0
    let saldo13004 = 0

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (
          String(row.no_akun) === "13003"
        ) {
          saldo13003 =
            Number(row.saldo || 0)
        }

        if (
          String(row.no_akun) === "13004"
        ) {
          saldo13004 =
            Number(row.saldo || 0)
        }
      }
    }

    return {
      success: true,
      data: {
        totalPendapatan,
        totalBeban,
        labaBersih,
        saldo13003,
        saldo13004,
      },
    }
  } catch (error: any) {
    console.error(
      "Gagal membaca preview laba rugi:",
      error
    )

    return {
      success: false,
      message:
        error?.message ||
        "Gagal memuat data.",
    }
  }
}

/**
 * ============================================================
 * AMBIL DETAIL CLOSING
 * ============================================================
 *
 * Pendapatan:
 *   tb_invoice
 *
 * Beban:
 *   tb_jurnal + tb_jurnal_item
 *
 * Penting:
 *
 * PPN dan PNBP dalam laporan Laba Rugi diperlakukan
 * sebagai BEBAN walaupun transaksi asalnya berada
 * di sisi KREDIT.
 */
async function getClosingAccounts(
  year: string,
  month: string
) {
  const startDate =
    `${year}-${String(month).padStart(2, "0")}-01`

  const endDate =
    getNextMonthDate(
      year,
      month
    )

  const accounts: {
    noAkun: string
    namaAkun: string
    tipe: "pendapatan" | "beban"
    nilai: number
  }[] = []

  // ==========================================================
  // 1. PENDAPATAN
  // ==========================================================

  const [invoiceRows]: any =
    await db.query(
      `
      SELECT
        LOWER(TRIM(jenis_kegiatan)) AS jenis_kegiatan,
        COALESCE(SUM(total), 0) AS total
      FROM tb_invoice
      WHERE
        DATE(created_at) >= ?
        AND DATE(created_at) < ?
        AND LOWER(TRIM(jenis_kegiatan)) IN (
          'pelatihan',
          'konsultan',
          'konsultasi'
        )
      GROUP BY
        LOWER(TRIM(jenis_kegiatan))
      `,
      [
        startDate,
        endDate,
      ]
    )

  let totalPelatihan = 0
  let totalKonsultan = 0

  if (Array.isArray(invoiceRows)) {
    for (const row of invoiceRows) {
      const jenis =
        String(
          row.jenis_kegiatan || ""
        ).toLowerCase()

      const total =
        Number(row.total || 0)

      if (jenis === "pelatihan") {
        totalPelatihan += total
      }

      if (
        jenis === "konsultan" ||
        jenis === "konsultasi"
      ) {
        totalKonsultan += total
      }
    }
  }

  if (totalPelatihan > 0) {
    accounts.push({
      noAkun: "41001",
      namaAkun:
        "Pendapatan Jasa Pelatihan",
      tipe: "pendapatan",
      nilai: totalPelatihan,
    })
  }

  if (totalKonsultan > 0) {
    accounts.push({
      noAkun: "41002",
      namaAkun:
        "Pendapatan Jasa Konsultan",
      tipe: "pendapatan",
      nilai: totalKonsultan,
    })
  }

  // ==========================================================
  // 2. BEBAN
  // ==========================================================

  const [expenseRows]: any =
    await db.query(
      `
      SELECT
        ji.no_akun,
        COALESCE(
          a.nama_akun,
          ji.no_akun
        ) AS nama_akun,
        COALESCE(
          SUM(ji.debit),
          0
        ) AS total_debit,
        COALESCE(
          SUM(ji.kredit),
          0
        ) AS total_kredit
      FROM tb_jurnal j
      INNER JOIN tb_jurnal_item ji
        ON ji.jurnal_id = j.id
      LEFT JOIN tb_akun a
        ON a.no_akun = ji.no_akun
      WHERE
        j.tanggal >= ?
        AND j.tanggal < ?
        AND (
          ji.no_akun LIKE '5%'
          OR ji.no_akun LIKE '6%'
          OR ji.no_akun = '71106'
          OR ji.no_akun = '81100'
        )
        AND ji.no_akun NOT IN (
          '13003',
          '13004'
        )
      GROUP BY
        ji.no_akun,
        a.nama_akun
      ORDER BY
        ji.no_akun
      `,
      [
        startDate,
        endDate,
      ]
    )

  if (Array.isArray(expenseRows)) {
    for (const row of expenseRows) {
      const noAkun =
        String(row.no_akun)

      const debit =
        Number(
          row.total_debit || 0
        )

      const kredit =
        Number(
          row.total_kredit || 0
        )

      let nilai = 0

      /**
       * 71106 PPN dan 81100 PNBP
       * merupakan beban berdasarkan
       * struktur Laba Rugi.
       *
       * Transaksi sumbernya kredit,
       * sehingga nilai bebannya diambil
       * dari sisi kredit.
       */
      if (
        noAkun === "71106" ||
        noAkun === "81100"
      ) {
        nilai = kredit - debit
      } else {
        /**
         * Beban normal:
         * Debit - Kredit
         */
        nilai = debit - kredit
      }

      if (nilai <= 0) {
        continue
      }

      accounts.push({
        noAkun,
        namaAkun:
          String(
            row.nama_akun ||
            noAkun
          ),
        tipe: "beban",
        nilai,
      })
    }
  }

  return accounts
}

/**
 * ============================================================
 * INSERT JURNAL
 * ============================================================
 */

async function insertJurnal(
  connection: any,
  tanggal: string,
  noRegistrasi: string,
  noReferensi: string,
  keterangan: string
): Promise<number> {
  const [result]: any =
    await connection.query(
      `
      INSERT INTO tb_jurnal (
        tanggal,
        no_registrasi,
        no_referensi,
        keterangan
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        tanggal,
        noRegistrasi,
        noReferensi,
        keterangan,
      ]
    )

  return Number(
    result.insertId
  )
}

/**
 * Insert item jurnal.
 */
async function insertJurnalItems(
  connection: any,
  jurnalId: number,
  items: {
    noAkun: string
    debit: number
    kredit: number
    keterangan: string
  }[]
) {
  for (const item of items) {
    await connection.query(
      `
      INSERT INTO tb_jurnal_item (
        jurnal_id,
        no_akun,
        debit,
        kredit,
        keterangan
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        jurnalId,
        item.noAkun,
        item.debit,
        item.kredit,
        item.keterangan,
      ]
    )
  }
}

/**
 * Update saldo tb_akun mengikuti normal balance.
 */
async function updateAccountSaldo(
  connection: any,
  noAkun: string,
  debit: number,
  kredit: number
) {
  const delta =
    calculateSaldoDelta(
      noAkun,
      debit,
      kredit
    )

  if (delta === 0) {
    return
  }

  await connection.query(
    `
    UPDATE tb_akun
    SET saldo =
      COALESCE(saldo, 0) + ?
    WHERE no_akun = ?
    `,
    [
      delta,
      noAkun,
    ]
  )
}

/**
 * ============================================================
 * EXECUTE TWO STEP CLOSING
 * ============================================================
 */
export async function executeTwoStepClosing(
  year: string,
  month: string
) {
  const connection =
    await db.getConnection()

  try {
    const monthLabel =
      BULAN_NAMES[month] ||
      `Bulan ${month}`

    // ========================================================
    // 1. AMBIL LAPORAN LABA RUGI
    // ========================================================

    const reportData =
      await getLabaRugiData(
        year,
        month
      )

    const labaBersih =
      Number(
        reportData?.labaBersih || 0
      )

    const totalPendapatanReport =
      Number(
        reportData?.totalPendapatan || 0
      )

    const totalBebanUsahaReport =
      Number(
        reportData?.totalBebanUsaha || 0
      )

    const totalPnbpDanPajakReport =
      Number(
        reportData?.totalPnbpDanPajak || 0
      )

    const totalBebanReport =
      totalBebanUsahaReport +
      totalPnbpDanPajakReport

    if (labaBersih === 0) {
      return {
        success: false,
        message:
          `Laba/Rugi ${monthLabel} ${year} ` +
          `adalah Rp 0. Tidak ada closing yang perlu diproses.`,
      }
    }

    // ========================================================
    // 2. DETAIL YANG AKAN DITUTUP
    // ========================================================

    const closingAccounts =
      await getClosingAccounts(
        year,
        month
      )

    if (
      closingAccounts.length === 0
    ) {
      return {
        success: false,
        message:
          `Tidak ditemukan detail pendapatan atau beban ` +
          `untuk ${monthLabel} ${year}.`,
      }
    }

    const totalPendapatanDetail =
      closingAccounts
        .filter(
          (account) =>
            account.tipe ===
            "pendapatan"
        )
        .reduce(
          (sum, account) =>
            sum + account.nilai,
          0
        )

    const totalBebanDetail =
      closingAccounts
        .filter(
          (account) =>
            account.tipe ===
            "beban"
        )
        .reduce(
          (sum, account) =>
            sum + account.nilai,
          0
        )

    const labaBersihDetail =
      totalPendapatanDetail -
      totalBebanDetail

    // ========================================================
    // 3. VALIDASI DENGAN LAPORAN LABA RUGI
    // ========================================================

    if (
      Math.abs(
        totalPendapatanDetail -
        totalPendapatanReport
      ) > 1
    ) {
      throw new Error(
        `Total pendapatan detail tidak sama dengan ` +
        `Laporan Laba Rugi. ` +
        `Laporan: ${formatRupiah(totalPendapatanReport)}, ` +
        `Detail: ${formatRupiah(totalPendapatanDetail)}.`
      )
    }

    if (
      Math.abs(
        totalBebanDetail -
        totalBebanReport
      ) > 1
    ) {
      throw new Error(
        `Total beban detail tidak sama dengan ` +
        `Laporan Laba Rugi. ` +
        `Laporan: ${formatRupiah(totalBebanReport)}, ` +
        `Detail: ${formatRupiah(totalBebanDetail)}.`
      )
    }

    if (
      Math.abs(
        labaBersihDetail -
        labaBersih
      ) > 1
    ) {
      throw new Error(
        `Laba Bersih detail tidak sama dengan ` +
        `Laporan Laba Rugi. ` +
        `Laporan: ${formatRupiah(labaBersih)}, ` +
        `Detail: ${formatRupiah(labaBersihDetail)}.`
      )
    }

    // ========================================================
    // 4. IDENTITAS CLOSING
    // ========================================================

    const periode =
      `${year}-${String(month).padStart(2, "0")}`

    const noRegistrasi =
      `CL_${String(month).padStart(2, "0")}/${String(year).slice(-2)}`

    const tanggalClosing =
      getClosingDate(
        year,
        month
      )

    const keterangan =
      `Closing Laba Rugi ${monthLabel} ${year}`

    // ========================================================
    // 5. CEK DUPLIKASI
    // ========================================================

    const [
      existingClosing,
    ]: any =
      await connection.query(
        `
        SELECT id
        FROM tb_jurnal
        WHERE no_registrasi = ?
        LIMIT 1
        `,
        [
          noRegistrasi,
        ]
      )

    if (
      Array.isArray(existingClosing) &&
      existingClosing.length > 0
    ) {
      return {
        success: false,
        message:
          `Closing ${monthLabel} ${year} sudah pernah dilakukan.`,
      }
    }

    // ========================================================
    // 6. BEGIN TRANSACTION
    // ========================================================

    await connection.beginTransaction()

    // ========================================================
    // 7. LOCK & VALIDASI AKUN
    // ========================================================

    const [
      akunRows,
    ]: any =
      await connection.query(
        `
        SELECT
          no_akun,
          nama_akun,
          saldo
        FROM tb_akun
        WHERE no_akun IN (
          '13003',
          '13004'
        )
        FOR UPDATE
        `
      )

    const akunSet =
      new Set<string>()

    if (Array.isArray(akunRows)) {
      for (const row of akunRows) {
        akunSet.add(
          String(row.no_akun)
        )
      }
    }

    if (
      !akunSet.has("13003")
    ) {
      throw new Error(
        "Akun 13003 Laba Tahun Berjalan tidak ditemukan."
      )
    }

    if (
      !akunSet.has("13004")
    ) {
      throw new Error(
        "Akun 13004 Ikhtisar Laba/Rugi tidak ditemukan."
      )
    }

    // ========================================================
    // 8. VALIDASI SEMUA AKUN DETAIL
    // ========================================================

    const detailCodes =
      closingAccounts.map(
        (account) =>
          account.noAkun
      )

    const placeholders =
      detailCodes
        .map(() => "?")
        .join(",")

    const [
      detailRows,
    ]: any =
      await connection.query(
        `
        SELECT no_akun
        FROM tb_akun
        WHERE no_akun IN (${placeholders})
        FOR UPDATE
        `,
        detailCodes
      )

    const detailSet =
      new Set<string>()

    if (Array.isArray(detailRows)) {
      for (const row of detailRows) {
        detailSet.add(
          String(row.no_akun)
        )
      }
    }

    const missingAccounts =
      closingAccounts.filter(
        (account) =>
          !detailSet.has(
            account.noAkun
          )
      )

    if (
      missingAccounts.length > 0
    ) {
      throw new Error(
        "Akun berikut tidak ditemukan di tb_akun: " +
        missingAccounts
          .map(
            (account) =>
              `${account.noAkun} ${account.namaAkun}`
          )
          .join(", ")
      )
    }

    // ========================================================
    // STEP 1
    // TUTUP PENDAPATAN DAN BEBAN KE 13004
    // ========================================================

    const step1Items: {
      noAkun: string
      debit: number
      kredit: number
      keterangan: string
    }[] = []

    // ========================================================
    // STEP 1A
    // PENDAPATAN
    //
    // Dr Pendapatan
    //    Cr 13004
    // ========================================================

    for (
      const account of closingAccounts
    ) {
      if (
        account.tipe !==
        "pendapatan"
      ) {
        continue
      }

      if (
        account.nilai <= 0
      ) {
        continue
      }

      step1Items.push({
        noAkun:
          account.noAkun,
        debit:
          account.nilai,
        kredit:
          0,
        keterangan:
          `Penutupan ${account.namaAkun} ${monthLabel} ${year}`,
      })

      step1Items.push({
        noAkun:
          "13004",
        debit:
          0,
        kredit:
          account.nilai,
        keterangan:
          `Penutupan ${account.namaAkun} ${monthLabel} ${year}`,
      })
    }

    // ========================================================
    // STEP 1B
    // BEBAN
    //
    // Dr 13004
    //    Cr Beban
    //
    // Termasuk:
    // 51101
    // 51102
    // 61115
    // 71106
    // 81100
    // ========================================================

    for (
      const account of closingAccounts
    ) {
      if (
        account.tipe !==
        "beban"
      ) {
        continue
      }

      if (
        account.nilai <= 0
      ) {
        continue
      }

      step1Items.push({
        noAkun:
          "13004",
        debit:
          account.nilai,
        kredit:
          0,
        keterangan:
          `Penutupan ${account.namaAkun} ${monthLabel} ${year}`,
      })

      step1Items.push({
        noAkun:
          account.noAkun,
        debit:
          0,
        kredit:
          account.nilai,
        keterangan:
          `Penutupan ${account.namaAkun} ${monthLabel} ${year}`,
      })
    }

    // ========================================================
    // 9. VALIDASI STEP 1 BALANCE
    // ========================================================

    const step1Debit =
      step1Items.reduce(
        (sum, item) =>
          sum + item.debit,
        0
      )

    const step1Kredit =
      step1Items.reduce(
        (sum, item) =>
          sum + item.kredit,
        0
      )

    if (
      step1Debit !==
      step1Kredit
    ) {
      throw new Error(
        `Jurnal Step 1 tidak balance. ` +
        `Debit: ${formatRupiah(step1Debit)}, ` +
        `Kredit: ${formatRupiah(step1Kredit)}.`
      )
    }

    // ========================================================
    // 10. INSERT STEP 1
    // ========================================================

    const jurnalStep1 =
      await insertJurnal(
        connection,
        tanggalClosing,
        noRegistrasi,
        `${periode}-STEP1`,
        `${keterangan} - Penutupan Pendapatan dan Beban`
      )

    await insertJurnalItems(
      connection,
      jurnalStep1,
      step1Items
    )

    // ========================================================
    // 11. UPDATE SALDO STEP 1
    // ========================================================

    for (
      const item of step1Items
    ) {
      await updateAccountSaldo(
        connection,
        item.noAkun,
        item.debit,
        item.kredit
      )
    }

    // ========================================================
    // STEP 2
    // TUTUP 13004 KE 13003
    // ========================================================

    const nilaiClosing =
      Math.abs(labaBersih)

    let step2Items: {
      noAkun: string
      debit: number
      kredit: number
      keterangan: string
    }[]

    if (
      labaBersih > 0
    ) {
      // ======================================================
      // LABA
      //
      // 13004 mempunyai saldo KREDIT
      //
      // Dr 13004
      //    Cr 13003
      // ======================================================

      step2Items = [
        {
          noAkun:
            "13004",
          debit:
            nilaiClosing,
          kredit:
            0,
          keterangan:
            `Pemindahan Laba ${monthLabel} ${year} ke Laba Tahun Berjalan`,
        },
        {
          noAkun:
            "13003",
          debit:
            0,
          kredit:
            nilaiClosing,
          keterangan:
            `Pemindahan Laba ${monthLabel} ${year} ke Laba Tahun Berjalan`,
        },
      ]
    } else {
      // ======================================================
      // RUGI
      //
      // 13004 mempunyai saldo DEBIT
      //
      // Dr 13003
      //    Cr 13004
      // ======================================================

      step2Items = [
        {
          noAkun:
            "13003",
          debit:
            nilaiClosing,
          kredit:
            0,
          keterangan:
            `Pemindahan Rugi ${monthLabel} ${year} ke Laba Tahun Berjalan`,
        },
        {
          noAkun:
            "13004",
          debit:
            0,
          kredit:
            nilaiClosing,
          keterangan:
            `Pemindahan Rugi ${monthLabel} ${year} ke Laba Tahun Berjalan`,
        },
      ]
    }

    // ========================================================
    // 12. VALIDASI STEP 2
    // ========================================================

    const step2Debit =
      step2Items.reduce(
        (sum, item) =>
          sum + item.debit,
        0
      )

    const step2Kredit =
      step2Items.reduce(
        (sum, item) =>
          sum + item.kredit,
        0
      )

    if (
      step2Debit !==
      step2Kredit
    ) {
      throw new Error(
        `Jurnal Step 2 tidak balance.`
      )
    }

    // ========================================================
    // 13. INSERT STEP 2
    // ========================================================

    const jurnalStep2 =
      await insertJurnal(
        connection,
        tanggalClosing,
        `${noRegistrasi}_2`,
        `${periode}-STEP2`,
        `${keterangan} - Pemindahan ke Laba Tahun Berjalan`
      )

    await insertJurnalItems(
      connection,
      jurnalStep2,
      step2Items
    )

    // ========================================================
    // 14. UPDATE SALDO STEP 2
    // ========================================================

    for (
      const item of step2Items
    ) {
      await updateAccountSaldo(
        connection,
        item.noAkun,
        item.debit,
        item.kredit
      )
    }

    // ========================================================
    // 15. VALIDASI 13004
    // ========================================================

    const [
      finalRows,
    ]: any =
      await connection.query(
        `
        SELECT
          no_akun,
          saldo
        FROM tb_akun
        WHERE no_akun IN (
          '13003',
          '13004'
        )
        `
      )

    let finalSaldo13003 = 0
    let finalSaldo13004 = 0

    if (Array.isArray(finalRows)) {
      for (const row of finalRows) {
        if (
          String(row.no_akun) ===
          "13003"
        ) {
          finalSaldo13003 =
            Number(
              row.saldo || 0
            )
        }

        if (
          String(row.no_akun) ===
          "13004"
        ) {
          finalSaldo13004 =
            Number(
              row.saldo || 0
            )
        }
      }
    }

    /**
     * Karena 13004 adalah akun sementara,
     * saldo akhirnya harus kembali ke saldo sebelum
     * proses closing.
     *
     * Pada kondisi yang mulia saat ini:
     *
     * 13004 = 0
     *
     * sehingga hasil akhirnya wajib 0.
     */
    if (
      finalSaldo13004 !== 0
    ) {
      throw new Error(
        `Saldo 13004 setelah closing bukan Rp 0. ` +
        `Saldo sekarang: ${formatRupiah(finalSaldo13004)}.`
      )
    }

    // ========================================================
    // 16. COMMIT
    // ========================================================

    await connection.commit()

    // ========================================================
    // 17. REVALIDATE
    // ========================================================

    revalidatePath("/neraca")
    revalidatePath("/closing")
    revalidatePath("/jurnal")
    revalidatePath("/riwayat-transaksi")

    const status =
      labaBersih > 0
        ? "LABA"
        : "RUGI"

    const nilaiFormatted =
      formatRupiah(labaBersih)

    return {
      success: true,
      message:
        `Closing ${monthLabel} ${year} berhasil. ` +
        `${status}: ${nilaiFormatted}. ` +
        `Step 1 dan Step 2 berhasil dibuat. ` +
        `Saldo 13004 telah kembali Rp 0.`,

      data: {
        year,
        month,
        periode,
        noRegistrasi,
        jurnalStep1,
        jurnalStep2,
        totalPendapatan:
          totalPendapatanReport,
        totalBeban:
          totalBebanReport,
        labaBersih,
        saldo13003:
          finalSaldo13003,
        saldo13004:
          finalSaldo13004,
      },
    }

  } catch (error: any) {
    await connection.rollback()

    console.error(
      "Gagal eksekusi closing:",
      error
    )

    return {
      success: false,
      message:
        error?.message ||
        "Terjadi kesalahan saat memproses closing.",
    }
  } finally {
    connection.release()
  }
}
