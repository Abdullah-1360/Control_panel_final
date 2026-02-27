import { PrismaClient } from '@prisma/client';
import { SSHExecutorService } from './src/modules/healer/services/ssh-executor.service';
import { EncryptionService } from './src/modules/encryption/encryption.service';

const prisma = new PrismaClient();
const encryptionService = new EncryptionService();
const sshExecutor = new SSHExecutorService(
  null as any,
  encryptionService,
  prisma
);

async function main() {
  const app = await prisma.applications.findFirst({
    where: { domain: { contains: 'zarwatech' } },
  });
  
  if (!app) {
    console.log('Application not found');
    return;
  }
  
  console.log('Listing files in:', app.path);
  
  try {
    const result = await sshExecutor.executeCommand(
      app.serverId,
      `ls -la ${app.path} | head -30`
    );
    console.log('\nDirectory contents:');
    console.log(result);
    
    // Check for WordPress in subdomain
    const subdomainPath = `${app.path}/dpexglobal.com`;
    console.log('\n\nChecking subdomain:', subdomainPath);
    const subResult = await sshExecutor.executeCommand(
      app.serverId,
      `ls -la ${subdomainPath} | head -30`
    );
    console.log(subResult);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
