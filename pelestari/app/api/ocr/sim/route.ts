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

    worker = await createWorker(['ind', 'eng']);
    const {
      data: { text },
    } = await worker.recognize(buffer);

    const parsed = parseSimText(text);

    return NextResponse.json({
      success: true,
      data: {
        ...parsed,
        rawText: text,
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

function normalizeSimNumber(val: string) {
  return val
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

function parseSimText(raw: string) {
  let jenisSim = '';
  let noSim = '';

  const clean = raw.replace(/\r/g, '').trim();
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  const simIndex = lines.findIndex((l) =>
    /SURAT\s*IZIN\s*MENGEMUDI|SIM/i.test(l),
  );

  if (simIndex !== -1) {
    const afterSimLine = lines[simIndex + 1] || '';
    const afterSimDigits = afterSimLine.match(/[\d\s-]{12,20}/);
    if (afterSimDigits) {
      noSim = normalizeSimNumber(afterSimDigits[0]).slice(0, 16);
    }
  }

  if (!noSim) {
    const simSection = clean.match(/SURAT\s*IZIN\s*MENGEMUDI[\s\S]{0,100}/i);
    if (simSection) {
      const digitsInSection = simSection[0].match(/[\d\s-]{12,20}/);
      if (digitsInSection) {
        noSim = normalizeSimNumber(digitsInSection[0]).slice(0, 16);
      }
    }
  }

  if (!noSim) {
    const labeledNoMatch = clean.match(
      /(?:NO(?:\.|\s+SIM)?|NOMOR)\s*[:=.\s]*([\d\s-]{12,20})/i,
    );
    if (labeledNoMatch) {
      noSim = normalizeSimNumber(labeledNoMatch[1]).slice(0, 16);
    }
  }

  if (!noSim) {
    const patternMatch =
      clean.match(/\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}(?:[-\s]?\d{4})?)\b/) ||
      clean.match(/\b(\d{12,16})\b/);
    if (patternMatch) {
      noSim = normalizeSimNumber(patternMatch[1]).slice(0, 16);
    }
  }

  const simContextMatch =
    clean.match(
      /(?:SURAT\s*IZIN\s*MENGEMUDI|DRIVING\s*LICENSE|SIM)\s*([A-C](?:\s*(?:I{1,2}|1|2))?(?:\s*UMUM)?)/i,
    ) ||
    clean.match(/\b(B\s*II\s*UMUM|B\s*I\s*UMUM|A\s*UMUM|B\s*II|B\s*I|B2|B1)\b/i) ||
    clean.match(/\bSIM\s*([A-D])\b/i);

  if (simContextMatch) {
    const matched = (simContextMatch[1] || simContextMatch[0])
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (matched.includes('B2') || matched.includes('B II') || matched.includes('B 2')) {
      jenisSim = 'B II Umum';
    } else if (matched.includes('B1') || matched.includes('B I') || matched.includes('B 1')) {
      jenisSim = 'B I Umum';
    } else if (matched.includes('A')) {
      jenisSim = 'A';
    } else if (matched.includes('C')) {
      jenisSim = 'C';
    } else if (matched.includes('D')) {
      jenisSim = 'D';
    } else {
      jenisSim = matched;
    }
  }

  if (!jenisSim && noSim) {
    for (const line of lines) {
      const hasSimNumber = line.match(/[\d\s-]{12,20}/);
      const hasType = line.match(
        /\b(B\s*II\s*UMUM|B\s*I\s*UMUM|A\s*UMUM|B\s*II|B\s*I|B2|B1|A|C|D)\b/i,
      );
      if (hasSimNumber && hasType) {
        const matched = hasType[1]
          .toUpperCase()
          .replace(/\s+/g, ' ')
          .trim();
        if (matched.includes('B2') || matched.includes('B II')) {
          jenisSim = 'B II Umum';
        } else if (matched.includes('B1') || matched.includes('B I')) {
          jenisSim = 'B I Umum';
        } else if (matched.includes('A')) {
          jenisSim = 'A';
        } else if (matched.includes('C')) {
          jenisSim = 'C';
        } else if (matched.includes('D')) {
          jenisSim = 'D';
        } else {
          jenisSim = matched;
        }
        break;
      }
    }
  }

  return { jenisSim, noSim };
}
