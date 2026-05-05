import { describe, it, expect } from 'vitest';
import { detectPii } from '@/lib/ingest/pii';

describe('detectPii', () => {
  it('flags credit-card-shaped numbers as high (regex fast-path)', async () => {
    const r = await detectPii('Card on file: 4111-1111-1111-1111.');
    expect(r.severity).toBe('high');
    expect(r.categories).toContain('financial');
  });

  it('flags SSN-shaped numbers as high', async () => {
    const r = await detectPii('SSN on the form: 123-45-6789.');
    expect(r.severity).toBe('high');
    expect(r.categories).toContain('government_id');
  });

  it('flags BEGIN PRIVATE KEY blobs as high', async () => {
    const r = await detectPii('Here is the deploy key:\n-----BEGIN OPENSSH PRIVATE KEY-----\nabc...');
    expect(r.severity).toBe('high');
    expect(r.categories).toContain('credentials');
  });

  it('flags an email as at-least low', async () => {
    const r = await detectPii('Contact john.doe@acme.com about the renewal.');
    expect(['low', 'medium', 'high']).toContain(r.severity);
    expect(r.categories).toContain('email');
  });

  it('returns none for ordinary business prose', async () => {
    const r = await detectPii('We agreed on quarterly billing for the engagement.');
    expect(r.severity).toBe('none');
  });
});
