import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { runMemoryMapSnapshot } = await import('../src/lib/memory-map/cron');
  const r = await runMemoryMapSnapshot();
  console.log('snapshot result:', r);
}
main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
