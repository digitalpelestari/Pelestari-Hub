"use server"

import { PDFParse } from "pdf-parse"

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
  const buffer = Buffer.from(arrayBuffer)

  const parser = new PDFParse({
    data: buffer,
  })

  try {
    const result = await parser.getText()

    const transaksi = parseTransaksiRekeningKoran(result.text)

    return {
      text: result.text,
      jumlahHalaman: result.total,
      transaksi,
    }
  } finally {
    await parser.destroy()
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
function formatTanggal(rowTanggal: string | Date) {
  if (rowTanggal instanceof Date) {
    const tahun = rowTanggal.getFullYear()
    const bulan = String(rowTanggal.getMonth() + 1).padStart(2, "0")
    const hari = String(rowTanggal.getDate()).padStart(2, "0")

    return `${tahun}-${bulan}-${hari}`
  }

  return String(rowTanggal).slice(0, 10)
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