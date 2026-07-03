// auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

const extendedOptions: any = {
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" }
      },
      async authorize(credentials: any) {
  try {
    console.log("===== LOGIN =====");

    const email = String(credentials?.email ?? "").trim();
    const password = String(credentials?.password ?? "");

    console.log("Email:", email);

    const [rows]: any = await db.execute(
      "SELECT * FROM tb_login WHERE LOWER(email)=LOWER(?) LIMIT 1",
      [email]
    );

    console.log("Rows:", rows);

    if (!rows.length) {
      console.log("USER TIDAK DITEMUKAN");
      return null;
    }

    const rawUser = rows[0];

    console.log("Password Hash:", rawUser.password);

    const valid = await bcrypt.compare(password, rawUser.password);

    console.log("Password Valid:", valid);

    if (!valid) {
      return null;
    }

    console.log("LOGIN BERHASIL");

    return {
      id: String(rawUser.id_user),
      name: rawUser.nama,
      email: rawUser.email,
      role: rawUser.role,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
    })
  ]
};

// @ts-ignore
const authInstance = NextAuth(extendedOptions);

export const { handlers, auth, signIn, signOut, update } = authInstance as any;