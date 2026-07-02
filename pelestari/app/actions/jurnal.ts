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
  noReferensi: string; // <-- Tambahan field interface payload
  keterangan: string;
  items: JurnalItemPayload[];
}

/**
 * 🚀 ACTION: EKSPOR DATA JURNAL UMUM KE EXCEL (10 KOLOM - DENGAN NO REFERENSI)
 */
export async function exportJurnalToExcel(startDate?: string, endDate?: string) {
  try {
    const jurnalList = await getJurnalList(startDate, endDate);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Jurnal Pembukuan", {
      views: [{ showGridLines: true }]
    });

    // 1. Header Judul Atas Laporan (Rentang Kolom Diperlebar jadi A s/d J)
    worksheet.mergeCells("A1", "J1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "REKAPITULASI JURNAL UMUM PEMBUKUAN";
    titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "111827" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };

    worksheet.mergeCells("A2", "J2");
    const subtitleCell = worksheet.getCell("A2");
    
    const infoTanggal = startDate && endDate 
      ? `${new Date(startDate).toLocaleDateString("id-ID")} s/d ${new Date(endDate).toLocaleDateString("id-ID")}`
      : "Semua Periode";
    subtitleCell.value = `Periode: ${infoTanggal} | Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`;
    subtitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "6B7280" } };

    worksheet.getRow(3).height = 12;

    // 2. Struktur Baru: Menjadi 10 Kolom dengan adanya No Referensi
    const tableHeaders = [
      "NO Register", 
      "No Referensi", // <-- Kolom baru disisipkan di sini
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
      const debitItems = (jurnal.items || []).filter((item: any) => Number(item.debit) > 0);
      const itemsToUse = debitItems.length > 0 ? debitItems : (jurnal.items || []);
      
      itemsToUse.forEach((item: any, idx: number) => {
        flatRowsToRender.push({
          isFirstInJurnal: idx === 0, 
          jurnalItemsCount: itemsToUse.length,
          no_registrasi: jurnal.no_registrasi || "-",
          no_referensi: jurnal.no_referensi || "-", // <-- Dimasukkan ke flattening list
          tanggal: jurnal.tanggal,
          kelompok_biaya: (item.nama_kelompok || "BIAYA OPERASIONAL").toUpperCase(),
          jenis_biaya: (item.nama_akun || "-").toUpperCase(),
          detail_jenis_biaya: (item.nama_akun || "-").toUpperCase(), 
          keterangan_memo: (jurnal.keterangan || "-").toUpperCase(), 
          nominal_murni: Number(item.debit) || Number(item.kredit) || 0
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
        flatRow.isFirstInJurnal ? flatRow.no_referensi : "", // <-- Tulis data No Referensi
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

      for (let colIdx = 1; colIdx <= 10; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "27272A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cellBgColor } };
        cell.border = {
          top: { style: "thin", color: { argb: "E4E4E7" } },
          bottom: { style: "thin", color: { argb: "E4E4E7" } },
          left: { style: "thin", color: { argb: "E4E4E7" } },
          right: { style: "thin", color: { argb: "E4E4E7" } }
        };

        // Format kolom 1, 2, 3 (Register, Referensi, Tanggal) jadi rata tengah
        if (colIdx === 1 || colIdx === 2 || colIdx === 3) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (colIdx === 1 || colIdx === 2) {
            cell.font = { name: "Consolas", size: 9, bold: true, color: { argb: colIdx === 1 ? "1D4ED8" : "047857" } };
          }
        } else if (colIdx === 4 || colIdx === 6 || colIdx === 8 || colIdx === 9) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else if (colIdx === 5 || colIdx === 7 || colIdx === 10) {
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

      // Geser index kolom ke kanan akibat adanya kolom baru (Kelompok=Kolom D, Total=Kolom E)
      if (kEnd > kStart && !processedKelompok.has(kKey)) {
        worksheet.mergeCells(`D${kStart}:D${kEnd}`);
        worksheet.mergeCells(`E${kStart}:E${kEnd}`);
        processedKelompok.add(kKey);
      }

      const jStart = flatRow.jenisStart;
      const jEnd = flatRow.jenisEnd;
      const jKey = `${jStart}-${jEnd}`;

      // Geser index kolom jenis biaya ke kanan (Jenis=Kolom F, Nominal=Kolom G)
      if (jEnd > jStart && !processedJenis.has(jKey)) {
        worksheet.mergeCells(`F${jStart}:F${jEnd}`);
        worksheet.mergeCells(`G${jStart}:G${jEnd}`);
        processedJenis.add(jKey);
      }
    });

    // Merge vertikal No Register, No Referensi & Tanggal transaksi bawaan
    let internalScanIdx = 5;
    flatRowsToRender.forEach((r) => {
      if (r.isFirstInJurnal && r.jurnalItemsCount > 1) {
        const subEnd = internalScanIdx + r.jurnalItemsCount - 1;
        try {
          worksheet.mergeCells(`A${internalScanIdx}:A${subEnd}`);
          worksheet.mergeCells(`B${internalScanIdx}:B${subEnd}`);
          worksheet.mergeCells(`C${internalScanIdx}:C${subEnd}`);
        } catch (e) {}
      }
      internalScanIdx++;
    });

    // Perataan posisi teks alignment tengah/kanan/kiri untuk kolom hasil merge cells
    for (let r = 5; r < currentRowIdx; r++) {
      ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
        const targetCell = worksheet.getCell(`${col}${r}`);
        if (targetCell) {
          let hAlign: "left" | "center" | "right" = "center";
          if (col === "D" || col === "F") hAlign = "left";
          if (col === "E" || col === "G") hAlign = "right";

          targetCell.alignment = { 
            vertical: "middle", 
            horizontal: hAlign,
            wrapText: true 
          };
        }
      });
    }

    // 7. Baris Grand Total Laporan Paling Bawah (Kolom J)
    const footerRow = worksheet.getRow(currentRowIdx);
    footerRow.height = 26;
    worksheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    
    const labelCell = footerRow.getCell(1);
    labelCell.value = "TOTAL KESELURUHAN LAPORAN  ";
    labelCell.font = { name: "Segoe UI", size: 10, bold: true };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };

    const totalFormulaCell = footerRow.getCell(10); // Pindah ke kolom 10 (J)
    totalFormulaCell.value = { formula: `=SUM(J5:J${currentRowIdx - 1})`, date1904: false }; 
    totalFormulaCell.font = { name: "Segoe UI", size: 10, bold: true };
    totalFormulaCell.numFmt = "#,##0;(#,##0);\"-\"";
    totalFormulaCell.alignment = { vertical: "middle", horizontal: "right" };

    for (let col = 1; col <= 10; col++) {
      const c = footerRow.getCell(col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4F4F5" } };
      c.border = {
        top: { style: "thin", color: { argb: "18181B" } },
        bottom: { style: "double", color: { argb: "18181B" } }
      };
    }

    // 8. Skala Lebar Kolom Presisi (10 Kolom)
    worksheet.columns = [
      { width: 16 }, // A: NO register
      { width: 16 }, // B: No Referensi (Tambahan)
      { width: 14 }, // C: Tanggal
      { width: 28 }, // D: Kelompok Biaya
      { width: 16 }, // E: Total Kelompok
      { width: 24 }, // F: Jenis Biaya
      { width: 16 }, // G: Nominal Jenis Biaya
      { width: 24 }, // H: Detail Jenis Biaya
      { width: 26 }, // I: Keterangan
      { width: 16 }  // J: Detail Nominal
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
 * 🛠️ ACTION: AMBIL DATA JURNAL (SELECT FIELD NO_REFERENSI)
 */
export async function getJurnalList(startDate?: string, endDate?: string) {
  try {
    let query = `
      SELECT 
        j.id, 
        j.tanggal, 
        j.no_registrasi, 
        j.no_referensi, -- <-- Ditambahkan ke selector database
        j.keterangan,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', i.id,  
            'no_akun', i.no_akun,
            'nama_akun', a.nama_akun,
            'nama_kelompok', k.kelompok_biaya, 
            'debit', i.debit,
            'kredit', i.kredit
          )
        ) AS items
      FROM tb_jurnal j
      LEFT JOIN tb_jurnal_item i ON j.id = i.jurnal_id
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id 
    `;

    const queryParams: any[] = [];

    if (startDate && endDate && startDate !== "" && endDate !== "") {
      query += ` WHERE DATE(j.tanggal) BETWEEN ? AND ? `;
      queryParams.push(startDate, endDate);
    }

    query += ` GROUP BY j.id ORDER BY j.tanggal DESC, j.id DESC `;

    const [rows]: any = await db.query(query, queryParams);
    return rows;
  } catch (error: any) {
    console.error("GET_JURNAL_LIST_ERROR:", error.message);
    return [];
  }
}

/**
 * 🛠️ ACTION: UPDATE MASSAL JURNAL (DENGAN NO_REFERENSI)
 */
export async function updateJurnalItem(itemId: number, payload: {
  jurnal_id: number;
  tanggal: string;
  no_registrasi: string;
  no_referensi: string; // <-- Ditambahkan ke type payload
  keterangan_umum: string;
  no_akun: string;
  debit: number;
  kredit: number;
}) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Injeksi update pada tb_jurnal dengan no_referensi
    await connection.query(
      `UPDATE tb_jurnal SET 
        tanggal = ?, 
        no_registrasi = ?, 
        no_referensi = ?, -- <-- Ditambahkan ke query UPDATE
        keterangan = ? 
       WHERE id = ?`,
      [payload.tanggal, payload.no_registrasi, payload.no_referensi, payload.keterangan_umum, payload.jurnal_id]
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
    revalidatePath("/dashboard/jurnal");
    return { success: true, message: "Seluruh kolom transaksi, No Referensi, dan saldo master berhasil disesuaikan!" };

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
    
    revalidatePath("/dashboard/jurnal");
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
 * 🛠️ ACTION: TAMBAH ENTRI JURNAL BARU (DENGAN NO_REFERENSI)
 */
export async function createJurnalUmum(payload: JurnalPayload) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const headerQuery = `
      INSERT INTO tb_jurnal (tanggal, no_registrasi, no_referensi, keterangan) 
      VALUES (?, ?, ?, ?)
    `;
    const [headerResult]: any = await connection.query(headerQuery, [
      payload.tanggal,
      payload.noRegistrasi, 
      payload.noReferensi, // <-- Disimpan masuk ke database tb_jurnal
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
    revalidatePath("/dashboard/jurnal");
    return { success: true, message: "Jurnal Umum Berhasil Disimpan!" };

  } catch (error: any) {
    await connection.rollback();
    console.error("CREATE_JURNAL_ERROR:", error.message);
    return { success: false, message: "Gagal menyimpan jurnal: " + error.message };
  } finally {
    connection.release();
  }
}

export async function generateNoRegistrasiOtomatis(type: "BK" | "BD") {
  try {
    const sekarang = new Date();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0"); // Hasil: "06"
    const tahunFull = sekarang.getFullYear(); // Hasil: 2026
    const tahunShort = String(tahunFull).slice(-2); // Hasil: "26"

    // Pola pencarian berdasarkan tipe, bulan, dan tahun saat ini (Contoh: 'BK_%/06/26')
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
      const noRegTerakhir = rows[0].no_registrasi; // Contoh: "BK_001/06/26"
      
      // Ambil bagian angka urutnya (di antara '_' dan '/')
      const match = noRegTerakhir.match(new RegExp(`${type}_(\\d+)\\/`));
      if (match && match[1]) {
        nomorUrutBaru = parseInt(match[1], 10) + 1;
      }
    }

    // Format urutan menjadi 3 digit (Contoh: 1 menjadi "001")
    const stringNomorUrut = String(nomorUrutBaru).padStart(3, "0");

    // Satukan sesuai format target: BK_002/06/26
    const noRegistrasiOtomatis = `${type}_${stringNomorUrut}/${bulan}/${tahunShort}`;

    return { success: true, code: noRegistrasiOtomatis };
  } catch (error: any) {
    console.error("GENERATE_NO_REG_ERROR:", error.message);
    return { success: false, code: "" };
  }
}