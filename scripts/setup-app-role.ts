import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws as never;

const APP_ROLE = 'osmer_app';

async function main() {
  const pwd = process.env.APP_ROLE_PASSWORD;
  if (!pwd) {
    console.error('Set APP_ROLE_PASSWORD in .env.local first.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Create role if missing, set login + password
    await pool.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${pwd.replace(/'/g, "''")}';
        END IF;
      END $$`);
    await pool.query(`ALTER ROLE ${APP_ROLE} WITH PASSWORD '${pwd.replace(/'/g, "''")}'`);
    await pool.query(`ALTER ROLE ${APP_ROLE} NOBYPASSRLS`);

    // Grant permissions on the database, schema, and all tables/sequences
    const dbName = (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? 'neondb';
    await pool.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${APP_ROLE}`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await pool.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await pool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${APP_ROLE}`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${APP_ROLE}`);

    console.log(`✓ ${APP_ROLE} ready (no BYPASSRLS, full table access).`);
    console.log('Update DATABASE_URL to use this role:');
    console.log(`  postgres://${APP_ROLE}:${pwd}@<host>:<port>/${dbName}?...`);
  } finally {
    await pool.end();
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
