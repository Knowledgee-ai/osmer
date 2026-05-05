import { spawn } from 'node:child_process';

interface SuiteResult {
  name: string;
  passed: boolean;
  durationSec: number;
  output: string;
}

const SUITES: Array<{ name: string; script: string }> = [
  { name: 'longmemeval',       script: 'evals/longmemeval/run.ts' },
  { name: 'cross-user',        script: 'evals/cross-user/run.ts' },
  { name: 'knowledge-update',  script: 'evals/knowledge-update/run.ts' },
  { name: 'abstention',        script: 'evals/abstention/run.ts' },
  { name: 'safety',            script: 'evals/safety/run.ts' },
];

async function runOne(name: string, script: string): Promise<SuiteResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const p = spawn('npx', ['tsx', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (b) => { out += b.toString(); });
    p.stderr.on('data', (b) => { out += b.toString(); });
    p.on('close', (code) => {
      resolve({
        name,
        passed: code === 0,
        durationSec: Math.round((Date.now() - start) / 1000),
        output: out.slice(-2000),
      });
    });
  });
}

async function main() {
  console.error(`Running ${SUITES.length} eval suites…\n`);
  const results: SuiteResult[] = [];
  for (const s of SUITES) {
    process.stderr.write(`  ${s.name}… `);
    const r = await runOne(s.name, s.script);
    process.stderr.write(`${r.passed ? 'PASS' : 'FAIL'} (${r.durationSec}s)\n`);
    results.push(r);
  }

  console.log(JSON.stringify({
    suites: results.map((r) => ({ name: r.name, passed: r.passed, durationSec: r.durationSec })),
    overall: results.every((r) => r.passed),
  }, null, 2));

  if (results.some((r) => !r.passed)) {
    console.error('\n--- failed suite output (last 2KB) ---');
    for (const r of results.filter((x) => !x.passed)) {
      console.error(`\n## ${r.name}\n${r.output}`);
    }
    process.exit(1);
  }
}

main();
