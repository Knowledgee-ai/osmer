# M8 — Public Launch Readiness

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take everything built in M1-M7 from "works for us" to "self-serve PLG product the public can sign up for and pay for." Ship pricing tier enforcement (Stripe), polished sign-up + activation flow, marketing site with 3D Memory Map hero, support flow, analytics, status page, and the legal surface.

**Architecture:** Stripe handles billing — checkout for Pro/Team/Business, webhook updates `subscriptions` table; tier enforcement reads from there. Pricing tier gates feature flags (model access, employee count, run quotas, voice onboarding, mobile push). Marketing site is Next.js routes under `/` with the 3D Memory Map as hero. PostHog for analytics. UptimeRobot for status. Anthropic-style minimal legal pages (terms, privacy, DPA).

**Tech Stack:** Stripe Checkout + Customer Portal + Webhooks, PostHog, UptimeRobot or Vercel Status, plain Markdown for legal pages, Resend for transactional email.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `drizzle/0015_subscriptions.sql` | `subscriptions`, `plan_features` |
| `src/lib/billing/plans.ts` | Plan definitions (free/pro/team/business) and feature flags |
| `src/lib/billing/gate.ts` | `assertFeatureAvailable(orgId, feature)` |
| `src/lib/billing/stripe.ts` | Stripe client + helpers |
| `src/app/api/billing/checkout/route.ts` | Create checkout session |
| `src/app/api/billing/portal/route.ts` | Customer portal session |
| `src/app/api/billing/webhook/route.ts` | Stripe webhook → update subscriptions |
| `src/app/pricing/page.tsx` | Pricing page with checkout buttons |
| `src/app/(marketing)/page.tsx` | Landing rebuild |
| `src/app/(marketing)/about/page.tsx` | About |
| `src/app/(marketing)/legal/terms/page.tsx` | Terms |
| `src/app/(marketing)/legal/privacy/page.tsx` | Privacy |
| `src/app/(marketing)/legal/dpa/page.tsx` | DPA |
| `src/app/api/memory/map/sample/route.ts` | Static sample snapshot for unauthed visitors |
| `src/lib/email/transactional.ts` | Resend wrappers (welcome, run-complete, weekly digest) |
| `src/lib/analytics/posthog.ts` | Server-side PostHog client |
| `src/components/marketing/hero.tsx` | Hero with 3D Memory Map and headline copy |
| `src/components/marketing/pricing-table.tsx` | Pricing table |
| `public/og-image.png` | Open Graph image |

**Modified files:**

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Subscriptions |
| `src/lib/spend/middleware.ts` | Read tier from subscription, raise caps accordingly |
| `src/app/api/employees/route.ts` | Gate `POST` on Pro+ |
| `src/app/api/upload/route.ts` | Gate doc count on Free |
| `src/lib/agent/runtime.ts` | Tier check before tool selection |
| `src/app/page.tsx` | Marketing landing |

---

## Task 1: Subscriptions schema + plan definitions

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/billing/plans.ts`

- [ ] **Step 1: Schema**

```ts
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing', 'active', 'past_due', 'canceled', 'paused']);
export const planTierEnum = pgEnum('plan_tier', ['free', 'pro', 'team', 'business']);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  tier: planTierEnum('tier').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  seats: integer('seats').notNull().default(1),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('subs_org_idx').on(t.orgId),
  uniqueIndex('subs_stripe_idx').on(t.stripeSubscriptionId),
]);
```

- [ ] **Step 2: Plan definitions**

```ts
export type Tier = 'free' | 'pro' | 'team' | 'business';

export interface PlanFeatures {
  maxEmployees: number;
  monthlyEmployeeRuns: number;
  monthlyMessages: number;
  maxDocuments: number;
  voiceOnboarding: boolean;
  mobilePush: boolean;
  memoryMap: boolean;
  ssoSupport: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
  userDailyCapCents: number;
  orgMonthlyCapCents: number;
  perRunCapCents: number;
}

export const PLANS: Record<Tier, { priceCents: number; features: PlanFeatures }> = {
  free:     { priceCents:    0, features: { maxEmployees: 1, monthlyEmployeeRuns: 25,    monthlyMessages: 100,    maxDocuments: 20,   voiceOnboarding: false, mobilePush: false, memoryMap: true,  ssoSupport: false, auditLogs: false, prioritySupport: false, userDailyCapCents: 100,  orgMonthlyCapCents: 500,    perRunCapCents: 50 } },
  pro:      { priceCents: 3000, features: { maxEmployees: 5, monthlyEmployeeRuns: 200,   monthlyMessages: 5000,   maxDocuments: 1000, voiceOnboarding: true,  mobilePush: true,  memoryMap: true,  ssoSupport: false, auditLogs: false, prioritySupport: false, userDailyCapCents: 500,  orgMonthlyCapCents: 5000,   perRunCapCents: 200 } },
  team:     { priceCents: 5000, features: { maxEmployees: 25, monthlyEmployeeRuns: 1000, monthlyMessages: 25000,  maxDocuments: 5000, voiceOnboarding: true,  mobilePush: true,  memoryMap: true,  ssoSupport: false, auditLogs: true,  prioritySupport: false, userDailyCapCents: 1000, orgMonthlyCapCents: 50000,  perRunCapCents: 500 } },
  business: { priceCents: 10000,features: { maxEmployees: 100,monthlyEmployeeRuns: 5000, monthlyMessages: 100000, maxDocuments: 50000,voiceOnboarding: true,  mobilePush: true,  memoryMap: true,  ssoSupport: true,  auditLogs: true,  prioritySupport: true,  userDailyCapCents: 2000, orgMonthlyCapCents: 250000, perRunCapCents: 1000 } },
};
```

- [ ] **Step 3: Push + RLS**

```bash
npx drizzle-kit generate --name subscriptions
npx drizzle-kit push
psql "$DATABASE_URL" -c "ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON subscriptions USING (org_id = current_setting('app.current_org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);"
git add src/lib/db/schema.ts src/lib/billing/plans.ts drizzle/
git commit -m "feat(billing): subscriptions schema + plan definitions"
```

---

## Task 2: Feature gate helper + spend cap injection

**Files:**
- Create: `src/lib/billing/gate.ts`
- Modify: `src/lib/spend/caps.ts`

- [ ] **Step 1: Gate**

```ts
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PLANS, type Tier } from './plans';

export async function getOrgTier(orgId: string): Promise<Tier> {
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId));
  if (!s || s.status === 'canceled' || s.status === 'past_due') return 'free';
  return s.tier as Tier;
}

export async function getOrgFeatures(orgId: string) {
  const tier = await getOrgTier(orgId);
  return PLANS[tier].features;
}

export class FeatureGated extends Error {
  constructor(public feature: string, public requiredTier: Tier) { super(`feature ${feature} requires ${requiredTier}`); }
}

export async function assertFeature(orgId: string, feature: keyof ReturnType<typeof getOrgFeatures> extends Promise<infer F> ? keyof F : never, required: Tier = 'pro') {
  const f = await getOrgFeatures(orgId);
  // For boolean features:
  // @ts-expect-error indexed
  if (f[feature] === false) throw new FeatureGated(String(feature), required);
}
```

- [ ] **Step 2: Spend caps read tier**

In `src/lib/spend/caps.ts`, replace the `DEFAULTS_CENTS` block with a per-org lookup:

```ts
import { getOrgFeatures } from '@/lib/billing/gate';

async function defaultCap(orgId: string, scope: string): Promise<number> {
  const f = await getOrgFeatures(orgId);
  if (scope === 'user_daily')  return f.userDailyCapCents;
  if (scope === 'org_monthly') return f.orgMonthlyCapCents;
  if (scope === 'employee_run') return f.perRunCapCents;
  return 0;
}
```

Update `capCents` to call `defaultCap` when no row exists.

- [ ] **Step 3: Commit**

```bash
git add src/lib/billing/gate.ts src/lib/spend/caps.ts
git commit -m "feat(billing): feature gate + tier-aware spend caps"
```

---

## Task 3: Stripe — checkout + portal + webhook

**Files:**
- Create: `src/lib/billing/stripe.ts`
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/billing/portal/route.ts`
- Create: `src/app/api/billing/webhook/route.ts`

- [ ] **Step 1: Install + client**

```bash
npm install stripe
```

`src/lib/billing/stripe.ts`:

```ts
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-08-27.basil' });

export const STRIPE_PRICE_ID = {
  pro:      process.env.STRIPE_PRICE_PRO!,
  team:     process.env.STRIPE_PRICE_TEAM!,
  business: process.env.STRIPE_PRICE_BUSINESS!,
};
```

- [ ] **Step 2: Checkout**

`src/app/api/billing/checkout/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizations, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, STRIPE_PRICE_ID } from '@/lib/billing/stripe';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { tier } = await req.json() as { tier: 'pro' | 'team' | 'business' };
  const [me] = await db.select({ orgId: users.orgId, email: users.email }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, me.orgId));
  let customerId = sub?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: me.email, metadata: { orgId: me.orgId } });
    customerId = customer.id;
    await db.insert(subscriptions).values({ orgId: me.orgId, stripeCustomerId: customerId, tier: 'free' }).onConflictDoNothing();
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID[tier], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?subscribed=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=1`,
    allow_promotion_codes: true,
  });
  return Response.json({ url: checkout.url });
}
```

- [ ] **Step 3: Portal**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/billing/stripe';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, me!.orgId!));
  if (!sub?.stripeCustomerId) return Response.json({ error: 'no_customer' }, { status: 400 });
  const portal = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat` });
  return Response.json({ url: portal.url });
}
```

- [ ] **Step 4: Webhook**

```ts
import { stripe } from '@/lib/billing/stripe';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { STRIPE_PRICE_ID } from '@/lib/billing/stripe';

export const config = { api: { bodyParser: false } };

function tierFromPriceId(priceId: string): 'pro' | 'team' | 'business' | null {
  if (priceId === STRIPE_PRICE_ID.pro) return 'pro';
  if (priceId === STRIPE_PRICE_ID.team) return 'team';
  if (priceId === STRIPE_PRICE_ID.business) return 'business';
  return null;
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature') ?? '';
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err) {
    return new Response(`Webhook Error: ${String(err)}`, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as { id: string; customer: string; status: string; items: { data: Array<{ price: { id: string } }> }; current_period_start: number; current_period_end: number; cancel_at_period_end: boolean };
      const tier = tierFromPriceId(sub.items.data[0]?.price.id ?? '') ?? 'free';
      await db.execute(sql`
        UPDATE subscriptions
        SET stripe_subscription_id = ${sub.id}, tier = ${tier}, status = ${sub.status},
            current_period_start = to_timestamp(${sub.current_period_start}),
            current_period_end = to_timestamp(${sub.current_period_end}),
            cancel_at_period_end = ${sub.cancel_at_period_end},
            updated_at = NOW()
        WHERE stripe_customer_id = ${sub.customer}
      `);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string };
      await db.update(subscriptions).set({ status: 'canceled', tier: 'free', updatedAt: new Date() }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }
  }
  return Response.json({ received: true });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stripe.ts src/app/api/billing/ package.json package-lock.json
git commit -m "feat(billing): Stripe checkout + portal + webhook"
```

---

## Task 4: Apply gates across the app

**Files:**
- Modify: `src/app/api/employees/route.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/lib/agent/runtime.ts`
- Modify: `src/app/api/voice/session/route.ts`

- [ ] **Step 1: Employees count gate**

In `POST /api/employees`, before insert:

```ts
import { getOrgFeatures } from '@/lib/billing/gate';
import { count } from 'drizzle-orm';
// ...
const features = await getOrgFeatures(me.orgId);
const [{ value: existing }] = await db.select({ value: count() }).from(employees).where(eq(employees.orgId, me.orgId));
if (existing >= features.maxEmployees) {
  return Response.json({ error: 'tier_limit', feature: 'maxEmployees', cap: features.maxEmployees }, { status: 402 });
}
```

- [ ] **Step 2: Upload doc count gate**

Same pattern with `maxDocuments` against `ingestion_jobs.kind = 'upload'`.

- [ ] **Step 3: Voice gate**

In voice session route, before mintRealtimeToken:

```ts
const features = await getOrgFeatures(me.orgId);
if (!features.voiceOnboarding) return Response.json({ error: 'tier_required', feature: 'voiceOnboarding' }, { status: 402 });
```

- [ ] **Step 4: Runtime tier check**

In `runtime.ts` before picking tools, filter out tools whose tier exceeds the org tier (paid tools require pro+).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/employees/ src/app/api/upload/ src/lib/agent/runtime.ts src/app/api/voice/
git commit -m "feat(billing): apply tier gates to employees, uploads, voice, runtime tools"
```

---

## Task 5: Pricing page + checkout buttons

**Files:**
- Create: `src/components/marketing/pricing-table.tsx`
- Create: `src/app/pricing/page.tsx`

- [ ] **Step 1: Table**

```tsx
'use client';
import { useState } from 'react';
import { PLANS, type Tier } from '@/lib/billing/plans';

const ROWS: Array<{ tier: Tier; label: string; description: string }> = [
  { tier: 'free', label: 'Free', description: 'Try the magic.' },
  { tier: 'pro',  label: 'Pro', description: 'For solo operators.' },
  { tier: 'team', label: 'Team', description: 'Shared memory and employees.' },
  { tier: 'business', label: 'Business', description: 'Org-wide memory and admin.' },
];

export function PricingTable() {
  const [busy, setBusy] = useState<string | null>(null);
  async function checkout(tier: Tier) {
    if (tier === 'free') { window.location.href = '/register'; return; }
    setBusy(tier);
    const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier }) });
    setBusy(null);
    if (r.ok) { const j = await r.json(); window.location.href = j.url; }
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ROWS.map((p) => (
        <div key={p.tier} className="rounded-md border p-6">
          <div className="text-xs uppercase tracking-wide text-stone-500">{p.label}</div>
          <div className="font-serif text-3xl mt-2">${PLANS[p.tier].priceCents / 100}<span className="text-sm font-sans">/seat/mo</span></div>
          <div className="text-sm text-stone-600 mt-1">{p.description}</div>
          <ul className="text-xs mt-4 space-y-1">
            <li>{PLANS[p.tier].features.maxEmployees} AI Employees</li>
            <li>{PLANS[p.tier].features.monthlyEmployeeRuns}/mo runs</li>
            <li>{PLANS[p.tier].features.monthlyMessages.toLocaleString()} messages</li>
            <li>{PLANS[p.tier].features.maxDocuments.toLocaleString()} documents</li>
            {PLANS[p.tier].features.voiceOnboarding ? <li>Voice onboarding</li> : null}
            {PLANS[p.tier].features.mobilePush ? <li>Mobile push</li> : null}
            {PLANS[p.tier].features.ssoSupport ? <li>SSO</li> : null}
            {PLANS[p.tier].features.auditLogs ? <li>Audit logs</li> : null}
          </ul>
          <button onClick={() => checkout(p.tier)} disabled={busy === p.tier} className="mt-6 w-full rounded-md bg-stone-900 text-white py-2 text-sm">
            {busy === p.tier ? '…' : (p.tier === 'free' ? 'Start free' : 'Subscribe')}
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Page**

```tsx
import { PricingTable } from '@/components/marketing/pricing-table';

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="font-serif text-4xl mb-3">Pricing</h1>
      <p className="text-stone-600 mb-10">Self-serve. Upgrade or downgrade any time.</p>
      <PricingTable />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/pricing-table.tsx src/app/pricing/
git commit -m "feat(marketing): pricing page with Stripe checkout buttons"
```

---

## Task 6: Marketing landing rebuild

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/marketing/hero.tsx`
- Create: `src/app/api/memory/map/sample/route.ts`

- [ ] **Step 1: Sample snapshot endpoint (for unauthed visitors)**

```ts
// Returns a synthetic Memory Map snapshot — no real data leaked.
import sample from '@/lib/memory-map/sample.json' assert { type: 'json' };

export async function GET() {
  return Response.json({ snapshot: sample });
}
```

(Author `src/lib/memory-map/sample.json` with ~30 illustrative nodes + edges.)

- [ ] **Step 2: Hero component**

```tsx
import { Graph3D } from '@/components/memory-map/graph-3d';

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Graph3D src="/api/memory/map/sample" />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-32 pb-24">
        <h1 className="font-serif text-5xl sm:text-6xl leading-tight">The company asset that compounds while your team works.</h1>
        <p className="text-lg text-stone-700 mt-6 max-w-xl">Multi-model AI chat that turns every conversation, document, and voice intro into living company memory. Then runs AI Employees on it.</p>
        <div className="mt-10 flex gap-3">
          <a href="/register" className="rounded-md bg-stone-900 text-white px-5 py-2 text-sm">Start free</a>
          <a href="/pricing" className="rounded-md border border-stone-300 px-5 py-2 text-sm">See pricing</a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Landing page**

`src/app/page.tsx`:

```tsx
import { Hero } from '@/components/marketing/hero';

export default function HomePage() {
  return (
    <main>
      <Hero />
      {/* Add: sections for problem, solution, AI Employees, Memory Map, social proof, footer. */}
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/hero.tsx src/app/page.tsx src/app/api/memory/map/sample/ src/lib/memory-map/sample.json
git commit -m "feat(marketing): landing rebuild with 3D Memory Map hero + sample snapshot"
```

---

## Task 7: Legal pages + email + analytics

**Files:**
- Create: `src/app/(marketing)/legal/terms/page.tsx`
- Create: `src/app/(marketing)/legal/privacy/page.tsx`
- Create: `src/app/(marketing)/legal/dpa/page.tsx`
- Create: `src/lib/email/transactional.ts`
- Create: `src/lib/analytics/posthog.ts`

- [ ] **Step 1: Legal pages**

Each page is a markdown-ish prose file rendered by Next.js — terms, privacy, DPA. Use minimal Anthropic-style language; engage counsel before public launch.

- [ ] **Step 2: Email helper (Resend)**

```bash
npm install resend
```

```ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, name: string) {
  await resend.emails.send({
    from: 'Osmer <hello@osmer.ai>',
    to,
    subject: 'Welcome to Osmer',
    text: `Hi ${name},\n\nYour account is ready. Let's seed your company memory: https://app.osmer.ai/chat/onboarding\n\n— Osmer`,
  });
}
```

- [ ] **Step 3: PostHog**

```bash
npm install posthog-node
```

```ts
import { PostHog } from 'posthog-node';

const ph = process.env.POSTHOG_KEY ? new PostHog(process.env.POSTHOG_KEY, { host: 'https://us.posthog.com' }) : null;

export function track(distinctId: string, event: string, properties: Record<string, unknown> = {}) {
  ph?.capture({ distinctId, event, properties });
}
```

Wire `track()` calls into key events: signup, first_employee_created, first_run_completed, tier_upgraded.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/legal/ src/lib/email/ src/lib/analytics/ package.json package-lock.json
git commit -m "feat(marketing): legal pages + Resend transactional email + PostHog tracking"
```

---

## Task 8: Status + acceptance

**Files:**
- Create: `docs/specs/M8-results.md`

- [ ] **Step 1: Results template**

```markdown
# M8 — Results

## Acceptance gates
- [ ] Stripe checkout completes for Pro / Team / Business
- [ ] Webhook updates subscriptions row within 60s
- [ ] Tier gates enforce on employees POST, upload POST, voice session POST
- [ ] Customer portal opens correctly
- [ ] Pricing page renders all four tiers with correct features
- [ ] Marketing hero renders 3D Memory Map without auth
- [ ] Welcome email lands within 60s of signup
- [ ] PostHog records: signup, employee.created, run.completed, tier.upgraded
- [ ] Legal pages reviewed by counsel
- [ ] Status page (UptimeRobot or Vercel) public
- [ ] App Store + Play Store builds approved (M6 dependency)

## First 100 users plan
- Direct outreach to 50 sales / consulting / marketing operators
- Hand-onboard via voice interview (M7) for the first 20
- Each onboarding produces a case study draft

## Day-of-launch checklist
- [ ] Production CRON_SECRET, OPENROUTER_API_KEY, etc. set
- [ ] Stripe live mode keys swapped in
- [ ] DNS for app.osmer.ai + osmer.ai live
- [ ] Status page green
- [ ] On-call rotation set
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/M8-results.md
git commit -m "docs(m8): launch readiness acceptance + day-of checklist"
```

---

## Self-review

- Stripe billing ✓ (T1, T3)
- Tier gates ✓ (T4)
- Pricing page ✓ (T5)
- Marketing landing with 3D hero ✓ (T6)
- Legal pages, email, analytics ✓ (T7)
- Day-of checklist ✓ (T8)

**Deferred / phase-3:** SSO admin UI, custom DPAs, vertical landing pages (sales/consulting/marketing-specific copy), referral program automation, SOC 2 evidence collection.
