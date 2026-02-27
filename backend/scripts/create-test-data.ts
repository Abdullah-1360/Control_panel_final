/**
 * Create test data for Phase 3 testing
 * Creates mock applications for each tech stack
 */

import { PrismaClient, TechStack, DetectionMethod, HealingMode, HealthStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
  console.log('========================================');
  console.log('Creating Test Data for Phase 3');
  console.log('========================================\n');

  try {
    // Check if we have any servers
    const serverCount = await prisma.servers.count();
    
    if (serverCount === 0) {
      console.log('⚠️  No servers found in database.');
      console.log('Please create a server first through the UI or API.');
      console.log('\nExample:');
      console.log('POST /api/v1/servers');
      console.log(JSON.stringify({
        name: 'Test Server',
        host: 'localhost',
        port: 22,
        username: 'test',
        platformType: 'LINUX',
      }, null, 2));
      await prisma.$disconnect();
      return;
    }

    // Get first server
    const server = await prisma.servers.findFirst();
    if (!server) {
      console.log('No server found');
      await prisma.$disconnect();
      return;
    }

    console.log(`Using server: ${server.name} (${server.host})`);
    console.log('');

    // Create test applications for each tech stack
    const testApps = [
      {
        domain: 'nodejs-test.local',
        path: '/var/www/nodejs-app',
        techStack: TechStack.NODEJS,
        techStackVersion: '20.10.0',
        metadata: {
          packageName: 'test-nodejs-app',
          hasNodeModules: true,
        },
      },
      {
        domain: 'laravel-test.local',
        path: '/var/www/laravel-app',
        techStack: TechStack.LARAVEL,
        techStackVersion: '10.0.0',
        metadata: {
          frameworkVersion: '^10.0',
          hasArtisan: true,
        },
      },
      {
        domain: 'php-test.local',
        path: '/var/www/php-app',
        techStack: TechStack.PHP_GENERIC,
        techStackVersion: '8.2.0',
        metadata: {
          hasComposer: true,
        },
      },
      {
        domain: 'express-test.local',
        path: '/var/www/express-app',
        techStack: TechStack.EXPRESS,
        techStackVersion: '4.18.0',
        metadata: {
          packageName: 'test-express-app',
          nodeVersion: '20.10.0',
        },
      },
      {
        domain: 'nextjs-test.local',
        path: '/var/www/nextjs-app',
        techStack: TechStack.NEXTJS,
        techStackVersion: '14.0.0',
        metadata: {
          packageName: 'test-nextjs-app',
          nodeVersion: '20.10.0',
        },
      },
    ];

    console.log('Creating test applications...\n');

    for (const appData of testApps) {
      // Check if application already exists
      const existing = await prisma.applications.findFirst({
        where: {
          serverId: server.id,
          path: appData.path,
        },
      });

      if (existing) {
        console.log(`✓ ${appData.techStack} application already exists: ${appData.domain}`);
        continue;
      }

      // Create application
      const app = await prisma.applications.create({
        data: {
          serverId: server.id,
          domain: appData.domain,
          path: appData.path,
          techStack: appData.techStack,
          techStackVersion: appData.techStackVersion,
          detectionMethod: DetectionMethod.MANUAL,
          detectionConfidence: 1.0,
          metadata: appData.metadata,
          isHealerEnabled: true,
          healingMode: HealingMode.MANUAL,
          healthStatus: HealthStatus.UNKNOWN,
          healthScore: 0,
          maxHealingAttempts: 3,
          healingCooldown: 3600,
          currentHealingAttempts: 0,
        },
      });

      console.log(`✓ Created ${appData.techStack} application: ${appData.domain}`);
      console.log(`  ID: ${app.id}`);
      console.log(`  Path: ${app.path}`);
      console.log('');
    }

    console.log('========================================');
    console.log('Test Data Creation Complete');
    console.log('========================================\n');

    // List all applications
    const apps = await prisma.applications.findMany({
      where: { serverId: server.id },
      select: {
        id: true,
        domain: true,
        techStack: true,
        path: true,
      },
    });

    console.log('Available test applications:');
    apps.forEach(app => {
      console.log(`  - ${app.techStack}: ${app.domain}`);
      console.log(`    ID: ${app.id}`);
      console.log(`    Path: ${app.path}`);
      console.log('');
    });

    console.log('Next Steps:');
    console.log('1. Test diagnosis on these applications:');
    console.log('   POST /api/v1/healer/applications/{id}/diagnose');
    console.log('');
    console.log('2. View diagnostic results:');
    console.log('   GET /api/v1/healer/applications/{id}/diagnostics');
    console.log('');
    console.log('3. Test healing actions:');
    console.log('   POST /api/v1/healer/applications/{id}/heal');
    console.log('   { "actionName": "npm_install" }');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
