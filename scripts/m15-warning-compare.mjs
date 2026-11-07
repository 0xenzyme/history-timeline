import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const baselinePath = process.argv[2];
if (!baselinePath) throw new Error('用法：node scripts/m15-warning-compare.mjs <baseline-log>');

function warnings(text) {
  return text.split(/\r?\n/).filter((line) => line.startsWith('warning '));
}

const baseline = warnings(readFileSync(baselinePath, 'utf8'));
const result = spawnSync('npm', ['run', 'content:check'], { encoding: 'utf8' });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
const current = warnings(`${result.stdout}\n${result.stderr}`);
const baselineCounts = new Map();
for (const line of baseline) baselineCounts.set(line, (baselineCounts.get(line) ?? 0) + 1);
const added = [];
for (const line of current) {
  const count = baselineCounts.get(line) ?? 0;
  if (count > 0) baselineCounts.set(line, count - 1);
  else added.push(line);
}
const explained = added.filter((line) => line.includes('[RELATION_CONFLICT]') && line.includes('since'));
const unexpected = added.filter((line) => !explained.includes(line));
console.log(
  JSON.stringify({ baseline: baseline.length, current: current.length, added, explained, unexpected }, null, 2),
);
if (unexpected.length > 0) process.exit(1);
if (explained.length !== 2) {
  console.error(`应有 2 条已记录 RELATION_CONFLICT warning，实际 ${explained.length}`);
  process.exit(1);
}
