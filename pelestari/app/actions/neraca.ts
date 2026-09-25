"use server";

import { db } from "@/lib/db";
import { getLabaRugiData } from "@/app/actions/labarugi";

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
  investasi: NeracaItem[];
  totalInvestasi: number;
  totalAktiva: number;
  kewajiban: NeracaItem[];
  totalKewajiban: number;
  ekuitas: NeracaItem[];
  totalEkuitas: number;
  totalPasiva: number;
}

export async function getNeracaData(
  year: string = "2026",
  month: string = "all"
): Promise<NeracaData> {
  try {
    const selectedYear = parseInt(year);
    const selectedMonth = month === "all" ? 12 : parseInt(month);

    // ----------------------------------------------------------------
    // 1. HITUNG OMSET & PIUTANG KUMULATIF S/D BULAN TERPILIH
    // ----------------------------------------------------------------
    let invoiceQuery = `SELECT SUM(COALESCE(total, 0)) as total_omset FROM tb_invoice WHERE YEAR(created_at) = ?`;
    let paidInvoiceQuery = `SELECT SUM(COALESCE(bayar_1, 0) + COALESCE(bayar_2, 0)) as total_paid FROM tb_invoice WHERE YEAR(created_at) = ?`;
    const invoiceParams: any[] = [selectedYear];
    const paidInvoiceParams: any[] = [selectedYear];

    if (month !== "all") {
      // Hanya ambil transaksi sampai bulan yang dipilih (misal: Januari <= 1)
      invoiceQuery += ` AND MONTH(created_at) <= ?`;
      paidInvoiceQuery += ` AND MONTH(created_at) <= ?`;
      invoiceParams.push(selectedMonth);
      paidInvoiceParams.push(selectedMonth);
    }

    const [invoiceRows]: any = await db.query(invoiceQuery, invoiceParams);
    const [paidInvoiceRows]: any = await db.query(paidInvoiceQuery, paidInvoiceParams);

    const totalOmsetInvoice = Number(invoiceRows[0]?.total_omset) || 0;
    const totalUangDiterima = Number(paidInvoiceRows[0]?.total_paid) || 0;

    // Piutang riil per akhir bulan yang dipilih
    const piutangDagangRealtime = Math.max(0, totalOmsetInvoice - totalUangDiterima);

    // ----------------------------------------------------------------
    // 2. HITUNG LABA BERSIH SESUAI PERIODE DARI getLabaRugiData
    // ----------------------------------------------------------------
    const labaRugiData = await getLabaRugiData(year, month);
    const labaBerjalanRealtime = Number(labaRugiData?.labaBersih || 0);

    // ----------------------------------------------------------------
    // 3. HITUNG PENYUSUTAN ASET TETAP BERDASARKAN BULAN TERPILIH
    // ----------------------------------------------------------------
    let totalHargaAset = 0;
    let totalPenyusutanAset = 0;

    try {
      const [asetRows]: any = await db.query(`
        SELECT
          harga_beli,
          jenis_asset,
          kelompok_komersial,
          bulan_perolehan,
          tahun_perolehan
        FROM tb_asset
        WHERE jenis_asset = 'Aset Tetap'
      `);

      const bulanMap: { [key: string]: number } = {
        Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
        Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
      };

      (asetRows || []).forEach((asset: any) => {
        const hargaBeli = Number(asset.harga_beli) || 0;
        const nilaiPerolehan = hargaBeli;
        totalHargaAset += nilaiPerolehan;

        const umurEkonomis = Number(asset.kelompok_komersial) || 4;
        const penyusutanTahunan = nilaiPerolehan / umurEkonomis;
        const penyusutanBulanan = penyusutanTahunan / 12;

        const bulanPerolehan = bulanMap[asset.bulan_perolehan] || 1;
        const tahunPerolehan = Number(asset.tahun_perolehan) || selectedYear;

        let jumlahBulan = 0;

        if (tahunPerolehan < selectedYear) {
          jumlahBulan = (selectedYear - tahunPerolehan) * 12 + (selectedMonth - bulanPerolehan);
        } else if (tahunPerolehan === selectedYear) {
          jumlahBulan = selectedMonth - bulanPerolehan;
        }

        if (
          tahunPerolehan > selectedYear ||
          (tahunPerolehan === selectedYear && bulanPerolehan > selectedMonth)
        ) {
          jumlahBulan = 0;
        }

        jumlahBulan = Math.max(0, jumlahBulan);
        const maksimalBulan = umurEkonomis * 12;
        jumlahBulan = Math.min(jumlahBulan, maksimalBulan);

        const akumulasiPenyusutan = penyusutanBulanan * jumlahBulan;
        totalPenyusutanAset += akumulasiPenyusutan;
      });
    } catch (e) {
      console.log("Gagal menghitung penyusutan aset:", e);
    }

    // ----------------------------------------------------------------
    // 4. AMBIL DATA MASTER DARI tb_akun
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

    let saldoInvestasiProperti = 0;
    let saldoLogamMulia = 0;
    let saldoKendaraan = 0;
    let saldoPenyusutanKendaraan = 0;

    (akunRows || []).forEach((row: any) => {
      const noAkun = String(row.no_akun).trim();
      let nominal = Number(row.saldo) || 0;

      // KUNCI PERBAIKAN:
      // Akun 12100 selalu mengambil nilai realtime hasil filter bulan invoice
      if (noAkun === "12100") {
        nominal = piutangDagangRealtime;
      }

      // Abaikan akun nominal laba rugi & akun perantara closing
      if (
        noAkun.startsWith("4") ||
        noAkun.startsWith("5") ||
        noAkun.startsWith("6") ||
        noAkun === "13004"
      ) {
        return;
      }

      // 1. Akun Khusus (Investasi & Kendaraan)
      if (noAkun === "16100") {
        saldoInvestasiProperti = Math.abs(nominal);
      } else if (noAkun === "16101") {
        saldoLogamMulia = Math.abs(nominal);
      } else if (noAkun === "15300") {
        saldoKendaraan = Math.abs(nominal);
      } else if (noAkun === "15400") {
        saldoPenyusutanKendaraan = nominal > 0 ? -nominal : nominal;
      }
      // 2. Aktiva Lancar (Kas/Bank 11xxx, Piutang 12xxx)
      else if (noAkun.startsWith("11") || noAkun.startsWith("12")) {
        const item: NeracaItem = {
          no_akun: noAkun,
          nama_akun: row.nama_akun,
          saldo: Math.abs(nominal),
        };
        aktivaLancar.push(item);
        totalAktivaLancar += item.saldo;
      }
      // 3. Kewajiban (2xxx atau 33xxx)
      else if (noAkun.startsWith("2") || noAkun.startsWith("33")) {
        const item: NeracaItem = {
          no_akun: noAkun,
          nama_akun: row.nama_akun,
          saldo: Math.abs(nominal),
        };
        kewajiban.push(item);
        totalKewajiban += item.saldo;
      }
      // 4. Modal / Ekuitas (13001, 13002, 31xxx)
      else if (
        noAkun === "13001" ||
        noAkun === "13002" ||
        (noAkun.startsWith("3") && !noAkun.startsWith("33"))
      ) {
        if (noAkun === "13003") return; // Laba tahun berjalan ditambahkan khusus di bawah

        const item: NeracaItem = {
          no_akun: noAkun,
          nama_akun: row.nama_akun,
          saldo: noAkun === "31101" ? -Math.abs(nominal) : Math.abs(nominal),
        };
        ekuitas.push(item);
        totalEkuitas += item.saldo;
      }
    });

    // ----------------------------------------------------------------
    // 5. INVESTASI (16100 & 16101)
    // ----------------------------------------------------------------
    const investasi: NeracaItem[] = [
      {
        no_akun: "16100",
        nama_akun: "Investasi Properti",
        saldo: saldoInvestasiProperti,
      },
      {
        no_akun: "16101",
        nama_akun: "Logam Mulia",
        saldo: saldoLogamMulia,
      },
    ];
    const totalInvestasi = investasi.reduce((sum, item) => sum + item.saldo, 0);

    // ----------------------------------------------------------------
    // 6. HARTA TETAP (15200, 15105, 15300, 15400)
    // ----------------------------------------------------------------
    const hartaTetap: NeracaItem[] = [
      {
        no_akun: "15200",
        nama_akun: "Aset Tetap",
        saldo: totalHargaAset,
      },
      {
        no_akun: "15105",
        nama_akun: "Penyusutan Aset",
        saldo: -Math.round(totalPenyusutanAset),
      },
      {
        no_akun: "15300",
        nama_akun: "Kendaraan",
        saldo: saldoKendaraan,
      },
      {
        no_akun: "15400",
        nama_akun: "Penyusutan Aset Kendaraan",
        saldo: saldoPenyusutanKendaraan,
      },
    ];
    const totalHartaTetap = hartaTetap.reduce((sum, item) => sum + item.saldo, 0);

    // ----------------------------------------------------------------
    // 7. LABA TAHUN BERJALAN (13003)
    // ----------------------------------------------------------------
    ekuitas.push({
      no_akun: "13003",
      nama_akun: "Laba Tahun Berjalan",
      saldo: labaBerjalanRealtime,
    });
    totalEkuitas += labaBerjalanRealtime;

    return {
      aktivaLancar,
      totalAktivaLancar,
      hartaTetap,
      totalHartaTetap,
      investasi,
      totalInvestasi,
      totalAktiva: totalAktivaLancar + totalHartaTetap + totalInvestasi,
      kewajiban,
      totalKewajiban,
      ekuitas,
      totalEkuitas,
      totalPasiva: totalKewajiban + totalEkuitas,
    };
  } catch (error) {
    console.error("Gagal memuat neraca balance sheet:", error);
    return {
      aktivaLancar: [],
      totalAktivaLancar: 0,
      hartaTetap: [],
      totalHartaTetap: 0,
      investasi: [],
      totalInvestasi: 0,
      totalAktiva: 0,
      kewajiban: [],
      totalKewajiban: 0,
      ekuitas: [],
      totalEkuitas: 0,
      totalPasiva: 0,
    };
  }
}