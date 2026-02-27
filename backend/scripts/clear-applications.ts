/**
 * Clear all applications from the database
 * Useful for testing discovery functionality
 * 
 * Run with: npm run clear-applications
 * Or: npx tsx backend/scripts/clear-applications.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearApplications() {
  console.log('Clearing all applications...');

  try {
    // Delete all diagnostic results first (foreign key constraint)
    const diagnosticsDeleted = await prisma.diagnostic_results.deleteMany({});
    console.log(`Deleted ${diagnosticsDeleted.count} diagnostic results`);

    // Delete all applications
    const appsDeleted = await prisma.applications.deleteMany({});
    console.log(`Deleted ${appsDeleted.count} applications`);

    console.log('✅ All applications cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing applications:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearApplications();
