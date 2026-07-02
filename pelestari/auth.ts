// auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config"; // Import config ramah Edge

const extendedOptions: any = {
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password wajib diisi");
        }
        
        const [rows]: any = await (db as any).execute(
          "SELECT * FROM tb_login WHERE email = ? LIMIT 1",
          [credentials.email]
        );
        const user = rows[0];
        
        // ========================================================
        // 🔍 SUNTIKAN BARIS DEBUG UNTUK VERCEL LOGS
        // ========================================================
        console.log("=== 🔍 DEBUG LOGIN VERCEL PRODUCTION ===");
        console.log("1. User ketemu di DB?:", !!user);
        console.log("2. Email yang diinput:", credentials.email);
        console.log("3. String Hash dari DB:", user?.password);
        console.log("4. Panjang karakter Hash DB:", user?.password?.length);
        // ========================================================
        
        if (!user) {
          throw new Error("Email tidak terdaftar");
        }
        
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string, 
          user.password
        );
        
        // Log hasil akhir kecocokan password sebelum dipotong NextAuth
        console.log("5. Hasil Match Bcrypt:", isPasswordValid);
        console.log("=========================================");
        
        if (!isPasswordValid) {
          throw new Error("Password salah");
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