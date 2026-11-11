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

const pad = (n: number) => String(n).padStart(2, "0");

const bulanMap: { [key: string]: number } = {
  Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
};

// Jumlah bulan penyusutan s/d akhir bulan m tahun y (garis lurus)
const hitungBulan = (
  tahunP: number,
  bulanP: number,
  umurBulan: number,
  y: number,
  m: number
) => {
  const n = (y - tahunP) * 12 + (m - bulanP);
  return Math.min(Math.max(0, n), umurBulan);
};

/**
 * mode = "mutasi" (bawaan): hanya transaksi di bulan terpilih (Februari tanpa transaksi = 0)
 * mode = "posisi"        : saldo kumulatif sampai tanggal akhir bulan terpilih
 * month = "all" -> satu tahun penuh (mutasi) atau posisi per 31 Desember (posisi)
 *
 * Catatan: Aset Tetap (tb_asset / laporan GA) selalu kumulatif s/d akhir bulan
 * terpilih, tidak bergantung pada mode.
 */
export async function getNeracaData(
  year: string = "2026",
  month: string = "all",
  mode: "mutasi" | "posisi" = "mutasi"
): Promise<NeracaData> {
  try {
    const selectedYear = parseInt(year);
    const startMonth = month === "all" ? 1 : parseInt(month);
    const selectedMonth = month === "all" ? 12 : parseInt(month);

    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;
    const startDate = `${selectedYear}-${pad(startMonth)}-01`;
    // Batas awal filter: awal bulan (mutasi) atau sejak awal data (posisi)
    const batasAwal = mode === "posisi" ? "1900-01-01" : startDate;

    // ----------------------------------------------------------------
    // 1. LABA TAHUN BERJALAN = jumlah laba Januari s/d bulan terpilih
    //    (getLabaRugiData hanya menghitung satu bulan, jadi dijumlahkan)
    // ----------------------------------------------------------------
    let labaBerjalanRealtime = 0;
    if (month === "all" || mode === "mutasi") {
      const data = await getLabaRugiData(year, month);
      labaBerjalanRealtime = Number(data?.labaBersih || 0);
    } else {
      const bulanList = Array.from({ length: selectedMonth }, (_, i) => i + 1);
      const hasil = await Promise.all(
        bulanList.map((m) => getLabaRugiData(year, String(m)))
      );
      labaBerjalanRealtime = hasil.reduce(
        (s, d) => s + (Number(d?.labaBersih) || 0),
        0
      );
    }

    // ----------------------------------------------------------------
    // 2. ASET TETAP (DATA LAPORAN GA / tb_asset) - KUMULATIF
    //    Semua aset dengan perolehan <= akhir bulan terpilih ikut tampil
    //    (contoh: aset 2024 s/d Januari 2026 masuk neraca Januari 2026).
    //    Penyusutan = akumulasi sejak perolehan s/d akhir bulan terpilih,
    //    dimulai bulan setelah perolehan & dibatasi umur ekonomis.
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

      const idxAkhir = selectedYear * 12 + selectedMonth;

      (asetRows || []).forEach((asset: any) => {
        const nilaiPerolehan = Number(asset.harga_beli) || 0;

        const umurEkonomis = Number(asset.kelompok_komersial) || 4;
        const penyusutanBulanan = nilaiPerolehan / umurEkonomis / 12;

        const bulanPerolehan = bulanMap[asset.bulan_perolehan] || 1;
        const tahunPerolehan = Number(asset.tahun_perolehan) || selectedYear;
        const umurBulan = umurEkonomis * 12;

        // Aset yang sudah diperoleh s/d akhir bulan terpilih (kumulatif)
        const idxPerolehan = tahunPerolehan * 12 + bulanPerolehan;
        if (idxPerolehan > idxAkhir) return;

        totalHargaAset += nilaiPerolehan;

        // Akumulasi penyusutan sejak perolehan s/d akhir bulan terpilih
        const bulanDisusutkan = hitungBulan(
          tahunPerolehan,
          bulanPerolehan,
          umurBulan,
          selectedYear,
          selectedMonth
        );
        totalPenyusutanAset += penyusutanBulanan * bulanDisusutkan;
      });
    } catch (e) {
      console.log("Gagal menghitung penyusutan aset:", e);
    }

    // ----------------------------------------------------------------
    // 3. SALDO JURNAL PER AKUN s/d TANGGAL AKHIR BULAN TERPILIH
    //    (termasuk piutang usaha 12100, diambil dari tb_jurnal_item)
    // ----------------------------------------------------------------
    const [mutasiRows]: any = await db.query(
      `
      SELECT
        ji.no_akun,
        SUM(COALESCE(ji.debit, 0))  AS debit,
        SUM(COALESCE(ji.kredit, 0)) AS kredit
      FROM tb_jurnal_item ji
      JOIN tb_jurnal j ON j.id = ji.jurnal_id
      WHERE j.tanggal BETWEEN ? AND ?
        AND (j.no_registrasi IS NULL OR j.no_registrasi NOT LIKE ?)
      GROUP BY ji.no_akun
      `,
      [batasAwal, endDate, "CL\\_%"]
    );

    const mutasi = new Map<string, { debit: number; kredit: number }>();
    (mutasiRows || []).forEach((r: any) => {
      mutasi.set(String(r.no_akun).trim(), {
        debit: Number(r.debit) || 0,
        kredit: Number(r.kredit) || 0,
      });
    });

    // ----------------------------------------------------------------
    // 3b. SALDO KAS & BANK (11xxx) PER TANGGAL AKHIR BULAN TERPILIH
    //     tb_akun.saldo = saldo terkini (tanpa tanggal), jadi dihitung mundur:
    //     saldo akhir bulan = saldo terkini - mutasi jurnal SETELAH akhir bulan
    //     (Kas Petty Cash, Bank Aktif, Bank Pasif)
    // ----------------------------------------------------------------
    const [kasBankRows]: any = await db.query(
      `
      SELECT
        a.no_akun,
        a.saldo - COALESCE(x.mutasi_setelah, 0) AS saldo_akhir
      FROM tb_akun a
      LEFT JOIN (
        SELECT
          ji.no_akun,
          SUM(COALESCE(ji.debit, 0)) - SUM(COALESCE(ji.kredit, 0)) AS mutasi_setelah
        FROM tb_jurnal_item ji
        JOIN tb_jurnal j ON j.id = ji.jurnal_id
        WHERE DATE(j.tanggal) > ?
          AND (j.no_registrasi IS NULL OR j.no_registrasi NOT LIKE ?)
        GROUP BY ji.no_akun
      ) x ON x.no_akun = a.no_akun
      WHERE a.no_akun LIKE '11%'
      `,
      [endDate, "CL\\_%"]
    );

    const saldoKasBank = new Map<string, number>();
    (kasBankRows || []).forEach((r: any) => {
      saldoKasBank.set(String(r.no_akun).trim(), Number(r.saldo_akhir) || 0);
    });

    // ----------------------------------------------------------------
    // 4. DATA MASTER DARI tb_akun (nama, saldo & daftar akun)
    //    saldo ikut diambil karena Modal (13001), Laba Ditahan (13002)
    //    dan Investasi (16100, 16101) memakai saldo master akun
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

    (akunRows || []).forEach((row: any) => {
      const noAkun = String(row.no_akun).trim();

      // Abaikan akun nominal laba rugi & akun perantara closing
      if (
        noAkun.startsWith("4") ||
        noAkun.startsWith("5") ||
        noAkun.startsWith("6") ||
        noAkun === "13004"
      ) {
        return;
      }

      const m = mutasi.get(noAkun) || { debit: 0, kredit: 0 };
      const saldoDebit = m.debit - m.kredit; // untuk aktiva
      const saldoKredit = m.kredit - m.debit; // untuk kewajiban & ekuitas

      // 1. Akun Khusus (Investasi)
      if (noAkun === "16100") {
        saldoInvestasiProperti = Number(row.saldo) || 0;
      } else if (noAkun === "16101") {
        saldoLogamMulia = Number(row.saldo) || 0;
      }
      // Kendaraan (15300) & Penyusutan Kendaraan (15400) tidak ditampilkan di neraca
      else if (noAkun === "15300" || noAkun === "15400") {
        return;
      }
      // 2. Aktiva Lancar (Kas/Bank 11xxx, Piutang 12xxx)
      //    Kas/Bank (11xxx) = kumulatif s/d akhir bulan; Piutang (12xxx) = debit - kredit sesuai mode
      else if (noAkun.startsWith("11") || noAkun.startsWith("12")) {
        // Kas & Bank (11xxx) selalu kumulatif s/d akhir bulan; piutang (12xxx) ikut mode
        const saldo = noAkun.startsWith("11")
          ? saldoKasBank.get(noAkun) || 0
          : saldoDebit;

        const item: NeracaItem = {
          no_akun: noAkun,
          nama_akun: row.nama_akun,
          saldo,
        };
        aktivaLancar.push(item);
        totalAktivaLancar += item.saldo;
      }
      // 3. Kewajiban (2xxx atau 33xxx)
      else if (noAkun.startsWith("2") || noAkun.startsWith("33")) {
        const item: NeracaItem = {
          no_akun: noAkun,
          nama_akun: row.nama_akun,
          saldo: saldoKredit,
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
          // Modal (13001) & Laba Ditahan (13002) diambil dari saldo master akun,
          // sisanya (misalnya prive 31101) tetap dari jurnal
          saldo:
            noAkun === "13001" || noAkun === "13002"
              ? Number(row.saldo) || 0
              : saldoKredit,
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
    // 6. HARTA TETAP (15200 & 15105)
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