"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function getBulanIndex(bulanNama: string): number {
  const listBulan: { [key: string]: number } = {
    Januari: 1,
    Februari: 2,
    Maret: 3,
    April: 4,
    Mei: 5,
    Juni: 6,
    Juli: 7,
    Agustus: 8,
    September: 9,
    Oktober: 10,
    November: 11,
    Desember: 12,
  };

  return listBulan[bulanNama] || 1;
}


// =========================================================================
// ACTION: AMBIL SEMUA LIST ASSET (DENGAN KALKULASI DEPRESIASI KOMERSIAL & FISKAL)
// =========================================================================
// =========================================================================
// ACTION: AMBIL SEMUA LIST ASSET
// DENGAN KALKULASI DEPRESIASI KOMERSIAL & FISKAL
// =========================================================================
export async function getAssetsAction(isFinanceView: boolean = false) {
  try {
    const [rows]: any = await db.execute(
      "SELECT * FROM tb_asset ORDER BY id_asset DESC"
    );

    if (!isFinanceView) {
      return {
        success: true,
        data: rows,
      };
    }

    const sekarang = new Date();
    const bulanSekarang = sekarang.getMonth() + 1;
    const tahunSekarang = sekarang.getFullYear();

    const computedData = rows.map((asset: any) => {
      const hargaBeli = Number(asset.harga_beli) || 0;

      /*
       * harga_beli dianggap sebagai HARGA BELI TOTAL.
       * jumlah tidak dikalikan lagi.
       */
      const nilaiPerolehan = hargaBeli;

      const isAsetTetap =
        asset.jenis_asset === "Aset Tetap";

      // =========================================
      // UMUR EKONOMIS
      // =========================================

      const masaKomersial =
        Number(asset.kelompok_komersial) || 4;

      const masaFiskal =
        Number(asset.kelompok_fiskal) || 4;

      // =========================================
      // PENYUSUTAN TAHUNAN
      // =========================================

      const penyusutanKomersialTahunan =
        isAsetTetap
          ? nilaiPerolehan / masaKomersial
          : 0;

      const penyusutanFiskalTahunan =
        isAsetTetap
          ? nilaiPerolehan / masaFiskal
          : 0;

      // =========================================
      // PENYUSUTAN BULANAN
      // =========================================

      const penyusutanKomersialBulanan =
        penyusutanKomersialTahunan / 12;

      const penyusutanFiskalBulanan =
        penyusutanFiskalTahunan / 12;

      // =========================================
      // BULAN & TAHUN PEROLEHAN
      // =========================================

      const bulanAsetIdx = getBulanIndex(
        asset.bulan_perolehan
      );

      const tahunPerolehan =
        Number(asset.tahun_perolehan) || tahunSekarang;

      // =========================================
      // HITUNG JUMLAH BULAN BERJALAN
      // =========================================

      let jumlahBulanBerjalan = 0;
      if (tahunPerolehan < tahunSekarang) {
        jumlahBulanBerjalan =
          (tahunSekarang - tahunPerolehan) * 12 +
          (bulanSekarang - bulanAsetIdx);
      } else if (tahunPerolehan === tahunSekarang) {
        jumlahBulanBerjalan =
          bulanSekarang - bulanAsetIdx;
      }

      // Aset yang belum diperoleh tidak mengalami penyusutan
      if (
        tahunPerolehan > tahunSekarang ||
        (
          tahunPerolehan === tahunSekarang &&
          bulanAsetIdx > bulanSekarang
        )
      ) {
        jumlahBulanBerjalan = 0;
      }

      jumlahBulanBerjalan = Math.max(
        0,
        jumlahBulanBerjalan
      );

      // =========================================
      // BATAS UMUR EKONOMIS
      // =========================================

      const maksimalBulanKomersial =
        masaKomersial * 12;

      const maksimalBulanFiskal =
        masaFiskal * 12;

      const bulanKomersialBerjalan =
        Math.min(
          jumlahBulanBerjalan,
          maksimalBulanKomersial
        );

      const bulanFiskalBerjalan =
        Math.min(
          jumlahBulanBerjalan,
          maksimalBulanFiskal
        );

      // =========================================
      // AKUMULASI PENYUSUTAN
      // =========================================

      const prorataKomersial =
        isAsetTetap
          ? penyusutanKomersialBulanan *
          bulanKomersialBerjalan
          : 0;

      const prorataFiskal =
        isAsetTetap
          ? penyusutanFiskalBulanan *
          bulanFiskalBerjalan
          : 0;

      // =========================================
      // NILAI BUKU
      // =========================================
      // Nilai buku menggunakan penyusutan komersial.

      const sisaNilaiBuku =
        isAsetTetap
          ? Math.max(
            0,
            nilaiPerolehan - prorataKomersial
          )
          : nilaiPerolehan;

      return {
        ...asset,

        // Nilai perolehan
        nilai_perolehan: nilaiPerolehan,

        // Kelompok komersial & fiskal
        kelompok_komersial: masaKomersial,
        kelompok_fiskal: masaFiskal,

        // Tarif komersial
        tarif_komersial_persen:
          isAsetTetap
            ? `${(100 / masaKomersial).toFixed(2)}%`
            : "0.00%",

        // Tarif fiskal
        tarif_fiskal_persen:
          isAsetTetap
            ? `${(100 / masaFiskal).toFixed(2)}%`
            : "0.00%",

        // Penyusutan tahunan
        penyusutan_komersial:
          penyusutanKomersialTahunan,

        penyusutan_fiskal:
          penyusutanFiskalTahunan,

        // Akumulasi penyusutan berjalan
        prorata_komersial:
          prorataKomersial,

        prorata_fiskal:
          prorataFiskal,

        // Nilai buku
        sisa_nilai_buku:
          sisaNilaiBuku,
      };
    });

    return {
      success: true,
      data: computedData,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

// =========================================================================
// ACTION: REGISTRASI ASSET BARU (TANPA JURNAL OTOMATIS)
// =========================================================================
export async function createAssetAction(payload: any) {
  try {
    const {
      nama_asset,
      kode_asset,
      jenis_asset,
      kelompok,
      bulan_perolehan,
      tahun_perolehan,
      harga_beli,
      cara_perolehan,
      jumlah,
      keterangan,
      kondisi,
    } = payload;

    const kelompokFinal = String(kelompok || "1");

    let kelompokKomersial =
      kelompokFinal === "1" ? 4 : 8;

    let kelompokFiskal =
      kelompokFinal === "1" ? 4 : 8;


    const jenisAsetFinal = jenis_asset || "Aset Tetap";

    await db.execute(
      `INSERT INTO tb_asset (
        nama_asset,
        kode_asset,
        jenis_asset,
        kelompok,
        bulan_perolehan,
        tahun_perolehan,
        harga_beli,
        cara_perolehan,
        jumlah,
        keterangan,
        kondisi,
        kelompok_komersial,
        kelompok_fiskal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama_asset,
        kode_asset || null,
        jenisAsetFinal,
        kelompok || "1",
        bulan_perolehan,
        Number(tahun_perolehan),
        Number(harga_beli),
        cara_perolehan,
        Number(jumlah),
        keterangan || null,
        kondisi,
        kelompokKomersial,
        kelompokFiskal,
      ]
    );

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");

    return {
      success: true,
      message: "Aset berhasil diregistrasi!",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// =========================================================================
// ACTION: UPDATE DATA ASSET
// =========================================================================
export async function updateAssetAction(id_asset: number, payload: any) {
  try {
    const {
      nama_asset,
      kode_asset,
      jenis_asset,
      kelompok,
      bulan_perolehan,
      tahun_perolehan,
      harga_beli,
      cara_perolehan,
      jumlah,
      keterangan,
      kondisi,
    } = payload;

    const kelompokFinal = String(kelompok || "1");

    let kelompokKomersial =
      kelompokFinal === "1" ? 4 : 8;

    let kelompokFiskal =
      kelompokFinal === "1" ? 4 : 8;

    const jenisAsetFinal = jenis_asset || "Aset Tetap";

    await db.execute(
      `UPDATE tb_asset SET
        nama_asset = ?,
        kode_asset = ?,
        jenis_asset = ?,
        kelompok = ?,
        bulan_perolehan = ?,
        tahun_perolehan = ?,
        harga_beli = ?,
        cara_perolehan = ?,
        jumlah = ?,
        keterangan = ?,
        kondisi = ?,
        kelompok_komersial = ?,
        kelompok_fiskal = ?
      WHERE id_asset = ?`,
      [
        nama_asset,
        kode_asset || null,
        jenisAsetFinal,
        kelompok || "1",
        bulan_perolehan,
        Number(tahun_perolehan),
        Number(harga_beli),
        cara_perolehan,
        Number(jumlah),
        keterangan || null,
        kondisi,
        kelompokKomersial,
        kelompokFiskal,
        id_asset,
      ]
    );

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");

    return {
      success: true,
      message: "Data aset berhasil diperbarui!",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}
// =========================================================================
// ACTION: HAPUS ASSET PERMANEN
// =========================================================================
export async function deleteAssetAction(id_asset: number) {
  try {
    await db.execute("DELETE FROM tb_asset WHERE id_asset = ?", [id_asset]);

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");

    return { success: true, message: "Data aset berhasil dihapus dari sistem!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// =========================================================================
// ACTION: INLINE UPDATE KONDISI ASSET
// =========================================================================
export async function updateAssetKondisiAction(id_asset: number, kondisi: string) {
  try {
    await db.execute(
      "UPDATE tb_asset SET kondisi = ? WHERE id_asset = ?",
      [kondisi, id_asset]
    );

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");

    return { success: true, message: "Kondisi aset berhasil diperbarui!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}