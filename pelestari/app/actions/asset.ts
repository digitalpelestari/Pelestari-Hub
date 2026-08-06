"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Helper konversi nama bulan ke indeks angka (1-12)
function getBulanIndex(bulanNama: string): number {
  const listBulan: { [key: string]: number } = {
    "Januari": 1, "Februari": 2, "Maret": 3, "April": 4, "Mei": 5, "Juni": 6,
    "Juli": 7, "Agustus": 8, "September": 9, "Oktober": 10, "November": 11, "Desember": 12
  };
  return listBulan[bulanNama] || 1;
}

// Helper Mapping Akun Pembayaran (Sesuaikan ID / Kode Akun dengan tb_akun Anda)
const AKUN_PEMBAYARAN_MAP: Record<string, string> = {
  "Kas": "10100",        // Kode Akun Kas
  "Transfer Bank": "10200", // Kode Akun Bank
  "Kredit / Utang": "20100" // Kode Akun Utang Usaha / Hutang Aset
};

// Helper Mapping Akun Aset Berdasarkan Jenisnya
const AKUN_ASET_MAP: Record<string, string> = {
  "Aset Tetap": "15100",    // Kode Akun Aset Tetap / Peralatan
  "Aset Non-Tetap": "15200" // Kode Akun Perlengkapan / Aset Non-Tetap
};

// =========================================================================
// 1. ACTION: AMBIL SEMUA LIST ASSET (DENGAN KALKULASI DEPRESIASI KOMERSIAL & FISKAL)
// =========================================================================
export async function getAssetsAction(isFinanceView: boolean = false) {
  try {
    const [rows]: any = await db.execute("SELECT * FROM tb_asset ORDER BY id_asset DESC");

    if (!isFinanceView) {
      return { success: true, data: rows };
    }

    const computedData = rows.map((asset: any) => {
      const hargaBeli = Number(asset.harga_beli);
      const masaKomersial = Number(asset.kelompok_komersial || 4);
      const masaFiskal = Number(asset.kelompok_fiskal || 4);
      const isAsetTetap = asset.jenis_asset === "Aset Tetap";

      // LOGIC BREAKDOWN: Penyusutan hanya berlaku jika Jenis Aset adalah "Aset Tetap"
      const penyusutanKomersialTahunan = isAsetTetap ? (hargaBeli / masaKomersial) : 0;
      const penyusutanFiskalTahunan = isAsetTetap ? (hargaBeli / masaFiskal) : 0;

      const penyusutanKomersialBulanan = penyusutanKomersialTahunan / 12;
      const penyusutanFiskalBulanan = penyusutanFiskalTahunan / 12;

      // Hitung Pengkali Bulan Berdasarkan Waktu Perolehan
      let bulanKomersialBerjalan = 8;
      let bulanFiskalBerjalan = 2;

      const bulanAsetIdx = getBulanIndex(asset.bulan_perolehan);
      if (asset.tahun_perolehan === 2025) {
        bulanKomersialBerjalan = 12 - bulanAsetIdx + 1;
        bulanFiskalBerjalan = Math.max(1, bulanKomersialBerjalan - 6);
      }

      const prorataKomersial = isAsetTetap ? (penyusutanKomersialBulanan * bulanKomersialBerjalan) : 0;
      const prorataFiskal = isAsetTetap ? (penyusutanFiskalBulanan * bulanFiskalBerjalan) : 0;

      // Sisa Nilai Buku akhir (Jika non-tetap, langsung kembalikan harga beli utuh)
      const sisaNilaiBuku = isAsetTetap ? Math.max(0, hargaBeli - prorataFiskal) : hargaBeli;

      return {
        ...asset,
        tarif_komersial_persen: isAsetTetap ? `${(100 / masaKomersial).toFixed(2)}%` : "0.00%",
        tarif_fiskal_persen: isAsetTetap ? `${(100 / masaFiskal).toFixed(2)}%` : "0.00%",
        penyusutan_komersial: penyusutanKomersialTahunan,
        penyusutan_fiskal: penyusutanFiskalTahunan,
        prorata_komersial: prorataKomersial,
        prorata_fiskal: prorataFiskal,
        sisa_nilai_buku: sisaNilaiBuku
      };
    });

    return { success: true, data: computedData };
  } catch (error: any) {
    return { success: false, message: error.message, data: [] };
  }
}

// =========================================================================
// 2. ACTION: REGISTRASI ASSET BARU + OTOMATIS JURNAL AKUNTANSI
// =========================================================================
export async function createAssetAction(payload: any) {
  // Gunakan connection client agar bisa mengontrol DB Transaction (COMMIT / ROLLBACK)
  const connection = await db.getConnection();

  try {
    const {
      nama_asset, kode_asset, jenis_asset, bulan_perolehan, tahun_perolehan,
      harga_beli, cara_perolehan, jumlah, keterangan, kondisi
    } = payload;

    // 1. Validasi / Set Logic Kelompok Depresiasi
    let kelompokKomersial = 4;
    let kelompokFiskal = 4;

    if (nama_asset.toLowerCase().includes("mobil") || nama_asset.toLowerCase().includes("avanza")) {
      kelompokKomersial = 6;
      kelompokFiskal = 4;
    }

    const totalHarga = Number(harga_beli) * Number(jumlah);
    const jenisAsetFinal = jenis_asset || "Aset Tetap";

    // 2. Tentukan Kode Akun Debit (Aset) & Kredit (Kas/Bank/Utang)
    const kodeAkunDebit = AKUN_ASET_MAP[jenisAsetFinal] || "15100";
    const kodeAkunKredit = AKUN_PEMBAYARAN_MAP[cara_perolehan] || "10100";

    // Mulai Transaksi Database
    await connection.beginTransaction();

    // 3. INSERT KE TABLE ASSET
    const [assetResult]: any = await connection.execute(
      `INSERT INTO tb_asset (
        nama_asset, kode_asset, jenis_asset, bulan_perolehan, tahun_perolehan, 
        harga_beli, cara_perolehan, jumlah, keterangan, kondisi, kelompok_komersial, kelompok_fiskal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama_asset,
        kode_asset || null,
        jenisAsetFinal,
        bulan_perolehan,
        Number(tahun_perolehan),
        Number(harga_beli),
        cara_perolehan,
        Number(jumlah),
        keterangan || null,
        kondisi,
        kelompokKomersial,
        kelompokFiskal
      ]
    );

    const newAssetId = assetResult.insertId;

    // 4. INSERT HEADER JURNAL (tb_jurnal)
    const nomorJurnal = `JRN-AST-${Date.now()}`;
    const tanggalJurnal = `${tahun_perolehan}-01-01`; // Bisa disesuaikan dengan tanggal riil
    const deskripsiJurnal = `Pembelian Aset: ${nama_asset} (${jumlah} unit) - ${cara_perolehan}`;

    const [jurnalResult]: any = await connection.execute(
      `INSERT INTO tb_jurnal (no_jurnal, tanggal, keterangan, ref_id, source) 
       VALUES (?, ?, ?, ?, ?)`,
      [nomorJurnal, tanggalJurnal, deskripsiJurnal, newAssetId, "ASSET_REGISTRATION"]
    );

    const idJurnal = jurnalResult.insertId;

    // 5. INSERT DETAIL JURNAL - DEBIT (Akun Aset Bertambah)
    await connection.execute(
      `INSERT INTO tb_jurnal_detail (id_jurnal, kode_akun, debit, kredit, memo) 
       VALUES (?, ?, ?, 0, ?)`,
      [idJurnal, kodeAkunDebit, totalHarga, `Aset: ${nama_asset}`]
    );

    // 6. INSERT DETAIL JURNAL - KREDIT (Akun Pembayaran Berkurang / Utang Bertambah)
    await connection.execute(
      `INSERT INTO tb_jurnal_detail (id_jurnal, kode_akun, debit, kredit, memo) 
       VALUES (?, ?, 0, ?, ?)`,
      [idJurnal, kodeAkunKredit, totalHarga, `Pembayaran via ${cara_perolehan}`]
    );

    // Commit seluruh transaksi jika tidak ada error
    await connection.commit();

    // Revalidasi Cache Next.js
    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    revalidatePath("/dashboard/finance/jurnal");

    return { 
      success: true, 
      message: "Aset berhasil diregistrasi & jurnal akuntansi otomatis dicatat!" 
    };

  } catch (error: any) {
    // Batalkan transaksi DB jika terjadi kegagalan
    await connection.rollback();
    return { success: false, message: error.message };
  } finally {
    // Selalu lepaskan koneksi client kembali ke pool
    connection.release();
  }
}

// =========================================================================
// 3. ACTION: HAPUS ASSET PERMANEN
// =========================================================================
export async function deleteAssetAction(id_asset: number) {
  try {
    await db.execute("DELETE FROM tb_asset WHERE id_asset = ?", [id_asset]);
    
    // Refresh cache data halaman terkait
    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    revalidatePath("/dashboard/finance/jurnal");
    
    return { success: true, message: "Data aset berhasil dihapus dari sistem!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// =========================================================================
// 4. ACTION: INLINE UPDATE KONDISI ASSET
// =========================================================================
export async function updateAssetKondisiAction(id_asset: number, kondisi: string) {
  try {
    await db.execute(
      "UPDATE tb_asset SET kondisi = ? WHERE id_asset = ?",
      [kondisi, id_asset]
    );

    // Revalidasi router cache Next.js
    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    
    return { success: true, message: "Kondisi aset berhasil diperbarui!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}