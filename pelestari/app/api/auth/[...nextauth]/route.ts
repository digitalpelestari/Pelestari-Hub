import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password wajib diisi");
        }

        const [rows]: any = await db.execute(
          "SELECT * FROM tb_login WHERE email = ? LIMIT 1",
          [credentials.email]
        );

        const user = rows[0];

        if (!user) {
          throw new Error("Email tidak terdaftar");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

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
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Jalur saat pertama kali login sukses
      if (user) {
        // Mengubah user menjadi (user as any) agar properti 'role' diizinkan oleh TypeScript
        const customUser = user as any; 
        
        token.id = customUser.id;
        token.role = customUser.role;
        token.name = customUser.name;
        token.email = customUser.email;
      }
      
      // KUNCI SINKRONISASI FE: Jika dipicu oleh fungsi update() di Front-End
      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
        token.email = session.user.email;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Mengubah session.user menjadi any sementara agar pengisian properti 'role' tidak error
        (session.user as any).role = token.role;
        session.user.name = token.name;
        session.user.email = token.email;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };