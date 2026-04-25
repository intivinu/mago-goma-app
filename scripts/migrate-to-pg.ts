import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = new Database('./prisma/dev.db', { readonly: true });

async function main() {
  console.log('Starting migration to Postgres...');

  // Words
  console.log('Reading Words from SQLite...');
  const words = db.prepare('SELECT * FROM Word').all() as any[];
  console.log(`Found ${words.length} words. Migrating in batches...`);
  
  const batchSize = 10000;
  for (let i = 0; i < words.length; i += batchSize) {
    const chunk = words.slice(i, i + batchSize).map(w => ({
      ...w,
      isValid: w.isValid === 1
    }));
    await prisma.word.createMany({
      data: chunk,
      skipDuplicates: true
    });
    console.log(`Migrated ${Math.min(i + batchSize, words.length)} / ${words.length} words`);
  }
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Word"', 'id'), coalesce(max(id), 1)) FROM "Word";`);

  // Users
  console.log('Reading Users from SQLite...');
  const users = db.prepare('SELECT * FROM User').all() as any[];
  const userPayloads = users.map(u => ({
    ...u,
    createdAt: new Date(u.createdAt)
  }));
  if (userPayloads.length > 0) {
    await prisma.user.createMany({ data: userPayloads, skipDuplicates: true });
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 1)) FROM "User";`);
    console.log(`Migrated ${users.length} users`);
  }

  // GameSessions
  console.log('Reading GameSessions from SQLite...');
  // Check if difficulty exists in sqlite GameSession
  let hasDifficulty = false;
  try {
    db.prepare('SELECT difficulty FROM GameSession LIMIT 1').get();
    hasDifficulty = true;
  } catch (e) {
    hasDifficulty = false;
  }

  const sessions = db.prepare('SELECT * FROM GameSession').all() as any[];
  const sessionPayloads = sessions.map(s => {
    const payload: any = {
      ...s,
      createdAt: new Date(s.createdAt)
    };
    if (!hasDifficulty) {
      payload.difficulty = 'aprendiz';
    }
    return payload;
  });
  if (sessionPayloads.length > 0) {
    await prisma.gameSession.createMany({ data: sessionPayloads, skipDuplicates: true });
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"GameSession"', 'id'), coalesce(max(id), 1)) FROM "GameSession";`);
    console.log(`Migrated ${sessions.length} sessions`);
  }

  // SuggestedWords
  console.log('Reading SuggestedWords from SQLite...');
  const suggestions = db.prepare('SELECT * FROM SuggestedWord').all() as any[];
  const suggestionPayloads = suggestions.map(s => ({
    ...s,
    createdAt: new Date(s.createdAt)
  }));
  if (suggestionPayloads.length > 0) {
    await prisma.suggestedWord.createMany({ data: suggestionPayloads, skipDuplicates: true });
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"SuggestedWord"', 'id'), coalesce(max(id), 1)) FROM "SuggestedWord";`);
    console.log(`Migrated ${suggestions.length} suggestions`);
  }

  console.log('Migration complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    db.close();
  });
