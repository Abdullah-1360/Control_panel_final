import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearServers() {
  console.log('🗑️  Clearing all servers and related data...\n');

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete server metrics
    const metricsCount = await prisma.serverMetrics.deleteMany({});
    console.log(`✅ Deleted ${metricsCount.count} server metrics records`);

    // 2. Delete server test history
    const testHistoryCount = await prisma.serverTestHistory.deleteMany({});
    console.log(`✅ Deleted ${testHistoryCount.count} server test history records`);

    // 3. Delete integrations (they reference servers)
    const integrationsCount = await prisma.integration.deleteMany({});
    console.log(`✅ Deleted ${integrationsCount.count} integrations`);

    // 4. Delete servers
    const serversCount = await prisma.server.deleteMany({});
    console.log(`✅ Deleted ${serversCount.count} servers`);

    console.log('\n✨ All servers and related data cleared successfully!');
    console.log('\n📝 Note: You may want to restart the backend to clear Redis job queues.');
  } catch (error) {
    console.error('❌ Error clearing servers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearServers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
