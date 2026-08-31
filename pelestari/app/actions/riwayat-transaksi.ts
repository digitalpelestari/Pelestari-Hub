// app/actions/riwayat-transaksi.ts
"use server"

import { db } from "@/lib/db"

export interface RiwayatSemuaTransaksi {
  id: number
  tanggal: string
  no_registrasi: string
  no_referensi: string
  penerima: string
  keterangan: string
  sumber_dana: string
  tujuan_alokasi: string
  nominal: number
  items: any[]
}

// Helper pembersih parameter Server Actions
function cleanParam(val?: any): string | undefined {
  if (
    val === undefined ||
    val === null ||
    val === "" ||
    val === "$undefined" ||
    val === "undefined" ||
    val === "null"
  ) {
    return undefined
  }
  return String(val).trim()
}

export async function getJurnalList(
  startDate?: string,
  endDate?: string,
  page?: number,
  pageSize?: number,
  search?: string,
  tipe?: "ALL" | "BK" | "BD" | "KK"
) {
  try {
    const cleanStart = cleanParam(startDate)
    const cleanEnd = cleanParam(endDate)
    const cleanSearch = cleanParam(search)
    const cleanTipe = cleanParam(tipe)

    const isPaginationEnabled = page !== undefined && pageSize !== undefined
    const currentPage = Math.max(1, Number(page) || 1)
    const currentPageSize = Math.max(1, Number(pageSize) || 20)
    const offset = (currentPage - 1) * currentPageSize

    const conditions: string[] = []
    const params: any[] = []

    // 1. FILTER TANGGAL
    if (cleanStart) {
      conditions.push("DATE(j.tanggal) >= ?")
      params.push(cleanStart)
    }
    if (cleanEnd) {
      conditions.push("DATE(j.tanggal) <= ?")
      params.push(cleanEnd)
    }

    // 2. FILTER TIPE REGISTRASI (BK / BD / KK)
    if (cleanTipe && cleanTipe !== "ALL") {
      conditions.push("UPPER(TRIM(j.no_registrasi)) LIKE ?")
      params.push(`${cleanTipe.toUpperCase()}%`)
    }

    // 3. SEARCH KEYWORD
    if (cleanSearch) {
      const searchValue = `%${cleanSearch}%`
      conditions.push(`
        (
          LOWER(j.no_registrasi) LIKE LOWER(?)
          OR LOWER(j.no_referensi) LIKE LOWER(?)
          OR LOWER(j.penerima) LIKE LOWER(?)
          OR LOWER(j.keterangan) LIKE LOWER(?)
          OR EXISTS (
            SELECT 1
            FROM tb_jurnal_item si
            LEFT JOIN tb_akun sa ON si.no_akun = sa.no_akun
            WHERE si.jurnal_id = j.id
              AND (
                LOWER(si.no_akun) LIKE LOWER(?)
                OR LOWER(sa.nama_akun) LIKE LOWER(?)
              )
          )
        )
      `)
      params.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    // TOTAL DATA
    const countQuery = `SELECT COUNT(*) AS total FROM tb_jurnal j ${whereClause}`
    const [countRows]: any = await db.query(countQuery, params)
    const total = Number(countRows[0]?.total || 0)

    // SUMMARY
    const summaryQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebit,
        COALESCE(SUM(i.kredit), 0) AS totalKredit
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      ${whereClause}
    `
    const [summaryRows]: any = await db.query(summaryQuery, params)
    const totalDebit = Number(summaryRows[0]?.totalDebit || 0)
    const totalKredit = Number(summaryRows[0]?.totalKredit || 0)

    // SALDO KAS (DINAMIS DARI KELOMPOK COA KAS/BANK)
    const saldoKasConditions: string[] = []
    const saldoKasParams: any[] = []

    if (cleanStart) {
      saldoKasConditions.push("DATE(j.tanggal) >= ?")
      saldoKasParams.push(cleanStart)
    }
    if (cleanEnd) {
      saldoKasConditions.push("DATE(j.tanggal) <= ?")
      saldoKasParams.push(cleanEnd)
    }
    if (cleanTipe && cleanTipe !== "ALL") {
      saldoKasConditions.push("UPPER(TRIM(j.no_registrasi)) LIKE ?")
      saldoKasParams.push(`${cleanTipe.toUpperCase()}%`)
    }

    const saldoKasWhere =
      saldoKasConditions.length > 0 ? `AND ${saldoKasConditions.join(" AND ")}` : ""

    const saldoKasQuery = `
      SELECT
        COALESCE(SUM(i.debit), 0) AS totalDebitKas,
        COALESCE(SUM(i.kredit), 0) AS totalKreditKas
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
      WHERE (
        UPPER(k.kelompok_biaya) LIKE '%KAS%' 
        OR UPPER(k.kelompok_biaya) LIKE '%BANK%'
      )
      ${saldoKasWhere}
    `

    const [saldoKasRows]: any = await db.query(saldoKasQuery, saldoKasParams)
    const totalDebitKas = Number(saldoKasRows[0]?.totalDebitKas || 0)
    const totalKreditKas = Number(saldoKasRows[0]?.totalKreditKas || 0)
    const saldoKas = totalDebitKas - totalKreditKas

    // HEADER JURNAL
    let headerQuery = `
      SELECT
        j.id,
        j.tanggal,
        j.no_registrasi,
        j.no_referensi,
        j.penerima,
        j.keterangan
      FROM tb_jurnal j
      ${whereClause}
      ORDER BY j.tanggal DESC, j.id DESC
    `
    const headerParams = [...params]
    if (isPaginationEnabled) {
      headerQuery += ` LIMIT ? OFFSET ?`
      headerParams.push(currentPageSize, offset)
    }

    const [headers]: any = await db.query(headerQuery, headerParams)
    if (!headers || headers.length === 0) {
      return {
        success: true,
        data: [],
        pagination: {
          page: currentPage,
          pageSize: currentPageSize,
          total,
          totalPages: Math.ceil(total / currentPageSize),
        },
        summary: {
          totalDebit,
          totalKredit,
          isBalanced: totalDebit === totalKredit && totalDebit > 0,
          saldoKas,
        },
      }
    }

    // DETAIL ITEMS DENGAN NAMA KELOMPOK COA
    const jurnalIds = headers.map((jurnal: any) => jurnal.id)
    const placeholders = jurnalIds.map(() => "?").join(",")
    const itemQuery = `
      SELECT
        i.id,
        i.jurnal_id,
        i.no_akun,
        a.nama_akun,
        k.kelompok_biaya AS nama_kelompok,
        i.debit,
        i.kredit
      FROM tb_jurnal_item i
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      LEFT JOIN tb_kelompok_biaya k ON a.kelompok_biaya_id = k.id
      WHERE i.jurnal_id IN (${placeholders})
      ORDER BY i.id ASC
    `
    const [allItems]: any = await db.query(itemQuery, jurnalIds)

    const itemsMap = new Map<number, any[]>()
    for (const item of allItems) {
      const jId = Number(item.jurnal_id)
      if (!itemsMap.has(jId)) itemsMap.set(jId, [])
      itemsMap.get(jId)!.push(item)
    }

    const structuredJurnal = headers.map((jurnal: any) => ({
      id: jurnal.id,
      tanggal: jurnal.tanggal,
      no_registrasi: jurnal.no_registrasi,
      no_referensi: jurnal.no_referensi,
      penerima: jurnal.penerima || "-",
      keterangan: jurnal.keterangan,
      items: itemsMap.get(Number(jurnal.id)) || [],
    }))

    return {
      success: true,
      data: structuredJurnal,
      summary: {
        totalDebit,
        totalKredit,
        isBalanced: totalDebit === totalKredit && totalDebit > 0,
        saldoKas,
      },
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.ceil(total / currentPageSize),
      },
    }
  } catch (error: any) {
    console.error("GET_JURNAL_LIST_ERROR:", error.message)
    return {
      success: false,
      data: [],
      pagination: { page: page || 1, pageSize: pageSize || 20, total: 0, totalPages: 0 },
      message: error.message,
    }
  }
}