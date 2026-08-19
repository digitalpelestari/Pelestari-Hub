import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [sppdRows]: any = await db.execute(`
      SELECT s.nomor, s.manager_nip, s.keperluan, s.tujuan, s.tempat, s.start_date, s.end_date, s.created_at, s.updated_at,
             k.nama as manager_nama, k.divisi as manager_divisi
      FROM tb_sppd s
      LEFT JOIN tb_karyawan k ON s.manager_nip = k.nip
      ORDER BY s.created_at DESC
    `);

    const result = await Promise.all(
      sppdRows.map(async (sppd: any) => {
        const [anggotaRows]: any = await db.execute(`
          SELECT sk.nip, k.nama, k.divisi
          FROM tb_sppd_karyawan sk
          JOIN tb_karyawan k ON sk.nip = k.nip
          WHERE sk.nomor_sppd = ?
          ORDER BY k.nama ASC
        `, [sppd.nomor]);

        return {
          ...sppd,
          anggota: anggotaRows,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { nomor, manager_nip, keperluan, tujuan, tempat, start_date, end_date, karyawan } = body;

    if (!nomor || !manager_nip || !keperluan || !tujuan || !tempat || !start_date || !end_date) {
      return NextResponse.json(
        { message: "Semua field utama wajib diisi" },
        { status: 400 }
      );
    }

    if (!Array.isArray(karyawan) || karyawan.length === 0) {
      return NextResponse.json(
        { message: "Pilih minimal satu karyawan" },
        { status: 400 }
      );
    }

    if (end_date < start_date) {
      return NextResponse.json(
        { message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" },
        { status: 400 }
      );
    }

    const [existing]: any = await db.execute(
      "SELECT nomor FROM tb_sppd WHERE nomor = ?",
      [nomor]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { message: "Nomor SPPD sudah ada" },
        { status: 409 }
      );
    }

    await db.execute(
      "INSERT INTO tb_sppd (nomor, manager_nip, keperluan, tujuan, tempat, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nomor, manager_nip, keperluan, tujuan, tempat, start_date, end_date]
    );

    const insertPivotPromises = karyawan.map((nip: string) =>
      db.execute(
        "INSERT IGNORE INTO tb_sppd_karyawan (nomor_sppd, nip) VALUES (?, ?)",
        [nomor, nip]
      )
    );

    await Promise.all(insertPivotPromises);

    return NextResponse.json(
      { success: true, message: "SPPD berhasil dibuat", nomor },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
