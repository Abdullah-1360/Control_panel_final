import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearHealerData() {
  console.log('🧹 Clearing all WP Healer data...\n');

  try {
    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete manual diagnosis sessions
    const sessions = await prisma.manualDiagnosisSession.deleteMany({});
    console.log(`✅ Deleted ${sessions.count} manual diagnosis sessions`);

    // 2. Delete healer executions
    const executions = await prisma.healerExecution.deleteMany({});
    console.log(`✅ Deleted ${executions.count} healer executions`);

    // 3. Delete healing patterns
    const patterns = await prisma.healingPattern.deleteMany({});
    console.log(`✅ Deleted ${patterns.count} healing patterns`);

    // 4. Delete WordPress sites
    const sites = await prisma.wpSite.deleteMany({});
    console.log(`✅ Deleted ${sites.count} WordPress sites`);

    console.log('\n✨ All WP Healer data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing healer data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearHealerData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
