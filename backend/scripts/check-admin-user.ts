import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('Checking admin users...\n');

    // Find all users with admin-like emails or usernames
    const users = await prisma.users.findMany({
      where: {
        OR: [
          { email: { contains: 'opsmanager.local' } },
          { username: 'admin' },
          { username: 'system' },
        ],
      },
      include: {
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    console.log(`Found ${users.length} users:\n`);

    for (const user of users) {
      console.log('---');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Username: ${user.username}`);
      console.log(`Role ID: ${user.roleId}`);
      console.log(`Role: ${user.roles ? `${user.roles.name} (${user.roles.displayName})` : 'NO ROLE FOUND'}`);
      console.log(`Active: ${user.isActive}`);
      console.log(`Locked: ${user.isLocked}`);
      console.log(`Created: ${user.createdAt}`);
      console.log('');
    }

    // Check all roles
    console.log('\nAll roles in database:');
    const roles = await prisma.roles.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
      },
    });

    for (const role of roles) {
      console.log(`- ${role.name} (${role.displayName}) [ID: ${role.id}]`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();
