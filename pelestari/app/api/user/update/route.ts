import { NextResponse } from "next/server";
import { auth } from "@/auth"; // Ambil fungsi auth dari file konfigurasi baru
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  try {
    // Panggil langsung fungsi auth() bawaan v5
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { nama, email, passwordBaru } = await req.json();
    const userId = (session.user as any).id;

    if (!nama || !email) {
      return NextResponse.json({ message: "Nama dan Email wajib diisi" }, { status: 400 });
    }

    if (passwordBaru) {
      const hashedPassword = await bcrypt.hash(passwordBaru, 10);
      await (db as any).execute(
        "UPDATE tb_login SET nama = ?, email = ?, password = ? WHERE id_user = ?",
        [nama, email, hashedPassword, userId]
      );
    } else {
      await (db as any).execute(
        "UPDATE tb_login SET nama = ?, email = ? WHERE id_user = ?",
        [nama, email, userId]
      );
    }

    return NextResponse.json({ message: "Profil berhasil diperbarui!" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}