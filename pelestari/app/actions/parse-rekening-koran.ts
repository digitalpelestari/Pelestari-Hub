"use server"

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"

type TransaksiBankParsed = {
  tanggal: string
  keterangan: string
  nominal: number
  tipe: "DEBIT" | "KREDIT"
  saldo: number | null
}

export async function bacaPdfRekeningKoran(file: File) {
  if (!file) {
    throw new Error("File PDF tidak ditemukan.")
  }

  if (file.type !== "application/pdf") {
    throw new Error("File harus berupa PDF.")
  }

  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)
  

const loadingTask = pdfjsLib.getDocument({
  data,
})

  const pdf = await loadingTask.promise

  const halaman: string[] = []

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()

 const items = content.items.filter(
  (item: any) => "str" in item && item.str.trim()
)

const lines: string[] = []
let currentY: number | null = null
let currentLine: string[] = []

for (const item of items as any[]) {
 const y = item.transform[5]

  if (currentY !== null && Math.abs(y - currentY) > 2) {
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" ").trim())
    }

    currentLine = []
  }

  currentLine.push(item.str)
  currentY = y
}

if (currentLine.length > 0) {
  lines.push(currentLine.join(" ").trim())
}

const firstTransactionIndex = lines.findIndex((line) => {
  return /^\d{2}\/\d{2}\s+/.test(line)
})

const transactionLines =
  firstTransactionIndex >= 0
    ? lines.slice(firstTransactionIndex)
    : []

const filteredTransactionLines = transactionLines.filter((line) => {
  const normalized = line
    .toUpperCase()
    .replace(/\s+/g, " ")

  return !normalized.includes("SALDO AWAL")
})

const summaryIndex = filteredTransactionLines.findIndex((line) => {  const normalized = line.toUpperCase().replace(/\s+/g, " ")

  return (
    normalized.includes("MUTASI CR") ||
    normalized.includes("MUTASI DB") ||
    normalized.includes("SALDO AKHIR")
  )
})

const text = filteredTransactionLines.join("\n")

console.log("========== HALAMAN", pageNumber, "==========")
console.log(text)

halaman.push(text)
}
  const text = halaman.join("\n")

  const transaksi = parseTransaksiRekeningKoran(text)

  const tanggalTransaksi = transaksi
  .map((item) => item.tanggal)
  .filter(Boolean)
  .sort()

const tanggalMulai =
  tanggalTransaksi.length > 0
    ? tanggalTransaksi[0]
    : null

const tanggalSampai =
  tanggalTransaksi.length > 0
    ? tanggalTransaksi[tanggalTransaksi.length - 1]
    : null

  return {
    text,
    jumlahHalaman: pdf.numPages,
    transaksi,
    tanggalMulai,
    tanggalSampai,
  }
}
function parseTransaksiRekeningKoran(
  text: string
): TransaksiBankParsed[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const transaksi: TransaksiBankParsed[] = []

  let transaksiAktif: {
    tanggal: string
    lines: string[]
    tipe: "DEBIT" | "KREDIT"
    nominal: number | null
    saldo: number | null
  } | null = null

  const simpanTransaksi = () => {
    if (
      transaksiAktif &&
      transaksiAktif.nominal !== null
    ) {
      transaksi.push({
        tanggal: ubahTanggal(transaksiAktif.tanggal),
        keterangan: transaksiAktif.lines.join(" ").trim(),
        nominal: transaksiAktif.nominal,
        tipe: transaksiAktif.tipe,
        saldo: transaksiAktif.saldo,
      })
    }
  }

  for (const line of lines) {
    // Abaikan header/footer PDF
    if (
      line.includes("REKENING GIRO") ||
      line.includes("TANGGAL KETERANGAN") ||
      line.includes("MUTASI SALDO") ||
      line.includes("Bersambung ke halaman berikut") ||
      line.startsWith("--")
    ) {
      continue
    }

    // Deteksi tanggal transaksi
    const tanggalMatch = line.match(/^(\d{2}\/\d{2})\s+(.*)$/)

    if (tanggalMatch) {
      simpanTransaksi()

      const tanggal = tanggalMatch[1]
      const isi = tanggalMatch[2]

      const tipe = /\bDB\b/i.test(isi)
        ? "DEBIT"
        : "KREDIT"

      transaksiAktif = {
        tanggal,
        lines: [],
        tipe,
        nominal: null,
        saldo: null,
      }

      // ------------------------------------------------------------
      // Jika baris tanggal langsung mengandung angka transaksi/saldo
      // contoh:
      //
      // 13/08 BI-FAST CR ... 6,200,000.00
      //
      // atau:
      //
      // 13/08 BI-FAST CR ... 6,200,000.00 1,500,086,851.81
      // ------------------------------------------------------------

      const angka = [
        ...isi.matchAll(/([\d,]+\.\d{2})/g),
      ].map((match) => match[1])

      if (angka.length >= 2) {
        const angkaParsed = angka.map(parseNominal)

        transaksiAktif.nominal =
          angkaParsed[angkaParsed.length - 2]

        transaksiAktif.saldo =
          angkaParsed[angkaParsed.length - 1]

        transaksiAktif.lines.push(
          isi
            .replace(
              angka[angka.length - 2],
              ""
            )
            .replace(
              angka[angka.length - 1],
              ""
            )
            .trim()
        )
      } else if (angka.length === 1) {
        transaksiAktif.nominal =
          parseNominal(angka[0])

        transaksiAktif.lines.push(
          isi
            .replace(angka[0], "")
            .trim()
        )
      } else {
        transaksiAktif.lines.push(isi)
      }

      continue
    }

    if (!transaksiAktif) {
      continue
    }

    // ------------------------------------------------------------
    // BARIS DEBIT
    //
    // Contoh:
    // 30,000.00 DB 1,562,764,772.81
    // ------------------------------------------------------------

    const nominalDbMatch = line.match(
      /([\d,]+\.\d{2})\s+DB\b/i
    )

    if (nominalDbMatch) {
      transaksiAktif.nominal =
        parseNominal(nominalDbMatch[1])

      transaksiAktif.tipe = "DEBIT"

      const setelahDb = line.match(
        /DB\s+([\d,]+\.\d{2})$/i
      )

      if (setelahDb) {
        transaksiAktif.saldo =
          parseNominal(setelahDb[1])
      }

      // Masukkan hanya teks sebelum angka
      const keterangan = line
        .replace(
          nominalDbMatch[1],
          ""
        )
        .replace(
          /DB\s+[\d,]+\.\d{2}$/i,
          ""
        )
        .trim()

      if (keterangan) {
        transaksiAktif.lines.push(keterangan)
      }

      continue
    }
    // ------------------------------------------------------------
    // Cari angka nominal/saldo pada baris
    // ------------------------------------------------------------

    const angka = [
      ...line.matchAll(/([\d,]+\.\d{2})/g),
    ].map((match) => match[1])

    if (angka.length >= 2) {
      const angkaParsed = angka.map(parseNominal)

      transaksiAktif.nominal =
        angkaParsed[angkaParsed.length - 2]

      transaksiAktif.saldo =
        angkaParsed[angkaParsed.length - 1]

      // Hapus nominal + saldo dari keterangan
      let keterangan = line

      keterangan = keterangan.replace(
        angka[angka.length - 2],
        ""
      )

      keterangan = keterangan.replace(
        angka[angka.length - 1],
        ""
      )

      keterangan = keterangan.trim()

      if (keterangan) {
        transaksiAktif.lines.push(keterangan)
      }

      continue
    }

    if (angka.length === 1) {
      const nominal = parseNominal(angka[0])

      if (transaksiAktif.nominal === null) {
        transaksiAktif.nominal = nominal
      } else {
        transaksiAktif.saldo = nominal
      }

      // Hapus angka dari keterangan
      const keterangan = line
        .replace(angka[0], "")
        .trim()

      if (keterangan) {
        transaksiAktif.lines.push(keterangan)
      }

      continue
    }

    // ------------------------------------------------------------
    // Baris biasa = bagian dari keterangan
    // ------------------------------------------------------------

    transaksiAktif.lines.push(line)
  }

  // Simpan transaksi terakhir
  simpanTransaksi()

  return transaksi
}

function parseNominal(value: string): number {
  return Number(value.replace(/,/g, ""))
}

function ubahTanggal(tanggal: string): string {
  const [hari, bulan] = tanggal.split("/")

  return `2026-${bulan}-${hari}`
}