"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

// Scroll distance over which the wordmark is fully drawn into the void.
// Larger range = slower, more cinematic suck-in.
const SUCK_RANGE_PX = 160;
// Background-frosting kicks in as soon as we begin scrolling.
const SCROLL_THRESHOLD = 6;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const tailRef = useRef<HTMLSpanElement | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mq.matches;
    const onChange = () => {
      reduceMotionRef.current = mq.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('[data-theme="paper"]');
    if (!scroller) return;

    let ticking = false;
    const apply = (progress: number) => {
      const tail = tailRef.current;
      if (!tail) return;
      // Reduced-motion: honour the system preference — pure opacity fade,
      // no translation / blur / rotation.
      if (reduceMotionRef.current) {
        tail.style.transform = "";
        tail.style.filter = "";
        tail.style.opacity = String(1 - progress);
        return;
      }
      // Quadratic ease-in. Real gravitational pull accelerates near the
      // singularity, so a slow start with a quick finish reads as "drawn
      // in by the void" rather than "linearly faded out".
      const eased = progress * progress;
      // Pull the wordmark left toward the SymbolMark while shrinking it
      // toward its own left edge (transform-origin set in style below).
      // The point ends up just inside the disc.
      const tx = eased * -14;
      const scale = Math.max(0.001, 1 - eased * 0.985);
      const rot = eased * 6; // gentle inward curl
      const blur = eased * 4; // motion blur as it accelerates
      tail.style.transform = `translateX(${tx}px) scale(${scale}) rotate(${rot}deg)`;
      tail.style.filter = blur > 0.05 ? `blur(${blur}px)` : "";
      tail.style.opacity = String(1 - eased);
    };

    const update = () => {
      const t = Math.min(1, Math.max(0, scroller.scrollTop / SUCK_RANGE_PX));
      apply(t);
      const nextScrolled = scroller.scrollTop > SCROLL_THRESHOLD;
      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
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

  const tailStyle: CSSProperties = {
    display: "inline-block",
    transformOrigin: "0% 50%",
    willChange: "transform, opacity, filter",
  };

  return (
    <div
      className="nav-shell sticky top-0 z-40"
      data-scrolled={scrolled ? "true" : "false"}
    >
      <nav className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-8 pt-7 pb-4 lg:px-14">
        <Link
          href="/"
          aria-label="Osmer, home"
          className="logo-collapsible justify-self-start"
        >
          <span className="logo-mark" aria-hidden="true">
            <SymbolMark />
          </span>
          <span className="tail-clip" aria-hidden="true">
            <span ref={tailRef} className="logo-tail" style={tailStyle}>
              Osmer
            </span>
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
