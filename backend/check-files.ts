import { PrismaClient } from '@prisma/client';
import { SSHExecutorService } from './src/modules/healer/services/ssh-executor.service';
import { Injectable } from '@nestjs/common';

const prisma = new PrismaClient();

async function main() {
  const app = await prisma.applications.findUnique({
    where: { id: '65fd8fcc-8205-45a7-af15-45cf9071e453' },
    include: { servers: true },
  });
  
  if (!app) {
    console.log('Application not found');
    return;
  }
  
  console.log(`Checking path: ${app.path}`);
  console.log(`Server: ${app.servers.host}`);
  
  // Check what files exist
  const sshExecutor = new SSHExecutorService(prisma);
  
  try {
    const lsResult = await sshExecutor.executeCommand(app.serverId, `ls -la ${app.path} | head -20`);
    console.log('\nFiles in directory:');
    console.log(lsResult);
    
    // Check for WordPress
    const wpCheck = await sshExecutor.executeCommand(app.serverId, `[ -e "${app.path}/wp-config.php" ] && echo "found" || echo "not found"`);
    console.log(`\nWordPress check: ${wpCheck.trim()}`);
    
    // Check for package.json
    const nodeCheck = await sshExecutor.executeCommand(app.serverId, `[ -e "${app.path}/package.json" ] && echo "found" || echo "not found"`);
    console.log(`Node.js check: ${nodeCheck.trim()}`);
    
    // Check for index.php
    const phpCheck = await sshExecutor.executeCommand(app.serverId, `[ -e "${app.path}/index.php" ] && echo "found" || echo "not found"`);
    console.log(`PHP check: ${phpCheck.trim()}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
