/**
 * Seed five AI Employees into every existing org.
 *
 * Idempotent: skips orgs that already have an employee with the same
 * name. Run-anytime safe.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { withTenant } = await import('../src/lib/db/tenant');
  const { organizations, employees } = await import('../src/lib/db/schema');
  const { SEED_EMPLOYEES } = await import('../src/lib/agent/seed-employees');
  const { sql, and, eq } = await import('drizzle-orm');

  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let added = 0, skipped = 0;
  for (const org of orgs) {
    for (const e of SEED_EMPLOYEES) {
      const existing = await withTenant(org.id, (tx) =>
        tx.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, org.id), eq(employees.name, e.name))).limit(1),
      );
      if (existing.length > 0) { skipped++; continue; }
      await withTenant(org.id, (tx) =>
        tx.insert(employees).values({
          orgId: org.id,
          ownerUserId: null,
          name: e.name,
          description: e.description,
          toolbelt: e.toolbelt,
          memoryScope: { kind: 'org' },
          shared: true,
        }),
      );
      added++;
      void sql; // keep import live for future use
    }
  }
  console.log(`seeded ${added} employees, skipped ${skipped} (already present)`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
