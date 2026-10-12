"use server"

import { db } from "@/lib/db"

export interface SubAkunItem {
  no_akun: string
  nama_akun: string
  kelompok_biaya_id: number | string | null
  kelompok_biaya: string
  saldo: number
}

export interface AkunItem {
  no_akun: string
  nama_akun: string
  saldo: number
  rincian?: SubAkunItem[]
}

export interface LabaRugiData {
  pendapatanPelatihan: number
  pendapatanKonsultan: number
  totalPendapatan: number

  bebanOperasional: AkunItem[]
  subTotalBeban: number

  bebanPenyusutan: AkunItem[]
  totalBebanUsaha: number

  pnbpDanPajak: AkunItem[]
  totalPnbpDanPajak: number

  labaBersih: number
}

export async function getLabaRugiData(
  year: string = "2026",
  month: string = "all"
): Promise<LabaRugiData> {
  try {
    const monthNum =
      month !== "all"
        ? Number(month)
        : null

    const yearNum =
      Number(year)

    // ============================================================
    // 1. PENDAPATAN
    // ============================================================
    //
    // Pendapatan menggunakan basis akrual berdasarkan
    // tanggal invoice.
    //
    // Yang dihitung sebagai pendapatan hanya DPP.
    //
    // PPN, PPh 23, dan PNBP tidak dihitung sebagai pendapatan.
    // ============================================================

    const queryPendapatan = `
      SELECT
        i.jenis_kegiatan,

        SUM(
          COALESCE(i.jumlah_peserta, 0)
          * COALESCE(i.harga_peserta, 0)

          +

          COALESCE(i.jumlah_peserta_2, 0)
          * COALESCE(i.harga_peserta_2, 0)

          +

          COALESCE(d.dpp_detail, 0)
        ) AS saldo

      FROM tb_invoice i

      LEFT JOIN (
        SELECT
          invoice_id,

          SUM(
            item_jumlah * item_harga
          ) AS dpp_detail

        FROM tb_invoice_details

        GROUP BY
          invoice_id

      ) d
        ON d.invoice_id = i.id

      WHERE YEAR(i.tanggal) = ?

      ${monthNum
        ? "AND MONTH(i.tanggal) = ?"
        : ""
      }

      GROUP BY
        i.jenis_kegiatan
    `

    const pendapatanParams: any[] =
      monthNum
        ? [yearNum, monthNum]
        : [yearNum]

    const [
      pendapatanRows,
    ]: any =
      await db.query(
        queryPendapatan,
        pendapatanParams
      )

    let pendapatanPelatihan = 0
    let pendapatanKonsultan = 0

    pendapatanRows.forEach(
      (row: any) => {
        const jenis =
          String(
            row.jenis_kegiatan || ""
          ).toLowerCase()

        const saldo =
          Number(
            row.saldo
          ) || 0

        if (
          jenis === "pelatihan"
        ) {
          pendapatanPelatihan +=
            saldo
        }

        else if (
          jenis === "konsultan"
        ) {
          pendapatanKonsultan +=
            saldo
        }
      }
    )

    const totalPendapatan =
      pendapatanPelatihan +
      pendapatanKonsultan

    // ============================================================
    // 2. BEBAN DARI JURNAL
    // ============================================================
    //
    // Hanya akun 71102 yang diperlakukan sebagai Beban Pajak.
    //
    // 71102 = Pasal 4 (2)
    //
    // Akun pajak lainnya TIDAK masuk ke Laba Rugi.
    //
    // 81100 = PNBP
    // Tidak masuk ke Laba Rugi.
    //
    // Akun lainnya menggunakan:
    // debit - kredit
    // ============================================================

    const queryAkun = `
      SELECT
        a.no_akun,
        a.nama_akun,
        a.kelompok_biaya_id,

        COALESCE(
          kb.kelompok_biaya,
          'Tanpa Kelompok'
        ) AS kelompok_biaya,

        /*
         * Semua akun menggunakan debit - kredit.
         *
         * 71102 merupakan beban pajak dan normalnya
         * dicatat sebagai debit.
         */
        COALESCE(
          jd.total_debit,
          0
        )
        -
        COALESCE(
          jd.total_kredit,
          0
        ) AS saldo

      FROM tb_akun a

      LEFT JOIN tb_kelompok_biaya kb
        ON a.kelompok_biaya_id = kb.id

      LEFT JOIN (
        SELECT
          ji.no_akun,

          SUM(
            ji.debit
          ) AS total_debit,

          SUM(
            ji.kredit
          ) AS total_kredit

        FROM tb_jurnal_item ji

        INNER JOIN tb_jurnal j
          ON j.id = ji.jurnal_id

        WHERE YEAR(j.tanggal) = ?

          /*
           * Jangan ikutkan jurnal closing.
           */
          AND (
            j.no_registrasi IS NULL
            OR j.no_registrasi
               NOT LIKE 'CL\\\\_%'
          )

          ${monthNum
        ? "AND MONTH(j.tanggal) = ?"
        : ""
      }

        GROUP BY
          ji.no_akun

      ) jd
        ON jd.no_akun = a.no_akun

      /*
       * Laba Rugi tidak mengambil:
       *
       * 1xxx = Aset
       * 2xxx = Liabilitas
       * 3xxx = Ekuitas
       * 4xxx = Pendapatan
       *
       * Pendapatan 4xxx sudah dihitung dari invoice.
       *
       * Pajak selain 71102 tidak dihitung.
       * PNBP 81100 tidak dihitung.
       */
      WHERE a.no_akun NOT LIKE '1%'
        AND a.no_akun NOT LIKE '2%'
        AND a.no_akun NOT LIKE '3%'
        AND a.no_akun NOT LIKE '4%'
        AND a.no_akun <> '71101'
        AND a.no_akun <> '71103'
        AND a.no_akun <> '71106'
        AND a.no_akun <> '71109'
        AND a.no_akun <> '71110'
        AND a.no_akun <> '81100'
    `

    const akunParams: any[] =
      monthNum
        ? [yearNum, monthNum]
        : [yearNum]

    const [
      akunRows,
    ]: any =
      await db.query(
        queryAkun,
        akunParams
      )

    // ============================================================
    // 3. MAP DATA LAPORAN
    // ============================================================

    const mapBeban =
      new Map<string, AkunItem>()

    const mapPenyusutan =
      new Map<string, AkunItem>()

    const mapPajak =
      new Map<string, AkunItem>()

    let subTotalBeban = 0

    let totalPenyusutan = 0

    let totalPnbpDanPajak = 0

    // ============================================================
    // 4. HELPER INSERT MAP
    // ============================================================

    const insertIntoMap = (
      targetMap: Map<string, AkunItem>,

      groupKey: string,

      noAkun: string,

      namaAkun: string,

      kelompokId:
        number | string | null,

      kelompokBiaya: string,

      saldo: number
    ) => {
      const subItem: SubAkunItem = {
        no_akun:
          noAkun,

        nama_akun:
          namaAkun,

        kelompok_biaya_id:
          kelompokId,

        kelompok_biaya:
          kelompokBiaya,

        saldo:
          saldo,
      }

      if (
        targetMap.has(
          groupKey
        )
      ) {
        const parent =
          targetMap.get(
            groupKey
          )!

        parent.saldo +=
          saldo

        parent.rincian?.push(
          subItem
        )
      }

      else {
        targetMap.set(
          groupKey,
          {
            no_akun:
              noAkun,

            nama_akun:
              groupKey,

            saldo:
              saldo,

            rincian: [
              subItem,
            ],
          }
        )
      }
    }

    // ============================================================
    // 5. PROSES AKUN
    // ============================================================

    akunRows.forEach(
      (row: any) => {
        const namaAkun =
          (
            row.nama_akun ||
            ""
          ).trim()

        const noAkun =
          String(
            row.no_akun || ""
          )

        const kelompokId =
          row.kelompok_biaya_id ??
          null

        const kelompokBiaya =
          (
            row.kelompok_biaya ||
            ""
          ).trim()

        const saldo =
          Number(
            row.saldo
          ) || 0

        // ========================================================
        // Tidak ada saldo
        // ========================================================

        if (
          saldo === 0
        ) {
          return
        }

        // ========================================================
        // PNBP
        // ========================================================
        //
        // 81100 tidak boleh masuk beban.
        // ========================================================

        if (
          noAkun === "81100"
        ) {
          return
        }

        // ========================================================
        // BEBAN PAJAK
        // ========================================================
        //
        // HANYA 71102.
        //
        // 71102 = Pasal 4 (2)
        // ========================================================

        if (
          noAkun === "71102"
        ) {
          totalPnbpDanPajak +=
            saldo

          insertIntoMap(
            mapPajak,

            namaAkun,

            noAkun,

            namaAkun,

            kelompokId,

            kelompokBiaya,

            saldo
          )

          return
        }

        // ========================================================
        // PENYUSUTAN
        // ========================================================

        const isPenyusutan =
          namaAkun
            .toLowerCase()
            .includes(
              "penyusutan"
            )

        if (
          isPenyusutan
        ) {
          totalPenyusutan +=
            saldo

          insertIntoMap(
            mapPenyusutan,

            namaAkun,

            noAkun,

            namaAkun,

            kelompokId,

            kelompokBiaya,

            saldo
          )

          return
        }

        // ========================================================
        // BEBAN OPERASIONAL
        // ========================================================

        subTotalBeban +=
          saldo

        insertIntoMap(
          mapBeban,

          kelompokBiaya,

          noAkun,

          namaAkun,

          kelompokId,

          kelompokBiaya,

          saldo
        )
      }
    )

    // ============================================================
    // 6. FORMAT DAN URUTKAN
    // ============================================================

    const formatDanUrutkan = (
      map: Map<string, AkunItem>
    ) => {
      return Array.from(
        map.values()
      )
        .map(
          (item) => ({
            ...item,

            rincian:
              item.rincian
                ? item.rincian.sort(
                  (a, b) =>
                    a.no_akun.localeCompare(
                      b.no_akun
                    )
                )
                : [],
          })
        )
        .sort(
          (a, b) =>
            a.nama_akun.localeCompare(
              b.nama_akun
            )
        )
    }

    // ============================================================
    // 7. HASIL PER KELOMPOK
    // ============================================================

    const bebanOperasional =
      formatDanUrutkan(
        mapBeban
      )

    const bebanPenyusutan =
      formatDanUrutkan(
        mapPenyusutan
      )

    const pnbpDanPajak =
      formatDanUrutkan(
        mapPajak
      )

    // ============================================================
    // 8. TOTAL BEBAN USAHA
    // ============================================================

    const totalBebanUsaha =
      subTotalBeban +
      totalPenyusutan

    // ============================================================
    // 9. LABA BERSIH
    // ============================================================

    const labaBersih =
      totalPendapatan -
      totalBebanUsaha -
      totalPnbpDanPajak

    // ============================================================
    // 10. RETURN
    // ============================================================

    return {
      pendapatanPelatihan,

      pendapatanKonsultan,

      totalPendapatan,

      bebanOperasional,

      subTotalBeban,

      bebanPenyusutan,

      totalBebanUsaha,

      pnbpDanPajak,

      totalPnbpDanPajak,

      labaBersih,
    }

  } catch (error) {
    console.error(
      "CRITICAL_ERR_LABA_RUGI:",
      error
    )

    return {
      pendapatanPelatihan: 0,

      pendapatanKonsultan: 0,

      totalPendapatan: 0,

      bebanOperasional: [],

      subTotalBeban: 0,

      bebanPenyusutan: [],

      totalBebanUsaha: 0,

      pnbpDanPajak: [],

      totalPnbpDanPajak: 0,

      labaBersih: 0,
    }
  }
}