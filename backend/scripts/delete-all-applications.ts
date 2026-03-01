import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllApplications() {
  try {
    console.log('Deleting all applications...');
    
    // Delete all diagnostic results first (foreign key constraint)
    const diagnosticsDeleted = await prisma.diagnostic_results.deleteMany({});
    console.log(`Deleted ${diagnosticsDeleted.count} diagnostic results`);
    
    // Delete all applications
    const applicationsDeleted = await prisma.applications.deleteMany({});
    console.log(`Deleted ${applicationsDeleted.count} applications`);
    
    console.log('✅ All applications deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting applications:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllApplications();
