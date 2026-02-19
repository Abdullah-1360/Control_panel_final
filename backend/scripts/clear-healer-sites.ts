import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearHealerSites() {
  console.log('🗑️  Clearing all WP Healer sites...');

  try {
    // Delete all healing patterns first (foreign key constraint)
    const patternsDeleted = await prisma.healingPattern.deleteMany({});
    console.log(`✓ Deleted ${patternsDeleted.count} healing patterns`);

    // Delete all manual diagnosis sessions
    const sessionsDeleted = await prisma.manualDiagnosisSession.deleteMany({});
    console.log(`✓ Deleted ${sessionsDeleted.count} manual diagnosis sessions`);

    // Delete all healer executions
    const executionsDeleted = await prisma.healerExecution.deleteMany({});
    console.log(`✓ Deleted ${executionsDeleted.count} healer executions`);

    // Delete all WP sites
    const sitesDeleted = await prisma.wpSite.deleteMany({});
    console.log(`✓ Deleted ${sitesDeleted.count} WordPress sites`);

    console.log('\n✅ All WP Healer data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing healer sites:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearHealerSites()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
