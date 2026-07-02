import { defineConfig } from '@prisma/config'; // atau library config prisma yang kamu pakai

export default defineConfig({
migrations: {
  // Ganti menjadi tsx
  seed: 'npx tsx ./prisma/seed.ts',
},
  datasource: {
    // Biarkan ini sesuai bawaan project kamu (biasanya mengambil dari env)
    url: process.env.DATABASE_URL, 
  },
});