import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lintEventCompositionGraph, lintRegistryEvent } from './lint';
import {
  EVENT_DIR,
  EVENT_ID_PATTERN,
  EVENT_INDEX_NAME,
  EVENT_TEMPLATE,
  coerceEventMarkdown,
  eventIndexRows,
  formatEventIndex,
  formatEventMarkdown,
  parseEventMarkdown,
  publishedEventMarkdown,
  readEventMarkdown,
} from './event-md';
import type { EventLifecycle } from './event-md';
import type { LintMessage } from './types';
import type { EventMarkdownFile } from './event-md';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pipelineRoot, '..');
const contentRoot = join(repoRoot, 'content');
const eventDir = join(contentRoot, EVENT_DIR);

function usage(): void {
  console.error(`用法：
  npm run events:check
  npm run events:format
  npm run events:new -- <id>`);
  process.exit(1);
}

function vocabIds(name: string): Set<string> {
  const rows = JSON.parse(readFileSync(join(pipelineRoot, 'vocab', name), 'utf8')) as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

/** 只扫文件名，不解析全文：校验事件引用的人物是否存在，用不到人物的字段。 */
function personIds(): Set<string> {
  const ids = new Set<string>();
  const registry = join(pipelineRoot, 'registry', 'people');
  for (const name of readdirSync(registry)) {
    if (name.endsWith('.json')) ids.add(name.slice(0, -'.json'.length));
  }
  const order = JSON.parse(readFileSync(join(pipelineRoot, 'topics.json'), 'utf8')) as string[];
  for (const topic of order) {
    const directory = join(contentRoot, topic);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      if (name.endsWith('.md') && !name.startsWith('_')) ids.add(name.slice(0, -'.md'.length));
    }
  }
  return ids;
}

function commandCheck(): void {
  const files = readEventMarkdown(contentRoot);
  const messages = lintEventMarkdownFiles(files, vocabIds('polities.json'), personIds());
  reportMessages(messages);
  const published = publishedEventMarkdown(files).length;
  console.log(`events check passed：模板 1，索引 1，事件 ${published} 条`);
}

export function lintEventMarkdownFiles(
  files: EventMarkdownFile[],
  polityIds: Set<string>,
  people: Set<string>,
): LintMessage[] {
  const messages: LintMessage[] = files.flatMap((file) => file.messages);
  const events = new Map(files.filter((file) => file.event).map((file) => [file.event!.id, file.event!]));
  const publishedEventIds = new Set(
    publishedEventMarkdown(files)
      .filter((file) => file.event !== undefined)
      .map((file) => file.event!.id),
  );
  const ctx = { polityIds, people, events, publishedEventIds };

  // draft 事件也做结构、类型和时间校验；只有发布态才参与跨事件索引和上轴。
  for (const file of files.filter((item) => !item.path.split('/').pop()?.startsWith('_'))) {
    if (!file.event) continue;
    messages.push(...lintRegistryEvent(file.event, ctx, file.path));
  }
  messages.push(...lintEventCompositionGraph(events));
  return messages;
}

function reportMessages(messages: LintMessage[]): void {
  const warnings = messages.filter((item) => item.level === 'warning');
  const errors = messages.filter((item) => item.level === 'error');
  for (const item of warnings) console.warn(`warning ${item.path}: ${item.message}`);
  if (errors.length > 0) {
    console.error(errors.map((item) => `error ${item.path}: ${item.message}`).join('\n'));
    process.exit(1);
  }
}

function rewriteEventIndex(): boolean {
  if (!existsSync(eventDir)) return false;
  const names = readdirSync(eventDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort();
  const files = names.map((name) =>
    parseEventMarkdown(readFileSync(join(eventDir, name), 'utf8'), `content/${EVENT_DIR}/${name}`),
  );
  const rows = eventIndexRows(files);
  if (!rows) return false;
  const next = formatEventIndex(rows);
  const indexPath = join(contentRoot, EVENT_INDEX_NAME);
  const current = existsSync(indexPath) ? readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current === next) return false;
  writeFileSync(indexPath, next);
  console.log(`已整理 content/${EVENT_INDEX_NAME}`);
  return true;
}

function commandFormat(): void {
  if (!existsSync(eventDir)) {
    console.error(`没有 content/${EVENT_DIR}/，先跑 npm run events:new -- <id>`);
    process.exit(1);
  }
  let changed = 0;
  const plans: Array<{
    path: string;
    full: string;
    original: string;
    formatted: string;
    result: ReturnType<typeof coerceEventMarkdown>;
  }> = [];
  const names = readdirSync(eventDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort();
  let failed = false;
  for (const name of names) {
    const path = `content/${EVENT_DIR}/${name}`;
    const original = readFileSync(join(eventDir, name), 'utf8').replace(/\r\n/g, '\n');
    const result = coerceEventMarkdown(original);
    if (result.error || !result.formatted) {
      console.error(`${path}: ${result.error ?? '无法整理'}`);
      process.exitCode = 1;
      failed = true;
      continue;
    }
    plans.push({ path, full: join(eventDir, name), original, formatted: result.formatted, result });
  }
  if (failed) process.exit(process.exitCode ?? 1);

  for (const plan of plans) {
    if (plan.result.dropped.length > 0) console.warn(`${plan.path}: 去掉文首字段 ${plan.result.dropped.join('、')}`);
    if (plan.result.movedDesc) console.warn(`${plan.path}: desc 已从文首移到正文`);
    if (plan.formatted === plan.original) continue;
    writeFileSync(plan.full, plan.formatted);
    changed += 1;
    console.log(`已整理 ${plan.path}`);
  }
  if (rewriteEventIndex()) changed += 1;
  console.log(changed === 0 ? '事件 Markdown 已是规定格式' : `整理了 ${changed} 个文件`);
}

function commandNew(id: string | undefined): void {
  if (!id || !EVENT_ID_PATTERN.test(id)) {
    console.error('id 必须是小写 kebab-case，例如 yehuling-zhizhan');
    process.exit(1);
  }
  const target = join(eventDir, `${id}.md`);
  if (existsSync(target)) {
    console.error(`事件 ${id} 已存在，不新建`);
    process.exit(1);
  }
  mkdirSync(eventDir, { recursive: true });
  const event: EventLifecycle = {
    ...EVENT_TEMPLATE,
    id,
    status: 'draft',
    sources: EVENT_TEMPLATE.sources.map((source) => ({ ...source })),
  };
  writeFileSync(target, formatEventMarkdown(event));
  rewriteEventIndex();
  console.log(`已写 content/${EVENT_DIR}/${id}.md`);
  console.log(
    '这是 draft 会战骨架，不会编译上轴。改 name、place、belligerents 和出处，通过 publish gate 后再将 status 改为 published；换 type 时同步改 scale 与必填字段。模板里的占位不能发布。',
  );
}

export function runEventsCommand(argv: string[]): void {
  const command = argv[0];
  if (command === 'check') commandCheck();
  else if (command === 'format') commandFormat();
  else if (command === 'new') commandNew(argv[1]);
  else usage();
}
