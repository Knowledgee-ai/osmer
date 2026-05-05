import fs from 'node:fs/promises';
import path from 'node:path';
import type { LMETask } from './types';

const CACHE = path.resolve(process.cwd(), '.cache/longmemeval-s.json');
const SYNTHETIC = path.resolve(process.cwd(), 'evals/longmemeval/synthetic.json');

/**
 * Load LongMemEval tasks. Resolution order:
 *  1. `.cache/longmemeval-s.json` (real dataset; download from
 *     https://github.com/xiaowuc2/LongMemEval — gated on Google Drive,
 *     manual download required)
 *  2. `evals/longmemeval/synthetic.json` (vendored 20-task synthetic
 *     set with the same five task types — used until M3 plugs in the
 *     real data)
 */
export async function loadLongMemEvalSubset(limit = 200): Promise<LMETask[]> {
  await fs.mkdir(path.dirname(CACHE), { recursive: true });

  // Try real dataset first
  try {
    const raw = await fs.readFile(CACHE, 'utf8');
    const all = JSON.parse(raw) as LMETask[];
    return all.slice(0, limit);
  } catch {
    // Fall back to synthetic
  }

  const raw = await fs.readFile(SYNTHETIC, 'utf8');
  console.error('[lme] using vendored synthetic dataset (20 tasks). Drop real LongMemEval JSON at .cache/longmemeval-s.json to switch.');
  const all = JSON.parse(raw) as LMETask[];
  return all.slice(0, limit);
}
