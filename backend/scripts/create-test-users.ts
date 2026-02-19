import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Creating test users...\n');

  // Get roles
  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  });

  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  const engineerRole = await prisma.role.findUnique({
    where: { name: 'ENGINEER' },
  });

  const viewerRole = await prisma.role.findUnique({
    where: { name: 'VIEWER' },
  });

  if (!superAdminRole || !adminRole || !engineerRole || !viewerRole) {
    console.error('❌ Roles not found. Please run seed first.');
    process.exit(1);
  }

  // Simple password for testing: "Password123!"
  const testPassword = 'Password123!';
  const passwordHash = await argon2.hash(testPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Update existing admin user password
  const existingAdmin = await prisma.user.findFirst({
    where: { role: { name: 'SUPER_ADMIN' } },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
    console.log('✅ Updated SUPER_ADMIN password');
  }

  // Create test users (skip if they already exist)
  const testUsers = [
    {
      email: 'admin@test.com',
      username: 'testadmin',
      firstName: 'Test',
      lastName: 'Admin',
      roleId: adminRole.id,
    },
    {
      email: 'engineer@test.com',
      username: 'testengineer',
      firstName: 'Test',
      lastName: 'Engineer',
      roleId: engineerRole.id,
    },
    {
      email: 'viewer@test.com',
      username: 'testviewer',
      firstName: 'Test',
      lastName: 'Viewer',
      roleId: viewerRole.id,
    },
  ];

  for (const userData of testUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          ...userData,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });
      console.log(`✅ Created user: ${userData.email}`);
    } else {
      console.log(`⚠️  User already exists: ${userData.email}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎉 Test users created successfully!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📋 TEST CREDENTIALS:');
  console.log('─────────────────────────────────────────────────────────');
  console.log('SUPER_ADMIN:');
  console.log(`  Email:    admin@opsmanager.local`);
  console.log(`  Password: ${testPassword}`);
  console.log('');
  console.log('ADMIN:');
  console.log(`  Email:    admin@test.com`);
  console.log(`  Password: ${testPassword}`);
  console.log('');
  console.log('ENGINEER:');
  console.log(`  Email:    engineer@test.com`);
  console.log(`  Password: ${testPassword}`);
  console.log('');
  console.log('VIEWER:');
  console.log(`  Email:    viewer@test.com`);
  console.log(`  Password: ${testPassword}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log('\n⚠️  IMPORTANT:');
  console.log('These are TEST credentials only!');
  console.log('DO NOT use these in production!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
