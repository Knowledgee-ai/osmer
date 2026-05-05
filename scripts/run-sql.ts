import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: tsx scripts/run-sql.ts <file.sql>');
    process.exit(1);
  }
  const sql = await fs.readFile(file, 'utf8');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const client = neon(url);
  // Split on `;` at end of line — naive but adequate for our migrations.
  // Skip DO $$ ... END $$ blocks: we run the whole file as one transaction
  // by using neon's tagged template, which doesn't accept multi-statement.
  // Instead we use the http driver's `transaction` (single SQL string per call),
  // running each top-level statement.
  const statements = splitTopLevel(sql).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    process.stdout.write(`-- ${stmt.slice(0, 80).replace(/\n/g, ' ')}…\n`);
    try {
      await client.query(stmt);
      console.log('   ok');
    } catch (err) {
      console.error('   FAILED:', err instanceof Error ? err.message : err);
      throw err;
    }
  }
  console.log('done');
}

// Splits a SQL script into top-level statements, treating `DO $$ ... $$;`
// as a single statement.
function splitTopLevel(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);
    if (next2 === '$$') {
      inDollar = !inDollar;
      buf += '$$';
      i++;
      continue;
    }
    if (ch === ';' && !inDollar) {
      if (buf.trim().length > 0) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim().length > 0) out.push(buf.trim());
  return out
    // strip pure comments
    .map((s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
}

main().catch((err) => { console.error(err); process.exit(1); });
