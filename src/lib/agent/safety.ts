/**
 * Safety layer for tool-using agents (M4.T6).
 *
 * Defends against indirect prompt injection through fetched content
 * (web pages, docs, emails). The pattern:
 *  1. Tool outputs that include free-form text get wrapped in a
 *     <retrieved-content untrusted="true"> envelope before being
 *     fed back to the model.
 *  2. Suspicious instruction-injection markers are redacted.
 *  3. A small set of tool ids are flagged as `irreversible` — the
 *     runtime requires per-run user approval before invoking them.
 */

const INJECTION_HINTS = [
  /ignore (your )?previous instructions/i,
  /^\s*system\s*[:\-]\s*/im,
  /you (?:are|must) now/i,
  /<!--\s*system/i,
  /override safety/i,
  /disregard all prior/i,
  /new instructions:/i,
  /<\/system>/i,
];

export function wrapUntrusted(content: string): string {
  return `<retrieved-content untrusted="true">\n${content}\n</retrieved-content>`;
}

export function sanitizeToolOutput(content: unknown): unknown {
  if (typeof content === 'string') {
    let out = content;
    for (const r of INJECTION_HINTS) out = out.replace(r, '[redacted-injection-hint]');
    return out;
  }
  if (Array.isArray(content)) return content.map(sanitizeToolOutput);
  if (content && typeof content === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(content as Record<string, unknown>)) o[k] = sanitizeToolOutput(v);
    return o;
  }
  return content;
}

const IRREVERSIBLE_TOOLS = new Set<string>(['memory.write']);

export function isIrreversible(toolId: string): boolean {
  return IRREVERSIBLE_TOOLS.has(toolId);
}
