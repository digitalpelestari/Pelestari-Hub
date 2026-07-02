import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Kita enkripsi dulu password untuk akun testing kita
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 2. Kita masukkan data akun Manager Finance untuk testing divisi Keuangan
  const userFinance = await prisma.user.upsert({
    where: { email: 'finance@pedulilestari.co.id' },
    update: {},
    create: {
      name: 'Latifah',
      email: 'finance@pedulilestari.co.id',
      password: hashedPassword,
      role: 'Finance', // Sesuai dengan role di database
    },
  });

  // 3. Kita masukkan data akun Superadmin untuk akses penuh
  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin@pedulilestari.co.id' },
    update: {},
    create: {
      name: 'Superadmin',
      email: 'admin@pedulilestari.co.id',
      password: hashedPassword,
      role: 'Superadmin',
    },
  });

  console.log('Database berhasil diisi akun testing:', { userFinance, userAdmin });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });