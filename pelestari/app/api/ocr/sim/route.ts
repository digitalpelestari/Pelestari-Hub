import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export async function POST(req: NextRequest) {
  let worker;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File SIM tidak ditemukan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    worker = await createWorker(['ind', 'eng']);
    const { data: { text } } = await worker.recognize(buffer);

    const parsedSim = parseSimText(text);

    return NextResponse.json({
      success: true,
      data: parsedSim,
      rawText: text,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal memproses OCR SIM: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

function parseSimText(raw: string) {
  let jenisSim = '';
  let noSim = '';

  // 1. Ekstrak Jenis/Golongan SIM (SIM A, SIM B I, SIM B II, SIM C, dll.)
  const jenisMatch = raw.match(/\b(?:SIM|SURAT\s*IZIN\s*MENGEMUDI)?\s*([A-C](?:\s*I{1,2})?)\b/i)
                  || raw.match(/\b(BI|BII|B1|B2|A|C)\b/i);
  if (jenisMatch) {
    const matched = jenisMatch[1].toUpperCase().replace(/\s+/g, ' ');
    if (matched.includes('B1') || matched.includes('B I')) jenisSim = 'B I Umum / B I';
    else if (matched.includes('B2') || matched.includes('B II')) jenisSim = 'B II Umum / B II';
    else if (matched.includes('A')) jenisSim = 'A';
    else if (matched.includes('C')) jenisSim = 'C';
    else jenisSim = matched;
  }

  // 2. Ekstrak Nomor SIM (12 - 16 digit angka)
  const noSimMatch = raw.match(/(?:NO|NOMOR|NO\.)\s*[:=]?\s*([0-9-]{12,18})/i)
                  || raw.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4,6}\b/);
  if (noSimMatch) {
    noSim = noSimMatch[1].replace(/[^0-9]/g, '');
  }

  return { jenisSim, noSim };
}