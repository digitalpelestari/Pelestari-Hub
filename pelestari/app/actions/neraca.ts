"use server";

import { db } from "@/lib/db";

export interface NeracaItem {
  no_akun: string;
  nama_akun: string;
  saldo: number;
}

export interface NeracaData {
  aktivaLancar: NeracaItem[];
  totalAktivaLancar: number;
  hartaTetap: NeracaItem[];
  totalHartaTetap: number;
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
    // 1. HITUNG OMSET DAN LABA BERSIH REALTIME
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
    const piutangDagangRealtime = totalOmsetInvoice - totalUangDiterima;

    const [bebanRows]: any = await db.query(
      `SELECT SUM(saldo) as total_beban FROM tb_akun WHERE saldo <> 0 AND (no_akun LIKE '2%' OR no_akun LIKE '3%' OR no_akun LIKE '4%' OR no_akun LIKE '5%')`
    );
    const totalBeban = Math.abs(Number(bebanRows[0]?.total_beban) || 0);
    const labaBerjalanRealtime = totalOmsetInvoice - totalBeban;

    // ----------------------------------------------------------------
    // 2. HITUNG TOTAL NILAI PEROLEHAN ASET KANTOR DARI tb_asset
    // ----------------------------------------------------------------
    let totalHargaAset = 0;
    try {
      const [asetRows]: any = await db.query(
        `SELECT SUM(COALESCE(harga_beli, 0) * COALESCE(jumlah, 1)) as total_harga FROM tb_asset`
      );
      totalHargaAset = Number(asetRows[0]?.total_harga) || 0;
    } catch (e) {
      console.log("Cek tabel tb_asset:", e);
    }

    // ----------------------------------------------------------------
    // 3. AMBIL DATA MASTER AKUN
    // ----------------------------------------------------------------
    const [akunRows]: any = await db.query(
      `SELECT no_akun, nama_akun, saldo FROM tb_akun ORDER BY no_akun ASC`
    );

    const aktivaLancar: NeracaItem[] = [];
    const kewajiban: NeracaItem[] = [];
    const ekuitas: NeracaItem[] = [];

    let totalAktivaLancar = 0;
    let totalKewajiban = 0;
    let totalEkuitas = 0;

    const listAktivaLancar = ["11100", "11200", "12100", "12102", "12103"];

    // Map penampung saldo akun harta tetap khusus
    let saldoInvestasiProperti = 0;
    let saldoLogamMulia = 0;
    let saldoKendaraan = 0;
    let saldoPenyusutanAset = 0;
    let saldoPenyusutanKendaraan = 0;

    akunRows.forEach((row: any) => {
      const noAkun = String(row.no_akun).trim();
      const namaAkunLower = String(row.nama_akun).toLowerCase();
      let nominal = Number(row.saldo) || 0;

      if (noAkun === "12100" && piutangDagangRealtime > 0) {
        nominal = piutangDagangRealtime;
      }

      const item: NeracaItem = {
        no_akun: noAkun,
        nama_akun: row.nama_akun,
        saldo: nominal
      };

      // 1. AKTIVA LANCAR (11xxx & 12xxx)
      if (listAktivaLancar.includes(noAkun) || noAkun.startsWith("11") || noAkun.startsWith("12")) {
        item.saldo = Math.abs(item.saldo);
        aktivaLancar.push(item);
        totalAktivaLancar += item.saldo;
      } 
      // 2. TANGKAP SALDO UNTUK HARTA TETAP KHUSUS
      else if (noAkun.startsWith("1")) {
        if (namaAkunLower.includes("properti") || (namaAkunLower.includes("investasi") && !namaAkunLower.includes("logam"))) {
          saldoInvestasiProperti += Math.abs(nominal);
        } else if (namaAkunLower.includes("logam") || namaAkunLower.includes("emas")) {
          saldoLogamMulia += Math.abs(nominal);
        } else if (namaAkunLower.includes("kendaraan") && !namaAkunLower.includes("penyusutan") && !namaAkunLower.includes("akumulasi")) {
          saldoKendaraan += Math.abs(nominal);
        } else if (namaAkunLower.includes("penyusutan") || namaAkunLower.includes("akumulasi")) {
          if (namaAkunLower.includes("kendaraan")) {
            saldoPenyusutanKendaraan += nominal > 0 ? -nominal : nominal;
          } else {
            saldoPenyusutanAset += nominal > 0 ? -nominal : nominal;
          }
        }
      } 
      // 3. KEWAJIBAN / HUTANG (2xxx)
      else if (noAkun.startsWith("2")) {
        item.saldo = Math.abs(item.saldo);
        kewajiban.push(item);
        totalKewajiban += item.saldo;
      } 
      // 4. EKUITAS (3xxx)
      else if (noAkun.startsWith("3")) {
        item.saldo = Math.abs(item.saldo);
        ekuitas.push(item);
        totalEkuitas += item.saldo;
      }
    });

    // ----------------------------------------------------------------
    // 4. SUSUN HARTA TETAP SESUAI URUTAN TERBARU
    // ----------------------------------------------------------------
    const hartaTetap: NeracaItem[] = [
      {
        no_akun: "14100",
        nama_akun: "Investasi Properti",
        saldo: saldoInvestasiProperti
      },
      {
        no_akun: "14200",
        nama_akun: "Logam Mulia",
        saldo: saldoLogamMulia
      },
      {
        no_akun: "15100",
        nama_akun: "Aset Kantor", // <--- SUDAH DIGANTI MENJADI "Aset Kantor"
        saldo: totalHargaAset
      },
      {
        no_akun: "15200",
        nama_akun: "Penyusutan Aset",
        saldo: saldoPenyusutanAset
      },
      {
        no_akun: "15300",
        nama_akun: "Kendaraan",
        saldo: saldoKendaraan
      },
      {
        no_akun: "15400",
        nama_akun: "Penyusutan Aset Kendaraan",
        saldo: saldoPenyusutanKendaraan
      }
    ];

    const totalHartaTetap = hartaTetap.reduce((sum, item) => sum + item.saldo, 0);

    // ----------------------------------------------------------------
    // 5. MENGHITUNG EKUITAS LABA BERJALAN
    // ----------------------------------------------------------------
    if (labaBerjalanRealtime !== 0) {
      ekuitas.push({
        no_akun: "3200",
        nama_akun: "Laba Tahun Berjalan",
        saldo: labaBerjalanRealtime
      });
      totalEkuitas += labaBerjalanRealtime;
    }

    return {
      aktivaLancar,
      totalAktivaLancar,
      hartaTetap,
      totalHartaTetap,
      totalAktiva: totalAktivaLancar + totalHartaTetap,
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
      hartaTetap: [], totalHartaTetap: 0, totalAktiva: 0,
      kewajiban: [], totalKewajiban: 0,
      ekuitas: [], totalEkuitas: 0, totalPasiva: 0
    };
  }
}