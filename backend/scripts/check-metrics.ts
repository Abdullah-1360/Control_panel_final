import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetrics() {
  const metrics = await prisma.serverMetrics.findMany({
    orderBy: { collectedAt: 'desc' },
    take: 10,
    include: {
      server: {
        select: { name: true }
      }
    }
  });

  console.log('\n=== Latest Metrics ===\n');
  metrics.forEach((m) => {
    console.log(`Server: ${m.server.name}`);
    console.log(`  Disk Total: ${m.diskTotalGB} GB`);
    console.log(`  Disk Used: ${m.diskUsedGB} GB`);
    console.log(`  Disk Usage: ${m.diskUsagePercent}%`);
    console.log(`  Collected: ${m.collectedAt}`);
    console.log(`  Success: ${m.collectionSuccess}`);
    console.log('---');
  });

  await prisma.$disconnect();
}

checkMetrics().catch(console.error);
