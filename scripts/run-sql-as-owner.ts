/**
 * Run a SQL file using the owner connection (DATABASE_URL_OWNER) for
 * privileged operations (CREATE TABLE, GRANT, ALTER ROLE). Falls back
 * to DATABASE_URL if no owner URL is set.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs/promises';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws as never;

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: tsx scripts/run-sql-as-owner.ts <file.sql>');
    process.exit(1);
  }
  const sql = await fs.readFile(file, 'utf8');
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL[_OWNER] missing');

  const pool = new Pool({ connectionString: url });
  try {
    // Strip -- line comments BEFORE splitting on ; (a comment may
    // contain a semicolon and we do not want to split mid-sentence).
    const cleaned = sql
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');

    const statements = splitTopLevel(cleaned).map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      process.stdout.write(`-- ${stmt.slice(0, 80).replace(/\n/g, ' ')}…\n`);
      await pool.query(stmt);
      console.log('   ok');
    }
    console.log('done');
  } finally {
    await pool.end();
  }
}

function splitTopLevel(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const next2 = sql.slice(i, i + 2);
    if (next2 === '$$') { inDollar = !inDollar; buf += '$$'; i++; continue; }
    if (sql[i] === ';' && !inDollar) {
      if (buf.trim().length > 0) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += sql[i];
  }
  if (buf.trim().length > 0) out.push(buf.trim());
  // (Line comments already stripped by caller.)
  return out.map((s) => s.trim()).filter(Boolean);
}

main().catch((err) => { console.error(err); process.exit(1); });
