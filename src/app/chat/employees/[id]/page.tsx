import { db } from '@/lib/db';
import { employees, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/db/tenant';
import { RunView } from '@/components/employees/run-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return <div className="p-12 text-sm">Sign in to view this employee.</div>;
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return <div className="p-12 text-sm">No organization.</div>;

  const [emp] = await withTenant(me.orgId, (tx) =>
    tx.select().from(employees).where(and(eq(employees.id, id), eq(employees.orgId, me.orgId!))),
  );
  if (!emp) return <div className="p-12 text-sm">Employee not found.</div>;

  const tools = (emp.toolbelt as string[]) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <header>
        <h1 className="font-serif text-3xl">{emp.name}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-2 whitespace-pre-wrap">{emp.description}</p>
        <p className="text-xs text-stone-500 mt-3">
          Toolbelt: {tools.length === 0 ? 'none' : tools.join(' · ')}
        </p>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">Run</h2>
        <RunView employeeId={id} />
      </section>
    </div>
  );
}
