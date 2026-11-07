import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
import type { RegistryCollection } from './types';
import type { LintMessage } from './types';

export const COLLECTION_MD_KEYS = [
  'id',
  'status',
  'name',
  'aliases',
  'category',
  'summary',
  'tags',
  'featuredOrder',
  'cover',
  'members',
  'relations',
  'events',
  'dynasties',
  'views',
  'defaultView',
  'path',
  'sources',
] as const;

export const COLLECTION_DIR = 'collections';
export const COLLECTION_TEMPLATE_NAME = '_template-collection.md';
export const COLLECTION_INDEX_NAME = 'collections.md';
export const COLLECTION_TEMPLATE_PATH = `content/${COLLECTION_TEMPLATE_NAME}`;
export const COLLECTION_INDEX_PATH = `content/${COLLECTION_INDEX_NAME}`;
export const COLLECTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COLLECTION_VIEWS = new Set(['overview', 'members', 'timeline', 'relations', 'events', 'works']);

export const COLLECTION_TEMPLATE: RegistryCollection = {
  id: 'example-collection',
  status: 'draft',
  name: '待填',
  category: 'thought',
  summary: '待填。说明这组人物为什么需要一起阅读。',
  members: [
    { id: 'example-person-a', order: 1 },
    { id: 'example-person-b', order: 2 },
  ],
  views: ['overview', 'members', 'timeline'],
  defaultView: 'overview',
  sources: [{ work: '待填', part: '待填', kind: 'classic' }],
};

export class CollectionMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionMarkdownError';
  }
}

export interface CollectionMarkdownFile {
  path: string;
  collection?: RegistryCollection;
  messages: LintMessage[];
}

export interface CollectionIndexRow {
  id: string;
  name: string;
  category: string;
  memberCount: number;
}

export function formatCollectionMarkdown(collection: RegistryCollection): string {
  const front = stringifyFrontmatter(collection as unknown as Record<string, unknown>, COLLECTION_MD_KEYS);
  const body = collection.body?.trim();
  return body ? `---\n${front}\n---\n\n${body}\n` : `---\n${front}\n---\n`;
}

export function parseCollectionMarkdown(text: string, path: string): CollectionMarkdownFile {
  const messages: LintMessage[] = [];
  const normalized = normalizeNewlines(text);
  const split = splitMarkdown(normalized);
  if (!split) return { path, messages: [{ level: 'error', path, message: '缺少文首' }] };
  let parsed: unknown;
  try {
    parsed = parseFrontmatter(split.front);
  } catch (error) {
    return {
      path,
      messages: [
        { level: 'error', path, message: `文首无法解析：${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
  if (!isRecord(parsed)) return { path, messages: [{ level: 'error', path, message: '文首必须是字段表' }] };
  if (Object.hasOwn(parsed, 'body')) {
    messages.push({ level: 'error', path, message: 'body 写在正文，不要写进文首' });
  }
  for (const key of Object.keys(parsed)) {
    if (key !== 'body' && !COLLECTION_MD_KEYS.includes(key as (typeof COLLECTION_MD_KEYS)[number])) {
      messages.push({ level: 'error', path, message: `字段 ${key} 不在 Collection 模板中` });
    }
  }
  if (parsed.status !== 'draft' && parsed.status !== 'published') {
    messages.push({ level: 'error', path, message: 'status 必须是 draft 或 published' });
  }
  for (const view of Array.isArray(parsed.views) ? parsed.views : []) {
    if (!COLLECTION_VIEWS.has(String(view))) messages.push({ level: 'error', path, message: `未知视图 ${view}` });
  }
  for (const source of Array.isArray(parsed.sources) ? parsed.sources : []) {
    if (!isRecord(source)) {
      messages.push({ level: 'error', path, message: '出处必须是字段表' });
      continue;
    }
    for (const key of Object.keys(source)) {
      if (!SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number])) {
        messages.push({ level: 'error', path, message: `出处字段 ${key} 不在模板中` });
      }
    }
    if (source.kind !== undefined && !SOURCE_KINDS.has(String(source.kind))) {
      messages.push({ level: 'error', path, message: '出处 kind 必须是 classic、modern 或 database' });
    }
  }
  const collection = parsed as unknown as RegistryCollection;
  if (typeof collection.id !== 'string') collection.id = '';
  const body = split.body.trim();
  if (body) collection.body = body;
  const filename = path.split('/').pop()?.replace(/\.md$/, '');
  if (filename && !filename.startsWith('_')) {
    if (!COLLECTION_ID_PATTERN.test(collection.id ?? '')) {
      messages.push({ level: 'error', path, message: `id 不合法：${String(collection.id || '(空)')}` });
    } else if (collection.id !== filename) {
      messages.push({ level: 'error', path, message: `id ${collection.id} 与文件名不一致` });
    }
  }
  if (messages.length === 0 && formatCollectionMarkdown(collection) !== normalized) {
    messages.push({ level: 'error', path, message: '格式与模板不一致，运行 npm run collections:format' });
  }
  return { path, collection, messages };
}

export function coerceCollectionMarkdown(text: string): { formatted?: string; error?: string } {
  const normalized = normalizeNewlines(text);
  const split = splitMarkdown(normalized);
  if (!split) return { error: '缺少文首' };
  let parsed: unknown;
  try {
    parsed = parseFrontmatter(split.front);
  } catch (error) {
    return { error: `文首无法解析：${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isRecord(parsed)) return { error: '文首必须是字段表' };
  if (Object.hasOwn(parsed, 'body')) return { error: 'body 必须只保留在正文，请先移出文首' };
  const unknown = Object.keys(parsed).find(
    (key) => !COLLECTION_MD_KEYS.includes(key as (typeof COLLECTION_MD_KEYS)[number]),
  );
  if (unknown) return { error: `文首含未知字段：${unknown}；不会自动丢弃` };
  const collection = parsed as unknown as RegistryCollection;
  const body = split.body.trim();
  if (body) collection.body = body;
  return { formatted: formatCollectionMarkdown(collection) };
}

export function publishedCollectionMarkdown(files: CollectionMarkdownFile[]): CollectionMarkdownFile[] {
  return files.filter(
    (file) => file.collection?.status === 'published' && !file.path.split('/').pop()?.startsWith('_'),
  );
}

export function collectionIndexRows(files: CollectionMarkdownFile[]): CollectionIndexRow[] | undefined {
  const published = publishedCollectionMarkdown(files);
  if (published.some((file) => !file.collection || file.messages.some((message) => message.level === 'error'))) {
    return undefined;
  }
  return published
    .map((file) => ({
      id: file.collection!.id,
      name: file.collection!.name,
      category: file.collection!.category,
      memberCount: Array.isArray(file.collection!.members) ? file.collection!.members.length : 0,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function formatCollectionIndex(rows: CollectionIndexRow[]): string {
  return [
    '# 群像索引',
    '',
    '本文件是 `content/collections/` 的已发布 Collection 索引。由 `npm run collections:format` 生成。',
    '',
    '| id | 名称 | 分类 | 成员数 |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| [${row.id}](${COLLECTION_DIR}/${row.id}.md) | ${tableCell(row.name)} | ${row.category} | ${row.memberCount} |`,
    ),
    '',
  ].join('\n');
}

export function readCollectionMarkdown(contentRoot: string): CollectionMarkdownFile[] {
  const files: CollectionMarkdownFile[] = [];
  const templateFull = join(contentRoot, COLLECTION_TEMPLATE_NAME);
  if (!existsSync(templateFull)) {
    files.push({
      path: COLLECTION_TEMPLATE_PATH,
      messages: [{ level: 'error', path: COLLECTION_TEMPLATE_PATH, message: '缺少模板文件' }],
    });
  } else {
    const parsed = parseCollectionMarkdown(readFileSync(templateFull, 'utf8'), COLLECTION_TEMPLATE_PATH);
    if (readFileSync(templateFull, 'utf8').replace(/\r\n/g, '\n') !== formatCollectionMarkdown(COLLECTION_TEMPLATE)) {
      parsed.messages.push({
        level: 'error',
        path: COLLECTION_TEMPLATE_PATH,
        message: '模板与 collection-md.ts 不一致',
      });
    }
    files.push(parsed);
  }
  const directory = join(contentRoot, COLLECTION_DIR);
  const indexFull = join(contentRoot, COLLECTION_INDEX_NAME);
  if (!existsSync(directory)) {
    if (existsSync(indexFull))
      files.push({
        path: COLLECTION_INDEX_PATH,
        messages: [{ level: 'error', path: COLLECTION_INDEX_PATH, message: '有索引但没有目录' }],
      });
    return files;
  }
  const collections = readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const path = `content/${COLLECTION_DIR}/${name}`;
      return name.startsWith('_')
        ? { path, messages: [{ level: 'error' as const, path, message: '模板放在 content/ 根目录' }] }
        : parseCollectionMarkdown(readFileSync(join(directory, name), 'utf8'), path);
    });
  files.push(...collections);
  const rows = collectionIndexRows(collections);
  if (!rows) {
    files.push({
      path: COLLECTION_INDEX_PATH,
      messages: [{ level: 'error', path: COLLECTION_INDEX_PATH, message: 'Collection 文件未通过，索引暂不核对' }],
    });
    return files;
  }
  if (!existsSync(indexFull)) {
    files.push({
      path: COLLECTION_INDEX_PATH,
      messages: [{ level: 'error', path: COLLECTION_INDEX_PATH, message: '缺少索引，运行 npm run collections:format' }],
    });
  } else if (readFileSync(indexFull, 'utf8').replace(/\r\n/g, '\n') !== formatCollectionIndex(rows)) {
    files.push({
      path: COLLECTION_INDEX_PATH,
      messages: [{ level: 'error', path: COLLECTION_INDEX_PATH, message: '索引与 Collection 文件不一致' }],
    });
  }
  return files;
}
