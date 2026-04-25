import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting mass level update...');
  
  const res1 = await prisma.$executeRawUnsafe("UPDATE Word SET level = 1 WHERE length(text) <= 6");
  console.log(`Updated to Level 1 (<= 6 chars): ${res1} words`);

  const res2 = await prisma.$executeRawUnsafe("UPDATE Word SET level = 2 WHERE length(text) > 6 AND length(text) <= 9");
  console.log(`Updated to Level 2 (7-9 chars): ${res2} words`);

  const res3 = await prisma.$executeRawUnsafe("UPDATE Word SET level = 3 WHERE length(text) >= 10");
  console.log(`Updated to Level 3 (>= 10 chars): ${res3} words`);

  console.log('Update complete!');
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
