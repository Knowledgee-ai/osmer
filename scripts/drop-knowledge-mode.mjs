import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = neon(url);

async function main() {
  console.log('Pre-check: column + type existence');
  const colCheck = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'knowledge_mode'`;
  const typeCheck = await sql`SELECT typname FROM pg_type WHERE typname = 'knowledge_mode'`;
  console.log('  column knowledge_mode present:', colCheck.length > 0);
  console.log('  type knowledge_mode present:', typeCheck.length > 0);

  if (colCheck.length > 0) {
    console.log('Dropping conversations.knowledge_mode column...');
    await sql`ALTER TABLE conversations DROP COLUMN knowledge_mode`;
    console.log('  done');
  } else {
    console.log('Skipping column drop (already gone)');
  }

  if (typeCheck.length > 0) {
    console.log('Dropping knowledge_mode enum type...');
    await sql`DROP TYPE knowledge_mode`;
    console.log('  done');
  } else {
    console.log('Skipping type drop (already gone)');
  }

  // Optional: clean up the unused JSONB key on existing rows
  console.log('Cleaning up users.preferences.defaultKnowledgeMode...');
  const updated = await sql`
    UPDATE users
    SET preferences = preferences - 'defaultKnowledgeMode'
    WHERE preferences ? 'defaultKnowledgeMode'
    RETURNING id
  `;
  console.log(`  cleaned ${updated.length} user rows`);

  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
