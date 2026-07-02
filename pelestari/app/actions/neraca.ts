"use server"

import { db } from "@/lib/db";

export interface NeracaItem {
  no_akun: string;
  nama_akun: string;
  saldo: number;
}

export interface NeracaData {
  aktivaLancar: NeracaItem[];
  totalAktivaLancar: number;
  aktivaTetap: NeracaItem[];
  totalAktivaTetap: number;
  totalAktiva: number;
  kewajiban: NeracaItem[];
  totalKewajiban: number;
  ekuitas: NeracaItem[];
  totalEkuitas: number;
  totalPasiva: number;
}

export async function getNeracaData(year: string = "2026"): Promise<NeracaData> {
  try {
    // ----------------------------------------------------------------
    // 1. HITUNG LABA BERSIH BERJALAN SECARA AKRUAL DARI TABEL INVOICE
    // ----------------------------------------------------------------
    const [invoiceRows]: any = await db.query(
      `SELECT SUM(COALESCE(total, 0)) as total_omset FROM tb_invoice WHERE YEAR(created_at) = ?`,
      [year]
    );
    const [paidInvoiceRows]: any = await db.query(
      `SELECT SUM(COALESCE(bayar_1, 0) + COALESCE(bayar_2, 0)) as total_paid FROM tb_invoice WHERE YEAR(created_at) = ?`,
      [year]
    );

    const totalOmsetInvoice = Number(invoiceRows[0]?.total_omset) || 0;
    const totalUangDiterima = Number(paidInvoiceRows[0]?.total_paid) || 0;
    
    // Piutang otomatis dihitung dari total invoice keluar dikurangi yang sudah dibayar
    const piutangDagangRealtime = totalOmsetInvoice - totalUangDiterima;

    // Hitung total beban usaha dari master akun (kepala 2, 3, 4) selain akun Neraca inti
    const [bebanRows]: any = await db.query(
      `SELECT SUM(saldo) as total_beban FROM tb_akun WHERE saldo <> 0 AND (no_akun LIKE '2%' OR no_akun LIKE '3%' OR no_akun LIKE '4%') AND no_akun NOT IN ('1000','1001','1003')`
    );
    const totalBeban = Math.abs(Number(bebanRows[0]?.total_beban) || 0);
    const labaBerjalanRealtime = totalOmsetInvoice - totalBeban;

    // ----------------------------------------------------------------
    // 2. AMBIL DATA DARI MASTER AKUN (tb_akun)
    // ----------------------------------------------------------------
    const [akunRows]: any = await db.query(
      `SELECT no_akun, nama_akun, saldo FROM tb_akun ORDER BY no_akun ASC`
    );

    let aktivaLancar: NeracaItem[] = [];
    let aktivaTetap: NeracaItem[] = [];
    let kewajiban: NeracaItem[] = [];
    let ekuitas: NeracaItem[] = [];

    let totalAktivaLancar = 0;
    let totalAktivaTetap = 0;
    let totalKewajiban = 0;
    let totalEkuitas = 0;

    // Otomatis masukkan akun Piutang ke Aktiva Lancar dengan kode 1002 sesuai database
    if (piutangDagangRealtime > 0) {
      aktivaLancar.push({
        no_akun: "1002",
        nama_akun: "Piutang",
        saldo: piutangDagangRealtime
      });
      totalAktivaLancar += piutangDagangRealtime;
    }

    akunRows.forEach((row: any) => {
      const noAkun = row.no_akun;
      const nominal = Number(row.saldo) || 0;

      const item: NeracaItem = {
        no_akun: noAkun,
        nama_akun: row.nama_akun,
        saldo: Math.abs(nominal)
      };

      // PEMETAAN BERDASARKAN KODE TEPAT DI DATABASE KAMU
      if (noAkun === "1000" || noAkun === "1001") {
        // 1000 (Kas) & 1001 (Bank Mandiri) masuk ke Aktiva Lancar
        aktivaLancar.push(item);
        totalAktivaLancar += item.saldo;
      } else if (noAkun === "1003") {
        // 1003 (Modal Di Nilai ...) masuk ke Ekuitas
        ekuitas.push(item);
        totalEkuitas += item.saldo;
      } else if (noAkun.startsWith("1") && noAkun !== "1000" && noAkun !== "1001" && noAkun !== "1002" && noAkun !== "1003") {
        // Jika ada akun kepala 1 lainnya di masa depan (Aset Tetap/Peralatan)
        aktivaTetap.push(item);
        totalAktivaTetap += item.saldo;
      } else if (noAkun.startsWith("5") || noAkun.startsWith("2") && noAkun.toLowerCase().includes("hutang")) {
        // Akun kewajiban/hutang jika ada
        kewajiban.push(item);
        totalKewajiban += item.saldo;
      }
    });

    // Suntikkan Laba Tahun Berjalan ke bagian Ekuitas dengan kode 3200 sesuai database
    ekuitas.push({
      no_akun: "3200",
      nama_akun: "Laba Tahun Berjalan",
      saldo: labaBerjalanRealtime
    });
    totalEkuitas += labaBerjalanRealtime;

    return {
      aktivaLancar,
      totalAktivaLancar,
      aktivaTetap,
      totalAktivaTetap,
      totalAktiva: totalAktivaLancar + totalAktivaTetap,
      kewajiban,
      totalKewajiban,
      ekuitas,
      totalEkuitas,
      totalPasiva: totalKewajiban + totalEkuitas
    };
  } catch (error) {
    console.error("Gagal memuat neraca balance sheet:", error);
    return {
      aktivaLancar: [], totalAktivaLancar: 0,
      aktivaTetap: [], totalAktivaTetap: 0, totalAktiva: 0,
      kewajiban: [], totalKewajiban: 0,
      ekuitas: [], totalEkuitas: 0, totalPasiva: 0
    };
  }
}