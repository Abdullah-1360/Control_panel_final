import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const newPassword = 'Admin@123456';
  
  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.update({
    where: { email: 'admin@opsmanager.local' },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  console.log('✅ Admin password reset successfully');
  console.log('Email:', user.email);
  console.log('Password:', newPassword);
}

resetAdminPassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
