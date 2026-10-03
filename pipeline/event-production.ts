import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lintRegistryEvent, type EventLintContext } from './lint';
import { EVENT_ID_PATTERN, readEventMarkdown } from './event-md';
import type { LintMessage, RegistryEvent } from './types';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pipelineRoot, '..');
const contentRoot = join(repoRoot, 'content');
const eventDir = join(contentRoot, 'events');
const runsRoot = join(repoRoot, '.harness', 'runs');

export interface DraftManifestEntry {
  id: string;
  path: string;
  sha256: string;
}

export interface DraftManifest {
  schemaVersion: 1;
  runId: string;
  inputHash: string;
  revision: number;
  events: DraftManifestEntry[];
}

export interface PublishCheckResult {
  ok: boolean;
  manifest: string;
  runId?: string;
  revision?: number;
  selectedIds: string[];
  warnings: LintMessage[];
  errors: LintMessage[];
}

function usage(): never {
  console.error('用法：npm run events:publish:check -- --manifest <draft-manifest.json> [--json]');
  process.exit(1);
}

function parseArgs(argv: string[]): { manifest: string; json: boolean } {
  let manifest = '';
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') {
      manifest = argv[index + 1] ?? '';
      index += 1;
    } else if (arg === '--json') {
      json = true;
    } else {
      usage();
    }
  }
  if (!manifest) usage();
  return { manifest, json };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function vocabIds(name: string): Set<string> {
  const rows = readJson(join(pipelineRoot, 'vocab', name));
  if (!Array.isArray(rows)) throw new Error(`词表 ${name} 不是列表`);
  return new Set(rows.filter(isRecord).map((row) => row.id).filter((id): id is string => typeof id === 'string'));
}

function personIds(): Set<string> {
  const ids = new Set<string>();
  const registry = join(pipelineRoot, 'registry', 'people');
  for (const name of readdirSync(registry)) {
    if (name.endsWith('.json')) ids.add(name.slice(0, -'.json'.length));
  }
  const order = readJson(join(pipelineRoot, 'topics.json'));
  if (!Array.isArray(order)) throw new Error('pipeline/topics.json 不是专题 id 列表');
  for (const topic of order) {
    if (typeof topic !== 'string') continue;
    const directory = join(contentRoot, topic);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      if (name.endsWith('.md') && !name.startsWith('_')) ids.add(name.slice(0, -'.md'.length));
    }
  }
  return ids;
}

function parseManifest(path: string): DraftManifest {
  const full = resolve(process.cwd(), path);
  if (!isWithin(full, runsRoot)) {
    throw new Error(`manifest 必须位于 .harness/runs/ 内：${path}`);
  }
  if (!existsSync(full)) throw new Error(`找不到 manifest：${path}`);
  const raw = readJson(full);
  if (!isRecord(raw)
    || raw.schemaVersion !== 1
    || typeof raw.runId !== 'string'
    || typeof raw.inputHash !== 'string'
    || !Number.isInteger(raw.revision)
    || !Array.isArray(raw.events)
    || raw.events.length === 0) {
    throw new Error('draft manifest 必须包含 schemaVersion=1、runId、inputHash、revision 和非空 events');
  }
  const events: DraftManifestEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw.events) {
    if (!isRecord(item)
      || typeof item.id !== 'string'
      || !EVENT_ID_PATTERN.test(item.id)
      || typeof item.path !== 'string'
      || typeof item.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error('draft manifest 的每一项必须包含合法 id、path 和 sha256');
    }
    if (seen.has(item.id)) throw new Error(`manifest 中事件 id 重复：${item.id}`);
    seen.add(item.id);
    events.push({ id: item.id, path: item.path, sha256: item.sha256 });
  }
  const revision = raw.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision)) {
    throw new Error('draft manifest revision 必须是整数');
  }
  return {
    schemaVersion: 1,
    runId: raw.runId,
    inputHash: raw.inputHash,
    revision,
    events,
  };
}

function eventPath(entry: DraftManifestEntry): string {
  const full = resolve(repoRoot, entry.path);
  if (!isWithin(full, eventDir) || full !== join(eventDir, `${entry.id}.md`)) {
    throw new Error(`事件 ${entry.id} 的 path 必须指向 content/events/${entry.id}.md`);
  }
  return full;
}

function manifestErrors(manifest: DraftManifest): LintMessage[] {
  const messages: LintMessage[] = [];
  const seenPaths = new Set<string>();
  for (const entry of manifest.events) {
    let full: string;
    try {
      full = eventPath(entry);
    } catch (error) {
      messages.push({ level: 'error', path: entry.path, message: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (seenPaths.has(full)) {
      messages.push({ level: 'error', path: entry.path, message: 'manifest path 重复' });
      continue;
    }
    seenPaths.add(full);
    if (!existsSync(full)) {
      messages.push({ level: 'error', path: entry.path, message: 'manifest 引用的事件文件不存在' });
      continue;
    }
    const actualHash = sha256(full);
    if (actualHash !== entry.sha256) {
      messages.push({ level: 'error', path: entry.path, message: `文件 hash 已变化：expected=${entry.sha256} actual=${actualHash}` });
    }
  }
  return messages;
}

function publishProjection(manifest: DraftManifest): PublishCheckResult {
  const manifestMessages = manifestErrors(manifest);
  const files = readEventMarkdown(contentRoot);
  const selected = new Map(manifest.events.map((entry) => [entry.id, entry]));
  const selectedIds = [...selected.keys()];
  const errors: LintMessage[] = [
    ...manifestMessages,
    ...files.flatMap((file) => file.messages.filter((message) => message.level === 'error')),
  ];
  const warnings: LintMessage[] = files.flatMap((file) => file.messages.filter((message) => message.level === 'warning'));

  const projected = new Map<string, RegistryEvent>();
  for (const file of files) {
    if (!file.event) continue;
    const event = selected.has(file.event.id)
      ? { ...file.event, status: 'published' as const }
      : file.event;
    if (event.status !== 'draft' || selected.has(event.id)) projected.set(event.id, event);
    if (selected.has(file.event.id) && file.event.status !== 'draft') {
      errors.push({ level: 'error', path: file.path, message: 'publish manifest 只能选择 status: draft 的事件' });
    }
  }

  const ctx: EventLintContext = {
    polityIds: vocabIds('polities.json'),
    people: personIds(),
    events: projected,
  };

  for (const file of files) {
    if (!file.event) continue;
    const event = selected.has(file.event.id)
      ? { ...file.event, status: 'published' as const }
      : file.event;
    const messages = lintRegistryEvent(event, ctx, file.path);
    for (const message of messages) {
      if (message.level === 'error') errors.push(message);
      else warnings.push(message);
    }
  }

  return {
    ok: errors.length === 0,
    manifest: 'draft-manifest.json',
    runId: manifest.runId,
    revision: manifest.revision,
    selectedIds,
    warnings,
    errors,
  };
}

export function runPublishCheck(manifestPath: string): PublishCheckResult {
  const manifest = parseManifest(manifestPath);
  const result = publishProjection(manifest);
  return { ...result, manifest: manifestPath };
}

function printResult(result: PublishCheckResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const warning of result.warnings) console.warn(`warning ${warning.path}: ${warning.message}`);
  if (result.errors.length > 0) {
    console.error(result.errors.map((error) => `error ${error.path}: ${error.message}`).join('\n'));
    console.error(`publish preview failed：${result.selectedIds.length} 个 draft，Run ${result.runId ?? '(unknown)'}`);
    return;
  }
  console.log(`publish preview passed：${result.selectedIds.length} 个 draft，Run ${result.runId ?? '(unknown)'}，revision ${result.revision ?? '(unknown)'}`);
}

const command = process.argv[2];
if (command !== 'publish-check') usage();

try {
  const args = parseArgs(process.argv.slice(3));
  const result = runPublishCheck(args.manifest);
  printResult(result, args.json);
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(`publish preview failed：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
