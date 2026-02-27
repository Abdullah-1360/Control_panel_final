#!/usr/bin/env ts-node

/**
 * Update existing applications with PHP_GENERIC to UNKNOWN
 * This script should be run after the UNKNOWN enum migration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting tech stack update...');
  
  // Find all applications with PHP_GENERIC and low confidence
  const phpGenericApps = await prisma.applications.findMany({
    where: {
      techStack: 'PHP_GENERIC',
      detectionConfidence: {
        lt: 0.8, // Less than 80% confidence
      },
    },
  });
  
  console.log(`Found ${phpGenericApps.length} applications with PHP_GENERIC (low confidence)`);
  
  if (phpGenericApps.length === 0) {
    console.log('No applications to update');
    return;
  }
  
  // Update to UNKNOWN
  const result = await prisma.applications.updateMany({
    where: {
      techStack: 'PHP_GENERIC',
      detectionConfidence: {
        lt: 0.8,
      },
    },
    data: {
      techStack: 'UNKNOWN',
      detectionConfidence: 0.0,
    },
  });
  
  console.log(`Updated ${result.count} applications to UNKNOWN`);
  
  // Show summary
  const summary = await prisma.applications.groupBy({
    by: ['techStack'],
    _count: true,
  });
  
  console.log('\nTech Stack Summary:');
  summary.forEach(item => {
    console.log(`  ${item.techStack}: ${item._count}`);
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
