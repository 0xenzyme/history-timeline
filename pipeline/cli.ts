import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTRACT_VERSION } from '../src/types';
import { compileAll, compileSearch, toPrettyJson } from './compile';
import { EventMarkdownError } from './event-md';
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
    if (error instanceof PersonMarkdownError || error instanceof EventMarkdownError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const { catalog, topics, events, lines } = compileAll(data);
  const lints = lintPipeline(data, topics, catalog);
  const roster = summarizeRoster(data);
  console.log(
    `收录进度：简表 ${roster.brief} 人，详表 ${roster.full} 人，候选待核 ${roster.pending} 人，不收 ${roster.rejected} 人，事件 ${events.length} 条`,
  );
  const errors = lints.filter((item) => item.level === 'error').map((item) => `error ${item.path}: ${item.message}`);
  const warnings = lints
    .filter((item) => item.level === 'warning')
    .map((item) => `warning ${item.path}: ${item.message}`);
  reportOrphans(lints);

  const files: Array<[string, unknown]> = [
    ['index.json', catalog],
    ['search.json', compileSearch(topics, events)],
    ['events.json', { contractVersion: CONTRACT_VERSION, events }],
    ...lines.map((line) => [`${line.id}.json`, line] as [string, unknown]),
    ...topics.map((topic) => [`${topic.meta.id}.json`, topic] as [string, unknown]),
  ];

  if (checkOnly) {
    const mismatches: string[] = [];
    const expectedNames = new Set(files.map(([name]) => name));
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
    if (existsSync(outDir)) {
      for (const entry of readdirSync(outDir, { withFileTypes: true })) {
        if (!expectedNames.has(entry.name)) mismatches.push(`public/data/${entry.name} 是多余的 stale 产物`);
      }
    }
    reportAndExit([...errors, ...mismatches], warnings);
    console.log(`content check passed：${topics.length} 个专题`);
    return;
  }

  reportAndExit(errors, warnings);
  const outputParent = dirname(outDir);
  mkdirSync(outputParent, { recursive: true });
  const tempDir = mkdtempSync(join(outputParent, '.data-tmp-'));
  try {
    for (const [name, value] of files) {
      writeFileSync(join(tempDir, name), toPrettyJson(value), 'utf8');
    }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
  const backupDir = `${outDir}.previous`;
  if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
  if (existsSync(outDir)) renameSync(outDir, backupDir);
  try {
    renameSync(tempDir, outDir);
  } catch (error) {
    if (existsSync(backupDir) && !existsSync(outDir)) renameSync(backupDir, outDir);
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
  if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
  console.log(`wrote ${files.length} files to public/data`);
}

main();
