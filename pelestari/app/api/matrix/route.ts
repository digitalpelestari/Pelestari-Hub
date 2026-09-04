import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteFileFromR2Action } from '@/app/actions/upload-r2';

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

// 2. POST: Simpan Data Peserta Baru (foto_url sudah berisi URL R2 dari frontend)
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

    const foto_ktp = (formData.get('foto_ktp') as string) || null;
    const foto_sim = (formData.get('foto_sim') as string) || null;
    const pas_foto = (formData.get('pas_foto') as string) || null;

    const JENIS_PELATIHAN_VALID = ['AKBB', 'ABB', 'OTHERS'] as const;
    const rawJenisPelatihan = (formData.get('jenis_pelatihan') as string) || 'AKBB';
    if (!JENIS_PELATIHAN_VALID.includes(rawJenisPelatihan as any)) {
      return NextResponse.json(
        { success: false, error: 'jenis_pelatihan harus AKBB, ABB, atau OTHERS' },
        { status: 400 }
      );
    }
    const jenis_pelatihan = rawJenisPelatihan as 'AKBB' | 'ABB' | 'OTHERS';

    if (tanggal_lahir && tanggal_lahir.includes('-')) {
      const parts = tanggal_lahir.split('-');
      if (parts[0].length === 2 && parts[2].length === 4) {
        tanggal_lahir = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const sql = `
      INSERT INTO tb_matrix (
        batch_id, nama, tempat_lahir, tanggal_lahir, nik,
        nomor_sim, jenis_sim, perusahaan, lokasi, jenis_muatan,
        foto_ktp, foto_sim, pas_foto, jenis_pelatihan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      jenis_pelatihan,
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

// 3. PATCH: Update Data Peserta (id via query ?id=)
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID peserta wajib diisi' },
        { status: 400 }
      );
    }

    const [existingRows]: any = await db.query(
      'SELECT foto_ktp, foto_sim, pas_foto FROM tb_matrix WHERE id = ?',
      [id]
    );
    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Peserta tidak ditemukan' },
        { status: 404 }
      );
    }
    const existing = existingRows[0];

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

    const newFotoKtp = (formData.get('foto_ktp') as string) || null;
    const newFotoSim = (formData.get('foto_sim') as string) || null;
    const newPasFoto = (formData.get('pas_foto') as string) || null;

    const foto_ktp = newFotoKtp || existing.foto_ktp;
    const foto_sim = newFotoSim || existing.foto_sim;
    const pas_foto = newPasFoto || existing.pas_foto;

    const JENIS_PELATIHAN_VALID = ['AKBB', 'ABB', 'OTHERS'] as const;
    const rawJenisPelatihan = (formData.get('jenis_pelatihan') as string) || 'AKBB';
    if (!JENIS_PELATIHAN_VALID.includes(rawJenisPelatihan as any)) {
      return NextResponse.json(
        { success: false, error: 'jenis_pelatihan harus AKBB, ABB, atau OTHERS' },
        { status: 400 }
      );
    }
    const jenis_pelatihan = rawJenisPelatihan as 'AKBB' | 'ABB' | 'OTHERS';

    if (tanggal_lahir && tanggal_lahir.includes('-')) {
      const parts = tanggal_lahir.split('-');
      if (parts[0].length === 2 && parts[2].length === 4) {
        tanggal_lahir = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const sql = `
      UPDATE tb_matrix SET
        batch_id = ?, nama = ?, tempat_lahir = ?, tanggal_lahir = ?, nik = ?,
        nomor_sim = ?, jenis_sim = ?, perusahaan = ?, lokasi = ?, jenis_muatan = ?,
        foto_ktp = ?, foto_sim = ?, pas_foto = ?, jenis_pelatihan = ?
      WHERE id = ?
    `;

    await db.execute(sql, [
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
      jenis_pelatihan,
      id,
    ]);

    if (newFotoKtp && existing.foto_ktp && newFotoKtp !== existing.foto_ktp) {
      await deleteFileFromR2Action(existing.foto_ktp);
    }
    if (newFotoSim && existing.foto_sim && newFotoSim !== existing.foto_sim) {
      await deleteFileFromR2Action(existing.foto_sim);
    }
    if (newPasFoto && existing.pas_foto && newPasFoto !== existing.pas_foto) {
      await deleteFileFromR2Action(existing.pas_foto);
    }

    return NextResponse.json({ success: true, message: 'Peserta berhasil diperbarui' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 4. DELETE: Hapus Peserta (id via query ?id=)
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID peserta wajib diisi' },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      'SELECT foto_ktp, foto_sim, pas_foto FROM tb_matrix WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Peserta tidak ditemukan' },
        { status: 404 }
      );
    }
    const { foto_ktp, foto_sim, pas_foto } = rows[0];

    await db.query('DELETE FROM tb_matrix WHERE id = ?', [id]);

    await deleteFileFromR2Action(foto_ktp);
    await deleteFileFromR2Action(foto_sim);
    await deleteFileFromR2Action(pas_foto);

    return NextResponse.json({ success: true, message: 'Peserta berhasil dihapus' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}