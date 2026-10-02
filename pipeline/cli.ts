import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAll, compileSearch, toPrettyJson } from './compile';
import { lintPipeline, summarizeRoster } from './lint';
import { loadPipeline } from './load';
import { PersonMarkdownError } from './person-md';
import type { LintMessage, PipelineData } from './types';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));
const outDir = join(pipelineRoot, '..', 'public', 'data');
const checkOnly = process.argv.includes('--check');

/** 已登记但没进任何专题的人：lint 只逐条告警，这里汇总成一份可复制的清单 */
function reportOrphans(lints: LintMessage[]): void {
  const ids = lints
    .filter((item) => item.message.includes('未被任何专题收录'))
    .map((item) => item.path.split('/').pop()?.replace(/\.(json|md)$/, '') ?? item.path);
  if (ids.length === 0) return;
  console.warn(`已登记但未被任何专题收录（${ids.length} 人）：${ids.join(' ')}`);
}

function reportAndExit(errors: string[], warnings: string[]): void {
  for (const warning of warnings) console.warn(warning);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
}

function main(): void {
  let data: PipelineData;
  try {
    data = loadPipeline(pipelineRoot);
  } catch (error) {
    if (error instanceof PersonMarkdownError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const { catalog, topics } = compileAll(data);
  const lints = lintPipeline(data, topics);
  const roster = summarizeRoster(data);
  console.log(
    `收录进度：简表 ${roster.brief} 人，详表 ${roster.full} 人，候选待核 ${roster.pending} 人，不收 ${roster.rejected} 人`,
  );
  const errors = lints.filter((item) => item.level === 'error').map((item) => `error ${item.path}: ${item.message}`);
  const warnings = lints
    .filter((item) => item.level === 'warning')
    .map((item) => `warning ${item.path}: ${item.message}`);
  reportOrphans(lints);

  const files: Array<[string, unknown]> = [
    ['index.json', catalog],
    ['search.json', compileSearch(topics)],
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
