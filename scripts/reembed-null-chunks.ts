/**
 * Re-embed every chunk + entity + atom whose embedding is NULL
 * (e.g., after a rogue drizzle-kit push dropped the column).
 * Owner connection — bypasses RLS so we can fix all orgs in one pass.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws as never;

async function main() {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  try {
    // Lazy import so dotenv loaded first
    const { embed } = await import('../src/lib/memory/embed');

    for (const table of ['source_chunks', 'memory_atoms', 'memory_entities']) {
      const col = table === 'memory_entities' ? 'name' : 'content';
      const r = await pool.query(`SELECT id, ${col} FROM ${table} WHERE embedding IS NULL`);
      const rows = r.rows as Array<{ id: string; content?: string; name?: string }>;
      console.log(`${table}: ${rows.length} rows to re-embed`);
      for (const row of rows) {
        const text = (row.content ?? row.name ?? '').slice(0, 8000);
        if (!text) continue;
        try {
          const { vector } = await embed(text);
          await pool.query(`UPDATE ${table} SET embedding = $1::vector WHERE id = $2`, [JSON.stringify(vector), row.id]);
        } catch (err) {
          console.error(`  failed ${table} ${row.id}:`, err instanceof Error ? err.message : err);
        }
      }
      console.log(`  ${table} done`);
    }
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
