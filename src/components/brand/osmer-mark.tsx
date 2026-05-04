/**
 * Osmer brand mark — Aperture (live).
 *
 * Shared between the landing nav, landing footer, app sidebar, and
 * auth pages so the animated accretion disc is consistent everywhere.
 *
 * The SMIL rotation is paused (60s/rev) when used inside the app shell
 * via the `quiet` prop — slower so it doesn't pull focus during long
 * sessions in the chat workspace.
 */
export function OsmerMark({
  size = 32,
  className,
  quiet = false,
}: {
  size?: number;
  className?: string;
  quiet?: boolean;
}) {
  const dur = quiet ? "60s" : "36s";
  // Use a different gradient id per call so multiple instances don't
  // collide on the same page (id collisions break SVG defs).
  const gid = `osmer-aperture-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="22%" stopColor="#1a1814" stopOpacity="0" />
          <stop offset="40%" stopColor="#D85728" stopOpacity="0" />
          <stop offset="58%" stopColor="#D85728" stopOpacity="0.95" />
          <stop offset="78%" stopColor="#D85728" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#D85728" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#${gid})`} />
      <g fill="var(--foreground, #1a1814)">
        <circle cx="40" cy="14" r="1.4" />
        <circle cx="61" cy="28" r="1" opacity="0.55" />
        <circle cx="64" cy="50" r="1.2" opacity="0.7" />
        <circle cx="40" cy="66" r="0.9" opacity="0.5" />
        <circle cx="19" cy="52" r="1" opacity="0.6" />
        <circle cx="17" cy="31" r="1.2" opacity="0.7" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 40 40"
          to="360 40 40"
          dur={dur}
          repeatCount="indefinite"
        />
      </g>
      <circle cx="40" cy="40" r="11" fill="var(--foreground, #1a1814)" />
    </svg>
  );
}
