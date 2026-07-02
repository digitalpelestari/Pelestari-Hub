import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "@/lib/db";
import bcrypt from "bcrypt";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { nama, email, passwordBaru } = await req.json();

    if (!nama || !email) {
      return NextResponse.json({ message: "Nama dan Email wajib diisi" }, { status: 400 });
    }

    const [currentUserRows]: any = await db.execute(
      "SELECT id_user FROM tb_login WHERE email = ? LIMIT 1",
      [session.user.email]
    );
    const idUser = currentUserRows[0]?.id_user;

    if (!idUser) {
      return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    }

    const [emailCheckRows]: any = await db.execute(
      "SELECT id_user FROM tb_login WHERE email = ? AND id_user != ? LIMIT 1",
      [email, idUser]
    );
    if (emailCheckRows.length > 0) {
      return NextResponse.json({ message: "Email sudah digunakan oleh pengguna lain" }, { status: 400 });
    }

    if (passwordBaru && passwordBaru.trim() !== "") {
      const hashedPassword = await bcrypt.hash(passwordBaru, 10);
      await db.execute(
        "UPDATE tb_login SET nama = ?, email = ?, password = ? WHERE id_user = ?",
        [nama, email, hashedPassword, idUser]
      );
    } else {
      await db.execute(
        "UPDATE tb_login SET nama = ?, email = ? WHERE id_user = ?",
        [nama, email, idUser]
      );
    }

    return NextResponse.json({ status: "Sukses", message: "Pengaturan akun berhasil diperbarui!" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}