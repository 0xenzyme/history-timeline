import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EventCommander } from '../src/types';
import {
  SOURCE_KEYS,
  SOURCE_KINDS,
  isRecord,
  normalizeNewlines,
  parseFrontmatter,
  splitMarkdown,
  stringifyFrontmatter,
  tableCell,
} from './frontmatter';
import type { EventCatalog, LintMessage, RegistryEvent, SourceRef } from './types';

/** 文首字段的规定顺序。events:format 按这个顺序重写，events:check 拒绝漂移。 */
export const EVENT_MD_KEYS = [
  'id',
  'status',
  'name',
  'display',
  'type',
  'catalogs',
  'scale',
  'importance',
  'year',
  'yearAccuracy',
  'yearNote',
  'endYear',
  'endYearAccuracy',
  'endYearNote',
  'place',
  'placeNow',
  'belligerents',
  'polity',
  'commanders',
  'people',
  'result',
  'parent',
  'tags',
  'aliases',
  'sources',
] as const;

/** 生命周期：缺省 status 的存量事件按 published 兼容；新建事件显式 draft。 */
export type EventStatus = 'draft' | 'published';
export type EventLifecycle = RegistryEvent & { status?: EventStatus };

export const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const EVENT_TYPES = new Set(['military', 'political', 'rebellion', 'institutional', 'diplomatic', 'cultural']);
const EVENT_SCALES = new Set(['war', 'campaign', 'battle', 'engagement']);
const EVENT_CATALOGS = new Set<EventCatalog>(['military', 'history']);
const ACCURACIES = new Set(['exact', 'approx', 'disputed', 'unknown']);
const IMPORTANCES = new Set([1, 2, 3]);

export class EventMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventMarkdownError';
  }
}

export const EVENT_TEMPLATE_BODY = '待填。两三句：经过、结果、为什么重要。';

/** 骨架。默认是一场会战，改 type 时同步改 scale 与必填字段。desc 只写正文，不进文首。 */
export const EVENT_TEMPLATE: RegistryEvent = {
  id: 'example-event',
  status: 'draft',
  name: '待填',
  type: 'military',
  catalogs: ['military'],
  scale: 'battle',
  importance: 2,
  year: 1211,
  yearAccuracy: 'exact',
  place: '待填',
  belligerents: ['jin-chao', 'mongol'],
  result: '待填',
  sources: [{ work: '待填', part: '待填', kind: 'classic' }],
  desc: EVENT_TEMPLATE_BODY,
};

export const EVENT_DIR = 'events';
export const EVENT_TEMPLATE_NAME = '_template-event.md';
export const EVENT_INDEX_NAME = 'events.md';
export const TEMPLATE_EVENT_PATH = `content/${EVENT_TEMPLATE_NAME}`;
export const EVENT_INDEX_PATH = `content/${EVENT_INDEX_NAME}`;

export function formatEventMarkdown(event: RegistryEvent): string {
  const front = stringifyFrontmatter(event as unknown as Record<string, unknown>, EVENT_MD_KEYS);
  const desc = event.desc?.trim();
  if (desc) return `---\n${front}\n---\n\n${desc}\n`;
  return `---\n${front}\n---\n`;
}

export interface EventMarkdownFile {
  /** 相对仓库根目录，例如 content/events/yehuling-zhizhan.md */
  path: string;
  event?: RegistryEvent;
  messages: LintMessage[];
}

export interface EventIndexRow {
  id: string;
  name: string;
  display: string;
  type: string;
  year: number;
}

/** commanders 允许写扁平 id，也允许写 { id, side }。 */
export function normalizeCommanders(raw: unknown): EventCommander[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const commanders: EventCommander[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      commanders.push({ id: item });
      continue;
    }
    if (!isRecord(item) || typeof item.id !== 'string') return undefined;
    if (Object.keys(item).some((key) => key !== 'id' && key !== 'side')) return undefined;
    const commander: EventCommander = { id: item.id };
    if (item.side !== undefined && typeof item.side !== 'string') return undefined;
    if (item.side !== undefined) commander.side = item.side;
    commanders.push(commander);
  }
  return commanders;
}

/** 解析一个事件的 Markdown。desc 只认正文，不认文首里的 desc。 */
export function parseEventMarkdown(text: string, path: string): EventMarkdownFile {
  const messages: LintMessage[] = [];
  const normalized = normalizeNewlines(text);
  const split = splitMarkdown(normalized);
  if (!split) {
    messages.push({ level: 'error', path, message: '缺少文首：文件要以 --- 开始，并以 --- 结束文首' });
    return { path, messages };
  }

  let parsed: unknown;
  try {
    parsed = parseFrontmatter(split.front);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    messages.push({ level: 'error', path, message: `文首无法解析：${detail}` });
    return { path, messages };
  }
  if (!isRecord(parsed)) {
    messages.push({ level: 'error', path, message: '文首必须是字段表' });
    return { path, messages };
  }

  const record = parsed;
  for (const key of Object.keys(record)) {
    if (key === 'desc') {
      messages.push({ level: 'error', path, message: 'desc 写在正文，不要写进文首' });
      continue;
    }
    if (!EVENT_MD_KEYS.includes(key as (typeof EVENT_MD_KEYS)[number])) {
      messages.push({ level: 'error', path, message: `字段 ${key} 不在事件模板中` });
    }
  }

  if (!EVENT_TYPES.has(String(record.type))) {
    messages.push({ level: 'error', path, message: 'type 必须是 military、political、rebellion、institutional、diplomatic 或 cultural' });
  }
  if (record.scale !== undefined && !EVENT_SCALES.has(String(record.scale))) {
    messages.push({ level: 'error', path, message: 'scale 必须是 war、campaign、battle 或 engagement' });
  }
  if (record.catalogs !== undefined) {
    if (!Array.isArray(record.catalogs) || record.catalogs.length === 0) {
      messages.push({ level: 'error', path, message: 'catalogs 至少要有一个 military 或 history' });
    } else {
      const catalogs = record.catalogs as unknown[];
      if (new Set(catalogs).size !== catalogs.length) {
        messages.push({ level: 'error', path, message: 'catalogs 不能有重复值' });
      }
      for (const catalog of catalogs) {
        if (!EVENT_CATALOGS.has(String(catalog) as EventCatalog)) {
          messages.push({ level: 'error', path, message: 'catalogs 只能是 military 或 history' });
        }
      }
    }
  }
  if (!IMPORTANCES.has(record.importance as number)) {
    messages.push({ level: 'error', path, message: `importance 必须是 1、2 或 3：${String(record.importance)}` });
  }
  if (!ACCURACIES.has(String(record.yearAccuracy))) {
    messages.push({ level: 'error', path, message: 'yearAccuracy 必须是 exact、approx、disputed 或 unknown' });
  }
  if (record.status !== undefined && record.status !== 'draft' && record.status !== 'published') {
    messages.push({ level: 'error', path, message: 'status 必须是 draft 或 published' });
  }
  if (record.endYearAccuracy !== undefined && !ACCURACIES.has(String(record.endYearAccuracy))) {
    messages.push({ level: 'error', path, message: 'endYearAccuracy 必须是 exact、approx、disputed 或 unknown' });
  }
  if (record.endYearNote !== undefined && typeof record.endYearNote !== 'string') {
    messages.push({ level: 'error', path, message: 'endYearNote 必须是字符串' });
  }
  if (record.year !== undefined && typeof record.year !== 'number') {
    messages.push({ level: 'error', path, message: 'year 必须是数字，公元前用负数' });
  }

  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    messages.push({ level: 'error', path, message: '缺少 sources' });
  } else {
    for (const source of record.sources) {
      if (!isRecord(source)) {
        messages.push({ level: 'error', path, message: '出处必须是字段表' });
        continue;
      }
      if (typeof source.work !== 'string' || source.work.trim() === '') {
        messages.push({ level: 'error', path, message: '出处缺少 work' });
      }
      if (source.kind !== undefined && !SOURCE_KINDS.has(String(source.kind))) {
        messages.push({ level: 'error', path, message: '出处 kind 必须是 classic、modern 或 database' });
      }
      for (const key of Object.keys(source)) {
        if (!SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number])) {
          messages.push({ level: 'error', path, message: `出处字段 ${key} 不在模板中` });
        }
      }
    }
  }

  const event = record as unknown as EventLifecycle;
  if (record.commanders !== undefined) {
    const commanders = normalizeCommanders(record.commanders);
    if (!commanders) {
      messages.push({ level: 'error', path, message: 'commanders 必须是字符串 id 或包含 id、side 的字段表列表' });
    } else {
      event.commanders = commanders;
    }
  }
  const desc = split.body.trim();
  if (desc) event.desc = desc;

  const filename = path.split('/').pop()?.replace(/\.md$/, '');
  if (filename && !filename.startsWith('_')) {
    if (typeof event.id !== 'string' || !EVENT_ID_PATTERN.test(event.id)) {
      messages.push({ level: 'error', path, message: `id 不合法：${String(event.id || '(空)')}` });
    } else if (event.id !== filename) {
      messages.push({ level: 'error', path, message: `id ${event.id} 与文件名不一致` });
    }
  }

  if (messages.length === 0) {
    const formatted = formatEventMarkdown(event);
    if (formatted !== normalized) {
      messages.push({ level: 'error', path, message: '格式与模板不一致，运行 npm run events:format' });
    }
  }
  return { path, event, messages };
}

export interface CoerceEventMarkdown {
  formatted?: string;
  error?: string;
  /** 文首里被去掉的未知字段。desc 不算在这里。 */
  dropped: string[];
  /** 文首里的 desc 已移到正文。 */
  movedDesc: boolean;
}

/** 放宽解析，供 events:format 把文首收成规定顺序。解析失败时不返回 formatted。 */
export function coerceEventMarkdown(text: string): CoerceEventMarkdown {
  const normalized = normalizeNewlines(text);
  const split = splitMarkdown(normalized);
  if (!split) return { error: '缺少文首：文件要以 --- 开始，并以 --- 结束文首', dropped: [], movedDesc: false };
  let parsed: unknown;
  try {
    parsed = parseFrontmatter(split.front);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `文首无法解析：${detail}`, dropped: [], movedDesc: false };
  }
  if (!isRecord(parsed)) return { error: '文首必须是字段表', dropped: [], movedDesc: false };

  const dropped: string[] = [];
  const record: Record<string, unknown> = {};
  let frontDesc = '';
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'desc') {
      if (typeof value !== 'string') return { error: '文首 desc 必须是字符串', dropped, movedDesc: false };
      frontDesc = value.trim();
      continue;
    }
    if (!EVENT_MD_KEYS.includes(key as (typeof EVENT_MD_KEYS)[number])) {
      dropped.push(key);
      continue;
    }
    record[key] = value;
  }
  if (dropped.length > 0) {
    return {
      error: `文首含未知字段：${dropped.join('、')}；请先决定字段并更新事件 schema，不会自动丢弃`,
      dropped,
      movedDesc: false,
    };
  }
  const event = record as unknown as RegistryEvent;
  if (event.sources !== undefined && !Array.isArray(event.sources)) {
    return { error: 'sources 必须是列表', dropped, movedDesc: false };
  }
  if (Array.isArray(event.sources)) {
    const sources: SourceRef[] = [];
    for (const source of event.sources) {
      if (!isRecord(source) || typeof source.work !== 'string') {
        return { error: '出处必须有 work', dropped, movedDesc: false };
      }
      const unknown = Object.keys(source).find((key) => !SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number]));
      if (unknown) return { error: `出处字段 ${unknown} 不在模板中`, dropped, movedDesc: false };
      if (source.kind !== undefined && !SOURCE_KINDS.has(String(source.kind))) {
        return { error: '出处 kind 必须是 classic、modern 或 database', dropped, movedDesc: false };
      }
      sources.push(source as unknown as SourceRef);
    }
    event.sources = sources;
  }
  if (record.commanders !== undefined) {
    const commanders = normalizeCommanders(record.commanders);
    if (!commanders) return { error: 'commanders 必须是字符串 id 或包含 id、side 的字段表列表', dropped, movedDesc: false };
    event.commanders = commanders;
  }

  const body = split.body.trim();
  const desc = [frontDesc, body].filter((part) => part.length > 0).join('\n\n');
  if (desc) event.desc = desc;
  return { formatted: formatEventMarkdown(event), dropped, movedDesc: frontDesc.length > 0 };
}

/** 事件索引。events:format 重写 content/events.md，events:check 拒绝漂移。 */
export function formatEventIndex(rows: EventIndexRow[]): string {
  const lines = [
    '# 事件索引',
    '',
    '本文件是 `content/events/` 的事件索引。一事件一个文件，文件名即 id。按年份升序；军事与历史事件两条目录共用这一份实体。',
    '',
    '| id | 名称 | 显示名 | type | 年份 |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| [${row.id}](${EVENT_DIR}/${row.id}.md) | ${tableCell(row.name)} | ${tableCell(row.display)} | ${row.type} | ${row.year} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

export function publishedEventMarkdown(files: EventMarkdownFile[]): EventMarkdownFile[] {
  return files.filter((file) => {
    if (file.path.split('/').pop()?.startsWith('_')) return false;
    const status = (file.event as EventLifecycle | undefined)?.status;
    return status !== 'draft';
  });
}

export function eventIndexRows(files: EventMarkdownFile[]): EventIndexRow[] | undefined {
  const published = publishedEventMarkdown(files);
  if (published.some((file) => !file.event || file.messages.some((message) => message.level === 'error'))) {
    return undefined;
  }
  return published
    .map((file) => ({
      id: file.event!.id,
      name: file.event!.name,
      display: file.event!.display ?? file.event!.name,
      type: file.event!.type,
      year: file.event!.year,
    }))
    .sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
}

function errorFile(path: string, message: string): EventMarkdownFile {
  return { path, messages: [{ level: 'error', path, message }] };
}

/** 读取 content/_template-event.md、content/events/*.md，并核对 content/events.md 索引。 */
export function readEventMarkdown(contentRoot: string): EventMarkdownFile[] {
  const files: EventMarkdownFile[] = [];

  const templateFull = join(contentRoot, EVENT_TEMPLATE_NAME);
  if (!existsSync(templateFull)) {
    files.push(errorFile(TEMPLATE_EVENT_PATH, '缺少模板文件'));
  } else {
    const parsed = parseEventMarkdown(readFileSync(templateFull, 'utf8'), TEMPLATE_EVENT_PATH);
    const expected = formatEventMarkdown(EVENT_TEMPLATE);
    const actual = readFileSync(templateFull, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected) {
      parsed.messages.push({ level: 'error', path: TEMPLATE_EVENT_PATH, message: '模板与 pipeline/event-md.ts 不一致' });
    }
    files.push(parsed);
  }

  const directory = join(contentRoot, EVENT_DIR);
  const indexFull = join(contentRoot, EVENT_INDEX_NAME);
  if (!existsSync(directory)) {
    if (existsSync(indexFull)) {
      files.push(errorFile(EVENT_INDEX_PATH, '有索引但没有事件目录'));
    }
    return files;
  }

  const names = readdirSync(directory).filter((name) => name.endsWith('.md')).sort();
  const events = names.map((name) => {
    const path = `content/${EVENT_DIR}/${name}`;
    if (name.startsWith('_')) {
      return errorFile(path, '模板放在 content/ 根目录，不要放进事件目录');
    }
    return parseEventMarkdown(readFileSync(join(directory, name), 'utf8'), path);
  });
  files.push(...events);

  const rows = eventIndexRows(events);
  if (!rows) {
    files.push(errorFile(EVENT_INDEX_PATH, '事件文件未通过，索引暂不核对'));
    return files;
  }
  const expected = formatEventIndex(rows);
  if (!existsSync(indexFull)) {
    files.push(errorFile(EVENT_INDEX_PATH, '缺少索引，运行 npm run events:format'));
    return files;
  }
  const actual = readFileSync(indexFull, 'utf8').replace(/\r\n/g, '\n');
  if (actual !== expected) {
    files.push(errorFile(EVENT_INDEX_PATH, '索引与事件文件不一致，运行 npm run events:format'));
  }
  return files;
}
