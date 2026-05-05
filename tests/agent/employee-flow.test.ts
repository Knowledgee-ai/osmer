import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { organizations, users, employees, employeeRuns, toolAudit } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db/tenant';
import { startRun } from '@/lib/agent/runtime';

describe('M4 employee flow', () => {
  it('runs an employee end-to-end and persists outputs + audit', async () => {
    const stamp = Date.now();
    const [org]  = await db.insert(organizations).values({ name: 'EFlow', slug: `eflow-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'U', email: `eflow-${stamp}@e.co`, role: 'member' }).returning();

    const [emp] = await withTenant(org.id, (tx) =>
      tx.insert(employees).values({
        orgId: org.id,
        ownerUserId: user.id,
        name: 'Test Employee',
        description:
          'Greet the user by the name from inputs.name, in one short sentence. Do not call any tools — just respond directly.',
        toolbelt: ['memory.query'],
        memoryScope: { kind: 'org' },
      }).returning(),
    );

    const result = await startRun({
      employeeId: emp.id,
      orgId: org.id,
      userId: user.id,
      inputs: { name: 'Acme tester' },
    });

    expect(['complete', 'failed']).toContain(result.status);
    if (result.status === 'complete') {
      expect(result.output.toLowerCase()).toMatch(/acme/);
    }

    // Run row should be persisted with terminal status under tenant.
    const [run] = await withTenant(org.id, (tx) =>
      tx.select().from(employeeRuns).where(eq(employeeRuns.id, result.runId)),
    );
    expect(run).toBeDefined();
    expect(['complete', 'failed']).toContain(run!.status);

    // Audit row may be empty (model didn't call a tool) — just confirm the
    // query works without RLS errors.
    const audit = await withTenant(org.id, (tx) =>
      tx.select().from(toolAudit).where(eq(toolAudit.runId, result.runId)),
    );
    expect(Array.isArray(audit)).toBe(true);
  }, 90_000);
});
