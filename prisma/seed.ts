import { PrismaClient } from '@prisma/client'
import spanishWords from 'an-array-of-spanish-words'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with Spanish words...')
  console.log(`Found ${spanishWords.length} words in dictionary.`)

  // Filter out monosyllabic words here or during insertion?
  // We'll insert all valid >1 letter words, but we could also run silabajs here.
  // Actually, seeding 600k words one by one might be slow.
  // We can use createMany, but SQLite has a limit on the number of variables (32766).
  // Each Word has text, so 1 variable per word. We can insert in batches of 10000.

  const words = spanishWords.filter((w: string) => w.length > 1 && !/\s/.test(w) && !/[A-Z]/.test(w));
  // Keep only lowercase single words

  await prisma.word.deleteMany({})

  const batchSize = 500; // smaller batch for sqlite variables limit
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    if (batch.length === 0) break;
    
    // SQLite variable limit is typically 999 or 32766. We'll use batches of 500.
    const valuesString = batch.map((_, index) => `($${index + 1})`).join(', ');
    const query = `INSERT OR IGNORE INTO "Word" ("text") VALUES ${valuesString};`;
    
    await prisma.$executeRawUnsafe(query, ...batch);
    
    if ((i + batchSize) % 50000 === 0) {
      console.log(`Inserted ${Math.min(i + batchSize, words.length)} / ${words.length} words`);
    }
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
