#!/usr/bin/env ts-node

/**
 * Get the first application ID for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getFirstApplication() {
  try {
    const app = await prisma.applications.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        servers: {
          select: {
            name: true,
            host: true,
          },
        },
      },
    });

    if (!app) {
      console.log('No applications found. Run discovery first.');
      process.exit(1);
    }

    console.log('\n📋 First Application:');
    console.log('  ID:', app.id);
    console.log('  Domain:', app.domain);
    console.log('  Path:', app.path);
    console.log('  Tech Stack:', app.techStack);
    console.log('  Server:', app.servers.name, `(${app.servers.host})`);
    console.log('');
    console.log('To test metadata collection, run:');
    console.log(`  npx ts-node scripts/test-metadata-collection.ts ${app.id}`);
    console.log('');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

getFirstApplication();
