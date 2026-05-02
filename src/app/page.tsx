import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";

export default function LandingPage() {
  return (
    <div
      data-theme="paper"
      className="paper-grain h-full overflow-y-auto"
      style={{ scrollBehavior: "smooth" }}
    >
      <LandingNav />
      <Hero />
      <Manifesto />
      <Problem />
      <ThreeTiers />
      <Protocol />
      <MultiModel />
      <ProductTheatre />
      <Closing />
      <Footer />
    </div>
  );
}

/* ───────────────────────── HERO ───────────────────────── */

function Hero() {
  return (
    <section className="relative">
      <div className="spotlight pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 px-8 pt-20 pb-32 lg:px-14 lg:pt-28 lg:pb-40">
        {/* Left rail: eyebrow and headline */}
        <div className="col-span-12 lg:col-span-7">
          <p className="mono blur-in mb-7 text-[var(--clay-deep)]" style={{ animationDelay: "100ms" }}>
            Vol. 01 / The Organizational Memory Protocol
          </p>
          <h1 className="display text-[clamp(3.5rem,8.4vw,7.5rem)] text-[var(--ink)]">
            <span className="rise block" style={{ animationDelay: "200ms" }}>
              The shape
            </span>
            <span className="rise block" style={{ animationDelay: "320ms" }}>
              of <span className="display-italic">organizational</span>
            </span>
            <span className="rise block" style={{ animationDelay: "440ms" }}>
              memory.
            </span>
          </h1>
          <p
            className="rise mt-10 max-w-[36ch] text-[1.18rem] leading-[1.55] text-[var(--ink-soft)]"
            style={{ animationDelay: "640ms" }}
          >
            Every conversation your team has with an AI generates knowledge that today
            evaporates the moment the tab closes. Knowledge HQ is the system of record for
            the work your colleagues do <em className="display-italic">with</em> machines.
            Captured, refined, and passed forward.
          </p>
          <div
            className="rise mt-12 flex flex-wrap items-center gap-6"
            style={{ animationDelay: "780ms" }}
          >
            <Link
              href="/chat"
              className="mono link-shift inline-flex items-center rounded-full bg-[var(--ink)] px-7 py-4 text-[var(--paper)] hover:bg-[var(--clay-deep)]"
            >
              Begin a conversation
              <ArrowEast />
            </Link>
            <a href="#problem" className="mono link-underline text-[var(--ink-soft)]">
              Read the thesis ↓
            </a>
          </div>
          <dl
            className="rise mt-20 grid grid-cols-3 gap-6 border-t border-[var(--hairline)] pt-8 text-[var(--ink-soft)] lg:max-w-[520px]"
            style={{ animationDelay: "920ms" }}
          >
            <div>
              <dt className="mono mb-2 text-[var(--ink-faint)]">Models</dt>
              <dd className="display text-3xl text-[var(--ink)]">10</dd>
            </div>
            <div>
              <dt className="mono mb-2 text-[var(--ink-faint)]">Providers</dt>
              <dd className="display text-3xl text-[var(--ink)]">5</dd>
            </div>
            <div>
              <dt className="mono mb-2 text-[var(--ink-faint)]">Tiers</dt>
              <dd className="display text-3xl text-[var(--ink)]">
                3<span className="display-italic text-[var(--clay)]">.</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Right rail: hero image */}
        <div className="col-span-12 mt-16 lg:col-span-5 lg:mt-0">
          <figure className="fade-in relative drift" style={{ animationDelay: "300ms" }}>
            <div className="absolute -inset-3 -z-10 rounded-full bg-[var(--clay-soft)]/40 blur-3xl" />
            <Image
              src="/landing/hero-knowledge-graph.png"
              alt=""
              width={1536}
              height={1024}
              priority
              className="aspect-square w-full rounded-[2px] object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <figcaption className="mono mt-5 flex items-center justify-between text-[var(--ink-faint)]">
              <span>Plate I</span>
              <span>A knowledge graph, in section</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── MANIFESTO ──────────────────────── */

function Manifesto() {
  return (
    <section className="border-y border-[var(--hairline)] bg-[var(--paper-pale)]/40 py-28 lg:py-40">
      <div className="mx-auto max-w-[1100px] px-8 lg:px-14">
        <p className="mono mb-10 text-[var(--clay-deep)]">A note on the work</p>
        <p className="display text-[clamp(2rem,4.4vw,3.6rem)] leading-[1.12] text-[var(--ink)]">
          Before Salesforce, customer knowledge lived in individual notebooks and heads.
          When someone left, it walked out the door. Knowledge HQ proposes the same
          inflection for the knowledge that flows through{" "}
          <span className="display-italic text-[var(--clay-deep)]">
            every AI conversation
          </span>{" "}
          your company has. The knowledge should belong to the organization, not to
          the inbox of one employee.
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── PROBLEM ───────────────────────── */

function Problem() {
  return (
    <section id="problem" className="py-28 lg:py-40">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 gap-y-14 px-8 lg:px-14">
        <div className="col-span-12 lg:col-span-4">
          <p className="mono mb-7 text-[var(--clay-deep)]">§ 01 / The shadow AI problem</p>
          <h2 className="display text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] text-[var(--ink)]">
            Knowledge is being created at unprecedented scale, then{" "}
            <span className="display-italic">forgotten</span> at the same rate.
          </h2>
        </div>
        <div className="col-span-12 grid grid-cols-1 gap-12 text-[1.05rem] leading-[1.65] text-[var(--ink-soft)] sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          <div>
            <p>
              The average knowledge worker now uses three to five different AI models in
              a working week. Each chat thread contains a small private archive of
              decisions, hypotheses, debugging traces, and resolved problems.
            </p>
            <p className="mt-5">
              None of it is searchable by colleagues. None of it survives a tab close.
              When the employee leaves, it leaves with them.
            </p>
          </div>
          <div>
            <p>
              We call this <em className="display-italic">shadow AI</em>: the
              twenty-first-century cousin of shadow IT, with one important difference.
              The artefacts are not files but conversations, and they are produced
              faster than any documentation practice can capture.
            </p>
            <p className="mt-5">
              No model provider solves this. They optimise for their own walled garden.
              The problem is, by definition, between them.
            </p>
          </div>
        </div>
      </div>

      {/* Statistic strip */}
      <div className="mx-auto mt-24 max-w-[1440px] border-y border-[var(--hairline)] px-8 py-10 lg:px-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {[
            { stat: "92%", label: "of knowledge workers use AI weekly" },
            { stat: "3-5", label: "providers used per person, per week" },
            { stat: "0%", label: "of that knowledge is captured by default" },
          ].map((s, i) => (
            <div key={s.stat} className={i > 0 ? "sm:border-l sm:border-[var(--hairline)] sm:pl-10" : ""}>
              <div className="display text-[clamp(3rem,5vw,4.5rem)] leading-none text-[var(--ink)]">
                {s.stat}
              </div>
              <div className="mono mt-3 text-[var(--ink-mute)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── THREE TIERS ──────────────────────── */

function ThreeTiers() {
  return (
    <section id="tiers" className="bg-[var(--paper-pale)]/60 py-28 lg:py-40">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 gap-y-12 px-8 lg:px-14">
        <div className="col-span-12 lg:col-span-5">
          <p className="mono mb-7 text-[var(--clay-deep)]">§ 02 / Three tiers of memory</p>
          <h2 className="display text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] text-[var(--ink)]">
            <span className="display-italic">Personal.</span>
            <br />
            Team.
            <br />
            Organisation.
          </h2>
          <p className="mt-8 max-w-[44ch] text-[1.05rem] leading-[1.65] text-[var(--ink-soft)]">
            Memory in Knowledge HQ is structured as a three-tier protocol. A fact you
            discover in a private conversation belongs to you. A decision your team makes
            belongs to the team. A truth about the company belongs to the organisation.
            Each atom carries provenance, confidence, and a decay function. Knowledge,
            but with metabolism.
          </p>
          <div className="mt-12 space-y-5">
            {[
              {
                tier: "Personal",
                desc: "Private to the user. Preferences, working context, drafts.",
                weight: "0.0",
              },
              {
                tier: "Team",
                desc: "Shared with the team. Conventions, decisions, on-call playbooks.",
                weight: "0.4",
              },
              {
                tier: "Organisation",
                desc: "Visible across the company. Stack, compliance, strategy.",
                weight: "0.9",
              },
            ].map((t, i) => (
              <div
                key={t.tier}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 border-b border-[var(--hairline)] pb-5"
              >
                <span className="mono text-[var(--ink-faint)]">0{i + 1}</span>
                <div>
                  <div className="display text-2xl text-[var(--ink)]">{t.tier}</div>
                  <p className="mt-1 text-[0.95rem] text-[var(--ink-mute)]">{t.desc}</p>
                </div>
                <span className="mono text-[var(--clay-deep)]">decay {t.weight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Animated SVG diagram */}
        <div className="col-span-12 flex items-center justify-center lg:col-span-7">
          <TiersDiagram />
        </div>
      </div>
    </section>
  );
}

function TiersDiagram() {
  return (
    <div className="relative aspect-square w-full max-w-[640px]">
      <svg
        viewBox="0 0 600 600"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="tier-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C15F3C" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#C15F3C" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#C15F3C" stopOpacity="0" />
          </radialGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1814" strokeWidth="0.3" opacity="0.06" />
          </pattern>
        </defs>

        {/* Background grid */}
        <rect width="600" height="600" fill="url(#grid)" />
        <circle cx="300" cy="300" r="290" fill="url(#tier-glow)" />

        {/* Outer ring: Organisation */}
        <g className="ring-pulse-3">
          <circle
            cx="300"
            cy="300"
            r="270"
            fill="none"
            stroke="#1a1814"
            strokeWidth="1"
            strokeDasharray="2 6"
            opacity="0.5"
          />
        </g>
        <g className="orbit-slow" style={{ transformOrigin: "300px 300px" }}>
          <circle cx="300" cy="30" r="4" fill="#1a1814" />
          <circle cx="570" cy="300" r="3" fill="#665f54" />
          <circle cx="120" cy="510" r="3" fill="#665f54" />
        </g>

        {/* Middle ring: Team */}
        <g className="ring-pulse-2">
          <circle
            cx="300"
            cy="300"
            r="180"
            fill="none"
            stroke="#1a1814"
            strokeWidth="1"
            opacity="0.7"
          />
        </g>
        <g className="orbit-rev" style={{ transformOrigin: "300px 300px" }}>
          <circle cx="300" cy="120" r="5" fill="#C15F3C" />
          <circle cx="480" cy="300" r="4" fill="#1a1814" />
          <circle cx="180" cy="420" r="4" fill="#1a1814" />
        </g>

        {/* Inner ring: Personal */}
        <g className="ring-pulse-1">
          <circle
            cx="300"
            cy="300"
            r="100"
            fill="#FAF6EE"
            stroke="#1a1814"
            strokeWidth="1.2"
          />
        </g>

        {/* Center: the user */}
        <circle cx="300" cy="300" r="10" fill="#1a1814" />

        {/* Connecting lines from center */}
        <g opacity="0.3">
          <line x1="300" y1="300" x2="300" y2="120" stroke="#1a1814" strokeWidth="0.5" />
          <line x1="300" y1="300" x2="480" y2="300" stroke="#1a1814" strokeWidth="0.5" />
          <line x1="300" y1="300" x2="300" y2="30" stroke="#1a1814" strokeWidth="0.5" />
        </g>

        {/* Labels */}
        <text x="300" y="318" textAnchor="middle" fontSize="9" fill="#FAF6EE" fontFamily="var(--font-geist-mono)" letterSpacing="2">
          YOU
        </text>
      </svg>

      {/* Tier labels */}
      <div className="pointer-events-none absolute inset-0">
        <span className="mono absolute left-1/2 top-[44%] -translate-x-1/2 text-[var(--ink-mute)]">
          Personal
        </span>
        <span className="mono absolute left-1/2 top-[24%] -translate-x-1/2 text-[var(--ink-mute)]">
          Team
        </span>
        <span className="mono absolute left-1/2 top-[5%] -translate-x-1/2 text-[var(--ink-mute)]">
          Organisation
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── PROTOCOL ───────────────────────── */

function Protocol() {
  return (
    <section id="protocol" className="py-28 lg:py-40">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 gap-y-16 px-8 lg:px-14">
        <div className="col-span-12 lg:col-span-5">
          <figure className="relative">
            <div className="absolute -inset-2 -z-10 rounded-full bg-[var(--clay-soft)]/30 blur-3xl" />
            <Image
              src="/landing/knowledge-atom.png"
              alt=""
              width={1024}
              height={1024}
              className="aspect-square w-full rounded-[2px] object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <figcaption className="mono mt-5 flex justify-between text-[var(--ink-faint)]">
              <span>Plate II</span>
              <span>A single atom, in macro</span>
            </figcaption>
          </figure>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <p className="mono mb-7 text-[var(--clay-deep)]">§ 03 / The protocol</p>
          <h2 className="display text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] text-[var(--ink)]">
            Knowledge as a structured object, not a chat log.
          </h2>
          <p className="mt-8 text-[1.05rem] leading-[1.65] text-[var(--ink-soft)]">
            We extract atoms, not transcripts. Each atom has a type, a confidence, a
            scope, a provenance, and a half-life. They are stored in pgvector for
            similarity, indexed for the graph, and reconciled nightly to detect drift,
            staleness, and contradiction.
          </p>
          <hr className="rule my-10" />

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {[
              { kind: "Fact", note: "verifiable, slow decay" },
              { kind: "Decision", note: "rationale preserved" },
              { kind: "Solution", note: "actionable, cross-referenced" },
              { kind: "Preference", note: "personal scope by default" },
              { kind: "Process", note: "high decay, frequent review" },
              { kind: "Relationship", note: "graph-linked to entities" },
              { kind: "Context", note: "ephemeral, expires on signal" },
              { kind: "Conflict", note: "flagged for human review" },
            ].map((a) => (
              <div key={a.kind} className="border-b border-[var(--hairline)] pb-3">
                <div className="display text-xl text-[var(--ink)]">{a.kind}</div>
                <div className="mono mt-1 text-[var(--ink-mute)]">{a.note}</div>
              </div>
            ))}
          </div>

          <div className="mono mt-12 inline-flex items-center gap-3 rounded-full border border-[var(--ink)] px-5 py-3 text-[var(--ink)]">
            <Pulse />
            Open spec · OMP v1
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── MULTI MODEL ───────────────────────── */

function MultiModel() {
  const models = [
    "GPT-4o",
    "Claude Opus 4.6",
    "Claude Sonnet 4",
    "Gemini 2.5 Pro",
    "Grok 3",
    "Llama 4",
    "o3",
    "Gemini Flash",
    "Claude Haiku",
    "GPT-4o Mini",
  ];
  return (
    <section id="models" className="border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--paper)]">
      <div className="mx-auto max-w-[1440px] px-8 py-28 lg:px-14 lg:py-40">
        <div className="grid grid-cols-12 gap-x-6 gap-y-14">
          <div className="col-span-12 lg:col-span-5">
            <p className="mono mb-7 text-[var(--clay-soft)]">§ 04 / Every model, one room</p>
            <h2 className="display text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] text-[var(--paper)]">
              Why bet on a single provider when you can have all of them, and keep
              what you learn regardless of which one was talking?
            </h2>
          </div>

          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <figure className="relative">
              <Image
                src="/landing/multi-model-constellation.png"
                alt=""
                width={1536}
                height={1024}
                className="w-full rounded-[2px] object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <figcaption className="mono mt-5 flex justify-between text-[var(--paper)]/50">
                <span>Plate III</span>
                <span>Five providers, in constellation</span>
              </figcaption>
            </figure>
          </div>
        </div>

        {/* Marquee of model names */}
        <div className="mt-20 overflow-hidden border-y border-[var(--paper)]/15">
          <div className="marquee-track flex items-center gap-12 py-7">
            {[...models, ...models].map((m, i) => (
              <span
                key={i}
                className="display flex items-center gap-12 whitespace-nowrap text-[2.6rem] text-[var(--paper)]/85"
              >
                {m}
                <span className="display-italic text-[var(--clay-soft)]">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Mid-conversation switch */}
        <div className="mt-20 grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono mb-5 text-[var(--clay-soft)]">A unique capability</p>
            <h3 className="display text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.05] text-[var(--paper)]">
              Switch models <span className="display-italic">mid-thread.</span> Context
              survives.
            </h3>
            <p className="mt-6 max-w-[58ch] text-[1.05rem] leading-[1.65] text-[var(--paper)]/70">
              A second opinion is one keystroke away. Open a thread with Claude,
              ask GPT the next question, then send the result to Gemini. Knowledge HQ
              keeps the entire context coherent across providers.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <SwitchDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

function SwitchDemo() {
  const turns = [
    { who: "You", model: null, text: "How would we shard the events table?" },
    { who: "Claude Sonnet", model: "claude", text: "Hash by tenant_id, range by week. Keeps tenants co-located while bounding hot partitions." },
    { who: "You", model: null, text: "Send that answer to GPT-4o for a sanity check." },
    { who: "GPT-4o", model: "gpt", text: "Concur on tenant_id hash. Suggest pg_partman for the weekly ranges; review your retention policy." },
  ];
  return (
    <div className="rounded-[2px] border border-[var(--paper)]/15 bg-[var(--paper)]/5 p-6">
      <div className="mono mb-5 flex items-center justify-between text-[var(--paper)]/50">
        <span>Knowledge HQ · thread #4421</span>
        <span className="flex items-center gap-1.5">
          <Pulse soft /> live
        </span>
      </div>
      <div className="space-y-4 text-[0.95rem]">
        {turns.map((t, i) => (
          <div key={i} className="grid grid-cols-[88px_1fr] items-baseline gap-3">
            <span className="mono text-[var(--paper)]/45">{t.who}</span>
            <p className="leading-[1.55] text-[var(--paper)]/90">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── PRODUCT THEATRE ───────────────────────── */

function ProductTheatre() {
  return (
    <section className="py-28 lg:py-40">
      <div className="mx-auto max-w-[1440px] px-8 lg:px-14">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono mb-7 text-[var(--clay-deep)]">§ 05 / In practice</p>
            <h2 className="display text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] text-[var(--ink)]">
              A workspace that <span className="display-italic">remembers</span>.
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-4 lg:col-start-9">
            <p className="text-[1.02rem] leading-[1.65] text-[var(--ink-soft)]">
              Three panels: the conversation, the model in use, and the knowledge atoms
              quietly attached to the answer, with citations, confidence, and the option
              to promote any atom to your team&rsquo;s shared memory.
            </p>
          </div>
        </div>

        <div className="mt-16 overflow-hidden rounded-[3px] border border-[var(--ink)] bg-[var(--paper-pale)] shadow-[0_30px_80px_-30px_rgba(26,24,20,0.35)]">
          {/* Top rail */}
          <div className="flex items-center justify-between border-b border-[var(--ink)] bg-[var(--ink)] px-6 py-3 text-[var(--paper)]">
            <div className="mono flex items-center gap-2 text-[var(--paper)]/60">
              <span>knowledge-hq</span>
              <span className="text-[var(--paper)]/30">/</span>
              <span>workspace</span>
              <span className="text-[var(--paper)]/30">/</span>
              <span className="text-[var(--clay-soft)]">events-sharding</span>
            </div>
            <div className="mono flex items-center gap-2 text-[var(--paper)]/60">
              <Pulse soft />
              autosave
            </div>
          </div>

          {/* Three columns */}
          <div className="grid grid-cols-12 gap-0 lg:min-h-[520px]">
            {/* Threads */}
            <aside className="col-span-12 border-r border-[var(--hairline)] bg-[var(--paper)] p-6 lg:col-span-3">
              <div className="mono mb-5 text-[var(--ink-faint)]">Recent threads</div>
              <ul className="space-y-1.5">
                {[
                  { t: "Events sharding", on: true },
                  { t: "Q3 pricing brief", on: false },
                  { t: "Onboarding rewrite", on: false },
                  { t: "Stripe webhook race", on: false },
                  { t: "Migration plan v2", on: false },
                ].map((th) => (
                  <li
                    key={th.t}
                    className={`rounded-[2px] border px-3 py-2 text-[0.92rem] ${
                      th.on
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                        : "border-transparent text-[var(--ink-mute)] hover:border-[var(--hairline)]"
                    }`}
                  >
                    {th.t}
                  </li>
                ))}
              </ul>
            </aside>

            {/* Conversation */}
            <main className="col-span-12 border-r border-[var(--hairline)] p-8 lg:col-span-6">
              <div className="mono mb-6 flex items-center gap-3 text-[var(--ink-faint)]">
                <span>Claude Sonnet 4</span>
                <span>·</span>
                <span>8 atoms in context</span>
              </div>
              <div className="space-y-7 text-[0.96rem] leading-[1.62] text-[var(--ink)]">
                <div>
                  <div className="mono mb-1.5 text-[var(--ink-faint)]">You</div>
                  <p>How would we shard the events table for the new region?</p>
                </div>
                <div>
                  <div className="mono mb-1.5 text-[var(--clay-deep)]">Knowledge HQ</div>
                  <p>
                    Given the team&rsquo;s prior decision (March &rsquo;26) to standardise on{" "}
                    <em className="display-italic">hash-by-tenant_id, range-by-week</em>,
                    extending the same pattern to the new region keeps pg_partman config
                    portable.
                  </p>
                  <p className="mt-3 text-[var(--ink-soft)]">
                    Two atoms attached this answer to past context.
                  </p>
                </div>
              </div>
            </main>

            {/* Atoms */}
            <aside className="col-span-12 bg-[var(--paper)] p-6 lg:col-span-3">
              <div className="mono mb-5 flex items-center justify-between text-[var(--ink-faint)]">
                <span>Atoms</span>
                <span>0.94 confidence</span>
              </div>
              <div className="space-y-3">
                {[
                  { type: "decision", text: "Standardise on hash(tenant_id) + range(week)", scope: "team" },
                  { type: "fact", text: "events table currently sharded by region", scope: "org" },
                ].map((a) => (
                  <div
                    key={a.text}
                    className="border-l-2 border-[var(--clay)] bg-[var(--paper-pale)] p-3"
                  >
                    <div className="mono mb-1.5 flex justify-between text-[var(--clay-deep)]">
                      <span>{a.type}</span>
                      <span className="text-[var(--ink-faint)]">{a.scope}</span>
                    </div>
                    <p className="text-[0.86rem] leading-[1.5] text-[var(--ink)]">{a.text}</p>
                  </div>
                ))}
              </div>

              <hr className="rule my-7" />
              <div className="mono mb-3 text-[var(--ink-faint)]">Reconciled today</div>
              <ul className="space-y-2 text-[0.86rem] text-[var(--ink-soft)]">
                <li>· 2 atoms affirmed</li>
                <li>· 1 atom marked stale</li>
                <li>· 1 conflict resolved</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── CLOSING ───────────────────────── */

function Closing() {
  return (
    <section className="border-t border-[var(--hairline)] bg-[var(--paper-pale)]/50 py-32 lg:py-44">
      <div className="mx-auto max-w-[1100px] px-8 text-center lg:px-14">
        <p className="mono mb-10 text-[var(--clay-deep)]">A closing remark</p>
        <p className="display text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[1.04] text-[var(--ink)]">
          The companies that win the next decade are the ones that{" "}
          <span className="display-italic">remember</span> what their people learned with
          machines.
        </p>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
          <Link
            href="/chat"
            className="mono link-shift inline-flex items-center rounded-full bg-[var(--ink)] px-8 py-4 text-[var(--paper)] hover:bg-[var(--clay-deep)]"
          >
            Begin a conversation
            <ArrowEast />
          </Link>
          <Link
            href="/register"
            className="mono link-underline text-[var(--ink-soft)]"
          >
            Create an organisation →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FOOTER ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] py-14">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6 px-8 text-[var(--ink-soft)] lg:px-14">
        <div className="col-span-12 lg:col-span-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[1.5rem] font-semibold tracking-[-0.022em] text-[var(--ink)]"
            style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
          >
            <svg width="28" height="28" viewBox="0 0 80 80" aria-hidden="true">
              <g fill="#1a1814">
                <rect x="14" y="22" width="14" height="9" rx="2" />
                <rect x="14" y="36" width="28" height="9" rx="2" />
                <rect x="14" y="50" width="42" height="9" rx="2" />
              </g>
              <circle cx="21" cy="13" r="3.5" fill="#C15F3C" />
            </svg>
            Knowledge HQ
          </Link>
          <p className="mt-4 max-w-[40ch] text-[0.95rem] leading-[1.6]">
            The Organizational Memory Protocol. The workspace that implements it.
          </p>
        </div>
        <div className="col-span-6 lg:col-span-2">
          <div className="mono mb-4 text-[var(--ink-faint)]">Product</div>
          <ul className="space-y-2 text-[0.9rem]">
            <li><Link href="/chat" className="link-underline">App</Link></li>
            <li><a href="#tiers" className="link-underline">Memory</a></li>
            <li><a href="#protocol" className="link-underline">Protocol</a></li>
          </ul>
        </div>
        <div className="col-span-6 lg:col-span-2">
          <div className="mono mb-4 text-[var(--ink-faint)]">Company</div>
          <ul className="space-y-2 text-[0.9rem]">
            <li><Link href="/register" className="link-underline">Register</Link></li>
            <li><Link href="/login" className="link-underline">Sign in</Link></li>
          </ul>
        </div>
        <div className="col-span-12 lg:col-span-3">
          <div className="mono mb-4 text-[var(--ink-faint)]">Colophon</div>
          <p className="text-[0.86rem] leading-[1.6]">
            Set in Fraunces and Inter Tight. Plates I-III generated for this issue.
          </p>
        </div>
        <div className="col-span-12 mt-8 flex items-center justify-between border-t border-[var(--hairline)] pt-6 text-[0.8rem]">
          <span className="mono">© Knowledge HQ {new Date().getFullYear()}</span>
          <span className="mono text-[var(--ink-faint)]">v1 · issue 01</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── PRIMITIVES ───────────────────────── */

function ArrowEast() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 7h10" />
      <path d="m8 3 4 4-4 4" />
    </svg>
  );
}

function Pulse({ soft }: { soft?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${soft ? "bg-[var(--clay-soft)]" : "bg-[var(--clay)]"} opacity-60`}
      />
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${soft ? "bg-[var(--clay-soft)]" : "bg-[var(--clay)]"}`}
      />
    </span>
  );
}
