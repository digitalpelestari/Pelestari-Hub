import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  return null;
}

function normalizeBatch(row: any) {
  if (!row) return row;
  return {
    ...row,
    tanggal_mulai: toDateOnly(row.tanggal_mulai),
    tanggal_selesai: toDateOnly(row.tanggal_selesai),
  };
}

export async function GET() {
  try {
    const [rows]: any = await db.query(
      'SELECT id, nama, tanggal_mulai, tanggal_selesai, lokasi FROM tb_batch ORDER BY tanggal_mulai DESC'
    );
    const data = (rows || []).map(normalizeBatch);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, tanggal_mulai, tanggal_selesai, lokasi } = body || {};

    if (!nama || String(nama).trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Nama batch wajib diisi' },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      'INSERT INTO tb_batch (nama, tanggal_mulai, tanggal_selesai, lokasi) VALUES (?, ?, ?, ?)',
      [
        String(nama).trim(),
        tanggal_mulai || null,
        tanggal_selesai || null,
        lokasi ? String(lokasi).trim() : null,
      ]
    );

    const insertedId = result?.insertId;
    const [created]: any = await db.query(
      'SELECT id, nama, tanggal_mulai, tanggal_selesai, lokasi FROM tb_batch WHERE id = ?',
      [insertedId]
    );

    return NextResponse.json({ success: true, data: normalizeBatch(created[0]) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID batch wajib diisi' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { nama, tanggal_mulai, tanggal_selesai, lokasi } = body || {};

    if (!nama || String(nama).trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Nama batch wajib diisi' },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      'UPDATE tb_batch SET nama = ?, tanggal_mulai = ?, tanggal_selesai = ?, lokasi = ? WHERE id = ?',
      [
        String(nama).trim(),
        tanggal_mulai || null,
        tanggal_selesai || null,
        lokasi ? String(lokasi).trim() : null,
        id,
      ]
    );

    if (!result || result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Batch tidak ditemukan' },
        { status: 404 }
      );
    }

    const [updated]: any = await db.query(
      'SELECT id, nama, tanggal_mulai, tanggal_selesai, lokasi FROM tb_batch WHERE id = ?',
      [id]
    );

    return NextResponse.json({ success: true, data: normalizeBatch(updated[0]) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID batch wajib diisi' },
        { status: 400 }
      );
    }

    const [pesertaResult]: any = await db.query(
      'SELECT COUNT(*) as total FROM tb_matrix WHERE batch_id = ?',
      [id]
    );
    const totalPeserta = pesertaResult?.[0]?.total ?? 0;

    await db.query('DELETE FROM tb_matrix WHERE batch_id = ?', [id]);

    const [result]: any = await db.query('DELETE FROM tb_batch WHERE id = ?', [id]);

    if (!result || result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Batch tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Batch berhasil dihapus beserta ${totalPeserta} peserta di dalamnya.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}