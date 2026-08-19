import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await db.execute(
      "SELECT nip, nama, divisi, jabatan FROM tb_karyawan ORDER BY nama ASC"
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
