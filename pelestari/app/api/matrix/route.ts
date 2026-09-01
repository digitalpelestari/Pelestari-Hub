import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

async function saveFile(file: File | null, prefix: string): Promise<string | null> {
  if (!file || typeof file === 'string') return null;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  await writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
}

// 1. GET: Ambil Data Matrix (bisa filter ?batch_id=1)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');

    let sql = `
      SELECT m.*, b.nama AS nama_batch, b.lokasi AS lokasi_batch 
      FROM tb_matrix m 
      LEFT JOIN tb_batch b ON m.batch_id = b.id
    `;
    const params: any[] = [];

    if (batchId) {
      sql += ' WHERE m.batch_id = ?';
      params.push(batchId);
    }

    sql += ' ORDER BY m.created_at DESC';

    const [rows] = await db.query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 2. POST: Simpan Data Peserta Baru beserta batch_id
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const batch_id = formData.get('batch_id') ? Number(formData.get('batch_id')) : null;
    const nama = formData.get('nama') as string;
    const tempat_lahir = (formData.get('tempat_lahir') as string) || null;
    let tanggal_lahir = (formData.get('tanggal_lahir') as string) || null;
    const nik = (formData.get('nik') as string) || null;
    const nomor_sim = (formData.get('nomor_sim') as string) || null;
    const jenis_sim = (formData.get('jenis_sim') as string) || null;
    const perusahaan = (formData.get('perusahaan') as string) || null;
    const lokasi = (formData.get('lokasi') as string) || null;
    const jenis_muatan = (formData.get('jenis_muatan') as string) || null;

    if (tanggal_lahir && tanggal_lahir.includes('-')) {
      const parts = tanggal_lahir.split('-');
      if (parts[0].length === 2 && parts[2].length === 4) {
        tanggal_lahir = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const fileKtp = formData.get('foto_ktp') as File | null;
    const fileSim = formData.get('foto_sim') as File | null;
    const filePasFoto = formData.get('pas_foto') as File | null;

    const foto_ktp = await saveFile(fileKtp, 'ktp');
    const foto_sim = await saveFile(fileSim, 'sim');
    const pas_foto = await saveFile(filePasFoto, 'pasfoto');

    const sql = `
      INSERT INTO tb_matrix (
        batch_id, nama, tempat_lahir, tanggal_lahir, nik, 
        nomor_sim, jenis_sim, perusahaan, lokasi, jenis_muatan, 
        foto_ktp, foto_sim, pas_foto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result]: any = await db.execute(sql, [
      batch_id,
      nama,
      tempat_lahir,
      tanggal_lahir,
      nik,
      nomor_sim,
      jenis_sim,
      perusahaan,
      lokasi,
      jenis_muatan,
      foto_ktp,
      foto_sim,
      pas_foto,
    ]);

    return NextResponse.json({
      success: true,
      message: 'Data berhasil disimpan ke batch',
      insertId: result.insertId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}