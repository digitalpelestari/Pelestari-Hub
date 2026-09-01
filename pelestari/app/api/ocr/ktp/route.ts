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

    // Inisialisasi Tesseract Worker dengan bahasa Indonesia (ind) + Inggris (eng)
    worker = await createWorker(['ind', 'eng']);
    const { data: { text } } = await worker.recognize(buffer);

    // Parsing teks mentah menggunakan Regex
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

  // 1. Ekstrak NIK (16 digit angka, toleransi typo huruf O/D/I jadi angka)
  const nikMatch = raw.match(/(?:NIK|N1K|N|K)\s*[:=]?\s*([0-9OBIDSZ]{16})/i) 
                || raw.match(/\b\d{16}\b/);
  if (nikMatch) {
    nik = nikMatch[1]
      .replace(/O|D/g, '0')
      .replace(/I|l/g, '1')
      .replace(/B/g, '8')
      .replace(/S/g, '5')
      .replace(/Z/g, '2');
  }

  // 2. Ekstrak Nama & Tempat/Tanggal Lahir dari baris teks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Cek baris Nama
    if (/Nama/i.test(line)) {
      nama = line.replace(/.*Nama\s*[:=]?\s*/i, '').trim();
    }

    // Cek baris Tempat/Tgl Lahir
    if (/Tempat|Tgl\s*Lahir|Lahir/i.test(line)) {
      const ttlRaw = line.replace(/.*(?:Lahir|Tgl Lahir)\s*[:=]?\s*/i, '').trim();
      const parts = ttlRaw.split(',');
      if (parts.length >= 2) {
        tempatLahir = parts[0].trim();
        // Cari pola tanggal DD-MM-YYYY
        const dateMatch = parts[1].match(/\d{2}[-\s/]\d{2}[-\s/]\d{4}/);
        if (dateMatch) {
          tanggalLahir = dateMatch[0].replace(/\s|\//g, '-');
        }
      }
    }
  }

  return { nik, nama, tempatLahir, tanggalLahir };
}