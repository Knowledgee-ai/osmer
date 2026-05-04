import Link from "next/link";

export const metadata = {
  title: "Logo candidates · Osmer",
};

type Candidate = {
  id: string;
  name: string;
  tagline: string;
  rationale: string;
  adopted?: boolean;
  Mark: () => React.ReactElement;
};

const CANDIDATES: Candidate[] = [
  {
    id: "aperture",
    name: "01 / Aperture",
    tagline: "A boundary, with one atom across it",
    adopted: true,
    rationale:
      "A solid ink disk (the membrane, the system of record) with a smaller clay disk offset to the upper-right — a single atom of knowledge passing across the boundary. Reads as cell, portal, lens, planet. Reductive osmotic figure that holds at favicon scale and pairs cleanly with the Osmer wordmark.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <circle cx="40" cy="40" r="28" fill="#1a1814" />
        <circle cx="50" cy="30" r="6" fill="#D85728" />
      </svg>
    ),
  },
  {
    id: "halo",
    name: "02 / Halo",
    tagline: "Iris, target, cell — perfectly centred",
    rationale:
      "A thin ink ring with a clay nucleus dead-centre. Pure cell-and-iris symmetry, calmer than Aperture, less metaphor-loaded. Risks reading as a generic record/play button at very small sizes; works best when locked up beside the wordmark.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <circle cx="40" cy="40" r="28" fill="none" stroke="#1a1814" strokeWidth="3" />
        <circle cx="40" cy="40" r="7" fill="#D85728" />
      </svg>
    ),
  },
  {
    id: "crescent",
    name: "03 / Crescent",
    tagline: "Light entering at the membrane",
    rationale:
      "A solid ink disk with a clay crescent hugging its right edge — knowledge entering at the boundary, the moment of permeation. More lyrical than Aperture, slightly less identifiable at 16px because the crescent thins to a sliver. A brand mark that needs a wordmark beside it.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <defs>
          <mask id="crescent-cut">
            <rect width="80" height="80" fill="white" />
            <circle cx="34" cy="40" r="28" fill="black" />
          </mask>
        </defs>
        <circle cx="40" cy="40" r="28" fill="#1a1814" />
        <circle cx="40" cy="40" r="28" fill="#D85728" mask="url(#crescent-cut)" />
      </svg>
    ),
  },
  {
    id: "tier-aperture",
    name: "04 / Tier Aperture",
    tagline: "Three tiers, sealed inside one membrane",
    rationale:
      "An ink disk with three concentric inner discs visible against cream — Personal (clay) at the centre, Team and Organisation outward. Encodes the OMP three-tier protocol inside the osmotic figure. Densest with meaning, slightly busier — works well as a 200px display mark, a hair fussy at 16px.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <circle cx="40" cy="40" r="28" fill="#1a1814" />
        <circle cx="40" cy="40" r="20" fill="#F4EFE6" />
        <circle cx="40" cy="40" r="13" fill="#1a1814" />
        <circle cx="40" cy="40" r="6" fill="#D85728" />
      </svg>
    ),
  },
  {
    id: "wordmark",
    name: "05 / Wordmark · o.",
    tagline: "Just the name, set carefully",
    rationale:
      "Lowercase Fraunces ‘o’ followed by a clay period — no separate symbol. Leans on the strength of the Osmer wordmark itself. Most editorial, most Anthropic-adjacent. Doesn't give you a favicon-scale glyph, so it pairs best with one of the disc marks above for that role.",
    Mark: () => (
      <svg viewBox="0 0 80 80" className="block h-full w-full">
        <text
          x="14"
          y="60"
          fontSize="64"
          fontFamily="var(--font-display), Georgia, serif"
          fontStyle="italic"
          fill="#1a1814"
        >
          o
        </text>
        <circle cx="62" cy="58" r="5" fill="#D85728" />
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
          <span className="mono text-[var(--clay-deep)]">Logo candidates · Osmer · v1</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-8 pt-20 pb-14 lg:px-14">
        <p className="mono mb-8 text-[var(--clay-deep)]">Logo lab · Osmer · pick or confirm</p>
        <h1
          className="text-[clamp(3rem,6vw,5rem)] leading-[0.98] text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.025em" }}
        >
          Five marks for{" "}
          <span style={{ fontStyle: "italic", color: "var(--clay-deep)" }}>Osmer</span>.
        </h1>
        <p className="mt-8 max-w-[60ch] text-[1.05rem] leading-[1.65] text-[var(--ink-soft)]">
          Osmer is the system of record for the work your team does with machines.
          The brand metaphor is osmosis — knowledge passing across a membrane and
          accumulating inside the organisation. Each candidate encodes that idea
          differently: a single atom across a boundary, a centred nucleus, a glowing
          edge, three tiers nested inside, or a pure wordmark. All five are rendered
          at the size they’d appear in the nav, on a billboard, and at favicon scale,
          so you can pick on real visual evidence rather than a sketch.
        </p>
        <p className="mt-6 max-w-[60ch] text-[0.95rem] leading-[1.6] text-[var(--ink-mute)]">
          <span className="mono text-[var(--clay-deep)]">01 / Aperture</span> is currently
          adopted across the app, landing, and favicon. Confirm or swap with{" "}
          <span className="mono text-[var(--clay-deep)]">02</span>,{" "}
          <span className="mono text-[var(--clay-deep)]">03</span>,{" "}
          <span className="mono text-[var(--clay-deep)]">04</span>, or{" "}
          <span className="mono text-[var(--clay-deep)]">05</span>.
        </p>
      </section>

      <section className="mx-auto max-w-[1280px] px-8 pb-32 lg:px-14">
        <ul className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {CANDIDATES.map((c) => (
            <li key={c.id} className="grid grid-cols-12 gap-x-6 gap-y-10 py-16">
              {/* Header column */}
              <div className="col-span-12 lg:col-span-3">
                <div className="mono mb-5 flex items-center gap-3 text-[var(--clay-deep)]">
                  <span>{c.name}</span>
                  {c.adopted && (
                    <span className="inline-flex items-center rounded-full border border-[var(--ink)] bg-[var(--ink)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]">
                      Adopted
                    </span>
                  )}
                </div>
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
                      Osmer
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
            Confirm or swap by telling me{" "}
            <span className="mono text-[var(--clay-deep)]">01</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">02</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">03</span>,{" "}
            <span className="mono text-[var(--clay-deep)]">04</span>, or{" "}
            <span className="mono text-[var(--clay-deep)]">05</span>. I&rsquo;ll re-wire
            nav, footer, favicon, and Apple-icon to match.
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
