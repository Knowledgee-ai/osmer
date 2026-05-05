import * as Sentry from '@sentry/nextjs';

let inited = false;

/** Idempotent — safe to call from multiple entry points. */
export function initSentry(): void {
  if (inited) return;
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  });
  inited = true;
}

export { Sentry };
