import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LegacyEventSnapshot {
  entryKey: string;
  legacyTopic: string;
  legacyId: string;
  legacyName: string;
  legacyKind: string;
  legacyYear: number;
  legacyEndYear: number | null;
  legacyPeople: string[];
  legacyDesc: string;
  candidateId: string | null;
  aliases: string[];
  status: string;
  duplicateGroup: string | null;
  evidence: string[];
  review: string[];
  gates: Record<string, 'pending' | 'pass' | 'fail'>;
}

export interface MigrationManifest {
  version: number;
  status: string;
  canonicalSource: string;
  legacySource: string;
  generatedAt: string;
  legacyEntryCount: number;
  sourceDigest: string;
  legacyInputPolicy: string;
  entryKey: string;
  entrySchema: Record<string, unknown>;
  inventory: Array<{ topic: string; source: string; count: number }>;
  duplicateGroups: Array<{ id: string; reason: string; sources: string[]; decision: string }>;
  entries: LegacyEventSnapshot[];
  batchAcceptance: string[];
}

interface LegacyEvent {
  id: string;
  name: string;
  kind: string;
  year: number;
  endYear?: number;
  people?: string[];
  desc?: string;
}

const GATE_NAMES = ['identity', 'taxonomy', 'evidence', 'references', 'compile', 'catalog'];
const MIGRATION_STATUSES = new Set([
  'frozen-inline',
  'candidate',
  'evidence-needed',
  'rejected',
  'migration-approved',
  'migrated',
  'verified',
]);

function gateState(): Record<string, 'pending'> {
  return Object.fromEntries(GATE_NAMES.map((name) => [name, 'pending'])) as Record<string, 'pending'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function slug(value: string): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (ascii) return ascii;
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function readTopics(pipelineRoot: string): string[] {
  return JSON.parse(readFileSync(join(pipelineRoot, 'topics.json'), 'utf8')) as string[];
}

function sourceRows(pipelineRoot: string): Array<{ topic: string; event: LegacyEvent }> {
  const rows: Array<{ topic: string; event: LegacyEvent }> = [];
  for (const topic of readTopics(pipelineRoot)) {
    const path = join(pipelineRoot, 'topics', topic, 'topic.json');
    const draft = JSON.parse(readFileSync(path, 'utf8')) as { events?: LegacyEvent[] };
    for (const event of draft.events ?? []) rows.push({ topic, event });
  }
  return rows;
}

function duplicateGroups(rows: Array<{ topic: string; event: LegacyEvent }>): Map<string, string> {
  const groups = new Map<string, string>();
  const byId = new Map<string, string[]>();
  const byNameYear = new Map<string, string[]>();
  for (const row of rows) {
    const source = `${row.topic}/${row.event.id}`;
    const idRows = byId.get(row.event.id) ?? [];
    idRows.push(source);
    byId.set(row.event.id, idRows);
    const nameKey = `${row.event.name}\u0000${row.event.year}`;
    const nameRows = byNameYear.get(nameKey) ?? [];
    nameRows.push(source);
    byNameYear.set(nameKey, nameRows);
  }
  for (const [id, sources] of byId) {
    if (sources.length > 1) for (const source of sources) groups.set(source, `legacy-id-${slug(id)}`);
  }
  for (const [nameYear, sources] of byNameYear) {
    if (sources.length <= 1) continue;
    const [name, year] = nameYear.split('\u0000');
    const group = `same-name-${slug(name)}-${year}`;
    for (const source of sources) if (!groups.has(source)) groups.set(source, group);
  }
  return groups;
}

export function collectLegacySnapshots(pipelineRoot: string): {
  rows: LegacyEventSnapshot[];
  inventory: Array<{ topic: string; source: string; count: number }>;
  duplicateGroups: Array<{ id: string; reason: string; sources: string[]; decision: string }>;
} {
  const source = sourceRows(pipelineRoot);
  const groupBySource = duplicateGroups(source);
  const rows = source.map(({ topic, event }) => ({
    entryKey: `${topic}/${event.id}`,
    legacyTopic: topic,
    legacyId: event.id,
    legacyName: event.name,
    legacyKind: event.kind,
    legacyYear: event.year,
    legacyEndYear: event.endYear ?? null,
    legacyPeople: [...(event.people ?? [])],
    legacyDesc: event.desc ?? '',
    candidateId: null,
    aliases: [],
    status: 'frozen-inline',
    duplicateGroup: groupBySource.get(`${topic}/${event.id}`) ?? null,
    evidence: [],
    review: [],
    gates: gateState(),
  }));
  const inventory = readTopics(pipelineRoot).map((topic) => ({
    topic,
    source: `pipeline/topics/${topic}/topic.json`,
    count: source.filter((row) => row.topic === topic).length,
  }));
  const byGroup = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.duplicateGroup) continue;
    const sources = byGroup.get(row.duplicateGroup) ?? [];
    sources.push(row.entryKey);
    byGroup.set(row.duplicateGroup, sources);
  }
  const groups = [...byGroup.entries()].map(([id, sources]) => ({
    id,
    reason: id.startsWith('legacy-id-')
      ? 'same legacy id in multiple topic inputs'
      : 'same name and year require identity comparison',
    sources,
    decision: 'pending',
  }));
  return { rows, inventory, duplicateGroups: groups };
}

function digestRows(rows: LegacyEventSnapshot[]): string {
  const stable = [...rows]
    .sort((left, right) => left.entryKey.localeCompare(right.entryKey))
    .map((row) => ({
      entryKey: row.entryKey,
      legacyTopic: row.legacyTopic,
      legacyId: row.legacyId,
      legacyName: row.legacyName,
      legacyKind: row.legacyKind,
      legacyYear: row.legacyYear,
      legacyEndYear: row.legacyEndYear,
      legacyPeople: row.legacyPeople,
      legacyDesc: row.legacyDesc,
    }));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function buildMigrationManifest(
  pipelineRoot: string,
  generatedAt = new Date().toISOString().slice(0, 10),
): MigrationManifest {
  const collected = collectLegacySnapshots(pipelineRoot);
  return {
    version: 2,
    status: 'inventory-frozen',
    canonicalSource: 'content/events/<id>.md',
    legacySource: 'pipeline/topics/<topic>/topic.json#events[]',
    generatedAt,
    legacyEntryCount: collected.rows.length,
    sourceDigest: digestRows(collected.rows),
    legacyInputPolicy: 'frozen-inline',
    entryKey: '<legacyTopic>/<legacyId>',
    entrySchema: {
      legacyTopic: 'string',
      legacyId: 'string',
      legacyName: 'string',
      legacyYear: 'number',
      legacyEndYear: 'number|null',
      candidateId: 'string|null',
      aliases: 'array of legacy ids',
      status: 'frozen-inline|candidate|evidence-needed|rejected|migration-approved|migrated|verified',
      duplicateGroup: 'string|null',
      evidence: 'array of source pointers',
      review: 'array of reviewer decisions',
      gates: Object.fromEntries(GATE_NAMES.map((name) => [name, 'pending|pass|fail'])),
    },
    inventory: collected.inventory,
    duplicateGroups: collected.duplicateGroups,
    entries: collected.rows,
    batchAcceptance: [
      'Every legacy entry has an entryKey and remains frozen until migration-approved.',
      'Every migrated entry has one canonical id, recorded aliases, evidence and reviewer decision.',
      'No candidate is accepted without year anchor, sources, taxonomy and resolved references.',
      'npm run events:check and npm run content:check pass, and generated catalogs reconcile with the manifest.',
      'Unresolved duplicates, missing evidence and unexplained catalog count changes keep the batch incomplete.',
    ],
  };
}

function compareSnapshot(expected: LegacyEventSnapshot, actual: LegacyEventSnapshot): string[] {
  const problems: string[] = [];
  for (const key of [
    'legacyTopic',
    'legacyId',
    'legacyName',
    'legacyKind',
    'legacyYear',
    'legacyEndYear',
    'legacyDesc',
  ] as const) {
    if (expected[key] !== actual[key]) problems.push(`${expected.entryKey} 的 ${key} 已变化`);
  }
  if (JSON.stringify(expected.legacyPeople) !== JSON.stringify(actual.legacyPeople)) {
    problems.push(`${expected.entryKey} 的 people 已变化`);
  }
  return problems;
}

export function checkLegacyEventManifest(pipelineRoot: string): string[] {
  const path = join(pipelineRoot, 'events-migration-manifest.json');
  if (!existsSync(path)) return ['缺少 pipeline/events-migration-manifest.json'];
  let manifest: MigrationManifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8')) as MigrationManifest;
  } catch (error) {
    return [`迁移 manifest 无法解析：${error instanceof Error ? error.message : String(error)}`];
  }
  const actual = collectLegacySnapshots(pipelineRoot);
  const problems: string[] = [];
  if (manifest.version !== 2) problems.push(`manifest version 应为 2，实际 ${String(manifest.version)}`);
  if (manifest.canonicalSource !== 'content/events/<id>.md')
    problems.push('manifest canonicalSource 不符合事件实体入口');
  if (manifest.legacySource !== 'pipeline/topics/<topic>/topic.json#events[]')
    problems.push('manifest legacySource 不符合冻结的旧 inline 入口');
  if (manifest.entryKey !== '<legacyTopic>/<legacyId>') problems.push('manifest entryKey 规则不一致');
  if (!Array.isArray(manifest.entries)) problems.push('迁移 manifest 缺少 entries 逐条快照');
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (manifest.legacyEntryCount !== actual.rows.length)
    problems.push(`manifest 记录 ${manifest.legacyEntryCount} 条，实际 ${actual.rows.length} 条`);
  if (entries.length !== actual.rows.length)
    problems.push(`manifest entries ${entries.length} 条，实际 ${actual.rows.length} 条`);
  const expectedByKey = new Map<string, LegacyEventSnapshot>();
  const seenEntryKeys = new Set<string>();
  const validEntries: LegacyEventSnapshot[] = [];
  for (const rawEntry of entries as unknown[]) {
    if (!isRecord(rawEntry)) {
      problems.push('manifest entries 含有非对象记录');
      continue;
    }
    const entry = rawEntry as unknown as LegacyEventSnapshot;
    if (typeof entry.entryKey !== 'string' || entry.entryKey.length === 0) {
      problems.push('manifest entryKey 缺失');
      continue;
    }
    if (seenEntryKeys.has(entry.entryKey)) problems.push(`manifest entryKey 重复：${entry.entryKey}`);
    seenEntryKeys.add(entry.entryKey);
    validEntries.push(entry);
    if (!expectedByKey.has(entry.entryKey)) expectedByKey.set(entry.entryKey, entry);
  }
  for (const row of actual.rows) {
    const expected = expectedByKey.get(row.entryKey);
    if (!expected) problems.push(`manifest 缺少 ${row.entryKey}`);
    else {
      problems.push(...compareSnapshot(expected, row));
      if (expected.duplicateGroup !== row.duplicateGroup) {
        problems.push(`${row.entryKey} 的 duplicateGroup 与当前重复盘点不一致`);
      }
    }
  }
  for (const entry of validEntries)
    if (!actual.rows.some((row) => row.entryKey === entry.entryKey)) problems.push(`manifest 多出 ${entry.entryKey}`);
  if (manifest.sourceDigest !== digestRows(actual.rows))
    problems.push('sourceDigest 不匹配：旧 inline 输入已变化，需先更新迁移批次');
  const inventory = JSON.stringify(manifest.inventory ?? []);
  if (inventory !== JSON.stringify(actual.inventory)) problems.push('manifest inventory 与专题事件计数不一致');
  if (manifest.legacyInputPolicy !== 'frozen-inline') problems.push('legacyInputPolicy 必须是 frozen-inline');
  const rawGroups = Array.isArray(manifest.duplicateGroups) ? manifest.duplicateGroups : [];
  if (!Array.isArray(manifest.duplicateGroups)) problems.push('manifest 缺少 duplicateGroups 数组');
  const normalizedGroups: Array<{ id: string; reason: string; sources: string[] }> = [];
  const seenGroupIds = new Set<string>();
  const seenGroupSources = new Set<string>();
  for (const rawGroup of rawGroups as unknown[]) {
    if (
      !isRecord(rawGroup) ||
      typeof rawGroup.id !== 'string' ||
      typeof rawGroup.reason !== 'string' ||
      !Array.isArray(rawGroup.sources) ||
      rawGroup.sources.some((source) => typeof source !== 'string')
    ) {
      problems.push('manifest duplicateGroups 含有无效记录');
      continue;
    }
    const group = {
      id: rawGroup.id,
      reason: rawGroup.reason,
      sources: rawGroup.sources as string[],
    };
    if (seenGroupIds.has(group.id)) problems.push(`manifest duplicateGroup id 重复：${group.id}`);
    seenGroupIds.add(group.id);
    for (const source of group.sources) {
      if (seenGroupSources.has(source)) problems.push(`manifest duplicateGroup 来源重复：${source}`);
      seenGroupSources.add(source);
    }
    normalizedGroups.push(group);
  }
  const expectedGroups = JSON.stringify(
    [...actual.duplicateGroups]
      .map(({ id, reason, sources }) => ({ id, reason, sources }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  const actualGroups = JSON.stringify(normalizedGroups.sort((left, right) => left.id.localeCompare(right.id)));
  if (expectedGroups !== actualGroups) problems.push('manifest duplicateGroups 与当前重复 id/名称盘点不一致');
  for (const entry of validEntries) {
    if (entry.status === 'approved') {
      problems.push(`${entry.entryKey} 的旧 status approved 必须改为 migration-approved`);
    }
    if (!MIGRATION_STATUSES.has(entry.status)) problems.push(`${entry.entryKey} 的迁移 status 无效`);
    if (!Array.isArray(entry.aliases) || !Array.isArray(entry.evidence) || !Array.isArray(entry.review)) {
      problems.push(`${entry.entryKey} 的 aliases/evidence/review 必须是数组`);
    }
    if (!isRecord(entry.gates)) {
      problems.push(`${entry.entryKey} 缺少 gates`);
    } else {
      for (const gate of GATE_NAMES) {
        if (entry.gates[gate] !== 'pending' && entry.gates[gate] !== 'pass' && entry.gates[gate] !== 'fail') {
          problems.push(`${entry.entryKey} 的 gate ${gate} 状态无效`);
        }
      }
      for (const gate of Object.keys(entry.gates)) {
        if (!GATE_NAMES.includes(gate)) problems.push(`${entry.entryKey} 含未知 gate：${gate}`);
      }
    }
    if (entry.duplicateGroup !== null && !seenGroupIds.has(entry.duplicateGroup)) {
      problems.push(`${entry.entryKey} 引用了不存在的 duplicateGroup：${entry.duplicateGroup}`);
    }
    if (
      entry.status === 'frozen-inline' &&
      (entry.candidateId !== null ||
        (Array.isArray(entry.aliases) && entry.aliases.length > 0) ||
        (Array.isArray(entry.evidence) && entry.evidence.length > 0) ||
        (Array.isArray(entry.review) && entry.review.length > 0) ||
        (isRecord(entry.gates) && Object.values(entry.gates).some((state) => state !== 'pending')))
    ) {
      problems.push(`${entry.entryKey} 冻结状态不应有 candidateId/aliases/evidence/review 或已通过 gate`);
    }
  }
  return problems;
}

export function writeMigrationManifest(pipelineRoot: string): MigrationManifest {
  const path = join(pipelineRoot, 'events-migration-manifest.json');
  if (existsSync(path)) {
    const current = JSON.parse(readFileSync(path, 'utf8')) as Partial<MigrationManifest>;
    const existingEntries = Array.isArray(current.entries) ? current.entries : [];
    const existingGroups = Array.isArray(current.duplicateGroups) ? current.duplicateGroups : [];
    const progressed =
      existingEntries.some((rawEntry) => {
        if (!isRecord(rawEntry)) return true;
        const entry = rawEntry as Partial<LegacyEventSnapshot>;
        if (entry.status && entry.status !== 'frozen-inline') return true;
        if (entry.candidateId !== null && entry.candidateId !== undefined) return true;
        if ((entry.aliases?.length ?? 0) > 0 || (entry.evidence?.length ?? 0) > 0 || (entry.review?.length ?? 0) > 0)
          return true;
        return entry.gates ? Object.values(entry.gates).some((state) => state !== 'pending') : true;
      }) ||
      existingGroups.some((rawGroup) => {
        if (!isRecord(rawGroup)) return true;
        return typeof rawGroup.decision !== 'string' || rawGroup.decision !== 'pending';
      });
    if (progressed) {
      throw new Error('manifest 已有迁移进度；禁止用 write 覆盖，请按批次手工更新并运行 check');
    }
  }
  const manifest = buildMigrationManifest(pipelineRoot);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
