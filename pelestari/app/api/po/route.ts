// file: app/api/po/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // Sesuaikan dengan file koneksi database mysql2 Anda
import { ResultSetHeader } from "mysql2";

interface CreatePORequest {
  no_po: string;
  vendor_id: number;
  total_akhir: number;
}

export async function POST(request: Request) {
  try {
    const body: CreatePORequest = await request.json();
    const { no_po, vendor_id, total_akhir } = body;

    // 1. Query otomatis simpan data PO GA
    const insertPOQuery = `
      INSERT INTO tb_po (no_po, vendor_id, total_amount, status_pembayaran) 
      VALUES (?, ?, ?, 'Belum Bayar')
    `;
    await db.query(insertPOQuery, [no_po, vendor_id, total_akhir]);

    // 2. Query otomatis tambah saldo ke akun 8000 di tb_akun sesuai gambar Anda
    const updateSaldoQuery = `
      UPDATE tb_akun 
      SET saldo = saldo + ? 
      WHERE no_akun = '8000'
    `;
    const [result] = await db.query<ResultSetHeader>(updateSaldoQuery, [total_akhir]);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Gagal otomatisasi, akun 8000 tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Sistem otomatis berhasil: PO tersimpan dan saldo Utang bertambah." 
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}