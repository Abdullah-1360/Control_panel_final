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
  
  const metadata = app.metadata as any;
  const subdomains = metadata?.availableSubdomains || [];
  
  console.log('Main Application:');
  console.log('  Domain:', app.domain);
  console.log('  Path:', app.path);
  console.log('  Tech Stack:', app.techStack);
  
  console.log('\nSubdomains:');
  subdomains.forEach((sub: any, index: number) => {
    console.log(`\n${index + 1}. ${sub.domain}`);
    console.log('   Path:', sub.path);
    console.log('   Type:', sub.type);
    console.log('   Tech Stack:', sub.techStack || 'NOT DETECTED');
    console.log('   Confidence:', sub.detectionConfidence || 'N/A');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
