import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';

const PiiSchema = z.object({
  severity: z.enum(['none', 'low', 'medium', 'high']),
  categories: z.array(z.enum(['email', 'phone', 'address', 'government_id', 'financial', 'health', 'credentials', 'custom'])),
  spans: z.array(z.object({ start: z.number(), end: z.number(), type: z.string() })),
});

export type PiiSeverity = z.infer<typeof PiiSchema>['severity'];
export type PiiCategory = z.infer<typeof PiiSchema>['categories'][number];

export interface PiiResult {
  severity: PiiSeverity;
  categories: PiiCategory[];
  spans: Array<{ start: number; end: number; type: string }>;
  detectorVersion: number;
}

/** Patterns where the regex itself is enough to bump severity to 'high'. */
const QUICK_REGEX_HIGH: Array<{ rx: RegExp; categories: PiiCategory[]; type: string }> = [
  { rx: /\b(?:\d[ -]?){13,19}\b/g,                       categories: ['financial'],     type: 'card-like' },
  { rx: /\b\d{3}-\d{2}-\d{4}\b/g,                        categories: ['government_id'], type: 'ssn' },
  { rx: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,          categories: ['credentials'],   type: 'private-key' },
  { rx: /\bsk-[a-zA-Z0-9_-]{20,}\b/g,                    categories: ['credentials'],   type: 'api-key' },
];

/** Patterns where the regex justifies at least 'low' severity. */
const QUICK_REGEX_LOW: Array<{ rx: RegExp; categories: PiiCategory[]; type: string }> = [
  { rx: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,   categories: ['email'],         type: 'email' },
  { rx: /\b\+?\d[\d\s().-]{8,}\d\b/g,                    categories: ['phone'],         type: 'phone-like' },
];

const DETECTOR_VERSION = 1;
const PII_MODEL = process.env.PII_MODEL ?? 'anthropic/claude-haiku-4-5-20251001';

function findFirst(text: string, rx: RegExp): { index: number; length: number } | null {
  const match = text.match(rx);
  if (!match) return null;
  const idx = text.indexOf(match[0]);
  return { index: idx, length: match[0].length };
}

function findAll(text: string, rx: RegExp): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(rx)) {
    if (typeof m.index === 'number') out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export async function detectPii(content: string): Promise<PiiResult> {
  // 1. Regex fast-path for high-severity items.
  for (const r of QUICK_REGEX_HIGH) {
    const hit = findFirst(content, r.rx);
    if (hit) {
      return {
        severity: 'high',
        categories: r.categories,
        spans: [{ start: hit.index, end: hit.index + hit.length, type: r.type }],
        detectorVersion: DETECTOR_VERSION,
      };
    }
  }

  // 2. Regex fast-path for low-severity items. Collect spans + ask the
  //    model whether to upgrade severity given full context.
  const lowSpans: PiiResult['spans'] = [];
  const lowCategories = new Set<PiiCategory>();
  for (const r of QUICK_REGEX_LOW) {
    for (const m of findAll(content, r.rx)) {
      lowSpans.push({ start: m.start, end: m.end, type: r.type });
      r.categories.forEach((c) => lowCategories.add(c));
    }
  }

  try {
    const { object } = await generateObject({
      model: getLanguageModel(PII_MODEL),
      schema: PiiSchema,
      prompt: `Classify the following text for personal/sensitive information. Return severity (none|low|medium|high) and the categories present.

Be conservative — internal business prose without identifiers is "none". Mention of a public company name is "none". A specific email or phone number is "low". A combination of identifiable info (name + medical condition, name + financial detail) is "medium". Government IDs, financial account numbers, credentials, or health records are "high".

Text:
${content.slice(0, 2000)}`,
    });
    const mergedSpans = [...object.spans, ...lowSpans];
    const mergedCategories = Array.from(new Set([...object.categories, ...lowCategories]));
    return {
      severity: object.severity,
      categories: mergedCategories,
      spans: mergedSpans,
      detectorVersion: DETECTOR_VERSION,
    };
  } catch {
    return {
      severity: lowSpans.length > 0 ? 'low' : 'none',
      categories: Array.from(lowCategories),
      spans: lowSpans,
      detectorVersion: DETECTOR_VERSION,
    };
  }
}
