#!/usr/bin/env ts-node

/**
 * One-time script to trigger diagnosis for existing WordPress sites with multiple domains
 * Run this after deploying the auto-diagnosis fix
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosisQueueService } from '../modules/healer/services/diagnosis-queue.service';
import { DiagnosisProfile } from '@prisma/client';

async function bootstrap() {
  console.log('🚀 Starting diagnosis trigger for existing WordPress sites...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const diagnosisQueue = app.get(DiagnosisQueueService);

  try {
    // Find all WordPress applications with subdomains
    const wpApps = await prisma.applications.findMany({
      where: {
        techStack: 'WORDPRESS',
      },
      select: {
        id: true,
        domain: true,
        metadata: true,
        healthScore: true,
        lastHealthCheck: true,
      },
    });

    console.log(`Found ${wpApps.length} WordPress applications\n`);

    let triggered = 0;
    let skipped = 0;

    for (const app of wpApps) {
      const metadata = app.metadata as any;
      const subdomains = metadata?.availableSubdomains || [];
      const totalDomains = 1 + subdomains.length;

      console.log(`\n📋 ${app.domain}:`);
      console.log(`   - Total domains: ${totalDomains} (1 main + ${subdomains.length} subdomains)`);
      console.log(`   - Current health score: ${app.healthScore || 0}`);
      console.log(`   - Last diagnosed: ${app.lastHealthCheck || 'Never'}`);

      // Only trigger if:
      // 1. Has multiple domains (2+)
      // 2. Never diagnosed OR health score is 0
      if (totalDomains >= 2 && (!app.lastHealthCheck || app.healthScore === 0)) {
        console.log(`   ✅ Triggering diagnosis for all ${totalDomains} domains...`);

        try {
          const result = await diagnosisQueue.enqueueDiagnosisForAllDomains(
            app.id,
            DiagnosisProfile.FULL,
            'SYSTEM',
          );

          console.log(`   ✅ Enqueued: ${result.batchId} (${result.totalDomains} jobs)`);
          triggered++;
        } catch (error: any) {
          console.error(`   ❌ Failed: ${error.message}`);
        }
      } else {
        if (totalDomains < 2) {
          console.log(`   ⏭️  Skipped: Only 1 domain (no subdomains)`);
        } else {
          console.log(`   ⏭️  Skipped: Already diagnosed (health score: ${app.healthScore})`);
        }
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   - Total WordPress sites: ${wpApps.length}`);
    console.log(`   - Diagnosis triggered: ${triggered}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log('\n✅ Script completed successfully!\n');

    // Get queue stats
    const stats = await diagnosisQueue.getQueueStats();
    console.log('📈 Diagnosis Queue Stats:');
    console.log(`   - Waiting: ${stats.waiting}`);
    console.log(`   - Active: ${stats.active}`);
    console.log(`   - Completed: ${stats.completed}`);
    console.log(`   - Failed: ${stats.failed}`);
    console.log('\n💡 Tip: Monitor queue progress with:');
    console.log('   GET /api/v1/healer/applications/diagnosis-queue/stats\n');

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
