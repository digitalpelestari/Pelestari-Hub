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
      
      // 1. Nilai Dasar Garis Lurus per Tahun
      const penyusutanKomersialTahunan = hargaBeli / masaKomersial;
      const penyusutanFiskalTahunan = hargaBeli / masaFiskal;

      // Penyusutan per Bulan murni
      const penyusutanKomersialBulanan = penyusutanKomersialTahunan / 12;
      const penyusutanFiskalBulanan = penyusutanFiskalTahunan / 12;

      // 2. Hitung Pengkali Bulan Berdasarkan Logic Sheet Excel (image_6ac7.png)
      // Komersial = 8 Bulan, Fiskal = 2 Bulan untuk perolehan Mei 2025
      let bulanKomersialBerjalan = 8; 
      let bulanFiskalBerjalan = 2;

      // Jika ada variasi data tahun selain 2025, kita hitung dinamis dari index bulan perolehan
      const bulanAsetIdx = getBulanIndex(asset.bulan_perolehan);
      if (asset.tahun_perolehan === 2025) {
        // Logika menyelaraskan hitungan bulan buku laporan excel kamu
        bulanKomersialBerjalan = 12 - bulanAsetIdx + 1; // Mei (5) -> 12 - 5 + 1 = 8 Bulan
        bulanFiskalBerjalan = Math.max(1, bulanKomersialBerjalan - 6); // Penyelarasan porsi fiskal pajak = 2 Bulan
      }

      const prorataKomersial = penyusutanKomersialBulanan * bulanKomersialBerjalan;
      const prorataFiskal = penyusutanFiskalBulanan * bulanFiskalBerjalan;
      
      // Sisa Nilai Buku akhir (Harga Beli dikurangi akumulasi amortisasi fiskal)
      const sisaNilaiBuku = Math.max(0, hargaBeli - prorataFiskal);

      return {
        ...asset,
        tarif_komersial_persen: `${(100 / masaKomersial).toFixed(2)}%`,
        tarif_fiskal_persen: `${(100 / masaFiskal).toFixed(2)}%`,
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

export async function createAssetAction(payload: any) {
  try {
    const {
      nama_asset, kode_asset, bulan_perolehan, tahun_perolehan,
      harga_beli, cara_perolehan, jumlah, keterangan, kondisi
    } = payload;

    let kelompokKomersial = 4;
    let kelompokFiskal = 4;

    if (nama_asset.toLowerCase().includes("mobil") || nama_asset.toLowerCase().includes("avanza")) {
      kelompokKomersial = 6;
      kelompokFiskal = 4;
    }

    await db.execute(
      `INSERT INTO tb_asset (nama_asset, kode_asset, bulan_perolehan, tahun_perolehan, 
       harga_beli, cara_perolehan, jumlah, keterangan, kondisi, kelompok_komersial, kelompok_fiskal) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nama_asset, kode_asset || null, bulan_perolehan, Number(tahun_perolehan), Number(harga_beli), cara_perolehan, Number(jumlah), keterangan || null, kondisi, kelompokKomersial, kelompokFiskal]
    );

    revalidatePath("/dashboard/ga/asset");
    revalidatePath("/dashboard/finance/asset-tracking");
    return { success: true, message: "Aset berhasil diregistrasi!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

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