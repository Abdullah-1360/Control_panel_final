import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDetectionAudit() {
  try {
    console.log('Testing detection audit logging...\n');
    
    // Find applications with UNKNOWN tech stack
    const unknownApps = await prisma.applications.findMany({
      where: {
        techStack: 'UNKNOWN',
      },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
    });

    console.log(`Found ${unknownApps.length} applications with UNKNOWN tech stack\n`);

    // Update detection attempts to 5 for testing
    for (const app of unknownApps) {
      await prisma.applications.update({
        where: { id: app.id },
        data: {
          detectionAttempts: 5,
          lastDetectionAttempt: new Date(),
        },
      });
      
      console.log(`✅ Updated ${app.domain} - detectionAttempts set to 5`);
    }

    console.log('\n📊 Summary:');
    console.log(`- Updated ${unknownApps.length} applications`);
    console.log(`- All set to 5 detection attempts`);
    console.log(`- Next tech stack detection will trigger audit logs`);
    
    // Show applications that will trigger audit logs
    const problematic = await prisma.applications.findMany({
      where: {
        techStack: 'UNKNOWN',
        detectionAttempts: {
          gte: 5,
        },
      },
      include: {
        servers: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    });

    console.log(`\n🚨 Problematic Applications (${problematic.length}):`);
    problematic.forEach((app, index) => {
      console.log(`${index + 1}. ${app.domain} (${app.servers.name}) - ${app.detectionAttempts} attempts`);
    });

    console.log('\n✅ Test setup complete!');
    console.log('Run discovery on these servers to trigger audit logs.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDetectionAudit();
