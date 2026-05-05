import { db } from '@/lib/db';
import { employees, users } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/db/tenant';
import Link from 'next/link';

export const metadata = { title: 'AI Employees · Osmer' };

async function loadEmployees() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return [];
  return withTenant(me.orgId, (tx) =>
    tx
      .select({ id: employees.id, name: employees.name, description: employees.description })
      .from(employees)
      .where(and(eq(employees.orgId, me.orgId!), eq(employees.status, 'active')))
      .orderBy(desc(employees.createdAt)),
  );
}

export default async function EmployeesPage() {
  const list = await loadEmployees();
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">AI Employees</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Reusable agents that act on your company memory.
          </p>
        </div>
        <Link href="/chat/employees/new" className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">
          New employee
        </Link>
      </header>

      {list.length === 0 ? (
        <p className="text-sm text-stone-500">
          No employees yet. <Link href="/chat/employees/new" className="underline">Create the first one.</Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <Link
                href={`/chat/employees/${e.id}`}
                className="block rounded-md border border-stone-200 dark:border-stone-800 p-4 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
              >
                <div className="font-medium">{e.name}</div>
                <div className="text-sm text-stone-500 line-clamp-2 mt-1">{e.description}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
