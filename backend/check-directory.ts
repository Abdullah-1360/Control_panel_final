import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the zarwatech application
  const app = await prisma.applications.findFirst({
    where: { 
      domain: { contains: 'zarwatech' }
    },
    include: { servers: true },
  });
  
  if (!app) {
    console.log('Application not found');
    return;
  }
  
  console.log('Application:', app.domain);
  console.log('Path:', app.path);
  console.log('Tech Stack:', app.techStack);
  console.log('\nMetadata:');
  console.log(JSON.stringify(app.metadata, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
