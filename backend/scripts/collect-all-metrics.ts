import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ServerMetricsService } from '../src/modules/servers/server-metrics.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function collectAllMetrics() {
  console.log('Starting metrics collection for all servers...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const metricsService = app.get(ServerMetricsService);
  const prisma = app.get(PrismaService);

  try {
    // Get all servers with metrics enabled
    const servers = await prisma.server.findMany({
      where: {
        deletedAt: null,
        metricsEnabled: true,
      },
      select: {
        id: true,
        name: true,
        host: true,
      },
    });

    console.log(`Found ${servers.length} servers with metrics enabled\n`);

    if (servers.length === 0) {
      console.log('No servers found. Please create servers first.');
      await app.close();
      return;
    }

    // Collect metrics for each server
    for (const server of servers) {
      console.log(`Collecting metrics for: ${server.name} (${server.host})...`);
      
      try {
        const metrics = await metricsService.collectMetrics(server.id);
        console.log(`✅ Success! CPU: ${metrics.cpuUsagePercent}%, RAM: ${metrics.memoryUsagePercent}%, Disk: ${metrics.diskUsagePercent}%\n`);
      } catch (error: any) {
        console.log(`❌ Failed: ${error.message}\n`);
      }
    }

    console.log('Metrics collection complete!');
    console.log('\nYou can now view metrics in the frontend:');
    console.log('1. Open http://localhost:3000');
    console.log('2. Navigate to Servers page');
    console.log('3. Metrics should appear on server cards\n');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await app.close();
  }
}

collectAllMetrics();
