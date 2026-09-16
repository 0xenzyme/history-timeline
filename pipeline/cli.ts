import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAll, toPrettyJson } from './compile';
import { lintPipeline } from './lint';
import { loadPipeline } from './load';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));
const outDir = join(pipelineRoot, '..', 'public', 'data');
const checkOnly = process.argv.includes('--check');

function reportAndExit(errors: string[], warnings: string[]): void {
  for (const warning of warnings) console.warn(warning);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
}

function main(): void {
  const data = loadPipeline(pipelineRoot);
  const { catalog, topics } = compileAll(data);
  const lints = lintPipeline(data, topics);
  const errors = lints.filter((item) => item.level === 'error').map((item) => `error ${item.path}: ${item.message}`);
  const warnings = lints
    .filter((item) => item.level === 'warning')
    .map((item) => `warning ${item.path}: ${item.message}`);

  const files: Array<[string, unknown]> = [
    ['index.json', catalog],
    ...topics.map((topic) => [`${topic.meta.id}.json`, topic] as [string, unknown]),
  ];

  if (checkOnly) {
    const mismatches: string[] = [];
    for (const [name, value] of files) {
      const expected = toPrettyJson(value);
      let actual = '';
      try {
        actual = readFileSync(join(outDir, name), 'utf8');
      } catch {
        mismatches.push(`public/data/${name} 不存在`);
        continue;
      }
      if (actual !== expected) mismatches.push(`public/data/${name} 与管线输出不一致`);
    }
    reportAndExit([...errors, ...mismatches], warnings);
    console.log(`content check passed：${topics.length} 个专题`);
    return;
  }

  reportAndExit(errors, warnings);
  mkdirSync(outDir, { recursive: true });
  for (const [name, value] of files) {
    writeFileSync(join(outDir, name), toPrettyJson(value));
  }
  console.log(`wrote ${files.length} files to public/data`);
}

main();
