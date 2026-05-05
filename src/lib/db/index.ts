import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Outside Vercel/Edge runtimes (Node, scripts, tests), neon-serverless needs
// an explicit WebSocket implementation. Inside Vercel Functions the runtime
// already provides WebSocket; assigning ws is a no-op there.
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
