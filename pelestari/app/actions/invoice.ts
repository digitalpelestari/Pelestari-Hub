"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// =========================================================================
// 1. FUNGSI: IMPORT DATA EXCEL INVOICES BULK
// =========================================================================
export async function importInvoices(dataArray: any[]) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of dataArray) {
      const query = `INSERT INTO tb_invoice (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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

      const [result]: any = await connection.query(query, values);
      const invoiceId = result.insertId;

      const jumlahPeserta1 = Number(item.jumlah_peserta) || 0;
      const hargaPeserta1 = Number(item.harga_peserta) || 0;
      const keterangan1 = item.jenis_kegiatan || item.keterangan || "-";

      if (keterangan1 || jumlahPeserta1 > 0 || hargaPeserta1 > 0) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            keterangan1,
            jumlahPeserta1,
            hargaPeserta1,
          ]
        );
      }

      const jumlahPeserta2 = Number(item.jumlah_peserta_2) || 0;
      const hargaPeserta2 = Number(item.harga_peserta_2) || 0;
      const keterangan2 = item.keterangan_2 || "";

      if (keterangan2 || jumlahPeserta2 > 0 || hargaPeserta2 > 0) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
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
    revalidatePath("/dashboard/finance/invoices");

    return {
      success: true,
      message: `${dataArray.length} data berhasil diimpor`,
    };
  } catch (error: any) {
    await connection.rollback();
    console.error("IMPORT_ERROR:", error.message);
    return {
      success: false,
      message: "Gagal impor: " + error.message,
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
    const [rows]: any = await db.query("SELECT COUNT(id) as total FROM tb_invoice");
    const count = rows.length > 0 ? rows[0].total : 0;
    return count + 1;
  } catch (error) {
    console.error("Gagal mengambil urutan nomor:", error);
    return 1;
  }
}

async function generateNoRegistrasi(connection: any, tanggal: string) {
  const date = new Date(tanggal);

  const bulan = String(date.getMonth() + 1).padStart(2, "0");
  const tahun = String(date.getFullYear()).slice(-2);

  const [rows]: any = await connection.query(
    `SELECT no_registrasi
     FROM tb_jurnal
     WHERE no_registrasi LIKE ?
     ORDER BY id DESC
     LIMIT 1`,
    [`BD_%/${bulan}/${tahun}`]
  );

  let nomorUrut = 1;

  if (rows.length > 0 && rows[0].no_registrasi) {
    const match = rows[0].no_registrasi.match(/^BD_(\d+)\/\d{2}\/\d{2}$/);

    if (match) {
      nomorUrut = Number(match[1]) + 1;
    }
  }

  return `BD_${String(nomorUrut).padStart(3, "0")}/${bulan}/${tahun}`;
}

function isNormalDebit(noAkun: string): boolean {
  const prefix = String(noAkun).trim().charAt(0);

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
// 3. FUNGSI: TAMBAH INVOICE FORM
// =========================================================================
export async function createInvoice(formData: any) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // =========================================================
    // 1. INSERT INVOICE
    // =========================================================

    const [invoiceResult]: any = await connection.query(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        formData.nominal_pnbp || 0,
        formData.total || 0,
        formData.bayar_1 || 0,
        formData.tanggal_bayar_1 || null,
        formData.bayar_2 || 0,
        formData.tanggal_bayar_2 || null,
        formData.status || "Belum Lunas",
      ]
    );

    const invoiceId = invoiceResult.insertId;

    // =========================================================
    // 2. INSERT DETAIL INVOICE
    // =========================================================

    if (formData.items && formData.items.length > 0) {
      for (const item of formData.items) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            invoiceId,
            item.item_deskripsi,
            item.item_jumlah || 0,
            item.item_harga || 0,
          ]
        );
      }
    }

    // =========================================================
    // 3. SIAPKAN NILAI JURNAL
    // =========================================================

    const totalInvoice = Number(formData.total || 0);
    const nominalPnbp = Number(formData.nominal_pnbp || 0);

    /*
     * Karena INT digunakan pada tb_jurnal_detail,
     * kita bulatkan nominal ke integer.
     */
    const total = Math.round(totalInvoice);
    const pnbp = Math.round(nominalPnbp);

    /*
     * Jenis kegiatan menentukan akun pendapatan:
     *
     * pelatihan  -> 41001
     * konsultan  -> 41002
     */
    const jenisKegiatan = String(
      formData.jenis_kegiatan || ""
    ).toLowerCase();

    let akunPendapatan = "41001";

    if (
      jenisKegiatan === "konsultan" ||
      jenisKegiatan === "konsultasi"
    ) {
      akunPendapatan = "41002";
    }

    // =========================================================
    // 4. HITUNG KOMPONEN PAJAK
    // =========================================================

    const items = Array.isArray(formData.items)
      ? formData.items
      : [];

    const subtotal = Math.round(
      items.reduce((sum: number, item: any) => {
        const jumlah = Number(item.item_jumlah || 0);
        const harga = Number(item.item_harga || 0);

        return sum + jumlah * harga;
      }, 0)
    );

    /*
     * DPP:
     * Jika is_dpp aktif:
     *
     * DPP = 11/12 x subtotal
     */
    const dpp = formData.is_dpp
      ? Math.round((11 / 12) * subtotal)
      : subtotal;

    /*
     * PPh 23 = 2%
     *
     * Jika DPP aktif, PPh dihitung dari DPP.
     * Jika tidak, dari subtotal.
     */
    const pph23 = formData.is_pph23
      ? Math.round(dpp * 0.02)
      : 0;

    /*
     * PPN = 11% dari subtotal
     */
    const ppn = formData.is_ppn11
      ? Math.round(subtotal * 0.11)
      : 0;
    // =========================================================
    // CARI PEMOHON JURNAL
    // =========================================================

    const [pemohonRows]: any = await connection.query(
      `SELECT id
   FROM tb_pemohon
   WHERE nama_pemohon = ?
   LIMIT 1`,
      ["PT Peduli Lestari Indonesia"]
    );

    if (pemohonRows.length === 0) {
      throw new Error(
        `Pemohon "PT Peduli Lestari Indonesia" tidak ditemukan di tb_pemohon`
      );
    }

    const pemohonId = pemohonRows[0].id;
    // =========================================================
    // CARI / BUAT PENERIMA JURNAL
    // =========================================================

    const namaPenerima = String(
      formData.perusahaan_tujuan || ""
    ).trim();

    if (!namaPenerima) {
      throw new Error("Perusahaan tujuan / penerima wajib diisi");
    }

    const [penerimaRows]: any = await connection.query(
      `SELECT id
   FROM tb_penerima
   WHERE nama_penerima = ?
   LIMIT 1`,
      [namaPenerima]
    );

    let penerimaId: number;

    if (penerimaRows.length > 0) {
      // Penerima sudah ada
      penerimaId = penerimaRows[0].id;
    } else {
      // Penerima belum ada → buat otomatis
      const [penerimaResult]: any = await connection.query(
        `INSERT INTO tb_penerima (nama_penerima)
     VALUES (?)`,
        [namaPenerima]
      );

      penerimaId = penerimaResult.insertId;
    }
    const noRegistrasi = await generateNoRegistrasi(
      connection,
      formData.tanggal
    );
    // =========================================================
    // 5. INSERT HEADER JURNAL
    // =========================================================

    const keteranganJurnal = formData.items
      .map((item: any) => item.item_deskripsi)
      .filter(Boolean)
      .join(", ");

    const [jurnalResult]: any = await connection.query(
      `INSERT INTO tb_jurnal (
    tanggal,
    no_registrasi,
    no_referensi,
    keterangan,
    invoice_id,
    penerima_id,
    pemohon_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

    const jurnalId = jurnalResult.insertId;

    // =========================================================
    // 6. INSERT DETAIL JURNAL
    // =========================================================

    /*
     * JURNAL DASAR
     *
     * Debit  12100 Piutang
     * Credit 41001/41002 Pendapatan
     */

    const jurnalDetails: {
      no_akun: string;
      debit: number;
      kredit: number;
      keterangan: string;
    }[] = [];

    /*
     * Piutang
     *
     * Total invoice sudah merupakan:
     * subtotal + PPN + PNBP - PPh23
     */
    jurnalDetails.push({
      no_akun: "12100",
      debit: total,
      kredit: 0,
      keterangan: `Piutang Invoice ${formData.nomor_invoice}`,
    });

    /*
     * PPh 23
     *
     * PPh23 menjadi debit karena dipotong oleh pihak customer
     * dan dicatat sebagai pajak yang dapat diperhitungkan.
     */
    if (pph23 > 0) {
      jurnalDetails.push({
        no_akun: "14001",
        debit: pph23,
        kredit: 0,
        keterangan: `PPh 23 Invoice ${formData.nomor_invoice}`,
      });
    }

    /*
     * Pendapatan
     *
     * Nilai pendapatan = subtotal
     */
    jurnalDetails.push({
      no_akun: akunPendapatan,
      debit: 0,
      kredit: subtotal,
      keterangan: `Pendapatan Invoice ${formData.nomor_invoice}`,
    });

    /*
     * PPN
     */
    if (ppn > 0) {
      jurnalDetails.push({
        no_akun: "71106",
        debit: 0,
        kredit: ppn,
        keterangan: `PPN Invoice ${formData.nomor_invoice}`,
      });
    }

    /*
     * PNBP
     */
    if (pnbp > 0) {
      jurnalDetails.push({
        no_akun: "81100",
        debit: 0,
        kredit: pnbp,
        keterangan: `PNBP Invoice ${formData.nomor_invoice}`,
      });
    }

    // =========================================================
    // 7. INSERT KE TB_JURNAL_DETAIL
    // =========================================================

    for (const detail of jurnalDetails) {
      await connection.query(
        `INSERT INTO tb_jurnal_item (
          jurnal_id,
          no_akun,
          debit,
          kredit,
          keterangan
        ) VALUES (?, ?, ?, ?, ?)`,
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
    // 8. VALIDASI BALANCE JURNAL
    // =========================================================

    const totalDebit = jurnalDetails.reduce(
      (sum, item) => sum + item.debit,
      0
    );

    const totalKredit = jurnalDetails.reduce(
      (sum, item) => sum + item.kredit,
      0
    );

    if (totalDebit !== totalKredit) {
      throw new Error(
        `Jurnal tidak balance. Debit: ${totalDebit}, Kredit: ${totalKredit}`
      );
    }
    // =========================================================
    // 9. UPDATE SALDO TB_AKUN
    // =========================================================

    function isNormalDebit(noAkun: string): boolean {
      const akun = String(noAkun).trim();

      // AKUN NORMAL DEBIT
      if (
        akun === "12100" || // Piutang
        akun === "14001"    // PPh 23
      ) {
        return true;
      }

      // AKUN NORMAL KREDIT
      if (
        akun === "41001" || // Pendapatan Pelatihan
        akun === "41002" || // Pendapatan Konsultan
        akun === "71106" || // PPN
        akun === "81100"    // PNBP
      ) {
        return false;
      }

      // Default
      return true;
    }

    for (const detail of jurnalDetails) {
      const normalDebit = isNormalDebit(detail.no_akun);

      const nilaiSaldo = normalDebit
        ? detail.debit - detail.kredit
        : detail.kredit - detail.debit;

      if (nilaiSaldo !== 0) {
        await connection.query(
          `UPDATE tb_akun
       SET saldo = saldo + ?
       WHERE no_akun = ?`,
          [
            nilaiSaldo,
            detail.no_akun,
          ]
        );
      }
    }
    // =========================================================
    // 10. COMMIT
    // =========================================================

    await connection.commit();

    revalidatePath("/dashboard/finance/invoices");
    revalidatePath("/dashboard/finance/jurnal");

    return {
      success: true,
      id: invoiceId,
      jurnalId: jurnalId,
    };
  } catch (error: any) {
    // =========================================================
    // ROLLBACK SEMUA
    // =========================================================

    await connection.rollback();

    console.error("Error createInvoice:", error);

    return {
      success: false,
      error: error.message || "Gagal membuat invoice",
    };
  } finally {
    connection.release();
  }
}
// =========================================================================
// 4. FUNGSI: HAPUS DATA INVOICE
// =========================================================================
export async function deleteInvoice(id: number) {
  try {
    const query = `DELETE FROM tb_invoice WHERE id = ?`;
    await db.query(query, [id]);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true, message: "Invoice berhasil dihapus" };
  } catch (error) {
    console.error("Gagal menghapus invoice:", error);
    return { success: false, message: "Gagal menghapus data dari database" };
  }
}

// =========================================================================
// 5. FUNGSI: UPDATE / EDIT INVOICE DATA
// =========================================================================
export async function updateInvoice(id: number, data: any) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const query = `
      UPDATE tb_invoice SET 
        batch = ?,
        tanggal_jatuhtempo = ?,
        perusahaan_tujuan = ?,
        npwp = ?,
        alamat_perusahaan = ?,
        file_faktur = ?,
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
      WHERE id = ?
    `;

    const values = [
      data.batch,
      data.tanggal_jatuhtempo || null,
      data.perusahaan_tujuan,
      data.npwp,
      data.alamat_perusahaan,
      data.file_faktur || null,
      data.is_dpp ? 1 : 0,
      data.is_pph23 ? 1 : 0,
      data.is_ppn11 ? 1 : 0,
      data.is_pnbp ? 1 : 0,
      data.nominal_pnbp || 0,
      data.bayar_1 || 0,
      data.tanggal_bayar_1 || null,
      data.bayar_2 || 0,
      data.tanggal_bayar_2 || null,
      data.total || 0,
      data.status || "Belum Lunas",
      id,
    ];

    await connection.query(query, values);

    await connection.query(
      `DELETE FROM tb_invoice_details WHERE invoice_id = ?`,
      [id]
    );

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        await connection.query(
          `INSERT INTO tb_invoice_details (
            invoice_id,
            item_deskripsi,
            item_jumlah,
            item_harga
          ) VALUES (?, ?, ?, ?)`,
          [
            id,
            item.item_deskripsi,
            item.item_jumlah,
            item.item_harga,
          ]
        );
      }
    }

    await connection.commit();

    revalidatePath("/dashboard/finance/invoices");

    return {
      success: true,
      message: "Invoice berhasil diperbarui.",
    };
  } catch (error: any) {
    await connection.rollback();

    console.error("UPDATE_INVOICE_ERROR:", error.message);

    return {
      success: false,
      message: error.message,
    };
  } finally {
    connection.release();
  }
}
// =========================================================================
// 6. FUNGSI: DETEKSI DETIL INVOICE BY ID
// =========================================================================
export async function getInvoiceById(id: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_invoice WHERE id = ?",
      [id]
    );

    if (!rows[0]) {
      return null;
    }

    const [details]: any = await db.query(
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
    console.error("GET_INVOICE_BY_ID_ERROR:", error);
    return null;
  }
}

// =========================================================================
// 7. FUNGSI: AMBIL SEMUA LIST DATA INVOICE + HITUNG UMUR PIUTANG
// =========================================================================
export async function getInvoices() {
  try {
    const [rows]: any = await db.query(`
      SELECT
        i.*,
        d.id AS detail_id,
        d.item_deskripsi,
        d.item_jumlah,
        d.item_harga
      FROM tb_invoice i
      LEFT JOIN tb_invoice_details d
        ON d.invoice_id = i.id
      ORDER BY i.id DESC, d.id ASC
    `);

    const invoiceMap = new Map<number, any>();

    for (const row of rows) {
      if (!invoiceMap.has(row.id)) {
        const { detail_id, item_deskripsi, item_jumlah, item_harga, ...header } = row;
        invoiceMap.set(row.id, { ...header, items: [] });
      }

      if (row.detail_id) {
        invoiceMap.get(row.id).items.push({
          id: row.detail_id,
          item_deskripsi: row.item_deskripsi,
          item_jumlah: row.item_jumlah,
          item_harga: row.item_harga,
        });
      }
    }

    const dataLengkap = Array.from(invoiceMap.values()).map((inv: any) => {
      const tglInvoice = new Date(inv.tanggal);
      const tglSekarang = new Date();
      const selisihMilidetik = tglSekarang.getTime() - tglInvoice.getTime();
      const hitungHari = Math.floor(selisihMilidetik / (1000 * 60 * 60 * 24));

      return {
        ...inv,
        umur_piutang: hitungHari > 0 ? hitungHari : 0,
      };
    });

    return dataLengkap;
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    return [];
  }
}

export async function updateInvoiceFile(
  id: number,
  field: "file_faktur" | "cl",
  fileUrl: string
) {
  try {
    const query = `UPDATE tb_invoice SET ${field} = ? WHERE id = ?`;
    await db.query(query, [fileUrl, id]);
    revalidatePath("/dashboard/finance/invoices");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_FILE_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}