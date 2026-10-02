"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// =========================================================================
// HELPER: CEK POSISI NORMAL AKUN
// =========================================================================
//
// Normal Debit:
// 1xxxx = Aset
// 5xxxx = Biaya
// 6xxxx = Biaya
// 7xxxx = Biaya/Pajak sesuai COA
// 8xxxx = Biaya/Pajak sesuai COA
// 9xxxx = Biaya/Pajak sesuai COA
//
// PPN Masukan yang digunakan dalam PO adalah akun 14004,
// sehingga normalnya DEBIT karena merupakan aset/pajak masukan.
//
// =========================================================================
function isNormalDebit(noAkun: string): boolean {
  const akun = String(noAkun).trim();

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
// HELPER: UPDATE SALDO AKUN
// =========================================================================
async function applySaldoAkun(
  connection: any,
  noAkun: string,
  debit: number,
  kredit: number,
  isRevert: boolean = false
) {
  const normalDebit = isNormalDebit(noAkun);

  let netDelta = normalDebit
    ? debit - kredit
    : kredit - debit;

  if (isRevert) {
    netDelta = -netDelta;
  }

  if (netDelta !== 0) {
    await connection.query(
      `UPDATE tb_akun
       SET saldo = saldo + ?
       WHERE no_akun = ?`,
      [netDelta, noAkun]
    );
  }
}

// =========================================================================
// 1. ACTION: AMBIL SEMUA LIST PO + HITUNG REMINDER SISA HARI
// =========================================================================
export async function getPurchaseOrdersAction() {
  try {
    const [rows]: any = await db.execute(`
      SELECT *,
        DATEDIFF(jatuh_tempo, CURDATE()) AS sisa_hari
      FROM tb_po
      ORDER BY id_po DESC
    `);

    return {
      success: true,
      data: rows
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      data: []
    };
  }
}

// =========================================================================
// ACTION: AMBIL DAFTAR AKUN COA UNTUK ITEM PO
// =========================================================================
//
// Akun yang diperbolehkan sebagai akun pembelian:
// - 15200 Aset Tetap
// - 15300 Aset Non Tetap
// - 511xx
// - 521xx
// - 531xx
// - 611xx
// - 621xx
// - 641xx
// - 650xx
//
// PPN TIDAK dipilih sebagai akun item.
// PPN otomatis menggunakan akun 14004.
// =========================================================================
export async function getAkunPembelianAction() {
  try {
    const [akunRows]: any = await db.execute(`
      SELECT
        no_akun,
        nama_akun,
        kelompok_biaya_id
      FROM tb_akun
      WHERE (
        no_akun IN ('15200', '15300')
        OR no_akun LIKE '511%'
        OR no_akun LIKE '521%'
        OR no_akun LIKE '531%'
        OR no_akun LIKE '611%'
        OR no_akun LIKE '621%'
        OR no_akun LIKE '641%'
        OR no_akun LIKE '650%'
      )
      ORDER BY no_akun ASC
    `);

    const [kelompokRows]: any = await db.execute(`
      SELECT
        id,
        kelompok_biaya
      FROM tb_kelompok_biaya
    `);

    const data = akunRows.map((akun: any) => {
      const kelompok = kelompokRows.find(
        (k: any) => Number(k.id) === Number(akun.kelompok_biaya_id)
      );

      return {
        ...akun,
        nama_kelompok: kelompok?.kelompok_biaya || "-",
      };
    });

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error("GET_AKUN_PEMBELIAN_ERROR:", error);

    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

// =========================================================================
// 2. ACTION: SIMPAN PO BARU + JURNAL OTOMATIS
// =========================================================================
export async function createPurchaseOrderAction(payload: any) {
  const connection = await db.getConnection();

  try {
    const {
      nomor_po,
      tanggal_po,
      vendor_nama,
      vendor_pic,
      vendor_email,
      alamat_pengantaran,
      penerima_nama,
      sub_total,
      ppn,
      total_harga,
      tempo_hari,
      items
    } = payload;

    // ================================================================
    // VALIDASI DASAR
    // ================================================================

    if (!nomor_po) {
      throw new Error("Nomor PO wajib diisi.");
    }

    if (!tanggal_po) {
      throw new Error("Tanggal PO wajib diisi.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Minimal harus ada 1 item PO.");
    }

    // ================================================================
    // VALIDASI ITEM
    // ================================================================

    for (const item of items) {
      if (!item.transaksi) {
        throw new Error(
          "Deskripsi/transaksi item wajib diisi."
        );
      }

      if (!item.no_akun) {
        throw new Error(
          `Akun pembelian untuk item "${item.transaksi}" wajib dipilih.`
        );
      }

      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const totalItem = Number(item.total) || 0;

      if (quantity <= 0) {
        throw new Error(
          `Quantity untuk item "${item.transaksi}" harus lebih dari 0.`
        );
      }

      if (unitPrice < 0 || totalItem < 0) {
        throw new Error(
          `Nominal item "${item.transaksi}" tidak valid.`
        );
      }
    }

    // ================================================================
    // AMBIL SEMUA KODE AKUN YANG DIPAKAI
    // ================================================================

    const akunCodes = [
      ...new Set(
        items.map((item: any) =>
          String(item.no_akun).trim()
        )
      )
    ];

    const akunPlaceholders =
      akunCodes.map(() => "?").join(",");

    // ================================================================
    // AMBIL DATA AKUN DARI COA
    // ================================================================

    const [akunRows]: any =
      await connection.query(
        `SELECT
           no_akun,
           nama_akun,
           is_aktif
         FROM tb_akun
         WHERE no_akun IN (${akunPlaceholders})`,
        akunCodes
      );

    const akunMap = new Map<string, any>();

    for (const akun of akunRows) {
      akunMap.set(
        String(akun.no_akun),
        akun
      );
    }

    // ================================================================
    // VALIDASI AKUN PEMBELIAN
    // ================================================================

    const isAllowedPurchaseAccount = (
      noAkun: string
    ) => {
      return (
        ["15200", "15300"].includes(noAkun) ||
        noAkun.startsWith("511") ||
        noAkun.startsWith("521") ||
        noAkun.startsWith("531") ||
        noAkun.startsWith("611") ||
        noAkun.startsWith("621") ||
        noAkun.startsWith("641") ||
        noAkun.startsWith("650")
      );
    };

    for (const noAkun of akunCodes) {
      // --------------------------------------------------------------
      // 1. Akun harus termasuk whitelist akun pembelian
      // --------------------------------------------------------------

      if (!isAllowedPurchaseAccount(noAkun)) {
        throw new Error(
          `Akun ${noAkun} tidak diperbolehkan sebagai akun pembelian PO.`
        );
      }

      // --------------------------------------------------------------
      // 2. Akun harus ada di COA
      // --------------------------------------------------------------

      const akun = akunMap.get(noAkun);

      if (!akun) {
        throw new Error(
          `Akun ${noAkun} tidak ditemukan di COA.`
        );
      }

      // --------------------------------------------------------------
      // 3. Akun harus aktif
      // --------------------------------------------------------------

      if (Number(akun.is_aktif) !== 1) {
        throw new Error(
          `Akun ${noAkun} (${akun.nama_akun}) sedang tidak aktif.`
        );
      }
    }

    // ================================================================
    // HITUNG JATUH TEMPO
    // ================================================================

    let jatuhTempoDate: string | null = null;

    if (Number(tempo_hari) > 0) {
      const date = new Date(tanggal_po);

      date.setDate(
        date.getDate() + Number(tempo_hari)
      );

      jatuhTempoDate = date
        .toISOString()
        .split("T")[0];
    } else {
      jatuhTempoDate = tanggal_po;
    }

    // ================================================================
    // HITUNG ULANG TOTAL DARI ITEM
    // ================================================================

    const calculatedSubTotal = items.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.total) || 0),
      0
    );

    const calculatedPpn =
      Number(ppn) || 0;

    const calculatedTotalHarga =
      calculatedSubTotal + calculatedPpn;

    const EPSILON = 1;

    // ================================================================
    // VALIDASI SUBTOTAL
    // ================================================================

    if (
      Math.abs(
        calculatedSubTotal -
        Number(sub_total || 0)
      ) > EPSILON
    ) {
      throw new Error(
        "Subtotal PO tidak sesuai dengan total item."
      );
    }

    // ================================================================
    // VALIDASI TOTAL
    // ================================================================

    if (
      Math.abs(
        calculatedTotalHarga -
        Number(total_harga || 0)
      ) > EPSILON
    ) {
      throw new Error(
        "Total harga PO tidak sesuai dengan subtotal + PPN."
      );
    }

    // ================================================================
    // MULAI TRANSACTION
    // ================================================================

    await connection.beginTransaction();

    // ================================================================
    // A. SIMPAN HEADER PO
    // ================================================================

    const [poResult]: any =
      await connection.execute(
        `INSERT INTO tb_po (
          nomor_po,
          tanggal_po,
          vendor_nama,
          vendor_pic,
          vendor_email,
          alamat_pengantaran,
          penerima_nama,
          sub_total,
          ppn,
          total_harga,
          status_pembayaran,
          tempo_hari,
          jatuh_tempo,
          tanggal_bayar_1
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'Belum Bayar',
          ?, ?, NULL
        )`,
        [
          nomor_po,
          tanggal_po,
          vendor_nama,
          vendor_pic,
          vendor_email,
          alamat_pengantaran,
          penerima_nama,
          calculatedSubTotal,
          calculatedPpn,
          calculatedTotalHarga,
          Number(tempo_hari) || 0,
          jatuhTempoDate
        ]
      );

    const insertedPoId =
      Number(poResult.insertId);

    // ================================================================
    // B. SIMPAN ITEM PO
    // ================================================================

    for (const item of items) {
      await connection.execute(
        `INSERT INTO tb_po_item (
          id_po,
          transaksi,
          ukuran,
          quantity,
          unit_price,
          total,
          no_akun
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          insertedPoId,
          item.transaksi,
          item.ukuran || null,
          Number(item.quantity) || 0,
          Number(item.unit_price) || 0,
          Number(item.total) || 0,
          String(item.no_akun).trim()
        ]
      );
    }

    // ================================================================
    // C. AGREGASI DEBIT BERDASARKAN AKUN
    // ================================================================

    const debitByAccount =
      new Map<string, number>();

    for (const item of items) {
      const noAkun =
        String(item.no_akun).trim();

      const totalItem =
        Number(item.total) || 0;

      const existing =
        debitByAccount.get(noAkun) || 0;

      debitByAccount.set(
        noAkun,
        existing + totalItem
      );
    }

    // ================================================================
    // D. VALIDASI AKUN PPN MASUKAN
    // ================================================================
    //
    // PPN Masukan menggunakan:
    //
    // 14004 = PPN Masukan
    //
    // PPN Masukan dicatat DEBIT.
    //
    // ================================================================

    if (calculatedPpn > 0) {
      const [ppnRows]: any =
        await connection.query(
          `SELECT
             no_akun,
             nama_akun,
             is_aktif
           FROM tb_akun
           WHERE no_akun = '71106'
           LIMIT 1`
        );

      if (
        !ppnRows ||
        ppnRows.length === 0
      ) {
        throw new Error(
          "Akun 71106 PPN tidak ditemukan."
        );
      }

      if (
        Number(ppnRows[0].is_aktif) !== 1
      ) {
        throw new Error(
          "Akun 71106 PPN sedang tidak aktif."
        );
      }
    }

    // ================================================================
    // E. BUAT JURNAL OTOMATIS PO
    // ================================================================

    const noRegistrasi =
      `PO-${insertedPoId}`;

    // ================================================================
    // CEK NOMOR JURNAL
    // ================================================================

    const [existingJurnal]: any =
      await connection.query(
        `SELECT id
         FROM tb_jurnal
         WHERE no_registrasi = ?
         LIMIT 1`,
        [noRegistrasi]
      );

    if (existingJurnal.length > 0) {
      throw new Error(
        `Jurnal untuk PO ${nomor_po} sudah tersedia.`
      );
    }

    // ================================================================
    // INSERT HEADER JURNAL
    // ================================================================

    const [jurnalResult]: any =
      await connection.query(
        `INSERT INTO tb_jurnal (
          tanggal,
          no_registrasi,
          no_referensi,
          invoice_id,
          po_id,
          penerima_id,
          pemohon_id,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tanggal_po,
          noRegistrasi,
          nomor_po,
          null,
          insertedPoId,
          null,
          null,
          `Pengakuan pembelian dan utang vendor PO ${nomor_po}`
        ]
      );

    const jurnalId =
      Number(jurnalResult.insertId);

    // ================================================================
    // F. INSERT JURNAL ITEM
    //    DEBIT AKUN PEMBELIAN
    // ================================================================

    const jurnalItemQuery = `
      INSERT INTO tb_jurnal_item (
        jurnal_id,
        no_akun,
        debit,
        kredit,
        keterangan
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    let totalDebitJurnal = 0;

    for (
      const [noAkun, nominal]
      of debitByAccount.entries()
    ) {
      if (nominal <= 0) {
        continue;
      }

      await connection.query(
        jurnalItemQuery,
        [
          jurnalId,
          noAkun,
          nominal,
          0,
          `Pembelian PO ${nomor_po}`
        ]
      );

      // Akun pembelian = DEBIT
      await applySaldoAkun(
        connection,
        noAkun,
        nominal,
        0,
        false
      );

      totalDebitJurnal += nominal;
    }

    // ================================================================
    // G. DEBIT PPN MASUKAN
    // ================================================================
    //
    // Contoh:
    //
    // Subtotal       = 10.000.000
    // PPN            = 1.100.000
    // Total           = 11.100.000
    //
    // Jurnal:
    //
    // Dr 511xx        10.000.000
    // Dr 14004         1.100.000
    // Cr 21100        11.100.000
    //
    // ================================================================

    if (calculatedPpn > 0) {
      await connection.query(
        jurnalItemQuery,
        [
          jurnalId,
          "71106",
          calculatedPpn,
          0,
          `PPN PO ${nomor_po}`
        ]
      );

      // PPN Masukan = DEBIT
      await applySaldoAkun(
        connection,
        "71106",
        calculatedPpn,
        0,
        false
      );

      totalDebitJurnal +=
        calculatedPpn;
    }

    // ================================================================
    // H. CREDIT UTANG VENDOR 21100
    // ================================================================

    await connection.query(
      jurnalItemQuery,
      [
        jurnalId,
        "21100",
        0,
        calculatedTotalHarga,
        `Utang Vendor PO ${nomor_po}`
      ]
    );

    await applySaldoAkun(
      connection,
      "21100",
      0,
      calculatedTotalHarga,
      false
    );

    // ================================================================
    // I. PASTIKAN JURNAL BALANCE
    // ================================================================

    if (
      Math.abs(
        totalDebitJurnal -
        calculatedTotalHarga
      ) > EPSILON
    ) {
      throw new Error(
        `Jurnal PO tidak balance. Debit: ${totalDebitJurnal}, Kredit: ${calculatedTotalHarga}.`
      );
    }

    // ================================================================
    // COMMIT
    // ================================================================

    await connection.commit();

    // ================================================================
    // REVALIDATE
    // ================================================================

    revalidatePath(
      "/dashboard/purchase-order"
    );

    revalidatePath(
      "/dashboard/ga/purchase-order"
    );

    revalidatePath(
      "/dashboard/finance/pos/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,
      message:
        `Purchase Order berhasil disimpan. ` +
        `Jurnal otomatis ${noRegistrasi} berhasil dibuat.`
    };

  } catch (error: any) {
    try {
      await connection.rollback();
    } catch (e) { }

    console.error(
      "CREATE_PURCHASE_ORDER_ERROR:",
      error.message
    );

    return {
      success: false,
      message:
        error.message ||
        "Gagal menyimpan Purchase Order."
    };

  } finally {
    connection.release();
  }
}

// =========================================================================
// 3. ACTION: UPDATE STATUS BAYAR + JURNAL PEMBAYARAN
// =========================================================================
export async function updatePaymentStatusAction(
  id_po: number,
  status_baru: string,
  tempo_hari_baru: number,
  tanggal_bayar_baru: string | null,
  akun_pembayaran_baru: string | null
) {
  let connection;

  try {
    connection = await db.getConnection();

    // ================================================================
    // VALIDASI STATUS
    // ================================================================

    if (
      !["Belum Bayar", "Lunas"].includes(
        status_baru
      )
    ) {
      return {
        success: false,
        message:
          "Status pembayaran tidak valid."
      };
    }

    // ================================================================
    // AKUN PEMBAYARAN YANG DIPERBOLEHKAN
    // ================================================================

    const allowedPaymentAccounts = [
      "11100",
      "11200",
      "11300"
    ];

    if (status_baru === "Lunas") {
      if (!akun_pembayaran_baru) {
        return {
          success: false,
          message:
            "Akun pembayaran wajib dipilih ketika status pembayaran Lunas."
        };
      }

      if (
        !allowedPaymentAccounts.includes(
          String(akun_pembayaran_baru)
        )
      ) {
        return {
          success: false,
          message:
            "Akun pembayaran hanya boleh Petty Cash, Bank Aktif, atau Bank Pasif."
        };
      }
    }

    // ================================================================
    // AMBIL DATA PO
    // ================================================================

    const [poRows]: any =
      await connection.execute(
        `SELECT
          id_po,
          nomor_po,
          tanggal_po,
          total_harga,
          status_pembayaran
         FROM tb_po
         WHERE id_po = ?
         LIMIT 1`,
        [id_po]
      );

    if (poRows.length === 0) {
      return {
        success: false,
        message:
          "Data Purchase Order tidak ditemukan!"
      };
    }

    const po = poRows[0];

    const nomorPo =
      String(po.nomor_po);

    const totalHarga =
      Number(po.total_harga) || 0;

    // ================================================================
    // HITUNG JATUH TEMPO
    // ================================================================

    let jatuhTempoDate:
      string | null = null;

    if (
      Number(tempo_hari_baru) > 0
    ) {
      const originDate =
        new Date(po.tanggal_po);

      const year =
        originDate.getFullYear();

      const month =
        originDate.getMonth();

      const day =
        originDate.getDate();

      const calculatedDate =
        new Date(
          year,
          month,
          day
        );

      calculatedDate.setDate(
        calculatedDate.getDate() +
        Number(tempo_hari_baru)
      );

      const resYear =
        calculatedDate.getFullYear();

      const resMonth =
        String(
          calculatedDate.getMonth() + 1
        ).padStart(2, "0");

      const resDay =
        String(
          calculatedDate.getDate()
        ).padStart(2, "0");

      jatuhTempoDate =
        `${resYear}-${resMonth}-${resDay}`;

    } else {
      const originDate =
        new Date(po.tanggal_po);

      const year =
        originDate.getFullYear();

      const month =
        String(
          originDate.getMonth() + 1
        ).padStart(2, "0");

      const day =
        String(
          originDate.getDate()
        ).padStart(2, "0");

      jatuhTempoDate =
        `${year}-${month}-${day}`;
    }

    // ================================================================
    // TANGGAL PEMBAYARAN
    // ================================================================

    const tglBayarFinal =
      status_baru === "Lunas"
        ? tanggal_bayar_baru
        : null;

    if (
      status_baru === "Lunas" &&
      !tglBayarFinal
    ) {
      return {
        success: false,
        message:
          "Tanggal pembayaran wajib diisi ketika status Lunas."
      };
    }

    // ================================================================
    // MULAI TRANSACTION
    // ================================================================

    await connection.beginTransaction();

    // ================================================================
    // CARI JURNAL PEMBAYARAN PO
    // ================================================================

    const noRegistrasiPayment =
      `PO-PAY-${id_po}`;

    const [paymentJurnalRows]: any =
      await connection.query(
        `SELECT id
         FROM tb_jurnal
         WHERE no_registrasi = ?
         LIMIT 1`,
        [noRegistrasiPayment]
      );

    // ================================================================
    // JIKA SUDAH ADA JURNAL PEMBAYARAN
    // MAKA REVERSAL TERLEBIH DAHULU
    // ================================================================

    if (
      paymentJurnalRows.length > 0
    ) {
      const paymentJurnalId =
        Number(
          paymentJurnalRows[0].id
        );

      const [paymentItems]: any =
        await connection.query(
          `SELECT
             no_akun,
             debit,
             kredit
           FROM tb_jurnal_item
           WHERE jurnal_id = ?`,
          [paymentJurnalId]
        );

      for (const item of paymentItems) {
        await applySaldoAkun(
          connection,
          String(item.no_akun),
          Number(item.debit) || 0,
          Number(item.kredit) || 0,
          true
        );
      }

      await connection.query(
        `DELETE FROM tb_jurnal_item
         WHERE jurnal_id = ?`,
        [paymentJurnalId]
      );

      await connection.query(
        `DELETE FROM tb_jurnal
         WHERE id = ?`,
        [paymentJurnalId]
      );
    }

    // ================================================================
    // UPDATE DATA PO
    // ================================================================

    await connection.execute(
      `UPDATE tb_po
       SET
         status_pembayaran = ?,
         tempo_hari = ?,
         jatuh_tempo = ?,
         tanggal_bayar_1 = ?
       WHERE id_po = ?`,
      [
        status_baru,
        Number(tempo_hari_baru),
        jatuhTempoDate,
        tglBayarFinal,
        id_po
      ]
    );

    // ================================================================
    // JIKA BELUM BAYAR
    // ================================================================

    if (
      status_baru === "Belum Bayar"
    ) {
      await connection.commit();

      revalidatePath(
        "/dashboard/ga/purchase-order"
      );

      revalidatePath(
        "/dashboard/purchase-order"
      );

      revalidatePath(
        "/dashboard/finance/pos/jurnal"
      );

      revalidatePath(
        "/dashboard/finance/riwayat"
      );

      return {
        success: true,
        message:
          "Status PO dikembalikan menjadi Belum Bayar. Jurnal pembayaran telah dibatalkan."
      };
    }

    // ================================================================
    // VALIDASI AKUN PEMBAYARAN
    // ================================================================

    const akunPembayaran =
      String(akun_pembayaran_baru);

    const [akunPaymentRows]: any =
      await connection.query(
        `SELECT
           no_akun,
           nama_akun,
           is_aktif
         FROM tb_akun
         WHERE no_akun = ?
         LIMIT 1`,
        [akunPembayaran]
      );

    if (
      !akunPaymentRows ||
      akunPaymentRows.length === 0
    ) {
      throw new Error(
        `Akun pembayaran ${akunPembayaran} tidak ditemukan.`
      );
    }

    if (
      Number(
        akunPaymentRows[0].is_aktif
      ) !== 1
    ) {
      throw new Error(
        `Akun ${akunPembayaran} (${akunPaymentRows[0].nama_akun}) sedang tidak aktif.`
      );
    }

    // ================================================================
    // BUAT JURNAL PEMBAYARAN
    // ================================================================
    //
    // Dr 21100 Utang Vendor
    // Cr 11100/11200/11300 Kas/Bank
    //
    // ================================================================

    const [jurnalPaymentResult]: any =
      await connection.query(
        `INSERT INTO tb_jurnal (
          tanggal,
          no_registrasi,
          no_referensi,
          invoice_id,
          po_id,
          penerima_id,
          pemohon_id,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tglBayarFinal,
          noRegistrasiPayment,
          nomorPo,
          null,
          id_po,
          null,
          null,
          `Pembayaran utang vendor PO ${nomorPo}`
        ]
      );

    const paymentJurnalId =
      Number(
        jurnalPaymentResult.insertId
      );

    const jurnalPaymentItemQuery = `
      INSERT INTO tb_jurnal_item (
        jurnal_id,
        no_akun,
        debit,
        kredit,
        keterangan
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    // ================================================================
    // DEBIT UTANG VENDOR
    // ================================================================

    await connection.query(
      jurnalPaymentItemQuery,
      [
        paymentJurnalId,
        "21100",
        totalHarga,
        0,
        `Pelunasan utang vendor PO ${nomorPo}`
      ]
    );

    await applySaldoAkun(
      connection,
      "21100",
      totalHarga,
      0,
      false
    );

    // ================================================================
    // CREDIT AKUN PEMBAYARAN
    // ================================================================

    await connection.query(
      jurnalPaymentItemQuery,
      [
        paymentJurnalId,
        akunPembayaran,
        0,
        totalHarga,
        `Pembayaran PO ${nomorPo} melalui ${akunPaymentRows[0].nama_akun}`
      ]
    );

    await applySaldoAkun(
      connection,
      akunPembayaran,
      0,
      totalHarga,
      false
    );

    // ================================================================
    // COMMIT
    // ================================================================

    await connection.commit();

    // ================================================================
    // REVALIDATE
    // ================================================================

    revalidatePath(
      "/dashboard/ga/purchase-order"
    );

    revalidatePath(
      "/dashboard/purchase-order"
    );

    revalidatePath(
      "/dashboard/finance/pos/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,
      message:
        `PO ${nomorPo} berhasil dilunasi melalui ${akunPaymentRows[0].nama_akun}. ` +
        `Jurnal pembayaran ${noRegistrasiPayment} berhasil dibuat.`
    };

  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) { }
    }

    console.error(
      "UPDATE_PAYMENT_STATUS_ERROR:",
      error.message
    );

    return {
      success: false,
      message:
        error.message ||
        "Gagal memperbarui status pembayaran."
    };

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// =========================================================================
// 4. ACTION: AMBIL RINCIAN ITEM BARANG PO
// =========================================================================
export async function getPoItemsAction(
  id_po: number
) {
  try {
    const [rows]: any =
      await db.execute(
        `SELECT *
         FROM tb_po_item
         WHERE id_po = ?`,
        [id_po]
      );

    return {
      success: true,
      data: rows
    };

  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      data: []
    };
  }
}

// =========================================================================
// 5. ACTION: HAPUS PO + REVERSAL JURNAL
// =========================================================================
export async function deletePurchaseOrderAction(
  id_po: number
) {
  let connection;

  try {
    connection = await db.getConnection();

    // ================================================================
    // AMBIL DATA PO
    // ================================================================

    const [poRows]: any =
      await connection.query(
        `SELECT
           id_po,
           nomor_po
         FROM tb_po
         WHERE id_po = ?
         LIMIT 1`,
        [id_po]
      );

    if (poRows.length === 0) {
      return {
        success: false,
        message:
          "Data PO tidak ditemukan!"
      };
    }

    const nomorPo =
      poRows[0].nomor_po;

    await connection.beginTransaction();

    // ================================================================
    // CARI SEMUA JURNAL PO
    // ================================================================
    //
    // PO-xxx      = jurnal pengakuan pembelian
    // PO-PAY-xxx  = jurnal pembayaran
    //
    // Keduanya harus direversal ketika PO dihapus.
    // ================================================================

    const [jurnalRows]: any =
      await connection.query(
        `SELECT id
         FROM tb_jurnal
         WHERE po_id = ?`,
        [id_po]
      );

    for (const jurnal of jurnalRows) {
      const jurnalId =
        Number(jurnal.id);

      // ==============================================================
      // AMBIL ITEM JURNAL
      // ==============================================================

      const [jurnalItems]: any =
        await connection.query(
          `SELECT
             no_akun,
             debit,
             kredit
           FROM tb_jurnal_item
           WHERE jurnal_id = ?`,
          [jurnalId]
        );

      // ==============================================================
      // REVERSAL SALDO
      // ==============================================================

      for (const item of jurnalItems) {
        await applySaldoAkun(
          connection,
          String(item.no_akun),
          Number(item.debit) || 0,
          Number(item.kredit) || 0,
          true
        );
      }

      // ==============================================================
      // HAPUS DETAIL JURNAL
      // ==============================================================

      await connection.query(
        `DELETE FROM tb_jurnal_item
         WHERE jurnal_id = ?`,
        [jurnalId]
      );

      // ==============================================================
      // HAPUS HEADER JURNAL
      // ==============================================================

      await connection.query(
        `DELETE FROM tb_jurnal
         WHERE id = ?`,
        [jurnalId]
      );
    }

    // ================================================================
    // HAPUS ITEM PO
    // ================================================================

    await connection.query(
      `DELETE FROM tb_po_item
       WHERE id_po = ?`,
      [id_po]
    );

    // ================================================================
    // HAPUS HEADER PO
    // ================================================================

    await connection.query(
      `DELETE FROM tb_po
       WHERE id_po = ?`,
      [id_po]
    );

    // ================================================================
    // COMMIT
    // ================================================================

    await connection.commit();

    // ================================================================
    // REVALIDATE
    // ================================================================

    revalidatePath(
      "/dashboard/ga/purchase-order"
    );

    revalidatePath(
      "/dashboard/purchase-order"
    );

    revalidatePath(
      "/dashboard/finance/pos/jurnal"
    );

    revalidatePath(
      "/dashboard/finance/riwayat"
    );

    return {
      success: true,
      message:
        `PO ${nomorPo} dan jurnal otomatisnya berhasil dihapus. Saldo akun telah dipulihkan.`
    };

  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) { }
    }

    console.error(
      "DELETE_PURCHASE_ORDER_ERROR:",
      error.message
    );

    return {
      success: false,
      message:
        error.message ||
        "Gagal menghapus Purchase Order."
    };

  } finally {
    if (connection) {
      connection.release();
    }
  }
}