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
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-8 pt-7 pb-4 lg:px-14">
        <Link
          href="/"
          aria-label="Knowledgee, home"
          className="logo-collapsible group flex items-center"
          data-collapsed={collapsed ? "true" : "false"}
        >
          <KMark />
          <span className="logo-tail display text-[1.55rem] tracking-tight text-[var(--ink)]">
            <span aria-hidden="true">nowledgee</span>
          </span>
          {/* Visually-hidden full word for screen readers */}
          <span className="sr-only">Knowledgee</span>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
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
          className="mono link-shift inline-flex items-center rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 py-2.5 text-[var(--paper)] hover:border-[var(--clay-deep)] hover:bg-[var(--clay-deep)]"
        >
          Open the app
          <ArrowEast />
        </Link>
      </nav>
    </div>
  );
}

function KMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 80 80"
      aria-hidden="true"
      className="logo-mark shrink-0 overflow-visible"
    >
      <g fill="#1a1814">
        <rect x="14" y="18" width="8" height="44" />
        <rect x="10" y="14" width="16" height="4" />
        <rect x="10" y="62" width="16" height="4" />
        <path d="M22 38 L52 18 L60 18 L60 22 L56 22 L30 40 Z" />
        <path d="M22 42 L52 62 L60 62 L60 58 L56 58 L30 40 Z" />
      </g>
      <circle cx="68" cy="14" r="4" fill="#C15F3C" />
    </svg>
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
