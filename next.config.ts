import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const baseConfig: NextConfig = {
  /* config options here */
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(baseConfig, {
      silent: true,
      // Project keys live in env; the wrapper picks them up automatically
      // when SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are present.
    })
  : baseConfig;
