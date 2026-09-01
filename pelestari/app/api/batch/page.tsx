import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await db.query(
      'SELECT id, nama, tanggal_mulai, tanggal_selesai, lokasi FROM tb_batch ORDER BY tanggal_mulai DESC'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}