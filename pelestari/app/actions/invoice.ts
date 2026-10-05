"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// =========================================================================
// HELPER: CEK NORMAL BALANCE AKUN
// =========================================================================

function isNormalDebit(noAkun: string): boolean {
  const akun = String(noAkun).trim();

  // =========================================================
  // AKUN NORMAL DEBIT
  // =========================================================
  if (
    akun === "12100" || // Piutang Usaha
    akun === "14001"    // PPh 23
  ) {
    return true;
  }

  // =========================================================
  // AKUN NORMAL KREDIT
  // =========================================================
  if (
    akun === "41001" || // Pendapatan Pelatihan
    akun === "41002" || // Pendapatan Konsultan
    akun === "71106" || // PPN
    akun === "81100"    // PNBP
  ) {
    return false;
  }

  // =========================================================
  // DEFAULT BERDASARKAN PREFIX
  // =========================================================
  const prefix = akun.charAt(0);

  return (
    prefix === "1" ||
    prefix === "5" ||
    prefix === "6" ||
    prefix === "7" ||
    prefix === "8" ||
    prefix === "9"
  );
}

// =========================================================================
// HELPER: HITUNG ULANG SALDO AKUN DARI SELURUH JURNAL
// =========================================================================

async function recalculateSaldoAkun(
  connection: any,
  noAkun: string
) {
  const akun = String(noAkun).trim();

  const [rows]: any = await connection.query(
    `SELECT
      COALESCE(
        SUM(
          CASE
            WHEN no_akun IN ('12100', '14001')
              THEN debit - kredit

            WHEN no_akun IN (
              '41001',
              '41002',
              '71106',
              '81100'
            )
              THEN kredit - debit

            ELSE debit - kredit
          END
        ),
        0
      ) AS saldo
     FROM tb_jurnal_item
     WHERE no_akun = ?`,
    [akun]
  );

  const saldo = Number(
    rows[0]?.saldo || 0
  );

  await connection.query(
    `UPDATE tb_akun
     SET saldo = ?
     WHERE no_akun = ?`,
    [
      saldo,
      akun,
    ]
  );
}

// =========================================================================
// HELPER: HITUNG ULANG BEBERAPA AKUN SEKALIGUS
// =========================================================================

async function recalculateSaldoAkunList(
  connection: any,
  akunList: string[]
) {
  const akunUnik = [
    ...new Set(
      akunList
        .map((akun) => String(akun).trim())
        .filter(Boolean)
    ),
  ];

  for (const noAkun of akunUnik) {
    await recalculateSaldoAkun(
      connection,
      noAkun
    );
  }
}

// =========================================================================
// HELPER: GENERATE NOMOR REGISTRASI JURNAL
// =========================================================================

async function generateNoRegistrasi(
  connection: any,
  tanggal: string
) {
  const date = new Date(tanggal);

  const bulan = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const tahun = String(
    date.getFullYear()
  ).slice(-2);

  const [rows]: any =
    await connection.query(
      `SELECT no_registrasi
       FROM tb_jurnal
       WHERE no_registrasi LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [
        `BD_%/${bulan}/${tahun}`,
      ]
    );

  let nomorUrut = 1;

  if (
    rows.length > 0 &&
    rows[0].no_registrasi
  ) {
    const match =
      rows[0].no_registrasi.match(
        /^BD_(\d+)\/\d{2}\/\d{2}$/
      );

    if (match) {
      nomorUrut =
        Number(match[1]) + 1;
    }
  }

  return `BD_${String(
    nomorUrut
  ).padStart(3, "0")}/${bulan}/${tahun}`;
}

// =========================================================================
// 1. FUNGSI: IMPORT DATA EXCEL INVOICES BULK
// =========================================================================

export async function importInvoices(
  dataArray: any[]
) {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of dataArray) {
      // =======================================================
      // INSERT HEADER INVOICE
      // =======================================================

      const query = `
        INSERT INTO tb_invoice (
          nomor_invoice,
          batch,
          jenis_kegiatan,
          tanggal,
          tanggal_jatuhtempo,
          perusahaan_tujuan,
          npwp,
          alamat_perusahaan,
          file_faktur,
          cl,
          keterangan,
          is_dpp,
          is_pph23,
          is_ppn11,
          is_pnbp,
          nominal_pnbp,
          total,
          status,
          bayar_1,
          bayar_2
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        item.nomor_invoice,
        item.batch || "N/A",
        item.jenis_kegiatan || "-",
        item.tanggal,
        item.tanggal_jatuhtempo,
        item.perusahaan_tujuan,
        item.npwp || "-",
        item.alamat_perusahaan || "-",
        item.file_faktur || null,
        item.cl || null,
        item.keterangan || "-",
        item.is_dpp ? 1 : 0,
        item.is_pph23 ? 1 : 0,
        item.is_ppn11 ? 1 : 0,
        item.is_pnbp ? 1 : 0,
        Number(item.nominal_pnbp) || 0,
        Number(item.total) || 0,
        item.status || "Belum Lunas",
        Number(item.bayar_1) || 0,
        Number(item.bayar_2) || 0,
      ];

      const [result]: any =
        await connection.query(
          query,
          values
        );

      const invoiceId =
        result.insertId;

      // =======================================================
      // DETAIL 1
      // =======================================================

      const jumlahPeserta1 =
        Number(
          item.jumlah_peserta
        ) || 0;

      const hargaPeserta1 =
        Number(
          item.harga_peserta
        ) || 0;

      const keterangan1 =
        `${item.jenis_kegiatan || item.keterangan || "-"} - Batch ${item.batch || "-"}`;

      if (
        keterangan1 ||
        jumlahPeserta1 > 0 ||
        hargaPeserta1 > 0
      ) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          )
          VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            keterangan1,
            jumlahPeserta1,
            hargaPeserta1,
          ]
        );
      }

      // =======================================================
      // DETAIL 2
      // =======================================================

      const jumlahPeserta2 =
        Number(
          item.jumlah_peserta_2
        ) || 0;

      const hargaPeserta2 =
        Number(
          item.harga_peserta_2
        ) || 0;

      const keterangan2 =
        item.keterangan_2 || "";

      if (
        keterangan2 ||
        jumlahPeserta2 > 0 ||
        hargaPeserta2 > 0
      ) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          )
          VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            keterangan2,
            jumlahPeserta2,
            hargaPeserta2,
          ]
        );
      }
    }

    await connection.commit();

    revalidatePath(
      "/dashboard/finance/invoices"
    );

    return {
      success: true,
      message:
        `${dataArray.length} data berhasil diimpor`,
    };

  } catch (error: any) {
    await connection.rollback();

    console.error(
      "IMPORT_ERROR:",
      error.message
    );

    return {
      success: false,
      message:
        "Gagal impor: " +
        error.message,
    };

  } finally {
    connection.release();
  }
}

// =========================================================================
// 2. FUNGSI: AMBIL URUTAN NOMOR INVOICE
// =========================================================================

export async function getNextInvoiceNumber() {
  try {
    const [rows]: any =
      await db.query(
        `SELECT COUNT(id) AS total
         FROM tb_invoice`
      );

    const count =
      rows.length > 0
        ? Number(rows[0].total)
        : 0;

    return count + 1;

  } catch (error) {
    console.error(
      "Gagal mengambil urutan nomor:",
      error
    );

    return 1;
  }
}

// =========================================================================
// 3. FUNGSI: TAMBAH INVOICE FORM
// =========================================================================

export async function createInvoice(
  formData: any
) {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    // =========================================================
    // 1. INSERT INVOICE
    // =========================================================

    const [invoiceResult]: any =
      await connection.query(
        `INSERT INTO tb_invoice (
          nomor_invoice,
          batch,
          tanggal,
          jenis_kegiatan,
          tanggal_jatuhtempo,
          perusahaan_tujuan,
          npwp,
          alamat_perusahaan,
          file_faktur,
          cl,
          is_dpp,
          is_pph23,
          is_ppn11,
          is_pnbp,
          nominal_pnbp,
          total,
          bayar_1,
          tanggal_bayar_1,
          bayar_2,
          tanggal_bayar_2,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          formData.nomor_invoice,
          formData.batch || null,
          formData.tanggal,
          formData.jenis_kegiatan,
          formData.tanggal_jatuhtempo || null,
          formData.perusahaan_tujuan,
          formData.npwp || null,
          formData.alamat_perusahaan || null,
          formData.file_faktur || null,
          formData.cl || null,
          formData.is_dpp ? 1 : 0,
          formData.is_pph23 ? 1 : 0,
          formData.is_ppn11 ? 1 : 0,
          formData.is_pnbp ? 1 : 0,
          Number(
            formData.nominal_pnbp || 0
          ),
          Number(
            formData.total || 0
          ),
          Number(
            formData.bayar_1 || 0
          ),
          formData.tanggal_bayar_1 || null,
          Number(
            formData.bayar_2 || 0
          ),
          formData.tanggal_bayar_2 || null,
          formData.status ||
          "Belum Lunas",
        ]
      );

    const invoiceId =
      invoiceResult.insertId;

    // =========================================================
    // 2. INSERT DETAIL INVOICE
    // =========================================================

    const items =
      Array.isArray(formData.items)
        ? formData.items
        : [];

    for (const item of items) {
      await connection.query(
        `INSERT INTO tb_invoice_details (
          invoice_id,
          item_deskripsi,
          item_jumlah,
          item_harga
        )
        VALUES (?, ?, ?, ?)`,
        [
          invoiceId,

          `${item.item_deskripsi || "-"} - Batch ${formData.batch || "-"
          }`,

          Number(
            item.item_jumlah || 0
          ),

          Number(
            item.item_harga || 0
          ),
        ]
      );
    }

    // =========================================================
    // 3. SIAPKAN NILAI JURNAL
    // =========================================================

    const totalInvoice =
      Number(
        formData.total || 0
      );

    const nominalPnbp =
      Number(
        formData.nominal_pnbp || 0
      );

    const total =
      Math.round(totalInvoice);

    const pnbp =
      formData.is_pnbp
        ? Math.round(nominalPnbp)
        : 0;

    // =========================================================
    // 4. TENTUKAN AKUN PENDAPATAN
    // =========================================================

    const jenisKegiatan =
      String(
        formData.jenis_kegiatan || ""
      )
        .trim()
        .toLowerCase();

    let akunPendapatan =
      "41001";

    if (
      jenisKegiatan === "konsultan" ||
      jenisKegiatan === "konsultasi"
    ) {
      akunPendapatan =
        "41002";
    }

    // =========================================================
    // 5. HITUNG SUBTOTAL
    // =========================================================

    const subtotal =
      Math.round(
        items.reduce(
          (
            sum: number,
            item: any
          ) => {
            const jumlah =
              Number(
                item.item_jumlah || 0
              );

            const harga =
              Number(
                item.item_harga || 0
              );

            return (
              sum +
              jumlah * harga
            );
          },
          0
        )
      );

    // =========================================================
    // 6. HITUNG DPP
    // =========================================================

    const dpp =
      formData.is_dpp
        ? Math.round(
          (11 / 12) *
          subtotal
        )
        : subtotal;

    // =========================================================
    // 7. HITUNG PPH 23
    // =========================================================

    const pph23 =
      formData.is_pph23
        ? Math.round(
          dpp * 0.02
        )
        : 0;

    // =========================================================
    // 8. HITUNG PPN
    // =========================================================

    const ppn =
      formData.is_ppn11
        ? Math.round(
          subtotal * 0.11
        )
        : 0;

    // =========================================================
    // 9. CARI PEMOHON
    // =========================================================

    const [pemohonRows]: any =
      await connection.query(
        `SELECT id
         FROM tb_pemohon
         WHERE nama_pemohon = ?
         LIMIT 1`,
        [
          "PT Peduli Lestari Indonesia",
        ]
      );

    if (
      pemohonRows.length === 0
    ) {
      throw new Error(
        `Pemohon "PT Peduli Lestari Indonesia" tidak ditemukan di tb_pemohon`
      );
    }

    const pemohonId =
      pemohonRows[0].id;

    // =========================================================
    // 10. CARI / BUAT PENERIMA
    // =========================================================

    const namaPenerima =
      String(
        formData.perusahaan_tujuan ||
        ""
      ).trim();

    if (!namaPenerima) {
      throw new Error(
        "Perusahaan tujuan / penerima wajib diisi"
      );
    }

    const [penerimaRows]: any =
      await connection.query(
        `SELECT id
         FROM tb_penerima
         WHERE nama_penerima = ?
         LIMIT 1`,
        [namaPenerima]
      );

    let penerimaId: number;

    if (
      penerimaRows.length > 0
    ) {
      penerimaId =
        penerimaRows[0].id;

    } else {
      const [
        penerimaResult,
      ]: any =
        await connection.query(
          `INSERT INTO tb_penerima (
            nama_penerima
          )
          VALUES (?)`,
          [namaPenerima]
        );

      penerimaId =
        penerimaResult.insertId;
    }

    // =========================================================
    // 11. NOMOR REGISTRASI
    // =========================================================

    const noRegistrasi =
      await generateNoRegistrasi(
        connection,
        formData.tanggal
      );

    // =========================================================
    // 12. KETERANGAN JURNAL
    // =========================================================

    const keteranganJurnal =
      items
        .map(
          (item: any) =>
            item.item_deskripsi
        )
        .filter(Boolean)
        .join(", ");

    // =========================================================
    // 13. INSERT HEADER JURNAL
    // =========================================================

    const [
      jurnalResult,
    ]: any =
      await connection.query(
        `INSERT INTO tb_jurnal (
          tanggal,
          no_registrasi,
          no_referensi,
          keterangan,
          invoice_id,
          penerima_id,
          pemohon_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          formData.tanggal,
          noRegistrasi,
          formData.nomor_invoice,
          keteranganJurnal,
          invoiceId,
          penerimaId,
          pemohonId,
        ]
      );

    const jurnalId =
      jurnalResult.insertId;

    // =========================================================
    // 14. SIAPKAN DETAIL JURNAL
    // =========================================================

    const jurnalDetails: {
      no_akun: string;
      debit: number;
      kredit: number;
      keterangan: string;
    }[] = [];

    // =========================================================
    // PIUTANG
    // =========================================================

    jurnalDetails.push({
      no_akun: "12100",
      debit: total,
      kredit: 0,
      keterangan:
        `Piutang Invoice ${formData.nomor_invoice} - Batch ${formData.batch || "-"
        }`,
    });

    // =========================================================
    // PPH 23
    // =========================================================

    if (pph23 > 0) {
      jurnalDetails.push({
        no_akun: "14001",
        debit: pph23,
        kredit: 0,
        keterangan:
          `PPh 23 Invoice ${formData.nomor_invoice}`,
      });
    }

    // =========================================================
    // PENDAPATAN
    // =========================================================

    jurnalDetails.push({
      no_akun: akunPendapatan,
      debit: 0,
      kredit: subtotal,
      keterangan:
        `Pendapatan Invoice ${formData.nomor_invoice}`,
    });

    // =========================================================
    // PPN
    // =========================================================

    if (ppn > 0) {
      jurnalDetails.push({
        no_akun: "71106",
        debit: 0,
        kredit: ppn,
        keterangan:
          `PPN Invoice ${formData.nomor_invoice}`,
      });
    }

    // =========================================================
    // PNBP
    // =========================================================

    if (pnbp > 0) {
      jurnalDetails.push({
        no_akun: "81100",
        debit: 0,
        kredit: pnbp,
        keterangan:
          `PNBP Invoice ${formData.nomor_invoice}`,
      });
    }

    // =========================================================
    // 15. VALIDASI BALANCE
    // =========================================================

    const totalDebit =
      jurnalDetails.reduce(
        (sum, item) =>
          sum +
          Number(
            item.debit || 0
          ),
        0
      );

    const totalKredit =
      jurnalDetails.reduce(
        (sum, item) =>
          sum +
          Number(
            item.kredit || 0
          ),
        0
      );

    if (
      totalDebit !==
      totalKredit
    ) {
      throw new Error(
        `Jurnal tidak balance. Debit: ${totalDebit}, Kredit: ${totalKredit}`
      );
    }

    // =========================================================
    // 16. INSERT DETAIL JURNAL
    // =========================================================

    for (const detail of jurnalDetails) {
      await connection.query(
        `INSERT INTO tb_jurnal_item (
          jurnal_id,
          no_akun,
          debit,
          kredit,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?)`,
        [
          jurnalId,
          detail.no_akun,
          detail.debit,
          detail.kredit,
          detail.keterangan,
        ]
      );
    }

    // =========================================================
    // 17. HITUNG ULANG SALDO AKUN
    // =========================================================

    await recalculateSaldoAkunList(
      connection,
      jurnalDetails.map(
        (detail) =>
          detail.no_akun
      )
    );

    // =========================================================
    // 18. COMMIT
    // =========================================================

    await connection.commit();

    revalidatePath(
      "/dashboard/finance/invoices"
    );

    revalidatePath(
      "/dashboard/finance/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,
      id: invoiceId,
      jurnalId,
    };

  } catch (error: any) {
    await connection.rollback();

    console.error(
      "Error createInvoice:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Gagal membuat invoice",
    };

  } finally {
    connection.release();
  }
}

// =========================================================================
// 4. FUNGSI: HAPUS DATA INVOICE + JURNAL + SALDO
// =========================================================================

export async function deleteInvoice(
  id: number
) {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    // =========================================================
    // 1. CARI JURNAL INVOICE
    // =========================================================

    const [jurnalRows]: any =
      await connection.query(
        `SELECT id
         FROM tb_jurnal
         WHERE invoice_id = ?
         LIMIT 1`,
        [id]
      );

    const jurnalId =
      jurnalRows.length > 0
        ? Number(jurnalRows[0].id)
        : null;

    let akunYangBerubah: string[] =
      [];

    // =========================================================
    // 2. AMBIL AKUN JURNAL
    // =========================================================

    if (jurnalId) {
      const [
        jurnalItems,
      ]: any =
        await connection.query(
          `SELECT
            no_akun
           FROM tb_jurnal_item
           WHERE jurnal_id = ?`,
          [jurnalId]
        );

      akunYangBerubah =
        jurnalItems.map(
          (detail: any) =>
            String(
              detail.no_akun
            )
        );

      // =======================================================
      // 3. HAPUS DETAIL JURNAL
      // =======================================================

      await connection.query(
        `DELETE FROM tb_jurnal_item
         WHERE jurnal_id = ?`,
        [jurnalId]
      );

      // =======================================================
      // 4. HAPUS HEADER JURNAL
      // =======================================================

      await connection.query(
        `DELETE FROM tb_jurnal
         WHERE id = ?`,
        [jurnalId]
      );
    }

    // =========================================================
    // 5. HAPUS DETAIL INVOICE
    // =========================================================

    await connection.query(
      `DELETE FROM tb_invoice_details
       WHERE invoice_id = ?`,
      [id]
    );

    // =========================================================
    // 6. HAPUS INVOICE
    // =========================================================

    const [result]: any =
      await connection.query(
        `DELETE FROM tb_invoice
         WHERE id = ?`,
        [id]
      );

    if (
      result.affectedRows === 0
    ) {
      throw new Error(
        "Invoice tidak ditemukan."
      );
    }

    // =========================================================
    // 7. HITUNG ULANG SALDO AKUN
    // =========================================================

    await recalculateSaldoAkunList(
      connection,
      akunYangBerubah
    );

    // =========================================================
    // 8. COMMIT
    // =========================================================

    await connection.commit();

    revalidatePath(
      "/dashboard/finance/invoices"
    );

    revalidatePath(
      "/dashboard/finance/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,
      message:
        "Invoice, jurnal, dan saldo berhasil dihapus.",
    };

  } catch (error: any) {
    await connection.rollback();

    console.error(
      "DELETE_INVOICE_ERROR:",
      error
    );

    return {
      success: false,
      message:
        error.message ||
        "Gagal menghapus invoice.",
    };

  } finally {
    connection.release();
  }
}

// =========================================================================
// 5. FUNGSI: UPDATE / EDIT INVOICE + JURNAL + SALDO
// =========================================================================

export async function updateInvoice(
  id: number,
  data: any
) {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    // =========================================================
    // 1. AMBIL INVOICE LAMA
    // =========================================================

    const [
      oldInvoiceRows,
    ]: any =
      await connection.query(
        `SELECT *
         FROM tb_invoice
         WHERE id = ?
         LIMIT 1`,
        [id]
      );

    if (
      oldInvoiceRows.length === 0
    ) {
      throw new Error(
        "Invoice tidak ditemukan."
      );
    }

    const oldInvoice =
      oldInvoiceRows[0];

    // =========================================================
    // 2. AMBIL JURNAL LAMA
    // =========================================================

    const [
      oldJurnalRows,
    ]: any =
      await connection.query(
        `SELECT id
         FROM tb_jurnal
         WHERE invoice_id = ?
         LIMIT 1`,
        [id]
      );

    const oldJurnalId =
      oldJurnalRows.length > 0
        ? Number(
          oldJurnalRows[0].id
        )
        : null;

    // =========================================================
    // 3. AMBIL AKUN JURNAL LAMA
    // =========================================================

    let akunJurnalLama: string[] =
      [];

    if (oldJurnalId) {
      const [
        oldJurnalItems,
      ]: any =
        await connection.query(
          `SELECT
            no_akun
           FROM tb_jurnal_item
           WHERE jurnal_id = ?`,
          [oldJurnalId]
        );

      akunJurnalLama =
        oldJurnalItems.map(
          (detail: any) =>
            String(
              detail.no_akun
            )
        );
    }

    // =========================================================
    // 4. DATA BARU
    // =========================================================

    const tanggal =
      data.tanggal ||
      oldInvoice.tanggal;

    const nomorInvoice =
      data.nomor_invoice ||
      oldInvoice.nomor_invoice;

    const batch =
      data.batch ||
      null;

    const jenisKegiatan =
      String(
        data.jenis_kegiatan ||
        oldInvoice.jenis_kegiatan ||
        ""
      )
        .trim()
        .toLowerCase();

    const perusahaanTujuan =
      String(
        data.perusahaan_tujuan ||
        oldInvoice.perusahaan_tujuan ||
        ""
      ).trim();

    if (!perusahaanTujuan) {
      throw new Error(
        "Perusahaan tujuan / penerima wajib diisi"
      );
    }

    // =========================================================
    // 5. UPDATE DATA INVOICE
    // =========================================================

    await connection.query(
      `UPDATE tb_invoice SET
        nomor_invoice = ?,
        tanggal = ?,
        batch = ?,
        jenis_kegiatan = ?,
        tanggal_jatuhtempo = ?,
        perusahaan_tujuan = ?,
        npwp = ?,
        alamat_perusahaan = ?,
        file_faktur = ?,
        cl = ?,
        is_dpp = ?,
        is_pph23 = ?,
        is_ppn11 = ?,
        is_pnbp = ?,
        nominal_pnbp = ?,
        bayar_1 = ?,
        tanggal_bayar_1 = ?,
        bayar_2 = ?,
        tanggal_bayar_2 = ?,
        total = ?,
        status = ?
       WHERE id = ?`,
      [
        nomorInvoice,
        tanggal,
        batch,
        data.jenis_kegiatan ||
        oldInvoice.jenis_kegiatan ||
        null,
        data.tanggal_jatuhtempo ||
        null,
        perusahaanTujuan,
        data.npwp || null,
        data.alamat_perusahaan ||
        null,
        data.file_faktur ||
        null,
        data.cl || null,
        data.is_dpp ? 1 : 0,
        data.is_pph23 ? 1 : 0,
        data.is_ppn11 ? 1 : 0,
        data.is_pnbp ? 1 : 0,
        Number(
          data.nominal_pnbp || 0
        ),
        Number(
          data.bayar_1 || 0
        ),
        data.tanggal_bayar_1 ||
        null,
        Number(
          data.bayar_2 || 0
        ),
        data.tanggal_bayar_2 ||
        null,
        Number(
          data.total || 0
        ),
        data.status ||
        "Belum Lunas",
        id,
      ]
    );

    // =========================================================
    // 6. REPLACE DETAIL INVOICE
    // =========================================================

    await connection.query(
      `DELETE FROM tb_invoice_details
       WHERE invoice_id = ?`,
      [id]
    );

    const items =
      Array.isArray(data.items)
        ? data.items
        : [];

    for (const item of items) {
      await connection.query(
        `INSERT INTO tb_invoice_details (
          invoice_id,
          item_deskripsi,
          item_jumlah,
          item_harga
        )
        VALUES (?, ?, ?, ?)`,
        [
          id,

          `${item.item_deskripsi || "-"} - Batch ${batch || "-"
          }`,

          Number(
            item.item_jumlah || 0
          ),

          Number(
            item.item_harga || 0
          ),
        ]
      );
    }

    // =========================================================
    // 7. HITUNG ULANG NILAI
    // =========================================================

    const totalInvoice =
      Math.round(
        Number(
          data.total || 0
        )
      );

    const nominalPnbp =
      Math.round(
        Number(
          data.nominal_pnbp || 0
        )
      );

    const pnbp =
      data.is_pnbp
        ? nominalPnbp
        : 0;

    // =========================================================
    // 8. TENTUKAN AKUN PENDAPATAN
    // =========================================================

    let akunPendapatan =
      "41001";

    if (
      jenisKegiatan ===
      "konsultan" ||
      jenisKegiatan ===
      "konsultasi"
    ) {
      akunPendapatan =
        "41002";
    }

    // =========================================================
    // 9. HITUNG SUBTOTAL
    // =========================================================

    const subtotal =
      Math.round(
        items.reduce(
          (
            sum: number,
            item: any
          ) => {
            const jumlah =
              Number(
                item.item_jumlah || 0
              );

            const harga =
              Number(
                item.item_harga || 0
              );

            return (
              sum +
              jumlah * harga
            );
          },
          0
        )
      );

    // =========================================================
    // 10. HITUNG DPP
    // =========================================================

    const dpp =
      data.is_dpp
        ? Math.round(
          (11 / 12) *
          subtotal
        )
        : subtotal;

    // =========================================================
    // 11. HITUNG PPH 23
    // =========================================================

    const pph23 =
      data.is_pph23
        ? Math.round(
          dpp * 0.02
        )
        : 0;

    // =========================================================
    // 12. HITUNG PPN
    // =========================================================

    const ppn =
      data.is_ppn11
        ? Math.round(
          subtotal * 0.11
        )
        : 0;

    // =========================================================
    // 13. CARI PEMOHON
    // =========================================================

    const [
      pemohonRows,
    ]: any =
      await connection.query(
        `SELECT id
         FROM tb_pemohon
         WHERE nama_pemohon = ?
         LIMIT 1`,
        [
          "PT Peduli Lestari Indonesia",
        ]
      );

    if (
      pemohonRows.length === 0
    ) {
      throw new Error(
        `Pemohon "PT Peduli Lestari Indonesia" tidak ditemukan di tb_pemohon`
      );
    }

    const pemohonId =
      pemohonRows[0].id;

    // =========================================================
    // 14. CARI / BUAT PENERIMA
    // =========================================================

    const [
      penerimaRows,
    ]: any =
      await connection.query(
        `SELECT id
         FROM tb_penerima
         WHERE nama_penerima = ?
         LIMIT 1`,
        [perusahaanTujuan]
      );

    let penerimaId: number;

    if (
      penerimaRows.length > 0
    ) {
      penerimaId =
        penerimaRows[0].id;

    } else {
      const [
        penerimaResult,
      ]: any =
        await connection.query(
          `INSERT INTO tb_penerima (
            nama_penerima
          )
          VALUES (?)`,
          [perusahaanTujuan]
        );

      penerimaId =
        penerimaResult.insertId;
    }

    // =========================================================
    // 15. NOMOR REGISTRASI
    // =========================================================

    let noRegistrasi: string;

    if (oldJurnalId) {
      const [
        noRegRows,
      ]: any =
        await connection.query(
          `SELECT no_registrasi
           FROM tb_jurnal
           WHERE id = ?
           LIMIT 1`,
          [oldJurnalId]
        );

      if (
        noRegRows.length > 0 &&
        noRegRows[0]
          .no_registrasi
      ) {
        noRegistrasi =
          noRegRows[0]
            .no_registrasi;

      } else {
        noRegistrasi =
          await generateNoRegistrasi(
            connection,
            tanggal
          );
      }

    } else {
      noRegistrasi =
        await generateNoRegistrasi(
          connection,
          tanggal
        );
    }

    // =========================================================
    // 16. KETERANGAN JURNAL
    // =========================================================

    const keteranganJurnal =
      items
        .map(
          (item: any) =>
            item.item_deskripsi
        )
        .filter(Boolean)
        .join(", ");

    // =========================================================
    // 17. SIAPKAN DETAIL JURNAL
    // =========================================================

    const jurnalDetails: {
      no_akun: string;
      debit: number;
      kredit: number;
      keterangan: string;
    }[] = [];

    // =========================================================
    // PIUTANG
    // =========================================================

    jurnalDetails.push({
      no_akun: "12100",

      debit: totalInvoice,

      kredit: 0,

      keterangan:
        `Piutang Invoice ${nomorInvoice} - Batch ${batch || "-"
        }`,
    });

    // =========================================================
    // PPH 23
    // =========================================================

    if (pph23 > 0) {
      jurnalDetails.push({
        no_akun: "14001",

        debit: pph23,

        kredit: 0,

        keterangan:
          `PPh 23 Invoice ${nomorInvoice}`,
      });
    }

    // =========================================================
    // PENDAPATAN
    // =========================================================

    jurnalDetails.push({
      no_akun:
        akunPendapatan,

      debit: 0,

      kredit: subtotal,

      keterangan:
        `Pendapatan Invoice ${nomorInvoice}`,
    });

    // =========================================================
    // PPN
    // =========================================================

    if (ppn > 0) {
      jurnalDetails.push({
        no_akun: "71106",

        debit: 0,

        kredit: ppn,

        keterangan:
          `PPN Invoice ${nomorInvoice}`,
      });
    }

    // =========================================================
    // PNBP
    // =========================================================

    if (pnbp > 0) {
      jurnalDetails.push({
        no_akun: "81100",

        debit: 0,

        kredit: pnbp,

        keterangan:
          `PNBP Invoice ${nomorInvoice}`,
      });
    }

    // =========================================================
    // 18. VALIDASI BALANCE
    // =========================================================

    const totalDebit =
      jurnalDetails.reduce(
        (sum, item) =>
          sum +
          Number(
            item.debit || 0
          ),
        0
      );

    const totalKredit =
      jurnalDetails.reduce(
        (sum, item) =>
          sum +
          Number(
            item.kredit || 0
          ),
        0
      );

    if (
      totalDebit !==
      totalKredit
    ) {
      throw new Error(
        `Jurnal tidak balance. Debit: ${totalDebit}, Kredit: ${totalKredit}`
      );
    }

    // =========================================================
    // 19. UPDATE / INSERT HEADER JURNAL
    // =========================================================

    let jurnalId: number;

    if (oldJurnalId) {
      // =======================================================
      // UPDATE JURNAL LAMA
      // =======================================================

      await connection.query(
        `UPDATE tb_jurnal SET
          tanggal = ?,
          no_registrasi = ?,
          no_referensi = ?,
          keterangan = ?,
          penerima_id = ?,
          pemohon_id = ?
         WHERE id = ?`,
        [
          tanggal,
          noRegistrasi,
          nomorInvoice,
          keteranganJurnal,
          penerimaId,
          pemohonId,
          oldJurnalId,
        ]
      );

      jurnalId =
        oldJurnalId;

      // =======================================================
      // HAPUS DETAIL JURNAL LAMA
      // =======================================================

      await connection.query(
        `DELETE FROM tb_jurnal_item
         WHERE jurnal_id = ?`,
        [jurnalId]
      );

    } else {
      // =======================================================
      // INSERT JURNAL BARU
      // =======================================================

      const [
        jurnalResult,
      ]: any =
        await connection.query(
          `INSERT INTO tb_jurnal (
            tanggal,
            no_registrasi,
            no_referensi,
            keterangan,
            invoice_id,
            penerima_id,
            pemohon_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tanggal,
            noRegistrasi,
            nomorInvoice,
            keteranganJurnal,
            id,
            penerimaId,
            pemohonId,
          ]
        );

      jurnalId =
        jurnalResult.insertId;
    }

    // =========================================================
    // 20. INSERT DETAIL JURNAL BARU
    // =========================================================

    for (const detail of jurnalDetails) {
      await connection.query(
        `INSERT INTO tb_jurnal_item (
          jurnal_id,
          no_akun,
          debit,
          kredit,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?)`,
        [
          jurnalId,
          detail.no_akun,
          detail.debit,
          detail.kredit,
          detail.keterangan,
        ]
      );
    }

    // =========================================================
    // 21. HITUNG ULANG SALDO
    // =========================================================

    const akunJurnalBaru =
      jurnalDetails.map(
        (detail) =>
          detail.no_akun
      );

    await recalculateSaldoAkunList(
      connection,
      [
        ...akunJurnalLama,
        ...akunJurnalBaru,
      ]
    );

    // =========================================================
    // 22. COMMIT
    // =========================================================

    await connection.commit();

    revalidatePath(
      "/dashboard/finance/invoices"
    );

    revalidatePath(
      "/dashboard/finance/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,

      message:
        "Invoice, jurnal, dan saldo berhasil diperbarui.",

      id,

      jurnalId,
    };

  } catch (error: any) {
    await connection.rollback();

    console.error(
      "UPDATE_INVOICE_ERROR:",
      error
    );

    return {
      success: false,

      message:
        error.message ||
        "Gagal memperbarui invoice.",
    };

  } finally {
    connection.release();
  }
}

// =========================================================================
// 6. FUNGSI: DETEKSI DETAIL INVOICE BY ID
// =========================================================================

export async function getInvoiceById(
  id: number
) {
  try {
    const [rows]: any =
      await db.query(
        `SELECT *
         FROM tb_invoice
         WHERE id = ?`,
        [id]
      );

    if (!rows[0]) {
      return null;
    }

    const [details]: any =
      await db.query(
        `SELECT
          id,
          invoice_id,
          item_deskripsi,
          item_jumlah,
          item_harga
         FROM tb_invoice_details
         WHERE invoice_id = ?
         ORDER BY id ASC`,
        [id]
      );

    return {
      ...rows[0],
      items: details,
    };

  } catch (error) {
    console.error(
      "GET_INVOICE_BY_ID_ERROR:",
      error
    );

    return null;
  }
}

// =========================================================================
// 7. FUNGSI: AMBIL SEMUA LIST DATA INVOICE + HITUNG UMUR PIUTANG
// =========================================================================

export async function getInvoices() {
  try {
    const [rows]: any =
      await db.query(`
        SELECT
          i.*,
          d.id AS detail_id,
          d.item_deskripsi,
          d.item_jumlah,
          d.item_harga
        FROM tb_invoice i
        LEFT JOIN tb_invoice_details d
          ON d.invoice_id = i.id
        ORDER BY
          i.id DESC,
          d.id ASC
      `);

    const invoiceMap =
      new Map<number, any>();

    for (const row of rows) {
      if (
        !invoiceMap.has(row.id)
      ) {
        const {
          detail_id,
          item_deskripsi,
          item_jumlah,
          item_harga,
          ...header
        } = row;

        invoiceMap.set(
          row.id,
          {
            ...header,
            items: [],
          }
        );
      }

      if (
        row.detail_id
      ) {
        invoiceMap
          .get(row.id)
          .items.push({
            id: row.detail_id,

            item_deskripsi:
              row.item_deskripsi,

            item_jumlah:
              row.item_jumlah,

            item_harga:
              row.item_harga,
          });
      }
    }

    const dataLengkap =
      Array.from(
        invoiceMap.values()
      ).map((inv: any) => {
        const tglJatuhTempo =
          new Date(
            inv.tanggal_jatuhtempo
          );

        const tglSekarang =
          new Date();

        const selisihMilidetik =
          tglSekarang.getTime() -
          tglJatuhTempo.getTime();

        const hitungHari =
          Math.floor(
            selisihMilidetik /
            (1000 *
              60 *
              60 *
              24)
          );

        return {
          ...inv,

          umur_piutang:
            hitungHari > 0
              ? hitungHari
              : 0,
        };
      });

    return dataLengkap;

  } catch (error) {
    console.error(
      "Gagal mengambil data:",
      error
    );

    return [];
  }
}

// =========================================================================
// 8. FUNGSI: UPDATE FILE INVOICE
// =========================================================================

export async function updateInvoiceFile(
  id: number,
  field:
    | "file_faktur"
    | "cl",
  fileUrl: string
) {
  try {
    const query = `
      UPDATE tb_invoice
      SET ${field} = ?
      WHERE id = ?
    `;

    await db.query(
      query,
      [
        fileUrl,
        id,
      ]
    );

    revalidatePath(
      "/dashboard/finance/invoices"
    );

    return {
      success: true,
    };

  } catch (error: any) {
    console.error(
      "UPDATE_FILE_ERROR:",
      error.message
    );

    return {
      success: false,

      message:
        error.message,
    };
  }
}