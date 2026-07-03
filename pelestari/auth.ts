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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password wajib diisi");
        }
        
        // Ambil data berdasarkan email (gunakan LOWER untuk cari aman)
        const [rows]: any = await (db as any).execute(
          "SELECT * FROM tb_login WHERE LOWER(email) = LOWER(?) LIMIT 1",
          [credentials.email]
        );
        
        const rawUser = rows[0];
        if (!rawUser) {
          throw new Error("Email tidak terdaftar");
        }

        // Koreksi Case-Insensitive: Memastikan properti terbaca baik huruf besar maupun kecil dari DB
        const user = {
          id_user: rawUser.id_user || rawUser.ID_USER,
          nama: rawUser.nama || rawUser.NAMA,
          email: rawUser.email || rawUser.EMAIL,
          password: rawUser.password || rawUser.PASSWORD,
          role: rawUser.role || rawUser.ROLE
        };
        
        // Validasi Bcrypt menggunakan data yang sudah dikoreksi
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string, 
          user.password
        );
        
        if (!isPasswordValid) {
  console.log("PASSWORD TIDAK MATCH DI SERVER VERCEL");
  return null; // <-- WAJIB null, jangan throw error
}

return {
  id: String(user.id_user),
  name: user.nama,
  email: user.email,
  role: user.role,
};
      }
    })
  ]
};

// @ts-ignore
const authInstance = NextAuth(extendedOptions);

export const { handlers, auth, signIn, signOut, update } = authInstance as any;