import { stringify, parse } from 'yaml';

import type { SourceRef } from '../src/types';

/** 文首与正文的分隔。文首以 `---\n` 开始、以 `\n---\n` 结束。 */
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export const SOURCE_KEYS = ['work', 'part', 'note', 'kind'] as const;
export const SOURCE_KINDS = new Set(['classic', 'modern', 'database']);

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface SplitMarkdown {
  front: string;
  body: string;
}

export function splitMarkdown(text: string): SplitMarkdown | undefined {
  const matched = FRONTMATTER.exec(normalizeNewlines(text));
  if (!matched) return undefined;
  return { front: matched[1], body: matched[2] };
}

/** 解析文首。失败时抛出，由调用方转成 lint 消息。 */
export function parseFrontmatter(front: string): unknown {
  return parse(front);
}

export function formatSource(source: SourceRef): SourceRef {
  const next: SourceRef = { work: source.work };
  if (source.part) next.part = source.part;
  if (source.note) next.note = source.note;
  if (source.kind) next.kind = source.kind;
  return next;
}

/** 按给定键序序列化文首。sources 与 commanders 走各自的字段顺序。 */
export function stringifyFrontmatter(record: Record<string, unknown>, keys: readonly string[]): string {
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'sources') {
      data.sources = (value as SourceRef[]).map(formatSource);
      continue;
    }
    if (key === 'commanders') {
      data.commanders = (value as Array<Record<string, unknown>>).map(formatCommander);
      continue;
    }
    data[key] = value;
  }
  return stringify(data, { lineWidth: 0 }).trimEnd();
}

function formatCommander(commander: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { id: commander.id };
  if (commander.side) next.side = commander.side;
  return next;
}

/** 表格单元格里不能出现竖线和换行。 */
export function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
