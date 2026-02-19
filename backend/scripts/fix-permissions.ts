import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing role permissions...\n');

  // Get all roles
  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
    include: { permissions: true },
  });

  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
    include: { permissions: true },
  });

  const engineerRole = await prisma.role.findUnique({
    where: { name: 'ENGINEER' },
    include: { permissions: true },
  });

  const viewerRole = await prisma.role.findUnique({
    where: { name: 'VIEWER' },
    include: { permissions: true },
  });

  if (!superAdminRole || !adminRole || !engineerRole || !viewerRole) {
    console.error('❌ Roles not found');
    process.exit(1);
  }

  console.log('📋 Current permissions:');
  console.log(`SUPER_ADMIN: ${superAdminRole.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}`);
  console.log(`ADMIN: ${adminRole.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}`);
  console.log(`ENGINEER: ${engineerRole.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}`);
  console.log(`VIEWER: ${viewerRole.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}\n`);

  // SUPER_ADMIN already has *.* so it's fine

  // Fix ADMIN permissions - add missing permissions
  const adminMissingPermissions = [
    { resource: 'roles', action: 'read' },
    { resource: 'sessions', action: 'read' },
    { resource: 'users', action: 'delete' }, // ADMIN should be able to delete users
  ];

  console.log('➕ Adding missing ADMIN permissions...');
  for (const perm of adminMissingPermissions) {
    const exists = adminRole.permissions.some(
      p => p.resource === perm.resource && p.action === perm.action
    );
    
    if (!exists) {
      await prisma.permission.create({
        data: {
          resource: perm.resource,
          action: perm.action,
          roleId: adminRole.id,
        },
      });
      console.log(`  ✅ Added ${perm.resource}.${perm.action}`);
    } else {
      console.log(`  ⏭️  ${perm.resource}.${perm.action} already exists`);
    }
  }

  // Fix ENGINEER permissions - add missing permissions
  const engineerMissingPermissions = [
    { resource: 'roles', action: 'read' },
    { resource: 'sessions', action: 'read' },
  ];

  console.log('\n➕ Adding missing ENGINEER permissions...');
  for (const perm of engineerMissingPermissions) {
    const exists = engineerRole.permissions.some(
      p => p.resource === perm.resource && p.action === perm.action
    );
    
    if (!exists) {
      await prisma.permission.create({
        data: {
          resource: perm.resource,
          action: perm.action,
          roleId: engineerRole.id,
        },
      });
      console.log(`  ✅ Added ${perm.resource}.${perm.action}`);
    } else {
      console.log(`  ⏭️  ${perm.resource}.${perm.action} already exists`);
    }
  }

  // VIEWER already has *.read which covers everything

  console.log('\n📊 Updated permissions:');
  
  const updatedAdmin = await prisma.role.findUnique({
    where: { id: adminRole.id },
    include: { permissions: true },
  });
  
  const updatedEngineer = await prisma.role.findUnique({
    where: { id: engineerRole.id },
    include: { permissions: true },
  });

  console.log(`ADMIN: ${updatedAdmin?.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}`);
  console.log(`ENGINEER: ${updatedEngineer?.permissions.map(p => `${p.resource}.${p.action}`).join(', ')}`);

  console.log('\n✅ Permissions fixed successfully!');
  console.log('\n⚠️  IMPORTANT: Users need to log out and log back in for changes to take effect!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
