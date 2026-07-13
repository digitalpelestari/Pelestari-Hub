"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function getBulanIndex(bulanNama: string): number {
  const listBulan: { [key: string]: number } = {
    "Januari": 1, "Februari": 2, "Maret": 3, "April": 4, "Mei": 5, "Juni": 6,
    "Juli": 7, "Agustus": 8, "September": 9, "Oktober": 10, "November": 11, "Desember": 12
  };
  return listBulan[bulanNama] || 1;
}

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
      // Jika "Aset Non-Tetap", maka penyusutan diset ke 0
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
// 2. ACTION: REGISTRASI ASSET BARU (TERMASUK JENIS ASSET FIXED/NON-FIXED)
// =========================================================================
export async function createAssetAction(payload: any) {
  try {
    const {
      nama_asset, kode_asset, jenis_asset, bulan_perolehan, tahun_perolehan,
      harga_beli, cara_perolehan, jumlah, keterangan, kondisi
    } = payload;

    let kelompokKomersial = 4;
    let kelompokFiskal = 4;

    if (nama_asset.toLowerCase().includes("mobil") || nama_asset.toLowerCase().includes("avanza")) {
      kelompokKomersial = 6;
      kelompokFiskal = 4;
    }

    // Memasukkan field `jenis_asset` ke dalam Query INSERT
    await db.execute(
      `INSERT INTO tb_asset (nama_asset, kode_asset, jenis_asset, bulan_perolehan, tahun_perolehan, 
       harga_beli, cara_perolehan, jumlah, keterangan, kondisi, kelompok_komersial, kelompok_fiskal) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama_asset, 
        kode_asset || null, 
        jenis_asset || "Aset Tetap", // Default fallback ke Aset Tetap jika kosong
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

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    return { success: true, message: "Aset berhasil diregistrasi ke dalam sistem!" };
  } catch (error: any) {
    return { success: false, message: error.message };
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
    
    return { success: true, message: "Data aset berhasil dihapus dari sistem!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// =========================================================================
// 4. ACTION: INLINE UPDATE KONDISI ASSET (BARU)
// =========================================================================
export async function updateAssetKondisiAction(id_asset: number, kondisi: string) {
  try {
    await db.execute(
      "UPDATE tb_asset SET kondisi = ? WHERE id_asset = ?",
      [kondisi, id_asset]
    );

    // Revalidasi router cache Next.js agar perubahan langsung masuk ke UI
    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    
    return { success: true, message: "Kondisi aset berhasil diperbarui!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}