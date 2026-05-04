"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COLLAPSE_THRESHOLD = 32;

export function LandingNav() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-theme="paper"]');
    if (!scroller) return;

    let ticking = false;
    const update = () => {
      const next = scroller.scrollTop > COLLAPSE_THRESHOLD;
      setCollapsed((prev) => (prev === next ? prev : next));
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="nav-shell sticky top-0 z-40"
      data-scrolled={collapsed ? "true" : "false"}
    >
      <nav className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-8 pt-7 pb-4 lg:px-14">
        <Link
          href="/"
          aria-label="Osmer, home"
          className="logo-collapsible justify-self-start"
          data-collapsed={collapsed ? "true" : "false"}
        >
          <span className="logo-mark" aria-hidden="true">
            <SymbolMark />
          </span>
          <span className="tail-clip" aria-hidden="true">
            <span className="logo-tail">Osmer</span>
          </span>
          <span className="sr-only">Osmer</span>
        </Link>

        <div className="hidden items-center gap-10 justify-self-center md:flex">
          <a href="#problem" className="mono link-underline text-[var(--ink-soft)]">
            Problem
          </a>
          <a href="#tiers" className="mono link-underline text-[var(--ink-soft)]">
            Memory
          </a>
          <a href="#protocol" className="mono link-underline text-[var(--ink-soft)]">
            Protocol
          </a>
          <a href="#models" className="mono link-underline text-[var(--ink-soft)]">
            Models
          </a>
        </div>

        <Link
          href="/chat"
          className="mono link-shift inline-flex items-center justify-self-end rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 py-2.5 text-[var(--paper)] hover:border-[var(--clay-deep)] hover:bg-[var(--clay-deep)]"
        >
          Open the app
          <ArrowEast />
        </Link>
      </nav>
    </div>
  );
}

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
      className="ml-2"
    >
      <path d="M2 7h10" />
      <path d="m8 3 4 4-4 4" />
    </svg>
  );
}

/**
 * Osmer symbol mark — Aperture (live).
 *
 * A small accretion disc: a clay-toned glow ring with drifting particles
 * orbiting an ink void at the centre. The disc is a soft radial gradient
 * (no hard edge); the ring of particles rotates slowly via SMIL so the
 * mark feels alive in the nav and footer without demanding attention.
 * Brand metaphor: knowledge orbiting a permeable boundary, drawn inward.
 */
function SymbolMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 80 80"
      aria-hidden="true"
      className="block"
    >
      <defs>
        <radialGradient id="osmer-aperture-glow" cx="50%" cy="50%" r="50%">
          <stop offset="22%" stopColor="#1a1814" stopOpacity="0" />
          <stop offset="40%" stopColor="#D85728" stopOpacity="0" />
          <stop offset="58%" stopColor="#D85728" stopOpacity="0.95" />
          <stop offset="78%" stopColor="#D85728" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#D85728" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="url(#osmer-aperture-glow)" />
      <g>
        <circle cx="40" cy="14" r="1.4" fill="#1a1814" />
        <circle cx="61" cy="28" r="1" fill="#1a1814" opacity="0.55" />
        <circle cx="64" cy="50" r="1.2" fill="#1a1814" opacity="0.7" />
        <circle cx="40" cy="66" r="0.9" fill="#1a1814" opacity="0.5" />
        <circle cx="19" cy="52" r="1" fill="#1a1814" opacity="0.6" />
        <circle cx="17" cy="31" r="1.2" fill="#1a1814" opacity="0.7" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 40 40"
          to="360 40 40"
          dur="36s"
          repeatCount="indefinite"
        />
      </g>
      <circle cx="40" cy="40" r="11" fill="#1a1814" />
    </svg>
  );
}
