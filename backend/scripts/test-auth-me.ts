import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGetUserById() {
  try {
    const userId = 'b42888ee-60be-47a3-a65c-98163f6b349d'; // Admin user ID

    console.log('Testing getUserById logic...\n');

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true,
        mustChangePassword: true,
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Raw user from database:');
    console.log(JSON.stringify(user, null, 2));

    console.log('\n\nTransformed user (what should be returned):');
    const transformed = {
      ...user,
      role: user.roles,
      roles: undefined,
    };
    console.log(JSON.stringify(transformed, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGetUserById();
