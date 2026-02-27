import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const app = await prisma.applications.findUnique({
    where: { id: '65fd8fcc-8205-45a7-af15-45cf9071e453' },
    select: {
      id: true,
      domain: true,
      path: true,
      techStack: true,
      metadata: true,
    },
  });
  
  console.log(JSON.stringify(app, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
