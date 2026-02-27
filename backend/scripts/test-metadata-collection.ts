#!/usr/bin/env ts-node

/**
 * Test script to verify metadata collection works correctly
 * 
 * Usage:
 *   npx ts-node scripts/test-metadata-collection.ts <applicationId>
 * 
 * This script:
 * 1. Fetches an application by ID
 * 2. Triggers metadata collection
 * 3. Displays the collected metadata
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMetadataCollection(applicationId: string) {
  console.log(`\n🔍 Testing metadata collection for application: ${applicationId}\n`);

  try {
    // Fetch application before metadata collection
    const appBefore = await prisma.applications.findUnique({
      where: { id: applicationId },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    if (!appBefore) {
      console.error(`❌ Application ${applicationId} not found`);
      process.exit(1);
    }

    console.log('📋 Application BEFORE metadata collection:');
    console.log('  Domain:', appBefore.domain);
    console.log('  Path:', appBefore.path);
    console.log('  Tech Stack:', appBefore.techStack);
    console.log('  Version:', appBefore.techStackVersion || 'Not detected');
    console.log('  Metadata:', JSON.stringify(appBefore.metadata, null, 2));
    console.log('');

    // Trigger metadata collection by calling the API endpoint
    console.log('🔄 Triggering metadata collection...\n');
    
    // Import the application service
    const { ApplicationService } = await import('../src/modules/healer/services/application.service');
    const { TechStackDetectorService } = await import('../src/modules/healer/services/tech-stack-detector.service');
    const { PluginRegistryService } = await import('../src/modules/healer/services/plugin-registry.service');
    const { SSHExecutorService } = await import('../src/modules/healer/services/ssh-executor.service');
    const { EncryptionService } = await import('../src/modules/encryption/encryption.service');
    
    // Create service instances
    const encryptionService = new EncryptionService();
    const sshExecutor = new SSHExecutorService(prisma, encryptionService);
    const techStackDetector = new TechStackDetectorService();
    const pluginRegistry = new PluginRegistryService();
    const applicationService = new ApplicationService(
      prisma,
      techStackDetector,
      pluginRegistry,
      sshExecutor,
    );

    // Call collectDetailedMetadata
    await applicationService.collectDetailedMetadata(applicationId);

    // Fetch application after metadata collection
    const appAfter = await prisma.applications.findUnique({
      where: { id: applicationId },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    if (!appAfter) {
      console.error(`❌ Application ${applicationId} not found after collection`);
      process.exit(1);
    }

    console.log('✅ Metadata collection completed!\n');
    console.log('📋 Application AFTER metadata collection:');
    console.log('  Domain:', appAfter.domain);
    console.log('  Path:', appAfter.path);
    console.log('  Tech Stack:', appAfter.techStack);
    console.log('  Version:', appAfter.techStackVersion || 'Not detected');
    console.log('  Detection Confidence:', appAfter.detectionConfidence);
    console.log('');
    console.log('  Metadata:');
    const metadata = appAfter.metadata as any;
    if (metadata) {
      console.log('    PHP Version:', metadata.phpVersion || 'N/A');
      console.log('    DB Name:', metadata.dbName || 'N/A');
      console.log('    DB Host:', metadata.dbHost || 'N/A');
      console.log('    Domain Type:', metadata.domainType || 'N/A');
      console.log('    cPanel Username:', metadata.cPanelUsername || 'N/A');
      console.log('    Available Subdomains:', metadata.availableSubdomains?.length || 0);
      
      if (metadata.availableSubdomains && metadata.availableSubdomains.length > 0) {
        console.log('');
        console.log('  🌐 Related Domains:');
        for (const subdomain of metadata.availableSubdomains) {
          console.log(`    - ${subdomain.domain} (${subdomain.type})`);
          console.log(`      Path: ${subdomain.path}`);
        }
      }
    }
    console.log('');

    // Show changes
    console.log('📊 Changes:');
    if (appBefore.techStack !== appAfter.techStack) {
      console.log(`  ✓ Tech Stack: ${appBefore.techStack} → ${appAfter.techStack}`);
    }
    if (appBefore.domain !== appAfter.domain) {
      console.log(`  ✓ Domain: ${appBefore.domain} → ${appAfter.domain}`);
    }
    if (appBefore.techStackVersion !== appAfter.techStackVersion) {
      console.log(`  ✓ Version: ${appBefore.techStackVersion || 'None'} → ${appAfter.techStackVersion || 'None'}`);
    }
    
    const metadataBefore = appBefore.metadata as any;
    const metadataAfter = appAfter.metadata as any;
    
    if (!metadataBefore?.domainType && metadataAfter?.domainType) {
      console.log(`  ✓ Domain Type: Detected as ${metadataAfter.domainType}`);
    }
    if (!metadataBefore?.cPanelUsername && metadataAfter?.cPanelUsername) {
      console.log(`  ✓ cPanel Username: Detected as ${metadataAfter.cPanelUsername}`);
    }
    if (metadataAfter?.availableSubdomains?.length > 0) {
      console.log(`  ✓ Subdomains: Found ${metadataAfter.availableSubdomains.length} related domains`);
    }

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get application ID from command line
const applicationId = process.argv[2];

if (!applicationId) {
  console.error('Usage: npx ts-node scripts/test-metadata-collection.ts <applicationId>');
  process.exit(1);
}

testMetadataCollection(applicationId);
