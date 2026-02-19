import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing VIEWER permissions...\n');

  const viewerRole = await prisma.role.findUnique({
    where: { name: 'VIEWER' },
    include: { permissions: true },
  });

  if (!viewerRole) {
    console.error('❌ VIEWER role not found');
    process.exit(1);
  }

  console.log('📋 Current VIEWER permissions:');
  console.log(viewerRole.permissions.map(p => `  - ${p.resource}.${p.action}`).join('\n'));

  // Delete the wildcard permission
  console.log('\n🗑️  Removing wildcard permission (*.read)...');
  await prisma.permission.deleteMany({
    where: {
      roleId: viewerRole.id,
      resource: '*',
      action: 'read',
    },
  });

  // Add specific read-only permissions
  const viewerPermissions = [
    { resource: 'users', action: 'read' },
    { resource: 'roles', action: 'read' },
    { resource: 'sessions', action: 'read' },
    { resource: 'audit', action: 'read' },
    { resource: 'servers', action: 'read' },
    { resource: 'sites', action: 'read' },
    { resource: 'incidents', action: 'read' },
    { resource: 'settings', action: 'read' },
  ];

  console.log('\n➕ Adding specific read-only permissions...');
  for (const perm of viewerPermissions) {
    await prisma.permission.create({
      data: {
        resource: perm.resource,
        action: perm.action,
        roleId: viewerRole.id,
      },
    });
    console.log(`  ✅ Added ${perm.resource}.${perm.action}`);
  }

  const updatedViewer = await prisma.role.findUnique({
    where: { id: viewerRole.id },
    include: { permissions: true },
  });

  console.log('\n📊 Updated VIEWER permissions:');
  console.log(updatedViewer?.permissions.map(p => `  - ${p.resource}.${p.action}`).join('\n'));

  console.log('\n✅ VIEWER permissions fixed successfully!');
  console.log('\n⚠️  IMPORTANT: VIEWER users need to log out and log back in for changes to take effect!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
