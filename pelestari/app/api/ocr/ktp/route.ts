import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export async function POST(req: NextRequest) {
  let worker;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Inisialisasi Tesseract Worker
    worker = await createWorker(['ind', 'eng']);
    const {
      data: { text },
    } = await worker.recognize(buffer);

    // Parsing teks mentah
    const parsedData = parseKtpText(text);

    return NextResponse.json({
      success: true,
      data: {
        id: crypto.randomUUID(),
        ...parsedData,
        rawText: text,
        statusVerifikasi: parsedData.nik ? 'VALID' : 'PERLU_CEK',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal OCR: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

// Helper function untuk membedah teks KTP
function parseKtpText(raw: string) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let nik = '';
  let nama = '';
  let tempatLahir = '';
  let tanggalLahir = '';

  // 1. Ekstrak NIK
  // Tangkap teks setelah label NIK/N1K/N|K termasuk pemisah titik dua/titik/spasi
  const nikLabelPattern = /(?:NIK|N1K|N[Il|]K|NI[Kk])\s*[:=;.\s]*\s*([0-9OBIDSZol|L\s-]{16,30})/i;
  const labelMatch = raw.match(nikLabelPattern);

  let candidate = '';

  if (labelMatch && labelMatch[1]) {
    // Ambil string tepat di belakang label NIK
    candidate = labelMatch[1];
  } else {
    // Fallback: Jika kata "NIK" gagal terbaca, cari baris atau susunan 16 karakter angka/typo
    for (const line of lines) {
      // Hilangkan spasi & strip untuk tes panjang
      const normalizedLine = line.replace(/[\s-]/g, '');
      const potentialNik = normalizedLine.match(/[0-9OBIDSZol|L]{16}/i);
      if (potentialNik) {
        candidate = potentialNik[0];
        break;
      }
    }
  }

  if (candidate) {
    // Normalisasi karakter typo OCR ke angka
    const cleanNumbers = candidate
      .toUpperCase()
      .replace(/[\s-]/g, '') // Hapus spasi & dash
      .replace(/[OD]/g, '0')
      .replace(/[IL|]/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    // Ambil tepat 16 digit pertama
    const digitMatch = cleanNumbers.match(/\d{16}/);
    if (digitMatch) {
      nik = digitMatch[0];
    }
  }

  // 2. Ekstrak Nama & Tempat/Tanggal Lahir
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Cek baris Nama
    if (/Nama/i.test(line) && !nama) {
      nama = line.replace(/.*Nama\s*[:=;.\s]*/i, '').trim();
    }

    // Cek baris Tempat/Tgl Lahir
    if (/Tempat|Tgl\s*Lahir|Lahir/i.test(line) && (!tempatLahir || !tanggalLahir)) {
      const ttlRaw = line.replace(/.*(?:Lahir|Tgl Lahir)\s*[:=;.\s]*/i, '').trim();
      const parts = ttlRaw.split(',');

      if (parts.length >= 2) {
        tempatLahir = parts[0].trim();
        // Cari pola tanggal DD-MM-YYYY atau DD MM YYYY
        const dateMatch = parts[1].match(/\d{2}[-\s/]\d{2}[-\s/]\d{4}/);
        if (dateMatch) {
          tanggalLahir = dateMatch[0].replace(/[\s/]/g, '-');
        }
      }
    }
  }

  return { nik, nama, tempatLahir, tanggalLahir };
}