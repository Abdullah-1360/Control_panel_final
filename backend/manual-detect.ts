import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const app = await prisma.applications.findFirst({
    where: { domain: { contains: 'zarwatech' } },
  });
  
  if (!app) {
    console.log('Application not found');
    return;
  }
  
  console.log('Application ID:', app.id);
  console.log('Domain:', app.domain);
  console.log('\nTo manually trigger detection, run:');
  console.log(`curl -X POST http://localhost:3001/api/v1/healer/applications/${app.id}/detect-all-tech-stacks \\`);
  console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
  
  console.log('\nOr for just the subdomain:');
  console.log(`curl -X POST http://localhost:3001/api/v1/healer/applications/${app.id}/subdomains/dpexglobal.com.zarwatech.com.pk/detect-tech-stack \\`);
  console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
