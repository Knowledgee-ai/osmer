import Link from "next/link";

export const metadata = {
  title: "Logo candidates · Knowledge HQ",
};

type Candidate = {
  id: string;
  name: string;
  tagline: string;
  rationale: string;
  Mark: () => React.ReactElement;
};

const CANDIDATES: Candidate[] = [
  {
    id: "monolith",
    name: "01 / HQ Monolith",
    tagline: "HQ + three tiers, in one solid form",
    rationale:
      "A solid filled square — the headquarters, the archive, the stamp — with three negative-space slits dividing it into Personal / Team / Organisation. A clay dot sits at the upper-right corner like a wax seal. Reads as a brand mark, not a diagram. Holds up at 16px.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <rect x="12" y="12" width="56" height="56" rx="3" fill="#1a1814" />
        {/* Top tier-slit in clay (Personal/Team boundary) */}
        <rect x="14" y="31.5" width="52" height="3" rx="1.5" fill="#D85728" />
        {/* Bottom tier-slit cuts through to cream paper (Team/Organisation boundary) */}
        <rect x="14" y="47.5" width="52" height="3" rx="1.5" fill="#F4EFE6" />
        {/* Corner wax-seal */}
        <circle cx="68" cy="12" r="6" fill="#D85728" />
      </svg>
    ),
  },
  {
    id: "convergence",
    name: "02 / Inward Convergence",
    tagline: "Three tiers feeding one source of truth",
    rationale:
      "Three triangular wedges pointing inward — the inverse of Anthropic's outward asterisk. Anthropic radiates (generative). Knowledge HQ converges (capture). The clay dot at the geometric center is the atom; the wedges are the three tiers feeding it.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <g fill="#1a1814">
          <polygon points="24,8 56,8 40,32" />
          <g transform="rotate(120 40 40)">
            <polygon points="24,8 56,8 40,32" />
          </g>
          <g transform="rotate(240 40 40)">
            <polygon points="24,8 56,8 40,32" />
          </g>
        </g>
        <circle cx="40" cy="40" r="4.5" fill="#C15F3C" />
      </svg>
    ),
  },
  {
    id: "bracket",
    name: "03 / Bracket-Atom",
    tagline: "The protocol frames a single atom",
    rationale:
      "Four corner brackets like registration marks on a magazine spread, framing a single clay atom at the geometric center. The brackets are the OMP protocol; the dot is the atom. Maximally minimal — has a publishing / archival feel that matches the editorial body.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <g stroke="#1a1814" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 14 28 V 14 H 28" />
          <path d="M 52 14 H 66 V 28" />
          <path d="M 14 52 V 66 H 28" />
          <path d="M 52 66 H 66 V 52" />
        </g>
        <circle cx="40" cy="40" r="5" fill="#C15F3C" />
      </svg>
    ),
  },
  {
    id: "archive",
    name: "04 / Stacked Archive",
    tagline: "Layered records, accumulating",
    rationale:
      "Three filled rectangles offset rightward, like papers in a filing cabinet pulled forward in sequence. Visible edges hint at depth and accumulation. Architectural file-cabinet feel. Closer to Notion / Perplexity territory than the others, so a slightly safer pick.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        {/* Top sheet (smallest, Personal tier) in clay */}
        <rect x="12" y="20" width="42" height="13" rx="2" fill="#D85728" />
        <rect x="16" y="35" width="46" height="13" rx="2" fill="#1a1814" />
        <rect x="20" y="50" width="50" height="13" rx="2" fill="#1a1814" />
      </svg>
    ),
  },
  {
    id: "k-vault",
    name: "05 / Geometric K-Vault",
    tagline: "An architectural K, not a font letter",
    rationale:
      "A K constructed from geometric solids (like Vercel's triangle is a 'V' only by abstraction). Vertical spine, upper diagonal in ink, lower diagonal in clay — the asymmetry is the brand mark. Direct branding via the K, but feels like a tech logo rather than a serif wordmark.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <rect x="14" y="12" width="11" height="56" rx="1.5" fill="#1a1814" />
        <polygon points="25,40 60,12 64,12 64,22 38,40" fill="#1a1814" />
        <polygon points="25,40 60,68 64,68 64,58 38,40" fill="#C15F3C" />
      </svg>
    ),
  },
];

export default function LogoLabPage() {
  return (
    <div data-theme="paper" className="paper-grain h-full overflow-y-auto">
      <header className="border-b border-[var(--hairline)]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-7 lg:px-14">
          <Link href="/" className="mono link-underline text-[var(--ink-soft)]">
            ← Back to landing
          </Link>
          <span className="mono text-[var(--clay-deep)]">Logo candidates · v1</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-8 pt-20 pb-14 lg:px-14">
        <p className="mono mb-8 text-[var(--clay-deep)]">Logo lab · pick one</p>
        <h1
          className="text-[clamp(3rem,6vw,5rem)] leading-[0.98] text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.025em" }}
        >
          Five marks for{" "}
          <span style={{ fontStyle: "italic", color: "var(--clay-deep)" }}>Knowledge HQ</span>.
        </h1>
        <p className="mt-8 max-w-[60ch] text-[1.05rem] leading-[1.65] text-[var(--ink-soft)]">
          Each candidate encodes a different concept from the brief: HQ + tiers,
          convergence vs. radiation, capture / framing, archival accumulation, or
          a direct architectural K. All five rendered at the size they&rsquo;d
          appear in the nav, on a billboard, and at favicon scale, so you can pick
          on real visual evidence rather than a sketch.
        </p>
      </section>

      <section className="mx-auto max-w-[1280px] px-8 pb-32 lg:px-14">
        <ul className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {CANDIDATES.map((c) => (
            <li key={c.id} className="grid grid-cols-12 gap-x-6 gap-y-10 py-16">
              {/* Header column */}
              <div className="col-span-12 lg:col-span-3">
                <div className="mono mb-5 text-[var(--clay-deep)]">{c.name}</div>
                <div
                  className="text-[1.5rem] leading-[1.1] text-[var(--ink)]"
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontWeight: 600,
                    letterSpacing: "-0.022em",
                  }}
                >
                  {c.tagline}
                </div>
                <p className="mt-5 text-[0.95rem] leading-[1.6] text-[var(--ink-mute)]">
                  {c.rationale}
                </p>
              </div>

              {/* Three sizes */}
              <div className="col-span-12 grid grid-cols-3 items-center gap-x-6 lg:col-span-9">
                {/* Big display */}
                <div className="flex flex-col items-center justify-center">
                  <div className="aspect-square w-full max-w-[200px]">
                    <c.Mark />
                  </div>
                  <span className="mono mt-4 text-[var(--ink-faint)]">Display · 200px</span>
                </div>

                {/* Nav size with wordmark */}
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2.5">
                    <span className="block h-9 w-9">
                      <c.Mark />
                    </span>
                    <span
                      className="text-[1.35rem] text-[var(--ink)]"
                      style={{
                        fontFamily: "var(--font-body), system-ui, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "-0.022em",
                      }}
                    >
                      Knowledge&nbsp;HQ
                    </span>
                  </div>
                  <span className="mono mt-4 text-[var(--ink-faint)]">Nav · 36px + wordmark</span>
                </div>

                {/* Favicon scale */}
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-[3px] border border-[var(--hairline)] bg-[var(--paper-pale)] p-1"
                      style={{ width: "20px", height: "20px" }}
                    >
                      <c.Mark />
                    </div>
                    <div
                      className="rounded-[3px] border border-[var(--hairline)] bg-[var(--paper-pale)] p-1"
                      style={{ width: "32px", height: "32px" }}
                    >
                      <c.Mark />
                    </div>
                    <div
                      className="rounded-[3px] border border-[var(--ink)] bg-[var(--ink)] p-1"
                      style={{ width: "32px", height: "32px" }}
                    >
                      <span className="block h-full w-full" style={{ filter: "invert(1)" }}>
                        <c.Mark />
                      </span>
                    </div>
                  </div>
                  <span className="mono mt-4 text-[var(--ink-faint)]">Favicon · 16 / 24 / dark</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-6 border-t border-[var(--hairline)] pt-12">
          <p className="text-[1rem] leading-[1.6] text-[var(--ink-soft)]">
            When you&rsquo;ve picked, tell me <span className="mono text-[var(--clay-deep)]">01</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">02</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">03</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">04</span>, or{" "}
            <span className="mono text-[var(--clay-deep)]">05</span> and I&rsquo;ll wire it
            across nav, footer, favicon, and Apple-icon.
          </p>
          <Link
            href="/"
            className="mono link-shift inline-flex items-center rounded-full bg-[var(--ink)] px-7 py-3.5 text-[var(--paper)] hover:bg-[var(--clay-deep)]"
          >
            Back to landing
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
              className="ml-2"
            >
              <path d="M2 7h10" />
              <path d="m8 3 4 4-4 4" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
