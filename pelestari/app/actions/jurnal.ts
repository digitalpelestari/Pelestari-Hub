"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs"; 

interface JurnalItemPayload {
  accountCode: string;
  debit: number;
  kredit: number;
}

interface JurnalPayload {
  tanggal: string;
  noRegistrasi: string;
  noReferensi: string; 
  penerima?: string;
  keterangan: string;
  items: JurnalItemPayload[];
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
      throw new Error(
        result.message || "Gagal mengambil data jurnal"
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Jurnal Pembukuan", {
      views: [{ showGridLines: true }]
    });

    // 1. Header Judul Atas Laporan (Rentang Kolom Diperlebar jadi A s/d K)
    worksheet.mergeCells("A1", "K1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "REKAPITULASI JURNAL UMUM PEMBUKUAN";
    titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "111827" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };

    worksheet.mergeCells("A2", "K2");
    const subtitleCell = worksheet.getCell("A2");
    
    const infoTanggal = startDate && endDate 
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
      "Detail Nominal"
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
        right: { style: "thin", color: { argb: "E4E4E7" } }
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
          kelompok_biaya: (
            item.nama_kelompok || "BIAYA OPERASIONAL"
          ).toUpperCase(),
          jenis_biaya: (
            item.nama_akun || "-"
          ).toUpperCase(),
          detail_jenis_biaya: (
            item.nama_akun || "-"
          ).toUpperCase(),
          keterangan_memo: (
            jurnal.keterangan || "-"
          ).toUpperCase(),
          nominal_murni:
            Number(item.debit) || Number(item.kredit) || 0,
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
        flatRow.nominal_murni       
      ];

      const cellBgColor = flatRow.no_registrasi.charCodeAt(flatRow.no_registrasi.length - 1) % 2 === 0 ? "FFFFFF" : "FBFBFC";

      for (let colIdx = 1; colIdx <= 11; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "27272A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cellBgColor } };
        cell.border = {
          top: { style: "thin", color: { argb: "E4E4E7" } },
          bottom: { style: "thin", color: { argb: "E4E4E7" } },
          left: { style: "thin", color: { argb: "E4E4E7" } },
          right: { style: "thin", color: { argb: "E4E4E7" } }
        };

        if (colIdx === 1 || colIdx === 2 || colIdx === 3 || colIdx === 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (colIdx === 1 || colIdx === 2) {
            cell.font = { name: "Consolas", size: 9, bold: true, color: { argb: colIdx === 1 ? "1D4ED8" : "047857" } };
          }
        } else if (colIdx === 5 || colIdx === 7 || colIdx === 9 || colIdx === 10) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else if (colIdx === 6 || colIdx === 8 || colIdx === 11) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0;(#,##0);\"-\"";
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
            wrapText: true 
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
    totalFormulaCell.numFmt = "#,##0;(#,##0);\"-\"";
    totalFormulaCell.alignment = { vertical: "middle", horizontal: "right" };

    for (let col = 1; col <= 11; col++) {
      const c = footerRow.getCell(col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4F4F5" } };
      c.border = {
        top: { style: "thin", color: { argb: "18181B" } },
        bottom: { style: "double", color: { argb: "18181B" } }
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
      { width: 16 }  // K: Detail Nominal
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split('T')[0];
    
    return { 
      success: true, 
      base64: Buffer.from(buffer).toString("base64"),
      fileName: `Laporan_Jurnal_Umum_${fileSuffix}.xlsx`
    };

  } catch (error: any) {
    console.error("EXPORT_EXCEL_ERROR:", error.message);
    return { success: false, message: "Gagal memproses ekspor spreadsheet: " + error.message, base64: null, fileName: "" };
  }
}

/**
 * 🛠️ ACTION: AMBIL DATA JURNAL
 * Support pagination, search, dan filter tanggal.
 */
export async function getJurnalList(
  startDate?: string,
  endDate?: string,
  page?: number,
  pageSize?: number,
  search?: string
) {
  try {
    const isPaginationEnabled =
      page !== undefined && pageSize !== undefined

    const currentPage = Math.max(1, page || 1)
    const currentPageSize = Math.max(1, pageSize || 20)
    const offset = (currentPage - 1) * currentPageSize

    const conditions: string[] = []
    const params: any[] = []

    // =========================================================
    // FILTER TANGGAL
    // =========================================================

    if (
      startDate &&
      startDate.trim() !== ""
    ) {
      conditions.push("DATE(j.tanggal) >= ?")
      params.push(startDate)
    }

    if (
      endDate &&
      endDate.trim() !== ""
    ) {
      conditions.push("DATE(j.tanggal) <= ?")
      params.push(endDate)
    }

    // =========================================================
    // SEARCH
    // =========================================================

    if (search?.trim()) {
      const searchValue = `%${search.trim()}%`

      conditions.push(`
        (
          LOWER(j.no_registrasi) LIKE LOWER(?)
          OR LOWER(j.no_referensi) LIKE LOWER(?)
          OR LOWER(j.penerima) LIKE LOWER(?)
          OR LOWER(j.keterangan) LIKE LOWER(?)

          OR EXISTS (
            SELECT 1
            FROM tb_jurnal_item si
            LEFT JOIN tb_akun sa
              ON si.no_akun = sa.no_akun
            WHERE si.jurnal_id = j.id
              AND (
                LOWER(si.no_akun) LIKE LOWER(?)
                OR LOWER(sa.nama_akun) LIKE LOWER(?)
              )
          )
        )
      `)

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      )
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : ""

    // =========================================================
    // 1. HITUNG TOTAL DATA
    // =========================================================

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM tb_jurnal j
      ${whereClause}
    `

    const [countRows]: any = await db.query(
      countQuery,
      params
    )

    const total = Number(countRows[0]?.total || 0)

    // =========================================================
    // HITUNG TOTAL DEBIT & KREDIT SELURUH DATA
    // =========================================================

    const summaryQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebit,
        COALESCE(SUM(i.kredit), 0) AS totalKredit
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j
        ON i.jurnal_id = j.id
      ${whereClause}
    `

    // =========================================================
    // HITUNG SALDO AKHIR KAS / BANK
    // =========================================================

    const saldoKasQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebitKas,
        COALESCE(SUM(i.kredit), 0) AS totalKreditKas
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j
        ON i.jurnal_id = j.id
      WHERE i.no_akun IN ('11100', '11200')
        ${
          startDate && startDate.trim() !== ""
            ? "AND DATE(j.tanggal) >= ?"
            : ""
        }
        ${
          endDate && endDate.trim() !== ""
            ? "AND DATE(j.tanggal) <= ?"
            : ""
        }
    `

    const saldoKasParams: any[] = []

    if (startDate && startDate.trim() !== "") {
      saldoKasParams.push(startDate)
    }

    if (endDate && endDate.trim() !== "") {
      saldoKasParams.push(endDate)
    }

    const [saldoKasRows]: any = await db.query(
      saldoKasQuery,
      saldoKasParams
    )

    const totalDebitKas = Number(
      saldoKasRows[0]?.totalDebitKas || 0
    )

    const totalKreditKas = Number(
      saldoKasRows[0]?.totalKreditKas || 0
    )

    const saldoKas = totalDebitKas - totalKreditKas

    const [summaryRows]: any = await db.query(
      summaryQuery,
      params
    )

    const totalDebit = Number(summaryRows[0]?.totalDebit || 0)
    const totalKredit = Number(summaryRows[0]?.totalKredit || 0)

    // =========================================================
    // 2. AMBIL HEADER JURNAL (DENGAN PENERIMA)
    // =========================================================

    let headerQuery = `
      SELECT
        j.id,
        j.tanggal,
        j.no_registrasi,
        j.no_referensi,
        j.penerima,
        j.keterangan
      FROM tb_jurnal j
      ${whereClause}
      ORDER BY j.tanggal DESC, j.id DESC
    `

    const headerParams = [...params]

    if (isPaginationEnabled) {
      headerQuery += `
        LIMIT ? OFFSET ?
      `

      headerParams.push(
        currentPageSize,
        offset
      )
    }

    const [headers]: any = await db.query(
      headerQuery,
      headerParams
    )

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
          isBalanced:
            totalDebit === totalKredit &&
            totalDebit > 0,
        },
      }
    }

    // =========================================================
    // 3. AMBIL ITEM HANYA UNTUK JURNAL YANG DITAMPILKAN
    // =========================================================

    const jurnalIds = headers.map(
      (jurnal: any) => jurnal.id
    )

    const placeholders = jurnalIds
      .map(() => "?")
      .join(",")

    const itemQuery = `
      SELECT
        i.id,
        i.jurnal_id,
        i.no_akun,
        a.nama_akun,
        k.kelompok_biaya AS nama_kelompok,
        i.debit,
        i.kredit
      FROM tb_jurnal_item i
      LEFT JOIN tb_akun a
        ON i.no_akun = a.no_akun
      LEFT JOIN tb_kelompok_biaya k
        ON a.kelompok_biaya_id = k.id
      WHERE i.jurnal_id IN (${placeholders})
      ORDER BY i.id ASC
    `

    const [allItems]: any = await db.query(
      itemQuery,
      jurnalIds
    )

    // =========================================================
    // 4. MAPPING ITEM KE HEADER
    // =========================================================

    const itemsMap = new Map<number, any[]>()

    for (const item of allItems) {
      const jurnalId = Number(item.jurnal_id)

      if (!itemsMap.has(jurnalId)) {
        itemsMap.set(jurnalId, [])
      }

      itemsMap.get(jurnalId)!.push(item)
    }

    const structuredJurnal = headers.map(
      (jurnal: any) => ({
        id: jurnal.id,
        tanggal: jurnal.tanggal,
        no_registrasi: jurnal.no_registrasi,
        no_referensi: jurnal.no_referensi,
        penerima: jurnal.penerima || "-",
        keterangan: jurnal.keterangan,
        items: itemsMap.get(Number(jurnal.id)) || [],
      })
    )

    const isBalanced =
      totalDebit === totalKredit &&
      totalDebit > 0    

    // =========================================================
    // 5. RETURN
    // =========================================================

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
        totalPages: Math.ceil(
          total / currentPageSize
        ),
      },  
    }

  } catch (error: any) {
    console.error(
      "GET_JURNAL_LIST_ERROR:",
      error.message
    )

    return {
      success: false,
      data: [],
      pagination: {
        page: page || 1,
        pageSize: pageSize || 20,
        total: 0,
        totalPages: 0,
      },
      message: error.message,
    }
  }
}

/**
 * 🛠️ ACTION: UPDATE MASSAL JURNAL (DENGAN NO_REFERENSI & PENERIMA)
 */
export async function updateJurnalItem(itemId: number, payload: {
  jurnal_id: number;
  tanggal: string;
  no_registrasi: string;
  no_referensi: string; 
  penerima?: string;
  keterangan_umum: string;
  no_akun: string;
  debit: number;
  kredit: number;
}) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE tb_jurnal SET 
        tanggal = ?, 
        no_registrasi = ?, 
        no_referensi = ?, 
        penerima = ?,
        keterangan = ? 
       WHERE id = ?`,
      [
        payload.tanggal, 
        payload.no_registrasi, 
        payload.no_referensi, 
        payload.penerima || "", 
        payload.keterangan_umum, 
        payload.jurnal_id
      ]
    );

    const [oldRows]: any = await connection.query(
      "SELECT no_akun, debit, kredit FROM tb_jurnal_item WHERE id = ?", 
      [itemId]
    );
    if (oldRows.length === 0) throw new Error("Data detail item transaksi tidak ditemukan di MySQL");
    const oldData = oldRows[0];

    if (oldData.debit > 0) {
      await connection.query("UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", [oldData.debit, oldData.no_akun]);
    }
    if (oldData.kredit > 0) {
      await connection.query("UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", [oldData.kredit, oldData.no_akun]);
    }

    await connection.query(
      `UPDATE tb_jurnal_item SET 
        no_akun = ?,
        debit = ?, 
        kredit = ? 
       WHERE id = ?`,
      [payload.no_akun, payload.debit, payload.kredit, itemId]
    );

    if (payload.debit > 0) {
      await connection.query("UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", [payload.debit, payload.no_akun]);
    }
    if (payload.kredit > 0) {
      await connection.query("UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", [payload.kredit, payload.no_akun]);
    }

    await connection.commit();
    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    return { success: true, message: "Seluruh kolom transaksi, No Referensi, Penerima, dan saldo master berhasil disesuaikan!" };

  } catch (error: any) {
    await connection.rollback();
    console.error("EDIT_JURNAL_ITEM_ERROR:", error.message);
    return { success: false, message: "Gagal menyesuaikan saldo: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ ACTION: HAPUS JURNAL (PULIHKAN SALDO)
 */
export async function deleteJurnalByHeader(jurnalId: number) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const [items]: any = await connection.query(
      "SELECT no_akun, debit, kredit FROM tb_jurnal_item WHERE jurnal_id = ?", 
      [jurnalId]
    );

    for (const item of items) {
      if (item.debit > 0) {
        await connection.query("UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", [item.debit, item.no_akun]);
      }
      if (item.kredit > 0) {
        await connection.query("UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", [item.kredit, item.no_akun]);
      }
    }

    await connection.query("DELETE FROM tb_jurnal_item WHERE jurnal_id = ?", [jurnalId]);
    await connection.query("DELETE FROM tb_jurnal WHERE id = ?", [jurnalId]);

    await connection.commit();
    
    revalidatePath("/dashboard/finance/pos/jurnal");
    revalidatePath("/dashboard/finance/riwayat");
    return { success: true, message: "Satu paket transaksi jurnal berhasil dihapus & saldo master dipulihkan!" };

  } catch (error: any) {
    await connection.rollback();
    console.error("DELETE_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal menghapus transaksi jurnal: " + error.message };
  } finally {
    connection.release();
  }
}

/**
 * 🛠️ ACTION: TAMBAH ENTRI JURNAL BARU (DENGAN NO_REFERENSI & PENERIMA)
 */
export async function createJurnalUmum(payload: JurnalPayload) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const headerQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, no_referensi, penerima, keterangan) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const [headerResult]: any = await connection.query(headerQuery, [
      payload.tanggal,
      payload.noRegistrasi, 
      payload.noReferensi, 
      payload.penerima || "",
      payload.keterangan
    ]);

    const jurnalId = headerResult.insertId;

    const itemQuery = `
      INSERT INTO tb_jurnal_item (jurnal_id, no_akun, debit, kredit) 
      VALUES (?, ?, ?, ?)
    `;

    for (const item of payload.items) {
      if (item.debit === 0 && item.kredit === 0) continue;

      await connection.query(itemQuery, [
        jurnalId,
        item.accountCode,
        item.debit,
        item.kredit
      ]);

      if (item.debit > 0) {
        await connection.query(
          "UPDATE tb_akun SET saldo = saldo + ? WHERE no_akun = ?", 
          [item.debit, item.accountCode]
        );
      } else if (item.kredit > 0) {
        await connection.query(
          "UPDATE tb_akun SET saldo = saldo - ? WHERE no_akun = ?", 
          [item.kredit, item.accountCode]
        );
      }
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
 * 🛠️ ACTION: GENERATE NO REGISTRASI OTOMATIS 
 */
export async function generateNoRegistrasiOtomatis(type: "BK" | "BD") {
  try {
    const sekarang = new Date();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0"); 
    const tahunFull = sekarang.getFullYear(); 
    const tahunShort = String(tahunFull).slice(-2); 

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