import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Check if any users exist
  const existingUsers = await prisma.users.count();
  if (existingUsers > 0) {
    console.log('⚠️  Database already seeded. Skipping...');
    return;
  }

  // Create system roles
  console.log('📝 Creating system roles...');
  
  const superAdminRole = await prisma.roles.create({
    data: {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      description: 'Full system access with all permissions',
      isSystem: true,
      permissions: {
        create: [
          // All permissions for SUPER_ADMIN
          { resource: '*', action: '*' },
        ],
      },
    },
  });

  const adminRole = await prisma.roles.create({
    data: {
      name: 'ADMIN',
      displayName: 'Administrator',
      description: 'Administrative access to manage users, servers, and incidents',
      isSystem: true,
      permissions: {
        create: [
          { resource: 'users', action: 'read' },
          { resource: 'users', action: 'create' },
          { resource: 'users', action: 'update' },
          { resource: 'servers', action: '*' },
          { resource: 'sites', action: '*' },
          { resource: 'incidents', action: '*' },
          { resource: 'settings', action: 'read' },
          { resource: 'settings', action: 'update' },
          { resource: 'audit', action: 'read' },
        ],
      },
    },
  });

  const engineerRole = await prisma.roles.create({
    data: {
      name: 'ENGINEER',
      displayName: 'Engineer',
      description: 'Engineering access to manage incidents and view infrastructure',
      isSystem: true,
      permissions: {
        create: [
          { resource: 'incidents', action: '*' },
          { resource: 'sites', action: 'read' },
          { resource: 'servers', action: 'read' },
          { resource: 'servers', action: 'test' },
          { resource: 'audit', action: 'read' },
        ],
      },
    },
  });

  const viewerRole = await prisma.roles.create({
    data: {
      name: 'VIEWER',
      displayName: 'Viewer',
      description: 'Read-only access to view system information',
      isSystem: true,
      permissions: {
        create: [
          { resource: '*', action: 'read' },
        ],
      },
    },
  });

  console.log('✅ System roles created\n');

  // Generate secure password for default admin
  const adminPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });

  // Create default SUPER_ADMIN user
  console.log('👤 Creating default SUPER_ADMIN user...');
  
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@opsmanager.local';
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';

  const adminUser = await prisma.users.create({
    data: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      roleId: superAdminRole.id,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  console.log('✅ Default SUPER_ADMIN user created\n');

  // Create audit log for seed operation
  await prisma.audit_logs.create({
    data: {
      actorType: 'SYSTEM',
      action: 'DATABASE_SEED',
      resource: 'SYSTEM',
      description: 'Database seeded with default roles and admin user',
      severity: 'INFO',
      metadata: {
        rolesCreated: 4,
        usersCreated: 1,
      },
    },
  });

  // Display credentials
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 Database seeded successfully!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📋 DEFAULT ADMIN CREDENTIALS:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Email:    ${adminEmail}`);
  console.log(`Username: ${adminUsername}`);
  console.log(`Password: ${adminPassword}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
  console.log('1. Save these credentials in a secure location');
  console.log('2. You MUST change the password on first login');
  console.log('3. Never commit these credentials to version control');
  console.log('4. Delete this output from your terminal history');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Summary:');
  console.log(`   - Roles created: 4 (SUPER_ADMIN, ADMIN, ENGINEER, VIEWER)`);
  console.log(`   - Users created: 1 (${adminUsername})`);
  console.log(`   - Permissions created: ${await prisma.permissions.count()}`);
  console.log('\n✨ Seed completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
