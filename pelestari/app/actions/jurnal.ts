"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { lookupReferensi } from "@/app/actions/referensi";

interface JurnalItemPayload {
  accountCode: string;
  debit: number;
  kredit: number;
  keterangan?: string;
}

interface JurnalPayload {
  tanggal: string;
  noRegistrasi: string;
  noReferensi: string;
  invoiceId?: number | null;
  penerimaId?: number | null;
  keterangan: string;
  items: JurnalItemPayload[];
}

/**
 * Helper: Cek apakah akun bersaldo normal Debit atau Kredit
 * Kepala 1: Aset (Debit)
 * Kepala 5/6/7/8/9: Beban/Biaya Operasional & Non-Operasional (Debit)
 * Kepala 2: Utang/Liabilitas (Kredit)
 * Kepala 3: Ekuitas/Modal (Kredit)
 * Kepala 4: Pendapatan/Penjualan (Kredit)
 */
function isNormalDebit(noAkun: string): boolean {
  const prefix = String(noAkun).trim().charAt(0);
  return prefix === "1" || prefix === "5" || prefix === "6" || prefix === "7" || prefix === "8" || prefix === "9";
}

/**
 * Helper: Update saldo akun berdasarkan posisi normal
 * isRevert = false -> Transaksi Masuk (Posting)
 * isRevert = true  -> Transaksi Dibatalkan/Dihapus (Reversal)
 */
async function applySaldoAkun(
  connection: any,
  noAkun: string,
  debit: number,
  kredit: number,
  isRevert: boolean = false
) {
  const normalDebit = isNormalDebit(noAkun);

  // Jika akun bertambah saat di-debit (Aset, Beban)
  // Perubahan = Debit - Kredit
  // Jika akun bertambah saat di-kredit (Utang, Modal, Pendapatan)
  // Perubahan = Kredit - Debit
  let netDelta = normalDebit ? (debit - kredit) : (kredit - debit);

  // Jika dibatalkan (revert), balik arah nilainya
  if (isRevert) {
    netDelta = -netDelta;
  }

  if (netDelta !== 0) {
    await connection.query(
      "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?",
      [netDelta, noAkun]
    );
  }
}

/**
 * 🚀 ACTION: EKSPOR DATA JURNAL UMUM KE EXCEL (11 KOLOM - DENGAN NO REFERENSI & PENERIMA)
 */
export async function exportJurnalToExcel(
  startDate?: string,
  endDate?: string
) {
  try {
    const result = await getJurnalList(startDate, endDate);
    const jurnalList = result.data;

    if (!result.success) {
      throw new Error(result.message || "Gagal mengambil data jurnal");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Jurnal Pembukuan", {
      views: [{ showGridLines: true }],
    });

    // 1. Header Judul Atas Laporan (Rentang Kolom Diperlebar jadi A s/d K)
    worksheet.mergeCells("A1", "K1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "REKAPITULASI JURNAL UMUM PEMBUKUAN";
    titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "111827" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };

    worksheet.mergeCells("A2", "K2");
    const subtitleCell = worksheet.getCell("A2");

    const infoTanggal =
      startDate && endDate
        ? `${new Date(startDate).toLocaleDateString("id-ID")} s/d ${new Date(endDate).toLocaleDateString("id-ID")}`
        : "Semua Periode";
    subtitleCell.value = `Periode: ${infoTanggal} | Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`;
    subtitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "6B7280" } };

    worksheet.getRow(3).height = 12;

    // 2. Struktur Baru: Menjadi 11 Kolom dengan adanya No Referensi & Penerima
    const tableHeaders = [
      "NO Register",
      "No Referensi",
      "Penerima",
      "Tanggal",
      "Kelompok Biaya",
      "Total",
      "Jenis Biaya",
      "Nominal",
      "Detail Jenis Biaya",
      "Keterangan",
      "Detail Nominal",
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = tableHeaders;
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4F4F5" } };
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "18181B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "A1A1AA" } },
        bottom: { style: "medium", color: { argb: "18181B" } },
        left: { style: "thin", color: { argb: "E4E4E7" } },
        right: { style: "thin", color: { argb: "E4E4E7" } },
      };
    });

    // 3. FLATTENING DATA
    const flatRowsToRender: any[] = [];

    jurnalList.forEach((jurnal: any) => {
      const itemsToUse = jurnal.items || [];

      itemsToUse.forEach((item: any, idx: number) => {
        flatRowsToRender.push({
          isFirstInJurnal: idx === 0,
          jurnalItemsCount: itemsToUse.length,
          no_registrasi: jurnal.no_registrasi || "-",
          no_referensi: jurnal.no_referensi || "-",
          penerima: jurnal.penerima || "-",
          tanggal: jurnal.tanggal,
          kelompok_biaya: (item.nama_kelompok || "BIAYA OPERASIONAL").toUpperCase(),
          jenis_biaya: (item.nama_akun || "-").toUpperCase(),
          detail_jenis_biaya: (item.nama_akun || "-").toUpperCase(),
          keterangan_memo: (jurnal.keterangan || "-").toUpperCase(),
          nominal_murni: Number(item.debit) || Number(item.kredit) || 0,
        });
      });
    });

    // 4. ALGORITMA MULTI-LEVEL CONDITIONAL GROUPING
    let i = 0;
    while (i < flatRowsToRender.length) {
      let j = i;
      let totalKelompok = 0;
      const currentKelompok = flatRowsToRender[i].kelompok_biaya;

      while (j < flatRowsToRender.length && flatRowsToRender[j].kelompok_biaya === currentKelompok) {
        totalKelompok += flatRowsToRender[j].nominal_murni;
        j++;
      }

      for (let k = i; k < j; k++) {
        flatRowsToRender[k].total_kelompok_value = totalKelompok;
        flatRowsToRender[k].kelompokStart = i + 5;
        flatRowsToRender[k].kelompokEnd = j + 4;
      }

      let subI = i;
      while (subI < j) {
        let subJ = subI;
        let totalJenisBiaya = 0;
        const currentJenis = flatRowsToRender[subI].jenis_biaya;

        while (subJ < j && flatRowsToRender[subJ].jenis_biaya === currentJenis) {
          totalJenisBiaya += flatRowsToRender[subJ].nominal_murni;
          subJ++;
        }

        for (let subK = subI; subK < subJ; subK++) {
          flatRowsToRender[subK].total_jenis_value = totalJenisBiaya;
          flatRowsToRender[subK].jenisStart = subI + 5;
          flatRowsToRender[subK].jenisEnd = subJ + 4;
        }
        subI = subJ;
      }

      i = j;
    }

    let currentRowIdx = 5;

    // 5. Penulisan Array Data ke Sel Lembar Kerja Excel
    flatRowsToRender.forEach((flatRow) => {
      const row = worksheet.getRow(currentRowIdx);
      row.height = 22;

      row.values = [
        flatRow.isFirstInJurnal ? flatRow.no_registrasi : "",
        flatRow.isFirstInJurnal ? flatRow.no_referensi : "",
        flatRow.isFirstInJurnal ? flatRow.penerima : "",
        flatRow.isFirstInJurnal ? new Date(flatRow.tanggal).toLocaleDateString("id-ID") : "",
        flatRow.kelompok_biaya,
        flatRow.total_kelompok_value,
        flatRow.jenis_biaya,
        flatRow.total_jenis_value,
        flatRow.detail_jenis_biaya,
        flatRow.keterangan_memo,
        flatRow.nominal_murni,
      ];

      const cellBgColor =
        flatRow.no_registrasi.charCodeAt(flatRow.no_registrasi.length - 1) % 2 === 0 ? "FFFFFF" : "FBFBFC";

      for (let colIdx = 1; colIdx <= 11; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "27272A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cellBgColor } };
        cell.border = {
          top: { style: "thin", color: { argb: "E4E4E7" } },
          bottom: { style: "thin", color: { argb: "E4E4E7" } },
          left: { style: "thin", color: { argb: "E4E4E7" } },
          right: { style: "thin", color: { argb: "E4E4E7" } },
        };

        if (colIdx >= 1 && colIdx <= 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (colIdx === 1 || colIdx === 2) {
            cell.font = { name: "Consolas", size: 9, bold: true, color: { argb: colIdx === 1 ? "1D4ED8" : "047857" } };
          }
        } else if (colIdx === 5 || colIdx === 7 || colIdx === 9 || colIdx === 10) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else if (colIdx === 6 || colIdx === 8 || colIdx === 11) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '#,##0;(#,##0);"-"';
        }
      }

      currentRowIdx++;
    });

    // 6. PROSES MERGE CELLS BERJENJANG SECARA OTOMATIS
    const processedKelompok = new Set<string>();
    const processedJenis = new Set<string>();

    flatRowsToRender.forEach((flatRow) => {
      const kStart = flatRow.kelompokStart;
      const kEnd = flatRow.kelompokEnd;
      const kKey = `${kStart}-${kEnd}`;

      if (kEnd > kStart && !processedKelompok.has(kKey)) {
        worksheet.mergeCells(`E${kStart}:E${kEnd}`);
        worksheet.mergeCells(`F${kStart}:F${kEnd}`);
        processedKelompok.add(kKey);
      }

      const jStart = flatRow.jenisStart;
      const jEnd = flatRow.jenisEnd;
      const jKey = `${jStart}-${jEnd}`;

      if (jEnd > jStart && !processedJenis.has(jKey)) {
        worksheet.mergeCells(`G${jStart}:G${jEnd}`);
        worksheet.mergeCells(`H${jStart}:H${jEnd}`);
        processedJenis.add(jKey);
      }
    });

    // Merge vertikal No Register, No Referensi, Penerima & Tanggal
    let internalScanIdx = 5;
    flatRowsToRender.forEach((r) => {
      if (r.isFirstInJurnal && r.jurnalItemsCount > 1) {
        const subEnd = internalScanIdx + r.jurnalItemsCount - 1;
        try {
          worksheet.mergeCells(`A${internalScanIdx}:A${subEnd}`);
          worksheet.mergeCells(`B${internalScanIdx}:B${subEnd}`);
          worksheet.mergeCells(`C${internalScanIdx}:C${subEnd}`);
          worksheet.mergeCells(`D${internalScanIdx}:D${subEnd}`);
        } catch (e) {}
      }
      internalScanIdx++;
    });

    // Perataan posisi teks alignment
    for (let r = 5; r < currentRowIdx; r++) {
      ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
        const targetCell = worksheet.getCell(`${col}${r}`);
        if (targetCell) {
          let hAlign: "left" | "center" | "right" = "center";
          if (col === "E" || col === "G") hAlign = "left";
          if (col === "F" || col === "H") hAlign = "right";

          targetCell.alignment = {
            vertical: "middle",
            horizontal: hAlign,
            wrapText: true,
          };
        }
      });
    }

    // 7. Baris Grand Total Laporan Paling Bawah (Kolom K)
    const footerRow = worksheet.getRow(currentRowIdx);
    footerRow.height = 26;
    worksheet.mergeCells(`A${currentRowIdx}:J${currentRowIdx}`);

    const labelCell = footerRow.getCell(1);
    labelCell.value = "TOTAL KESELURUHAN LAPORAN  ";
    labelCell.font = { name: "Segoe UI", size: 10, bold: true };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };

    const totalFormulaCell = footerRow.getCell(11);
    totalFormulaCell.value = { formula: `=SUM(K5:K${currentRowIdx - 1})`, date1904: false };
    totalFormulaCell.font = { name: "Segoe UI", size: 10, bold: true };
    totalFormulaCell.numFmt = '#,##0;(#,##0);"-"';
    totalFormulaCell.alignment = { vertical: "middle", horizontal: "right" };

    for (let col = 1; col <= 11; col++) {
      const c = footerRow.getCell(col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4F4F5" } };
      c.border = {
        top: { style: "thin", color: { argb: "18181B" } },
        bottom: { style: "double", color: { argb: "18181B" } },
      };
    }

    // 8. Skala Lebar Kolom Presisi (11 Kolom)
    worksheet.columns = [
      { width: 16 }, // A: NO register
      { width: 16 }, // B: No Referensi
      { width: 20 }, // C: Penerima
      { width: 14 }, // D: Tanggal
      { width: 28 }, // E: Kelompok Biaya
      { width: 16 }, // F: Total Kelompok
      { width: 24 }, // G: Jenis Biaya
      { width: 16 }, // H: Nominal Jenis Biaya
      { width: 24 }, // I: Detail Jenis Biaya
      { width: 26 }, // J: Keterangan
      { width: 16 }, // K: Detail Nominal
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split("T")[0];

    return {
      success: true,
      base64: Buffer.from(buffer).toString("base64"),
      fileName: `Laporan_Jurnal_Umum_${fileSuffix}.xlsx`,
    };
  } catch (error: any) {
    console.error("EXPORT_EXCEL_ERROR:", error.message);
    return { success: false, message: "Gagal memproses ekspor spreadsheet: " + error.message, base64: null, fileName: "" };
  }
}

/**
 * 🛠️ ACTION: AMBIL DATA JURNAL
 */
export async function getJurnalList(
  startDate?: string,
  endDate?: string,
  page?: number,
  pageSize?: number,
  search?: string
) {
  try {
    const isPaginationEnabled = page !== undefined && pageSize !== undefined;
    const currentPage = Math.max(1, page || 1);
    const currentPageSize = Math.max(1, pageSize || 20);
    const offset = (currentPage - 1) * currentPageSize;

    const conditions: string[] = [];
    const params: any[] = [];

    // FILTER TANGGAL
    if (startDate && startDate.trim() !== "") {
      conditions.push("DATE(j.tanggal) >= ?");
      params.push(startDate);
    }

    if (endDate && endDate.trim() !== "") {
      conditions.push("DATE(j.tanggal) <= ?");
      params.push(endDate);
    }

    // SEARCH
    if (search?.trim()) {
      const searchValue = `%${search.trim()}%`;
      conditions.push(`
        (
          LOWER(j.no_registrasi) LIKE LOWER(?)
          OR LOWER(j.no_referensi) LIKE LOWER(?)
          OR LOWER(j.keterangan) LIKE LOWER(?)
          OR LOWER(p.nama_penerima) LIKE LOWER(?)
          OR EXISTS (
            SELECT 1
            FROM tb_jurnal_item si
            LEFT JOIN tb_akun sa ON si.no_akun = sa.no_akun
            WHERE si.jurnal_id = j.id
              AND (
                LOWER(si.no_akun) LIKE LOWER(?)
                OR LOWER(sa.nama_akun) LIKE LOWER(?)
              )
          )
        )
      `);
      params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. HITUNG TOTAL DATA
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM tb_jurnal j
      LEFT JOIN tb_penerima p ON j.penerima_id = p.id
      ${whereClause}
    `;
    const [countRows]: any = await db.query(countQuery, params);
    const total = Number(countRows[0]?.total || 0);

    // HITUNG TOTAL DEBIT & KREDIT SELURUH DATA
    const summaryQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebit,
        COALESCE(SUM(i.kredit), 0) AS totalKredit
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      LEFT JOIN tb_penerima p ON j.penerima_id = p.id
      ${whereClause}
    `;

    // HITUNG SALDO AKHIR KAS / BANK
    const saldoKasQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebitKas,
        COALESCE(SUM(i.kredit), 0) AS totalKreditKas
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      WHERE i.no_akun IN ('11100', '11200')
        ${startDate && startDate.trim() !== "" ? "AND DATE(j.tanggal) >= ?" : ""}
        ${endDate && endDate.trim() !== "" ? "AND DATE(j.tanggal) <= ?" : ""}
    `;

    const saldoKasParams: any[] = [];
    if (startDate && startDate.trim() !== "") saldoKasParams.push(startDate);
    if (endDate && endDate.trim() !== "") saldoKasParams.push(endDate);

    const [saldoKasRows]: any = await db.query(saldoKasQuery, saldoKasParams);
    const totalDebitKas = Number(saldoKasRows[0]?.totalDebitKas || 0);
    const totalKreditKas = Number(saldoKasRows[0]?.totalKreditKas || 0);
    const saldoKas = totalDebitKas - totalKreditKas;

    const [summaryRows]: any = await db.query(summaryQuery, params);
    const totalDebit = Number(summaryRows[0]?.totalDebit || 0);
    const totalKredit = Number(summaryRows[0]?.totalKredit || 0);

    // 2. AMBIL HEADER JURNAL
    let headerQuery = `
      SELECT
        j.id,
        j.tanggal,
        j.no_registrasi,
        j.no_referensi,
        p.nama_penerima AS penerima,
        j.penerima_id,
        j.keterangan
      FROM tb_jurnal j
      LEFT JOIN tb_penerima p ON j.penerima_id = p.id
      ${whereClause}
      ORDER BY j.tanggal DESC, j.id DESC
    `;

    const headerParams = [...params];

    if (isPaginationEnabled) {
      headerQuery += ` LIMIT ? OFFSET ?`;
      headerParams.push(currentPageSize, offset);
    }

    const [headers]: any = await db.query(headerQuery, headerParams);

    if (!headers || headers.length === 0) {
      return {
        success: true,
        data: [],
        pagination: {
          page: currentPage,
          pageSize: currentPageSize,
          total,
          totalPages: Math.ceil(total / currentPageSize),
        },
        summary: {
          totalDebit,
          totalKredit,
          isBalanced: totalDebit === totalKredit && totalDebit > 0,
          saldoKas,
        },
      };
    }

    // 3. AMBIL ITEM JURNAL
    const jurnalIds = headers.map((jurnal: any) => jurnal.id);
    const placeholders = jurnalIds.map(() => "?").join(",");

    const itemQuery = `
      SELECT
        i.id,
        i.jurnal_id,
        i.no_akun,
        a.nama_akun,
        k.kelompok_biaya AS nama_kelompok,
        i.debit,
        i.kredit,
        i.keterangan
      FROM tb_jurnal_item i
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
      WHERE i.jurnal_id IN (${placeholders})
      ORDER BY i.id ASC
    `;

    const [allItems]: any = await db.query(itemQuery, jurnalIds);

    // 4. MAPPING ITEM KE HEADER
    const itemsMap = new Map<number, any[]>();
    for (const item of allItems) {
      const jurnalId = Number(item.jurnal_id);
      if (!itemsMap.has(jurnalId)) {
        itemsMap.set(jurnalId, []);
      }
      itemsMap.get(jurnalId)!.push(item);
    }

    const structuredJurnal = headers.map((jurnal: any) => ({
      id: jurnal.id,
      tanggal: jurnal.tanggal,
      no_registrasi: jurnal.no_registrasi,
      no_referensi: jurnal.no_referensi,
      penerima: jurnal.penerima || "-",
      penerima_id: jurnal.penerima_id || null,
      keterangan: jurnal.keterangan,
      items: itemsMap.get(Number(jurnal.id)) || [],
    }));

    const isBalanced = totalDebit === totalKredit && totalDebit > 0;

    return {
      success: true,
      data: structuredJurnal,
      summary: {
        totalDebit,
        totalKredit,
        isBalanced,
        saldoKas,
      },
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.ceil(total / currentPageSize),
      },
    };
  } catch (error: any) {
    console.error("GET_JURNAL_LIST_ERROR:", error.message);
    return {
      success: false,
      data: [],
      pagination: { page: page || 1, pageSize: pageSize || 20, total: 0, totalPages: 0 },
      message: error.message,
    };
  }
}

/**
 * 🛠️ ACTION: UPDATE MASSAL JURNAL (DENGAN REVERSAL SALDO SESUAI SALDO NORMAL)
 */
export async function updateJurnalItem(
  itemId: number,
  payload: {
    jurnal_id: number;
    tanggal: string;
    no_registrasi: string;
    no_referensi: string;
    penerimaId?: number | null;
    keterangan_umum: string;
    no_akun: string;
    debit: number;
    kredit: number;
    keterangan: string;
  }
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE tb_jurnal SET 
        tanggal = ?, 
        no_registrasi = ?, 
        no_referensi = ?, 
        penerima_id = ?, 
        keterangan = ? 
       WHERE id = ?`,
      [
        payload.tanggal,
        payload.no_registrasi,
        payload.no_referensi,
        payload.penerimaId ?? null,
        payload.keterangan_umum,
        payload.jurnal_id,
      ]
    );

    const [oldRows]: any = await connection.query(
      "SELECT no_akun, debit, kredit FROM tb_jurnal_item WHERE id = ?",
      [itemId]
    );
    if (oldRows.length === 0) throw new Error("Data detail item transaksi tidak ditemukan di MySQL");
    const oldData = oldRows[0];

    // 1. Rollback/Revert saldo item lama sesuai saldo normalnya
    await applySaldoAkun(
      connection,
      oldData.no_akun,
      Number(oldData.debit) || 0,
      Number(oldData.kredit) || 0,
      true // Revert = true
    );

    // 2. Update item jurnal
    await connection.query(
      `UPDATE tb_jurnal_item SET 
        no_akun = ?, 
        debit = ?, 
        kredit = ?, 
        keterangan = ? 
       WHERE id = ?`,
      [payload.no_akun, payload.debit, payload.kredit, payload.keterangan, itemId]
    );

    // 3. Terapkan saldo baru sesuai saldo normalnya
    await applySaldoAkun(
      connection,
      payload.no_akun,
      Number(payload.debit) || 0,
      Number(payload.kredit) || 0,
      false // Revert = false
    );

    // 4. Jika jurnal terhubung ke invoice, hitung ulang pembayaran invoice
    const [jurnalHeaderForUpdate]: any = await connection.query(
      "SELECT invoice_id FROM tb_jurnal WHERE id = ?",
      [payload.jurnal_id]
    );
    const invoiceIdToUpdate = jurnalHeaderForUpdate.length > 0 ? Number(jurnalHeaderForUpdate[0].invoice_id) : null;

    if (invoiceIdToUpdate) {
      const [remainingJurnals]: any = await connection.query(
        `SELECT j.id, j.tanggal, i.no_akun, i.debit, i.kredit
         FROM tb_jurnal j
         INNER JOIN tb_jurnal_item i ON i.jurnal_id = j.id
         WHERE j.invoice_id = ?
         ORDER BY j.tanggal ASC, j.id ASC`,
        [invoiceIdToUpdate]
      );

      const [piutangRows]: any = await connection.query(
        `SELECT a.no_akun
         FROM tb_akun a
         JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
         WHERE k.kelompok_biaya LIKE '%PIUTANG%' AND a.is_aktif = 1`
      );
      const piutangAccounts = new Set<string>(
        (piutangRows || []).map((r: any) => String(r.no_akun))
      );

      const jurnalMap = new Map<number, any[]>();
      for (const row of remainingJurnals) {
        if (!jurnalMap.has(row.id)) {
          jurnalMap.set(row.id, []);
        }
        jurnalMap.get(row.id)!.push(row);
      }

      let bayar1 = 0;
      let tglBayar1: string | null = null;
      let bayar2 = 0;
      let tglBayar2: string | null = null;
      let isFirstPayment = true;

      for (const [, jurnalItems] of jurnalMap) {
        let piutangDebit = 0;
        let piutangKredit = 0;
        for (const item of jurnalItems) {
          if (piutangAccounts.has(String(item.no_akun))) {
            piutangDebit += Number(item.debit) || 0;
            piutangKredit += Number(item.kredit) || 0;
          }
        }
        const netBayar = piutangKredit - piutangDebit;
        if (netBayar <= 0) continue;

        if (isFirstPayment) {
          bayar1 = netBayar;
          tglBayar1 = jurnalItems[0].tanggal;
          isFirstPayment = false;
        } else {
          bayar2 += netBayar;
          tglBayar2 = jurnalItems[0].tanggal;
        }
      }

      const [invoiceRows]: any = await connection.query(
        "SELECT total FROM tb_invoice WHERE id = ?",
        [invoiceIdToUpdate]
      );
      const totalInv = Number(invoiceRows[0]?.total) || 0;
      const totalBayar = bayar1 + bayar2;
      const newStatus = totalBayar >= totalInv ? "Lunas" : totalBayar > 0 ? "Sebagian" : "Belum Lunas";

      await connection.query(
        `UPDATE tb_invoice
         SET bayar_1 = ?, bayar_2 = ?, tanggal_bayar_1 = ?, tanggal_bayar_2 = ?, status = ?
         WHERE id = ?`,
        [bayar1, bayar2, tglBayar1, tglBayar2, newStatus, invoiceIdToUpdate]
      );
    }

    await connection.commit();
    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    if (invoiceIdToUpdate) {
      revalidatePath(`/dashboard/finance/invoices/${invoiceIdToUpdate}`);
      revalidatePath("/dashboard/finance/invoices");
    }
    return {
      success: true,
      message: "Seluruh kolom transaksi, No Referensi, Penerima, dan saldo master berhasil disesuaikan!",
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("EDIT_JURNAL_ITEM_ERROR:", error.message);
    return { success: false, message: "Gagal menyesuaikan saldo: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ ACTION: HAPUS JURNAL (PULIHKAN SALDO SESUAI SALDO NORMAL)
 */
export async function deleteJurnalByHeader(jurnalId: number) {
  const connection = await db.getConnection();
  let invoiceIdToUpdate: number | null = null;

  try {
    await connection.beginTransaction();

    const [items]: any = await connection.query(
      "SELECT no_akun, debit, kredit FROM tb_jurnal_item WHERE jurnal_id = ?",
      [jurnalId]
    );

    const [jurnalHeader]: any = await connection.query(
      "SELECT invoice_id FROM tb_jurnal WHERE id = ?",
      [jurnalId]
    );
    invoiceIdToUpdate = jurnalHeader.length > 0 ? Number(jurnalHeader[0].invoice_id) : null;

    // Revert semua akun yang terlibat sebelum baris dihapus
    for (const item of items) {
      await applySaldoAkun(
        connection,
        item.no_akun,
        Number(item.debit) || 0,
        Number(item.kredit) || 0,
        true // Revert = true
      );
    }

    await connection.query("DELETE FROM tb_jurnal_item WHERE jurnal_id = ?", [jurnalId]);
    await connection.query("DELETE FROM tb_jurnal WHERE id = ?", [jurnalId]);

    if (invoiceIdToUpdate) {
      const [remainingJurnals]: any = await connection.query(
        "SELECT COUNT(*) as count FROM tb_jurnal WHERE invoice_id = ?",
        [invoiceIdToUpdate]
      );
      const remainingCount = Number(remainingJurnals[0]?.count) || 0;

      if (remainingCount === 0) {
        await connection.query("DELETE FROM tb_invoice WHERE id = ?", [invoiceIdToUpdate]);
      } else {
        const [remainingJurnalsDetail]: any = await connection.query(
          `SELECT j.id, j.tanggal, i.no_akun, i.debit, i.kredit
           FROM tb_jurnal j
           INNER JOIN tb_jurnal_item i ON i.jurnal_id = j.id
           WHERE j.invoice_id = ?
           ORDER BY j.tanggal ASC, j.id ASC`,
          [invoiceIdToUpdate]
        );

        const [piutangRows]: any = await connection.query(
          `SELECT a.no_akun
           FROM tb_akun a
           JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
           WHERE k.kelompok_biaya LIKE '%PIUTANG%' AND a.is_aktif = 1`
        );
        const piutangAccounts = new Set<string>(
          (piutangRows || []).map((r: any) => String(r.no_akun))
        );

        const jurnalMap = new Map<number, any[]>();
        for (const row of remainingJurnalsDetail) {
          if (!jurnalMap.has(row.id)) {
            jurnalMap.set(row.id, []);
          }
          jurnalMap.get(row.id)!.push(row);
        }

        let bayar1 = 0;
        let tglBayar1: string | null = null;
        let bayar2 = 0;
        let tglBayar2: string | null = null;
        let isFirstPayment = true;

        for (const [, jurnalItems] of jurnalMap) {
          let piutangDebit = 0;
          let piutangKredit = 0;
          for (const item of jurnalItems) {
            if (piutangAccounts.has(String(item.no_akun))) {
              piutangDebit += Number(item.debit) || 0;
              piutangKredit += Number(item.kredit) || 0;
            }
          }
          const netBayar = piutangKredit - piutangDebit;
          if (netBayar <= 0) continue;

          if (isFirstPayment) {
            bayar1 = netBayar;
            tglBayar1 = jurnalItems[0].tanggal;
            isFirstPayment = false;
          } else {
            bayar2 += netBayar;
            tglBayar2 = jurnalItems[0].tanggal;
          }
        }

        const [invoiceRows]: any = await connection.query(
          "SELECT total FROM tb_invoice WHERE id = ?",
          [invoiceIdToUpdate]
        );
        const totalInv = Number(invoiceRows[0]?.total) || 0;
        const totalBayar = bayar1 + bayar2;
        const newStatus = totalBayar >= totalInv ? "Lunas" : totalBayar > 0 ? "Sebagian" : "Belum Lunas";

        await connection.query(
          `UPDATE tb_invoice
           SET bayar_1 = ?, bayar_2 = ?, tanggal_bayar_1 = ?, tanggal_bayar_2 = ?, status = ?
           WHERE id = ?`,
          [bayar1, bayar2, tglBayar1, tglBayar2, newStatus, invoiceIdToUpdate]
        );
      }
    }

    await connection.commit();

    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    if (invoiceIdToUpdate) {
      revalidatePath(`/dashboard/finance/invoices/${invoiceIdToUpdate}`);
      revalidatePath("/dashboard/finance/invoices");
    }
    return {
      success: true,
      message: "Satu paket transaksi jurnal berhasil dihapus & saldo master dipulihkan!",
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("DELETE_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal menghapus transaksi jurnal: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ ACTION: TAMBAH ENTRI JURNAL BARU (DENGAN SALDO NORMAL AKUNTANSI)
 */
export async function createJurnalUmum(payload: JurnalPayload) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const headerQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, no_referensi, invoice_id, penerima_id, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [headerResult]: any = await connection.query(headerQuery, [
      payload.tanggal,
      payload.noRegistrasi,
      payload.noReferensi,
      payload.invoiceId ?? null,
      payload.penerimaId ?? null,
      payload.keterangan,
    ]);

    const jurnalId = headerResult.insertId;

    const itemQuery = `
      INSERT INTO tb_jurnal_item (jurnal_id, no_akun, debit, kredit, keterangan) 
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const item of payload.items) {
      const debitVal = Number(item.debit) || 0;
      const kreditVal = Number(item.kredit) || 0;

      if (debitVal === 0 && kreditVal === 0) continue;

      await connection.query(itemQuery, [
        jurnalId,
        item.accountCode,
        debitVal,
        kreditVal,
        item.keterangan || "",
      ]);

      // Update master saldo akun secara dinamis berdasarkan posisi normal akun
      await applySaldoAkun(connection, item.accountCode, debitVal, kreditVal, false);
    }

    await connection.commit();
    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    return { success: true, message: "Jurnal Umum Berhasil Disimpan!" };
  } catch (error: any) {
    await connection.rollback();
    console.error("CREATE_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal menyimpan jurnal: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ ACTION: SIMPAN JURNAL + AUTO-UPDATE INVOICE (KASIR)
 * - Cek noReferensi ke tb_invoice via lookupReferensi
 * - Kalau match invoice: insert jurnal + items + saldo, lalu UPDATE tb_invoice (bayar_1/2, status Sebagian/Lunas)
 * - Kalau bukan invoice (PO atau referensi bebas): fallback ke createJurnalUmum biasa
 */
export async function createJurnalDenganReferensiInvoiceOnly(payload: JurnalPayload) {
  // 1. Cek apakah noReferensi match ke invoice
  const lookup = await lookupReferensi(payload.noReferensi || "");

  // 2. Kalau bukan invoice, fallback ke createJurnalUmum biasa
  if (lookup.found !== "invoice") {
    return await createJurnalUmum(payload);
  }

  const invLookup = lookup.data; // { nomor, total, bayar_1, bayar_2, ... }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 3. Ambil id invoice dari nomor_invoice
    const [invoiceRows]: any = await connection.query(
      `SELECT id, total, bayar_1, bayar_2, status FROM tb_invoice WHERE nomor_invoice = ? LIMIT 1`,
      [invLookup.nomor]
    );
    if (!Array.isArray(invoiceRows) || invoiceRows.length === 0) {
      throw new Error("Invoice tidak ditemukan di database");
    }
    const invoice = invoiceRows[0];
    const invoiceId: number = Number(invoice.id);
    const totalInv = Number(invoice.total) || 0;
    const bayar1Lama = Number(invoice.bayar_1) || 0;
    const bayar2Lama = Number(invoice.bayar_2) || 0;

    // 4. Cari akun-akun yang kelompok_biaya-nya mengandung kata 'PIUTANG'
    //    Pakai LIKE '%PIUTANG%' agar bebas nama: 'Piutang', 'PIUTANG USAHA', 'Piutang Dagang', dll
    const [piutangRows]: any = await connection.query(
      `SELECT a.no_akun
       FROM tb_akun a
       JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
       WHERE k.kelompok_biaya LIKE '%PIUTANG%' AND a.is_aktif = 1`
    );
    const piutangAccounts = new Set<string>(
      (piutangRows || []).map((r: any) => String(r.no_akun))
    );

    // 5. Hitung posisi akun piutang di jurnal
    let piutangDebit = 0;
    let piutangKredit = 0;
    for (const item of payload.items) {
      const kode = String(item.accountCode || "").trim();
      if (piutangAccounts.has(kode)) {
        piutangDebit += Number(item.debit) || 0;
        piutangKredit += Number(item.kredit) || 0;
      }
    }

    // 6. Deteksi arah transaksi:
    //    - piutangKredit > 0 && piutangDebit == 0 → BAYAR
    //    - piutangKredit > 0 && piutangDebit > 0  → ADJUSTMENT (net = kredit - debit)
    //    - piutangKredit == 0 && piutangDebit == 0 → bukan jurnal piutang, rollback & fallback
    //    - piutangKredit == 0 && piutangDebit > 0  → KOREKSI (disabled di kasir)
    if (piutangKredit === 0 && piutangDebit === 0) {
      await connection.rollback();
      return await createJurnalUmum(payload);
    }

    if (piutangDebit > 0 && piutangKredit === 0) {
      await connection.rollback();
      return {
        success: false,
        message:
          "Koreksi / pembatalan bayar (Piutang di Debit) tidak dapat dilakukan lewat Kasir. " +
          "Silakan hubungi admin untuk adjustment manual.",
      };
    }

    const netBayar = piutangKredit - piutangDebit;
    if (netBayar <= 0) {
      // Adjustment hasilnya ≤ 0, tidak ada efek bayar ke invoice
      await connection.rollback();
      return await createJurnalUmum(payload);
    }

    // 7. Insert header jurnal (dengan invoice_id)
    const headerQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, no_referensi, invoice_id, penerima_id, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [headerResult]: any = await connection.query(headerQuery, [
      payload.tanggal,
      payload.noRegistrasi,
      payload.noReferensi,
      invoiceId,
      payload.penerimaId ?? null,
      payload.keterangan,
    ]);
    const jurnalId = headerResult.insertId;

    // 8. Insert items jurnal + update saldo akun
    const itemQuery = `
      INSERT INTO tb_jurnal_item (jurnal_id, no_akun, debit, kredit, keterangan)
      VALUES (?, ?, ?, ?, ?)
    `;
    for (const item of payload.items) {
      const debitVal = Number(item.debit) || 0;
      const kreditVal = Number(item.kredit) || 0;
      if (debitVal === 0 && kreditVal === 0) continue;
      await connection.query(itemQuery, [
        jurnalId,
        item.accountCode,
        debitVal,
        kreditVal,
        item.keterangan || "",
      ]);
      await applySaldoAkun(connection, item.accountCode, debitVal, kreditVal, false);
    }

    // 9. Update tb_invoice: bayar_1/bayar_2, tanggal_bayar_*, status
    const nominalBayar = netBayar;
    const totalBayarSetelah = bayar1Lama + bayar2Lama + nominalBayar;
    const isLunas = totalBayarSetelah >= totalInv;
    const newStatus = isLunas ? "Lunas" : "Sebagian";

    if (bayar1Lama === 0) {
      await connection.query(
        `UPDATE tb_invoice
         SET bayar_1 = ?, tanggal_bayar_1 = ?, status = ?
         WHERE id = ?`,
        [nominalBayar, payload.tanggal, newStatus, invoiceId]
      );
    } else {
      await connection.query(
        `UPDATE tb_invoice
         SET bayar_2 = bayar_2 + ?, tanggal_bayar_2 = ?, status = ?
         WHERE id = ?`,
        [nominalBayar, payload.tanggal, newStatus, invoiceId]
      );
    }

    await connection.commit();

    // 10. Revalidate paths
    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    revalidatePath("/dashboard/finance/invoices");
    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);

    return {
      success: true,
      message: `Jurnal tersimpan & invoice ${invLookup.nomor} diperbarui ke status "${newStatus}". (Net bayar: Rp ${nominalBayar.toLocaleString("id-ID")})`,
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("CREATE_JURNAL_DGN_REFENS_ERROR:", error.message);
    return { success: false, message: "Gagal menyimpan jurnal referensi: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ HELPER: CARI AKUN AKTIF BERDASARKAN KELOMPOK BIAYA
 * Dipakai oleh auto-fill template jurnal dari lookupReferensi (invoice/PO).
 * Mengembalikan akun pertama yang aktif, atau null bila tidak ditemukan.
 */
export async function getAkunByKelompok(
  kelompokBiaya: string
): Promise<{ no_akun: string; nama_akun: string; nama_kelompok: string } | null> {
  try {
    const [rows]: any = await db.query(
      `SELECT a.no_akun, a.nama_akun, k.kelompok_biaya AS nama_kelompok
       FROM tb_akun a
       JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
       WHERE k.kelompok_biaya = ? AND a.is_aktif = 1
       ORDER BY a.no_akun ASC
       LIMIT 1`,
      [kelompokBiaya]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return {
        no_akun: String(rows[0].no_akun),
        nama_akun: String(rows[0].nama_akun),
        nama_kelompok: String(rows[0].nama_kelompok || kelompokBiaya),
      };
    }
    return null;
  } catch (error: any) {
    console.error("GET_AKUN_BY_KELOMPOK_ERROR:", error.message);
    return null;
  }
}

/**
 * 🛠️ ACTION: GENERATE NO REGISTRASI OTOMATIS
 */
export async function generateNoRegistrasiOtomatis(type: "BK" | "BD") {
  try {
    const sekarang = new Date();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tahunShort = String(sekarang.getFullYear()).slice(-2);

    const pattern = `${type}_%/${bulan}/${tahunShort}`;

    const query = `
      SELECT no_registrasi 
      FROM tb_jurnal 
      WHERE no_registrasi LIKE ? 
      ORDER BY id DESC 
      LIMIT 1
    `;

    const [rows]: any = await db.query(query, [pattern]);

    let nomorUrutBaru = 1;

    if (rows.length > 0) {
      const noRegTerakhir = rows[0].no_registrasi;
      const match = noRegTerakhir.match(new RegExp(`${type}_(\\d+)\\/`));
      if (match && match[1]) {
        nomorUrutBaru = (parseInt(match[1], 10) || 0) + 1;
      }
    }

    const stringNomorUrut = String(nomorUrutBaru).padStart(3, "0");
    const noRegistrasiOtomatis = `${type}_${stringNomorUrut}/${bulan}/${tahunShort}`;

    return { success: true, code: noRegistrasiOtomatis };
  } catch (error: any) {
    console.error("GENERATE_NO_REG_ERROR:", error.message);
    return { success: false, code: "" };
  }
}