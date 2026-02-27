import { PrismaClient } from '@prisma/client';
import { NodeJsPlugin } from '../src/modules/healer/plugins/nodejs.plugin';
import { LaravelPlugin } from '../src/modules/healer/plugins/laravel.plugin';
import { PhpGenericPlugin } from '../src/modules/healer/plugins/php-generic.plugin';
import { ExpressPlugin } from '../src/modules/healer/plugins/express.plugin';
import { NextJsPlugin } from '../src/modules/healer/plugins/nextjs.plugin';
import { SSHExecutorService } from '../src/modules/healer/services/ssh-executor.service';

const prisma = new PrismaClient();

async function testPluginSystem() {
  console.log('========================================');
  console.log('Universal Healer Plugin System Test');
  console.log('Phase 3 - Real Implementation Testing');
  console.log('========================================\n');

  // Initialize SSH executor (mock for now)
  const sshExecutor = new SSHExecutorService(prisma);

  // Initialize plugins
  const plugins = {
    nodejs: new NodeJsPlugin(sshExecutor),
    laravel: new LaravelPlugin(sshExecutor),
    phpGeneric: new PhpGenericPlugin(sshExecutor),
    express: new ExpressPlugin(sshExecutor),
    nextjs: new NextJsPlugin(sshExecutor),
  };

  console.log('✓ Plugins initialized\n');

  // Test 1: Plugin Metadata
  console.log('Test 1: Plugin Metadata');
  console.log('------------------------');
  for (const [name, plugin] of Object.entries(plugins)) {
    console.log(`${name}:`);
    console.log(`  Name: ${plugin.name}`);
    console.log(`  Version: ${plugin.version}`);
    console.log(`  Supported Versions: ${plugin.supportedVersions.join(', ')}`);
    console.log(`  Diagnostic Checks: ${plugin.getDiagnosticChecks().length}`);
    console.log(`  Healing Actions: ${plugin.getHealingActions().length}`);
    console.log('');
  }

  // Test 2: Diagnostic Checks
  console.log('Test 2: Diagnostic Checks');
  console.log('-------------------------');
  for (const [name, plugin] of Object.entries(plugins)) {
    const checks = plugin.getDiagnosticChecks();
    console.log(`${name}: ${checks.join(', ')}`);
  }
  console.log('');

  // Test 3: Healing Actions
  console.log('Test 3: Healing Actions');
  console.log('-----------------------');
  for (const [name, plugin] of Object.entries(plugins)) {
    const actions = plugin.getHealingActions();
    console.log(`${name}:`);
    actions.forEach(action => {
      console.log(`  - ${action.name}: ${action.description} (${action.riskLevel} risk)`);
    });
    console.log('');
  }

  // Test 4: Check if we have any test servers
  console.log('Test 4: Database Check');
  console.log('----------------------');
  const serverCount = await prisma.servers.count();
  const appCount = await prisma.applications.count();
  console.log(`Servers in database: ${serverCount}`);
  console.log(`Applications in database: ${appCount}`);
  console.log('');

  if (serverCount === 0) {
    console.log('⚠️  No servers found. You need to:');
    console.log('   1. Add a server via the UI or API');
    console.log('   2. Run discovery to find applications');
    console.log('   3. Run diagnosis to test the plugins');
  } else {
    console.log('✓ Servers found. Ready for testing!');
    
    // List servers
    const servers = await prisma.servers.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        host: true,
        platformType: true,
      },
    });
    
    console.log('\nAvailable servers:');
    servers.forEach(server => {
      console.log(`  - ${server.name} (${server.host}) - ${server.platformType}`);
      console.log(`    ID: ${server.id}`);
    });
  }

  console.log('\n========================================');
  console.log('Plugin System Test Complete');
  console.log('========================================');
  console.log('\nNext Steps:');
  console.log('1. If you have servers, test discovery:');
  console.log('   POST /api/v1/healer/applications/discover');
  console.log('   { "serverId": "your-server-id", "paths": ["/var/www"] }');
  console.log('');
  console.log('2. After discovery, test diagnosis:');
  console.log('   POST /api/v1/healer/applications/{id}/diagnose');
  console.log('');
  console.log('3. After diagnosis, test healing:');
  console.log('   POST /api/v1/healer/applications/{id}/heal');
  console.log('   { "actionName": "npm_install" }');

  await prisma.$disconnect();
}

testPluginSystem().catch(console.error);
