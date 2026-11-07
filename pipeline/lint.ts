import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Catalog, Topic } from '../src/types';
import { dynastyHits } from './compile';
import type {
  CandidateEntry,
  DynastyTerm,
  LintMessage,
  PipelineData,
  RegistryEvent,
  RegistryPerson,
  SourceRef,
  TopicDraft,
} from './types';
import {
  lintCandidatesSchema,
  lintCatalogSchema,
  lintEventSchema,
  lintCollectionSchema,
  lintDynastyProfileSchema,
  lintHomeEditorialSchema,
  lintPersonSchema,
  lintTopicSchema,
} from './lint-schema';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));

// 人物 polity 是叙事归属，事件 side / belligerents / polity 是事件时点政权。
// 兼容对是跨实体校验的规则数据，集中放在 vocab 文件，避免在代码里形成第二套 polity 口径。
interface PolityCompatFile {
  version: number;
  pairs: Array<{ a: string; b: string; reason: string }>;
}

const polityCompatPath = join(pipelineRoot, 'vocab', 'polity-compat.json');
const polityCompatFile = JSON.parse(readFileSync(polityCompatPath, 'utf8')) as PolityCompatFile;
if (polityCompatFile.version !== 1 || !Array.isArray(polityCompatFile.pairs)) {
  throw new Error('pipeline/vocab/polity-compat.json 必须是 version 1，并包含 pairs 数组');
}
const POLITY_COMPAT: Array<[string, string]> = polityCompatFile.pairs.map((pair) => {
  if (
    !pair ||
    typeof pair.a !== 'string' ||
    typeof pair.b !== 'string' ||
    typeof pair.reason !== 'string' ||
    !pair.reason.trim()
  ) {
    throw new Error('pipeline/vocab/polity-compat.json 的每个 pair 必须有 a、b 和非空 reason');
  }
  return [pair.a, pair.b];
});

const polityCompatSets: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(a);
    map.get(a)!.add(b);
    map.get(b)!.add(b);
    map.get(b)!.add(a);
  };
  for (const [a, b] of POLITY_COMPAT) link(a, b);
  return map;
})();

function politiesCompatible(a: string[] | undefined, b: string[] | undefined): boolean {
  const listA = a ?? [];
  const listB = b ?? [];
  for (const x of listA) {
    if (listB.includes(x)) return true;
    const set = polityCompatSets.get(x);
    if (set) for (const y of listB) if (set.has(y)) return true;
  }
  return false;
}

function vocabSet(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

const CANDIDATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANDIDATE_KEYS = new Set(['id', 'name', 'display', 'seat', 'status', 'anchor', 'reason', 'sources']);

export function profileOf(person: RegistryPerson): 'brief' | 'full' {
  if (person.profile) return person.profile;
  return person.bio?.trim() ? 'full' : 'brief';
}

const LOCAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACCURACIES = new Set(['exact', 'approx', 'disputed', 'unknown']);

function lintSources(sources: SourceRef[] | undefined, path: string, tag: string): LintMessage[] {
  const messages: LintMessage[] = [];
  if (!Array.isArray(sources) || sources.length === 0) {
    return [{ level: 'error', path, message: `${tag} 至少需要一条 sources` }];
  }
  const seen = new Set<string>();
  for (const [index, source] of sources.entries()) {
    if (!source || typeof source.work !== 'string' || !source.work.trim()) {
      messages.push({ level: 'error', path, message: `${tag}[${index}] 缺少 work` });
      continue;
    }
    const key = JSON.stringify(source);
    if (seen.has(key)) messages.push({ level: 'error', path, message: `${tag} 不能有重复出处` });
    seen.add(key);
  }
  checkSourcePaths(messages, path, 'SOURCE_LOCAL_PATH', sources);
  return messages;
}

function lintOptionalYear(
  value: {
    year?: number;
    yearAccuracy?: string;
    yearNote?: string;
    endYear?: number;
    endYearAccuracy?: string;
    endYearNote?: string;
  },
  path: string,
  requireAccuracy: boolean,
): LintMessage[] {
  const messages: LintMessage[] = [];
  if (value.year !== undefined && (!Number.isInteger(value.year) || value.year === 0)) {
    messages.push({ level: 'error', path, message: 'year 必须是非零整数' });
  }
  if (requireAccuracy && value.year === undefined && value.yearAccuracy !== 'unknown') {
    messages.push({ level: 'error', path, message: '未知年份时 yearAccuracy 必须为 unknown' });
  }
  if (value.year !== undefined && requireAccuracy && !ACCURACIES.has(value.yearAccuracy ?? '')) {
    messages.push({ level: 'error', path, message: 'yearAccuracy 必须是 exact、approx、disputed 或 unknown' });
  }
  if (value.yearAccuracy === 'unknown' && value.year !== undefined) {
    messages.push({ level: 'error', path, message: 'yearAccuracy 为 unknown 时不能写 year' });
  }
  if ((value.yearAccuracy === 'approx' || value.yearAccuracy === 'disputed') && !value.yearNote?.trim()) {
    messages.push({ level: 'error', path, message: 'approx / disputed 必须写 yearNote' });
  }
  if (value.endYear !== undefined) {
    if (!Number.isInteger(value.endYear) || value.endYear === 0) {
      messages.push({ level: 'error', path, message: 'endYear 必须是非零整数' });
    }
    if (value.year !== undefined && value.endYear < value.year) {
      messages.push({ level: 'error', path, message: 'endYear 不得早于 year' });
    }
    if (!ACCURACIES.has(value.endYearAccuracy ?? '') || value.endYearAccuracy === 'unknown') {
      messages.push({ level: 'error', path, message: '有 endYear 时必须写有效的 endYearAccuracy' });
    }
    if ((value.endYearAccuracy === 'approx' || value.endYearAccuracy === 'disputed') && !value.endYearNote?.trim()) {
      messages.push({ level: 'error', path, message: '结束年 approx / disputed 必须写 endYearNote' });
    }
  } else if (value.endYearAccuracy !== undefined || value.endYearNote !== undefined) {
    messages.push({ level: 'error', path, message: '没有 endYear 时不能写结束精度或说明' });
  }
  return messages;
}

function lintPersonExtensions(person: RegistryPerson, path: string): LintMessage[] {
  const messages: LintMessage[] = [];
  const seen = new Set<string>();
  for (const work of person.works ?? []) {
    const workPath = `${path}#works/${work.id}`;
    if (!LOCAL_ID.test(work.id) || seen.has(work.id)) {
      messages.push({ level: 'error', path: workPath, message: '作品 id 必须是人物内唯一的 kebab-case' });
    }
    seen.add(work.id);
    if (!work.title?.trim()) messages.push({ level: 'error', path: workPath, message: '作品缺少 title' });
    messages.push(...lintOptionalYear(work, workPath, false));
    messages.push(...lintSources(work.sources, workPath, 'sources'));
  }
  for (const experience of person.experiences ?? []) {
    const experiencePath = `${path}#experiences/${experience.id}`;
    if (!LOCAL_ID.test(experience.id) || seen.has(experience.id)) {
      messages.push({ level: 'error', path: experiencePath, message: '作品与经历共享的人物内 id 必须唯一' });
    }
    seen.add(experience.id);
    if (!experience.label?.trim() || !experience.note?.trim()) {
      messages.push({ level: 'error', path: experiencePath, message: '经历必须有 label 与 note' });
    }
    messages.push(...lintOptionalYear(experience, experiencePath, true));
    messages.push(...lintSources(experience.sources, experiencePath, 'sources'));
  }
  return messages;
}

function sourceKind(source: SourceRef): 'classic' | 'modern' | 'database' {
  return source.kind ?? 'classic';
}

function hasReliableSource(sources: SourceRef[] | undefined): boolean {
  if (!Array.isArray(sources)) return false;
  return sources.some(
    (source) =>
      source !== null &&
      typeof source === 'object' &&
      typeof source.work === 'string' &&
      source.work.trim() !== '' &&
      sourceKind(source) !== 'database',
  );
}

/** 出处只写书目定位（书名 + 卷次/篇目）。抽取库 raw/ 不在仓库里，本机路径、文件名和行号锚对读者没有定位价值。 */
function localArtifact(value: string): string | null {
  if (value.includes('file://')) return '本机绝对路径';
  if (/(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/.test(value)) return '本机绝对路径';
  if (/[\\/](?:Users|home)[\\/]/.test(value)) return '本机绝对路径';
  if (/(^|[\s(（])raw\//.test(value)) return 'raw/ 抽取目录路径';
  if (/\.(?:md|txt)(?:$|[\s)）(（])/.test(value)) return '抽取文件名';
  if (!value.includes('://') && /:\d+(?:[-,]\d+)*/.test(value)) return '抽取文本的行号锚';
  return null;
}

function checkSourcePaths(messages: LintMessage[], path: string, tag: string, sources: SourceRef[] | undefined): void {
  for (const [index, source] of (sources ?? []).entries()) {
    if (source === null || typeof source !== 'object') continue;
    for (const field of ['work', 'part', 'note'] as const) {
      const value = source[field];
      if (typeof value !== 'string') continue;
      const hit = localArtifact(value);
      if (hit) {
        messages.push({
          level: 'error',
          path,
          message: `[${tag}] sources[${index}].${field} 含${hit}；出处写书名与卷次篇目`,
        });
      }
    }
  }
}

export interface RosterReport {
  brief: number;
  full: number;
  pending: number;
  rejected: number;
}

/** 登记按简表/详表计数；候选台账按待核/不收计数。人数本身不是门禁。 */
export function summarizeRoster(data: PipelineData): RosterReport {
  let brief = 0;
  let full = 0;
  for (const person of data.people.values()) {
    if (profileOf(person) === 'brief') brief += 1;
    else full += 1;
  }
  let pending = 0;
  let rejected = 0;
  for (const entries of data.candidates.values()) {
    for (const entry of entries) {
      if (entry.status === 'pending') pending += 1;
      else if (entry.status === 'rejected') rejected += 1;
    }
  }
  return { brief, full, pending, rejected };
}

export function lintRegistryPerson(
  person: RegistryPerson,
  categoryIds: Set<string>,
  polityIds: Set<string>,
  path = `pipeline/registry/people/${person.id}.json`,
): LintMessage[] {
  const messages = lintPersonSchema(person, path);
  const categories = Array.isArray(person.categories) ? person.categories : [];
  if (new Set(categories).size !== categories.length) {
    messages.push({ level: 'error', path, message: 'categories 不能有重复值' });
  }
  for (const category of categories) {
    if (!categoryIds.has(category)) {
      messages.push({ level: 'error', path, message: `category ${category} 不在词表中` });
    }
  }
  if (person.primary && Array.isArray(person.categories) && !person.categories.includes(person.primary)) {
    messages.push({ level: 'error', path, message: `primary ${person.primary} 不在 categories 中` });
  }
  const polities = Array.isArray(person.polity) ? person.polity : [];
  if (new Set(polities).size !== polities.length) {
    messages.push({ level: 'error', path, message: 'polity 不能有重复值' });
  }
  for (const polity of polities) {
    if (!polityIds.has(polity)) {
      messages.push({ level: 'error', path, message: `polity ${polity} 不在词表中` });
    }
  }
  if (!person.sources || person.sources.length === 0) {
    messages.push({ level: 'error', path, message: '缺少出处' });
  }
  if (person.birth === undefined && person.death === undefined) {
    messages.push({ level: 'error', path, message: '生卒年全为空' });
  }
  if (person.birth === undefined && person.birthAccuracy !== 'unknown') {
    messages.push({ level: 'error', path, message: '缺生年时 birthAccuracy 应为 unknown' });
  }
  if (person.death === undefined && person.deathAccuracy !== 'unknown') {
    messages.push({ level: 'error', path, message: '缺卒年时 deathAccuracy 应为 unknown' });
  }
  if (person.birth !== undefined && person.birthAccuracy === 'unknown') {
    messages.push({ level: 'error', path, message: 'birthAccuracy 为 unknown 时不应写入 birth' });
  }
  if (person.death !== undefined && person.deathAccuracy === 'unknown') {
    messages.push({ level: 'error', path, message: 'deathAccuracy 为 unknown 时不应写入 death' });
  }
  if (person.birthAccuracy === 'disputed' && !person.birthNote) {
    messages.push({ level: 'error', path, message: '生年异说必须写 birthNote' });
  }
  if (person.deathAccuracy === 'disputed' && !person.deathNote) {
    messages.push({ level: 'error', path, message: '卒年异说必须写 deathNote' });
  }
  if (person.birth !== undefined && person.death !== undefined && person.birth > person.death) {
    messages.push({ level: 'error', path, message: '生年晚于卒年' });
  }
  // 与事件线 [EVENT_YEAR_ZERO] 同一口径：有符号年份里没有公元 0 年
  if (person.birth === 0) {
    messages.push({ level: 'error', path, message: '[PERSON_BIRTH_YEAR_ZERO] birth 不存在公元 0 年，使用 -1 或 1' });
  }
  if (person.death === 0) {
    messages.push({ level: 'error', path, message: '[PERSON_DEATH_YEAR_ZERO] death 不存在公元 0 年，使用 -1 或 1' });
  }
  if ((person.birth !== undefined || person.death !== undefined) && !hasReliableSource(person.sources)) {
    messages.push({ level: 'error', path, message: '年份不能只靠 database 出处支撑，需要 classic 或 modern' });
  }
  if (person.profile === 'full' && !person.bio?.trim()) {
    messages.push({ level: 'error', path, message: '详表缺少 bio' });
  }
  if (person.profile === 'brief' && person.bio?.trim()) {
    messages.push({ level: 'error', path, message: '已写 bio，profile 应为 full' });
  }
  if (person.profile && (!person.polity || person.polity.length === 0)) {
    messages.push({ level: 'error', path, message: '简表必须写 polity' });
  }
  if (person.profile === 'brief' || person.profile === 'full') {
    if (person.birthAccuracy === 'approx' && !person.birthNote?.trim()) {
      messages.push({ level: 'error', path, message: '生年约略必须写 birthNote' });
    }
    if (person.deathAccuracy === 'approx' && !person.deathNote?.trim()) {
      messages.push({ level: 'error', path, message: '卒年约略必须写 deathNote' });
    }
  }
  // 与事件线 [EVENT_PLACEHOLDER] 同一口径：骨架占位不能编进产物。
  const placeholderFields: Array<[string, unknown]> = [
    ['name', person.name],
    ['display', person.display],
    ['title', person.title],
    ['birthNote', person.birthNote],
    ['deathNote', person.deathNote],
    ['bio', person.bio],
  ];
  for (const [field, value] of placeholderFields) {
    if (typeof value === 'string' && /待填|TODO|TBD/i.test(value)) {
      messages.push({ level: 'error', path, message: `[PERSON_PLACEHOLDER] ${field} 仍包含占位符` });
    }
  }
  for (const [field, values] of [
    ['tags', person.tags ?? []],
    ['aliases', person.aliases ?? []],
  ] as const) {
    for (const value of values) {
      if (typeof value === 'string' && /待填|TODO|TBD/i.test(value)) {
        messages.push({ level: 'error', path, message: `[PERSON_PLACEHOLDER] ${field} 仍包含占位符` });
      }
    }
  }
  for (const [index, source] of (person.sources ?? []).entries()) {
    for (const field of ['work', 'part', 'note'] as const) {
      const value = source[field];
      if (typeof value === 'string' && /待填|TODO|TBD/i.test(value)) {
        messages.push({
          level: 'error',
          path,
          message: `[PERSON_PLACEHOLDER] sources[${index}].${field} 仍包含占位符`,
        });
      }
    }
  }
  checkSourcePaths(messages, path, 'PERSON_SOURCE_LOCAL_PATH', person.sources);
  messages.push(...lintPersonExtensions(person, path));
  return messages;
}

/** 事件线的收录范围。含夏，止于民国结束。与 compile.ts 的 EVENT_RANGE 同步。 */
export const EVENT_YEAR_MIN = -2070;
export const EVENT_YEAR_MAX = 1949;

export interface EventLintContext {
  polityIds: Set<string>;
  people: Set<string>;
  /** 完整人物登记；events:check 可只传 people，content:check 传入后启用跨实体门禁。 */
  personRecords?: Map<string, RegistryPerson>;
  events: Map<string, RegistryEvent>;
  publishedEventIds?: Set<string>;
}

export function lintRegistryEvent(
  event: RegistryEvent,
  ctx: EventLintContext,
  path = `content/events/${event.id}.md`,
): LintMessage[] {
  const messages = lintEventSchema(event, path);
  const military = event.type === 'military';

  if (military) {
    if (!event.scale) {
      messages.push({ level: 'error', path, message: '军事事件缺少 scale' });
    }
    if (!event.belligerents || event.belligerents.length < 2) {
      messages.push({ level: 'error', path, message: '军事事件至少要写两个交战方' });
    }
    if (event.polity && event.polity.length > 0) {
      messages.push({ level: 'error', path, message: '军事事件用 belligerents 表示政权，不应同时写 polity' });
    }
    if (event.scale === 'war' && typeof event.place === 'string' && event.place) {
      messages.push({ level: 'error', path, message: 'war 是跨地域战争，不应写 place' });
    }
    if (event.scale && event.scale !== 'war' && (typeof event.place !== 'string' || !event.place.trim())) {
      messages.push({ level: 'error', path, message: `${event.scale} 缺少 place` });
    }
    if (event.scale === 'war' && event.endYear === undefined) {
      messages.push({ level: 'error', path, message: '[EVENT_WAR_END_YEAR] war 必须写 endYear' });
    }
    if ((event.scale === 'battle' || event.scale === 'engagement') && event.endYear !== undefined) {
      messages.push({
        level: 'error',
        path,
        message: `[EVENT_POINT_SCALE_END_YEAR] ${event.scale} 是点事件，不应写 endYear`,
      });
    }
  } else {
    if (event.scale) {
      messages.push({ level: 'error', path, message: 'scale 只用于军事事件' });
    }
    if (event.belligerents) {
      messages.push({ level: 'error', path, message: 'belligerents 只用于军事事件' });
    }
    if (!event.polity || event.polity.length === 0) {
      messages.push({ level: 'error', path, message: '非军事事件缺少 polity' });
    }
  }

  if (event.yearAccuracy === 'unknown') {
    messages.push({ level: 'error', path, message: 'yearAccuracy 为 unknown 时不应写 year，事件上不了轴' });
  }
  if (event.year === 0) {
    messages.push({ level: 'error', path, message: '[EVENT_YEAR_ZERO] year 不存在公元 0 年，使用 -1 或 1' });
  }
  if (event.yearAccuracy === 'disputed' && (typeof event.yearNote !== 'string' || !event.yearNote.trim())) {
    messages.push({ level: 'error', path, message: '年份有异说必须写 yearNote' });
  }
  if (event.yearAccuracy === 'approx' && (typeof event.yearNote !== 'string' || !event.yearNote.trim())) {
    messages.push({ level: 'error', path, message: '年份约略必须写 yearNote' });
  }
  if (event.endYear !== undefined && event.endYear < event.year) {
    messages.push({ level: 'error', path, message: 'endYear 早于 year' });
  }
  if (event.endYear !== undefined) {
    if (!event.endYearAccuracy) {
      messages.push({ level: 'error', path, message: '[EVENT_END_YEAR_ACCURACY] 有 endYear 时必须写 endYearAccuracy' });
    }
    if (event.endYearAccuracy === 'unknown') {
      messages.push({ level: 'error', path, message: '[EVENT_END_YEAR_UNKNOWN] endYear 不能标 unknown' });
    }
    if ((event.endYearAccuracy === 'approx' || event.endYearAccuracy === 'disputed') && !event.endYearNote?.trim()) {
      messages.push({
        level: 'error',
        path,
        message: '[EVENT_END_YEAR_NOTE] endYear 约略或有异说时必须写 endYearNote',
      });
    }
  } else if (event.endYearAccuracy !== undefined || event.endYearNote !== undefined) {
    messages.push({ level: 'error', path, message: '[EVENT_END_YEAR_ORPHAN] 没有 endYear 时不能写端点 accuracy/note' });
  }
  if (event.endYear === 0) {
    messages.push({ level: 'error', path, message: '[EVENT_END_YEAR_ZERO] endYear 不存在公元 0 年，使用 -1 或 1' });
  }
  if (event.year < EVENT_YEAR_MIN || event.year > EVENT_YEAR_MAX) {
    messages.push({
      level: 'error',
      path,
      message: `year ${event.year} 超出收录范围 ${EVENT_YEAR_MIN}—${EVENT_YEAR_MAX}`,
    });
  }
  if (event.endYear !== undefined && (event.endYear < EVENT_YEAR_MIN || event.endYear > EVENT_YEAR_MAX)) {
    messages.push({
      level: 'error',
      path,
      message: `endYear ${event.endYear} 超出收录范围 ${EVENT_YEAR_MIN}—${EVENT_YEAR_MAX}`,
    });
  }
  if (!hasReliableSource(event.sources)) {
    messages.push({ level: 'error', path, message: '年份不能只靠 database 出处支撑，需要 classic 或 modern' });
  }

  if (!event.catalogs || event.catalogs.length === 0) {
    const lifecycleStatus = (event as RegistryEvent).status;
    messages.push({
      level: lifecycleStatus === 'published' ? 'error' : 'warning',
      path,
      message:
        lifecycleStatus === 'published'
          ? '[EVENT_CATALOG_REQUIRED] published 事件必须显式声明 catalogs'
          : '[EVENT_CATALOG_DEFAULT] 未显式声明 catalogs，将暂按旧规则推导；新迁移条目应补齐',
    });
  } else {
    const catalogs = new Set(event.catalogs);
    if (event.type === 'military' && !catalogs.has('military')) {
      messages.push({
        level: 'error',
        path,
        message: '[EVENT_CATALOG_MILITARY] type=military 必须进入 military catalog',
      });
    }
    if (catalogs.has('military') && event.type !== 'military' && event.type !== 'rebellion') {
      messages.push({
        level: 'error',
        path,
        message: '[EVENT_CATALOG_TYPE] 只有 military 或 rebellion 可以进入 military catalog',
      });
    }
    if (event.type === 'rebellion' && !catalogs.has('history')) {
      messages.push({
        level: 'warning',
        path,
        message: '[EVENT_CATALOG_REBELLION] rebellion 通常应进入 history catalog；如有武装行动请同时声明 military',
      });
    }
  }

  // draft 允许保留骨架占位；published 事件一旦仍有占位就拒绝进入轴。
  const lifecycleStatus = (event as RegistryEvent & { status?: 'draft' | 'published' }).status;
  if (lifecycleStatus !== 'draft') {
    const placeholderFields: Array<[string, unknown]> = [
      ['name', event.name],
      ['display', event.display],
      ['place', event.place],
      ['placeNow', event.placeNow],
      ['result', event.result],
      ['yearNote', event.yearNote],
      ['desc', event.desc],
    ];
    for (const [field, value] of placeholderFields) {
      if (typeof value === 'string' && /待填|TODO|TBD/i.test(value)) {
        messages.push({ level: 'error', path, message: `[EVENT_PLACEHOLDER] ${field} 仍包含占位符` });
      }
    }
    for (const [index, source] of (event.sources ?? []).entries()) {
      for (const field of ['work', 'part', 'note'] as const) {
        const value = source[field];
        if (typeof value === 'string' && /待填|TODO|TBD/i.test(value)) {
          messages.push({
            level: 'error',
            path,
            message: `[EVENT_PLACEHOLDER] sources[${index}].${field} 仍包含占位符`,
          });
        }
      }
    }
  }
  checkSourcePaths(messages, path, 'EVENT_SOURCE_LOCAL_PATH', event.sources);

  const partIds = new Set<string>();
  for (const part of event.partOf ?? []) {
    partIds.add(part.id);
    const partPath = `${path}#partOf/${part.id}`;
    if (part.id === event.id) messages.push({ level: 'error', path: partPath, message: 'partOf 不能指向自己' });
    if (!part.note?.trim()) messages.push({ level: 'error', path: partPath, message: 'partOf 必须有组成说明 note' });
    messages.push(...lintSources(part.sources, partPath, 'sources'));
    const parent = ctx.events.get(part.id);
    if (!parent || (ctx.publishedEventIds && !ctx.publishedEventIds.has(part.id) && event.status !== 'draft')) {
      messages.push({ level: 'error', path: partPath, message: `partOf ${part.id} 不存在或不是已发布事件` });
      continue;
    }
    const isComposition =
      (parent.type === 'rebellion' ||
        (parent.type === 'military' && (parent.scale === 'war' || parent.scale === 'campaign'))) &&
      parent.endYear !== undefined;
    if (!isComposition) {
      messages.push({ level: 'error', path: partPath, message: `partOf ${part.id} 不是允许的 span 组合事件` });
    }
    if (parent.endYear === undefined) {
      messages.push({ level: 'error', path: partPath, message: `partOf ${part.id} 缺少 endYear，不能作为组合` });
    }
    if (parent.endYear !== undefined && (event.endYear ?? event.year) < parent.year) {
      messages.push({ level: 'error', path: partPath, message: `partOf ${part.id} 与成员时间区间不相交` });
    }
    if (parent.endYear !== undefined && event.year > parent.endYear) {
      messages.push({ level: 'error', path: partPath, message: `partOf ${part.id} 与成员时间区间不相交` });
    }
  }
  if (partIds.size !== (event.partOf ?? []).length) {
    messages.push({ level: 'error', path, message: 'partOf 不能重复引用同一组合' });
  }
  const belligerents = Array.isArray(event.belligerents) ? event.belligerents : [];
  const polities = Array.isArray(event.polity) ? event.polity : [];
  for (const [label, values] of [
    ['belligerents', belligerents],
    ['polity', polities],
    ['people', event.people ?? []],
  ] as const) {
    if (new Set(values).size !== values.length) {
      messages.push({ level: 'error', path, message: `${label} 不能有重复值` });
    }
  }
  for (const polity of [...belligerents, ...polities]) {
    if (!ctx.polityIds.has(polity)) {
      messages.push({ level: 'error', path, message: `政权 ${polity} 不在词表中` });
    }
  }
  const commanders = Array.isArray(event.commanders) ? event.commanders : [];
  const people = Array.isArray(event.people) ? event.people : [];
  const sides = new Set(belligerents);
  for (const commander of commanders) {
    if (commander && typeof commander === 'object' && commander.side && !sides.has(commander.side)) {
      messages.push({
        level: 'error',
        path,
        message: `主将 ${commander.id} 的 side ${commander.side} 不在 belligerents 中`,
      });
    }
  }
  for (const id of [...commanders.map((item) => item?.id), ...people]) {
    if (!ctx.people.has(id)) {
      messages.push({ level: 'error', path, message: `引用的人物不存在：${id}` });
    }
  }

  // 事件年份与人物生卒、人物政权归属是交叉证据：确定冲突报错，异说或仅相关人物报提醒。
  if (ctx.personRecords) {
    const eventStart = event.year;
    const eventEnd = event.endYear ?? event.year;
    for (const commander of commanders) {
      const person = ctx.personRecords.get(commander.id);
      if (!person) continue;
      const exactLife = person.birthAccuracy === 'exact' && person.deathAccuracy === 'exact';
      const exactEvent =
        event.yearAccuracy === 'exact' && (event.endYear === undefined || event.endYearAccuracy === 'exact');
      const certainDateConflict = exactLife && exactEvent;
      if (person.birth !== undefined && eventEnd < person.birth) {
        messages.push({
          level: certainDateConflict ? 'error' : 'warning',
          path,
          message: `[EVENT_PERSON_DATE] 主将 ${commander.id} 的事件早于生年`,
        });
      }
      if (person.death !== undefined && eventStart > person.death) {
        messages.push({
          level: certainDateConflict ? 'error' : 'warning',
          path,
          message: `[EVENT_PERSON_DATE] 主将 ${commander.id} 的事件晚于卒年`,
        });
      }
      if (
        commander.side &&
        person.polity &&
        person.polity.length > 0 &&
        !politiesCompatible(person.polity, [commander.side])
      ) {
        messages.push({
          level: 'warning',
          path,
          message: `[EVENT_PERSON_POLITY] 主将 ${commander.id} 的 side=${commander.side} 与人物 polity 不重合，请核对时点归属`,
        });
      }
      if (
        !commander.side &&
        polities.length > 0 &&
        person.polity &&
        person.polity.length > 0 &&
        !politiesCompatible(person.polity, polities)
      ) {
        messages.push({
          level: 'warning',
          path,
          message: `[EVENT_PERSON_POLITY] 主将 ${commander.id} 的 polity 与事件 polity 不重合，请核对时点归属`,
        });
      }
    }
    for (const id of people) {
      if (commanders.some((commander) => commander.id === id)) continue;
      const person = ctx.personRecords.get(id);
      if (!person) continue;
      if (
        (person.birth !== undefined && eventEnd < person.birth) ||
        (person.death !== undefined && eventStart > person.death)
      ) {
        messages.push({
          level: 'warning',
          path,
          message: `[EVENT_PERSON_DATE] 相关人物 ${id} 的事件年份落在生卒范围之外，请核对是否应改为 people/出处说明`,
        });
      }
      if (
        polities.length > 0 &&
        person.polity &&
        person.polity.length > 0 &&
        !politiesCompatible(person.polity, polities)
      ) {
        messages.push({
          level: 'warning',
          path,
          message: `[EVENT_PERSON_POLITY] 相关人物 ${id} 的 polity 与事件 polity 不重合，请核对时点归属`,
        });
      }
    }
  }

  if (event.parent !== undefined) {
    if (event.parent === event.id) {
      messages.push({ level: 'error', path, message: 'parent 不能指向自己' });
    } else {
      const parent = ctx.events.get(event.parent);
      if (!parent) {
        messages.push({ level: 'error', path, message: `parent ${event.parent} 不存在` });
      } else {
        if (parent.parent) {
          messages.push({ level: 'error', path, message: `parent ${event.parent} 自身还有 parent，只允许两层` });
        }
        if (parent.type !== 'military' || parent.scale !== 'war') {
          messages.push({ level: 'error', path, message: `parent ${event.parent} 必须是 scale=war 的军事事件` });
        }
        if (parent.endYear === undefined) {
          messages.push({ level: 'error', path, message: `parent ${event.parent} 是战争时必须写 endYear` });
        }
        if (event.type !== 'military' || (event.scale !== 'campaign' && event.scale !== 'battle')) {
          messages.push({ level: 'error', path, message: 'parent 子事件必须是 scale=campaign 或 battle 的军事事件' });
        }
        const childEnd = event.endYear ?? event.year;
        if (parent.endYear !== undefined && (event.year < parent.year || childEnd > parent.endYear)) {
          messages.push({
            level: 'error',
            path,
            message: `事件时间 ${event.year}—${childEnd} 超出 parent ${event.parent} 的范围 ${parent.year}—${parent.endYear}`,
          });
        }
      }
      const seenParents = new Set<string>([event.id]);
      let cursor = event.parent;
      while (cursor) {
        if (seenParents.has(cursor)) {
          messages.push({ level: 'error', path, message: 'parent 链存在循环' });
          break;
        }
        seenParents.add(cursor);
        cursor = ctx.events.get(cursor)?.parent ?? '';
      }
    }
  }

  if (event.importance === 3 && (typeof event.desc !== 'string' || !event.desc.trim())) {
    messages.push({ level: 'warning', path, message: 'importance 为 3 但还没写正文' });
  }
  if (typeof event.name === 'string' && event.name.length > 8 && !event.display) {
    messages.push({ level: 'warning', path, message: '名称较长但没有 display，轴上标签会挤' });
  }
  if (military && (typeof event.result !== 'string' || !event.result.trim())) {
    messages.push({ level: 'warning', path, message: '军事事件缺少 result' });
  }
  if (!military && (event.sources?.length ?? 0) < 2) {
    messages.push({ level: 'warning', path, message: '非军事事件建议两条出处' });
  }
  return messages;
}

export function isCompositionEvent(event: RegistryEvent): boolean {
  return (
    event.endYear !== undefined &&
    (event.type === 'rebellion' || (event.type === 'military' && (event.scale === 'war' || event.scale === 'campaign')))
  );
}

export function lintEventCompositionGraph(events: Map<string, RegistryEvent>): LintMessage[] {
  const messages: LintMessage[] = [];
  const finished = new Set<string>();
  const visiting = new Set<string>();
  const reported = new Set<string>();
  const visit = (id: string): void => {
    if (finished.has(id)) return;
    if (visiting.has(id)) {
      if (!reported.has(id))
        messages.push({ level: 'error', path: `content/events/${id}.md`, message: 'partOf 链存在循环' });
      reported.add(id);
      return;
    }
    const event = events.get(id);
    if (!event) return;
    visiting.add(id);
    for (const part of event.partOf ?? []) visit(part.id);
    visiting.delete(id);
    finished.add(id);
  };
  for (const id of events.keys()) {
    if (!isCompositionEvent(events.get(id)!)) continue;
    visit(id);
    for (const part of events.get(id)!.partOf ?? []) visit(part.id);
  }
  return messages;
}

function lintDynasties(dynasties: DynastyTerm[]): LintMessage[] {
  const messages: LintMessage[] = [];
  const path = 'pipeline/vocab/dynasties.json';
  const seen = new Set<string>();
  for (const item of dynasties) {
    if (seen.has(item.id)) {
      messages.push({ level: 'error', path, message: `朝代 id 重复：${item.id}` });
    }
    seen.add(item.id);
    if (item.from > item.to) {
      messages.push({ level: 'error', path, message: `${item.id} 的 from 晚于 to` });
    }
  }
  return messages;
}

export function lintEvents(data: PipelineData): LintMessage[] {
  const ctx: EventLintContext = {
    polityIds: vocabSet(data.polities),
    people: new Set(data.people.keys()),
    personRecords: data.people,
    events: data.events,
    publishedEventIds: new Set(data.events.keys()),
  };
  const messages: LintMessage[] = [];
  const aliasOwners = new Map<string, string>();
  for (const event of data.events.values()) {
    const path = data.eventPaths.get(event.id) ?? `content/events/${event.id}.md`;
    messages.push(...lintRegistryEvent(event, ctx, path));
    const aliases = event.aliases ?? [];
    if (new Set(aliases).size !== aliases.length) {
      messages.push({ level: 'error', path, message: 'aliases 不能有重复值' });
    }
    for (const alias of aliases) {
      if (alias === event.id) messages.push({ level: 'error', path, message: `alias 不能等于 canonical id：${alias}` });
      const canonical = data.events.get(alias);
      if (canonical && canonical.id !== event.id) {
        messages.push({ level: 'error', path, message: `alias ${alias} 与另一个 canonical event id 冲突` });
      }
      const owner = aliasOwners.get(alias);
      if (owner && owner !== event.id) {
        messages.push({ level: 'error', path, message: `alias ${alias} 已指向 ${owner}，不能再指向 ${event.id}` });
      } else {
        aliasOwners.set(alias, event.id);
      }
    }
  }
  messages.push(...lintDynasties(data.dynasties));
  messages.push(...lintEventCompositionGraph(data.events));
  return messages;
}

interface RelationMerge {
  key: string;
  source: string;
  target: string;
  type: string;
  directed: boolean;
  since?: number;
  notes: string[];
  topicIds: string[];
}

function relationMerge(topic: TopicDraft, relation: TopicDraft['relations'][number]): RelationMerge {
  const relationType = topic.relationTypes.find((item) => item.id === relation.type);
  const directed = relationType?.directed ?? false;
  const [source, target] = directed ? [relation.source, relation.target] : [relation.source, relation.target].sort();
  return {
    key: `${source}\0${target}\0${relation.type}`,
    source,
    target,
    type: relation.type,
    directed,
    since: relation.since,
    notes: relation.note ? [relation.note] : [],
    topicIds: [topic.meta.id],
  };
}

export function mergeTopicRelations(topics: TopicDraft[]): { relations: RelationMerge[]; messages: LintMessage[] } {
  const merges = new Map<string, RelationMerge>();
  const messages: LintMessage[] = [];
  for (const topic of topics) {
    for (const relation of topic.relations) {
      const incoming = relationMerge(topic, relation);
      const existing = merges.get(incoming.key);
      if (!existing) {
        merges.set(incoming.key, incoming);
        continue;
      }
      const relationPath = `relations/${existing.source}/${existing.target}/${existing.type}`;
      if (existing.directed !== incoming.directed) {
        messages.push({ level: 'error', path: relationPath, message: '跨专题 relationType directed 冲突' });
      }
      if (existing.since !== undefined && incoming.since !== undefined && existing.since !== incoming.since) {
        messages.push({ level: 'error', path: relationPath, message: '跨专题关系 since 冲突' });
      }
      if (existing.since === undefined) existing.since = incoming.since;
      for (const note of incoming.notes) if (!existing.notes.includes(note)) existing.notes.push(note);
      if (!existing.topicIds.includes(topic.meta.id)) existing.topicIds.push(topic.meta.id);
    }
  }
  return { relations: [...merges.values()], messages };
}

export function lintCollections(data: PipelineData): LintMessage[] {
  const messages: LintMessage[] = [];
  const categoryIds = vocabSet(data.collectionCategories);
  const dynastyIds = vocabSet(data.dynasties);
  const merged = mergeTopicRelations(data.topics);
  const conflicts = new Set(merged.messages.map((message) => message.path));
  const relationKeys = new Set(merged.relations.map((relation) => relation.key));
  const seenAliases = new Map<string, string>();
  const collections = [...data.collections.values(), ...data.draftCollections.values()];
  for (const collection of collections) {
    const path =
      data.collectionPaths.get(collection.id) ??
      data.draftCollectionPaths.get(collection.id) ??
      `content/collections/${collection.id}.md`;
    if (new Set(collection.events ?? []).size !== (collection.events ?? []).length) {
      messages.push({ level: 'error', path, message: 'events 不能有重复引用' });
    }
    if (new Set(collection.dynasties ?? []).size !== (collection.dynasties ?? []).length) {
      messages.push({ level: 'error', path, message: 'dynasties 不能有重复引用' });
    }
    messages.push(...lintCollectionSchema(collection, path));
    messages.push(...lintSources(collection.sources, path, 'sources'));
    if (!categoryIds.has(collection.category))
      messages.push({ level: 'error', path, message: `未知 category ${collection.category}` });
    if (
      collection.status === 'published' &&
      /待填|TODO|TBD/i.test(`${collection.name}\n${collection.summary}\n${collection.body ?? ''}`)
    ) {
      messages.push({ level: 'error', path, message: 'published Collection 仍有占位文本' });
    }
    const memberIds = new Set<string>();
    const orders = new Set<number>();
    for (const member of Array.isArray(collection.members) ? collection.members : []) {
      if (memberIds.has(member.id)) messages.push({ level: 'error', path, message: `重复成员 ${member.id}` });
      if (orders.has(member.order)) messages.push({ level: 'error', path, message: `重复成员顺序 ${member.order}` });
      memberIds.add(member.id);
      orders.add(member.order);
      if (!data.people.has(member.id)) messages.push({ level: 'error', path, message: `成员不存在 ${member.id}` });
    }
    if (memberIds.size < 2) messages.push({ level: 'error', path, message: 'Collection 至少需要两名成员' });
    for (const relation of collection.relations ?? []) {
      if (!memberIds.has(relation.source) || !memberIds.has(relation.target)) {
        messages.push({ level: 'error', path, message: `关系 ${relation.source}→${relation.target} 的端点不全是成员` });
      }
      const key = resolveCollectionRelationKey(data.topics, relation);
      const relationPath = key?.replaceAll('\0', '/');
      if (!key || !relationKeys.has(key) || (relationPath !== undefined && conflicts.has(relationPath))) {
        messages.push({
          level: 'error',
          path,
          message: `Collection 关系引用无法解析 ${relation.source}→${relation.target}/${relation.type}`,
        });
      }
    }
    for (const eventId of collection.events ?? []) {
      if (!data.events.has(eventId))
        messages.push({ level: 'error', path, message: `事件引用不存在或未发布 ${eventId}` });
    }
    for (const dynastyId of collection.dynasties ?? []) {
      if (!dynastyIds.has(dynastyId)) messages.push({ level: 'error', path, message: `朝代引用不存在 ${dynastyId}` });
    }
    const views = Array.isArray(collection.views) ? collection.views : [];
    if (new Set(views).size !== views.length) messages.push({ level: 'error', path, message: 'views 不能重复' });
    for (const view of ['overview', 'members', 'timeline']) {
      if (!views.includes(view as (typeof collection.views)[number]))
        messages.push({ level: 'error', path, message: `必须包含 ${view} 视图` });
    }
    if (!views.includes(collection.defaultView))
      messages.push({ level: 'error', path, message: 'defaultView 必须属于 views' });
    if (views.includes('relations') && (collection.relations ?? []).length === 0)
      messages.push({ level: 'error', path, message: 'relations 视图需要至少一条关系' });
    if (views.includes('events') && (collection.events ?? []).length === 0)
      messages.push({ level: 'error', path, message: 'events 视图需要至少一个事件' });
    if (views.includes('works') && ![...memberIds].some((id) => (data.people.get(id)?.works ?? []).length > 0)) {
      messages.push({ level: 'error', path, message: 'works 视图需要至少一名成员有作品' });
    }
    for (const step of collection.path ?? []) {
      if (Number(Boolean(step.person)) + Number(Boolean(step.event)) > 1)
        messages.push({ level: 'error', path, message: `探索步骤 ${step.label} 至多一个 person 或 event` });
      if (step.person && !memberIds.has(step.person))
        messages.push({ level: 'error', path, message: `探索步骤引用非成员 ${step.person}` });
      if (step.event && !(collection.events ?? []).includes(step.event))
        messages.push({ level: 'error', path, message: `探索步骤引用未收录事件 ${step.event}` });
      if (step.view && !views.includes(step.view))
        messages.push({ level: 'error', path, message: `探索步骤视图不可用 ${step.view}` });
    }
    for (const alias of collection.aliases ?? []) {
      const owner = seenAliases.get(alias);
      if (owner || data.collections.has(alias))
        messages.push({ level: 'error', path, message: `alias ${alias} 与其他 Collection 冲突` });
      seenAliases.set(alias, collection.id);
    }
  }
  return messages;
}

export function lintDiscovery(data: PipelineData): LintMessage[] {
  const messages: LintMessage[] = [];
  const dynastyIds = new Set(data.dynasties.map((item) => item.id));
  const topicIds = new Set(data.topics.map((item) => item.meta.id));
  const knownPeople = new Set(data.people.keys());
  const eventDynasties = new Map(
    [...data.events.values()].map((event) => [event.id, dynastyHits(data.dynasties, event.year, event.endYear)]),
  );
  for (const profile of data.dynastyProfiles.values()) {
    const path = data.dynastyProfilePaths.get(profile.id) ?? `pipeline/dynasties/${profile.id}.json`;
    messages.push(...lintDynastyProfileSchema(profile, path), ...lintSources(profile.sources, path, 'sources'));
    if (!dynastyIds.has(profile.id)) messages.push({ level: 'error', path, message: `朝代区间不存在 ${profile.id}` });
    for (const field of ['topics', 'featuredPeople', 'featuredEvents', 'collections'] as const) {
      if (new Set(profile[field] ?? []).size !== (profile[field] ?? []).length)
        messages.push({ level: 'error', path, message: `${field} 不能有重复引用` });
    }
    for (const id of profile.topics ?? [])
      if (!topicIds.has(id)) messages.push({ level: 'error', path, message: `年表专题不存在 ${id}` });
    for (const id of profile.founders ?? [])
      if (!knownPeople.has(id.id)) messages.push({ level: 'error', path, message: `建立者不存在 ${id.id}` });
    const eligiblePeople = new Set(
      data.topics
        .filter((topic) => (profile.topics ?? []).includes(topic.meta.id) || topic.catalog.eras.includes(profile.id))
        .flatMap((topic) => topic.people.map((person) => person.id)),
    );
    for (const id of profile.featuredPeople ?? []) {
      if (!knownPeople.has(id)) messages.push({ level: 'error', path, message: `推荐人物不存在 ${id}` });
      else if (!eligiblePeople.has(id))
        messages.push({ level: 'error', path, message: `推荐人物不在对应专题，需要显式 topics 编排 ${id}` });
    }
    for (const id of profile.featuredEvents ?? []) {
      if (!data.events.has(id)) messages.push({ level: 'error', path, message: `推荐事件不存在 ${id}` });
      else if (!eventDynasties.get(id)?.includes(profile.id))
        messages.push({ level: 'error', path, message: `推荐事件未命中朝代区间 ${id}` });
    }
    for (const id of profile.collections ?? [])
      if (!data.collections.has(id)) messages.push({ level: 'error', path, message: `相关群像不存在或未发布 ${id}` });
  }
  const editorialPath = 'pipeline/editorial/home.json';
  messages.push(...lintHomeEditorialSchema(data.homeEditorial, editorialPath));
  for (const field of ['dynasties', 'collections'] as const) {
    const ids = data.homeEditorial[field];
    if (new Set(ids).size !== ids.length)
      messages.push({ level: 'error', path: editorialPath, message: `${field} 不能有重复推荐` });
  }
  for (const id of data.homeEditorial.dynasties)
    if (!dynastyIds.has(id)) messages.push({ level: 'error', path: editorialPath, message: `推荐朝代不存在 ${id}` });
  for (const id of data.homeEditorial.collections)
    if (!data.collections.has(id))
      messages.push({ level: 'error', path: editorialPath, message: `推荐群像不存在或未发布 ${id}` });
  return messages;
}

export function resolveCollectionRelationKey(
  topics: TopicDraft[],
  ref: { source: string; target: string; type: string },
): string | undefined {
  const candidates = topics.flatMap((topic) =>
    topic.relations
      .filter((relation) => relation.type === ref.type)
      .filter((relation) => {
        const directed = topic.relationTypes.find((type) => type.id === relation.type)?.directed ?? false;
        return directed
          ? relation.source === ref.source && relation.target === ref.target
          : (relation.source === ref.source && relation.target === ref.target) ||
              (relation.source === ref.target && relation.target === ref.source);
      })
      .map((relation) => relationMerge(topic, relation)),
  );
  return candidates[0]?.key;
}

function lintCandidates(data: PipelineData): LintMessage[] {
  const messages: LintMessage[] = [];
  for (const draft of data.topics) {
    const topicId = draft.meta.id;
    const path = `topics/${topicId}/candidates.json`;
    const entries = data.candidates.get(topicId) ?? [];
    messages.push(...lintCandidatesSchema(entries, path));
    const laneIds = new Set(draft.lanes.map((lane) => lane.id));
    const topicPeople = new Set(draft.people.map((person) => person.id));
    const seen = new Set<string>();

    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
      messages.push(...lintCandidateEntry(entry, path, laneIds, topicPeople, data, seen));
    }
  }
  return messages;
}

function lintCandidateEntry(
  entry: CandidateEntry,
  path: string,
  laneIds: Set<string>,
  topicPeople: Set<string>,
  data: PipelineData,
  seen: Set<string>,
): LintMessage[] {
  const messages: LintMessage[] = [];
  const record = entry as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!CANDIDATE_KEYS.has(key)) {
      messages.push({ level: 'warning', path, message: `${entry.id || '(无 id)'} 的字段 ${key} 不在候选台账中` });
    }
  }
  if (typeof entry.id !== 'string' || !CANDIDATE_ID.test(entry.id)) {
    messages.push({ level: 'error', path, message: `候选 id 不合法：${entry.id || '(空)'}` });
    return messages;
  }
  if (seen.has(entry.id)) {
    messages.push({ level: 'error', path, message: `候选 id 重复：${entry.id}` });
  }
  seen.add(entry.id);
  if (typeof entry.name !== 'string' || !entry.name.trim()) {
    messages.push({ level: 'error', path, message: `${entry.id} 缺少 name` });
  }
  if (typeof entry.seat !== 'string' || !laneIds.has(entry.seat)) {
    messages.push({ level: 'error', path, message: `${entry.id} 的 seat 不是本专题泳道` });
  }
  if (entry.status !== 'pending' && entry.status !== 'rejected') {
    messages.push({ level: 'error', path, message: `${entry.id} 的 status 只能是 pending 或 rejected` });
    return messages;
  }
  if (entry.status === 'pending') {
    if (typeof entry.anchor !== 'string' || !entry.anchor.trim()) {
      messages.push({ level: 'error', path, message: `${entry.id} 待核但缺少 anchor` });
    }
    if (!hasReliableSource(entry.sources)) {
      messages.push({ level: 'error', path, message: `${entry.id} 待核但没有 classic 或 modern 出处` });
    }
    if (data.people.has(entry.id)) {
      messages.push({ level: 'error', path, message: `${entry.id} 已有登记，简表写入后应移出候选台账` });
    }
    if (topicPeople.has(entry.id)) {
      messages.push({ level: 'error', path, message: `${entry.id} 已收入专题，应移出候选台账` });
    }
  }
  if (entry.status === 'rejected') {
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      messages.push({ level: 'error', path, message: `${entry.id} 已标不收但缺少 reason` });
    }
    if (topicPeople.has(entry.id)) {
      messages.push({ level: 'error', path, message: `${entry.id} 已标不收，但仍在专题 people 里` });
    }
    if (data.people.has(entry.id)) {
      messages.push({ level: 'error', path, message: `${entry.id} 已登记却标为不收，应从候选台账移除或重新说明` });
    }
  }
  return messages;
}

function connectedPeople(topic: Topic): Set<string> {
  const ids = new Set<string>();
  for (const rel of topic.relations) {
    ids.add(rel.source);
    ids.add(rel.target);
  }
  return ids;
}

export function lintPipeline(data: PipelineData, compiled: Topic[], catalog?: Catalog): LintMessage[] {
  const messages: LintMessage[] = [];
  if (catalog) messages.push(...lintCatalogSchema(catalog, 'public/data/index.json'));
  for (const topic of compiled) messages.push(...lintTopicSchema(topic, `public/data/${topic.meta.id}.json`));
  const regionIds = vocabSet(data.regions);
  const eraIds = vocabSet(data.eras);
  const themeIds = vocabSet(data.themes);
  const categoryIds = vocabSet(data.categories);
  const polityIds = vocabSet(data.polities);
  const usedPeople = new Set<string>();
  const approxGaps: string[] = [];
  const polityGaps: string[] = [];

  for (const person of data.people.values()) {
    const path = data.personPaths.get(person.id) ?? `pipeline/registry/people/${person.id}.json`;
    messages.push(...lintRegistryPerson(person, categoryIds, polityIds, path));
    for (const experience of person.experiences ?? []) {
      if (!experience.event) continue;
      const event = data.events.get(experience.event);
      if (!event) {
        messages.push({
          level: 'error',
          path,
          message: `经历 ${experience.id} 引用的公共事件不存在或未发布 ${experience.event}`,
        });
        continue;
      }
      const linked = [...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)];
      if (!linked.includes(person.id)) {
        messages.push({
          level: 'error',
          path,
          message: `经历 ${experience.id} 引用的公共事件没有显式关联人物 ${person.id}`,
        });
      }
      if (
        experience.event &&
        (experience.year !== undefined || experience.endYear !== undefined || experience.place !== undefined)
      ) {
        messages.push({
          level: 'error',
          path,
          message: `经历 ${experience.id} 使用 event 时不得复制公共事件的 year/endYear/place`,
        });
      }
    }
    if (!person.profile) {
      if (person.birthAccuracy === 'approx' && person.birth !== undefined && !person.birthNote?.trim()) {
        approxGaps.push(`${person.id} 生年`);
      }
      if (person.deathAccuracy === 'approx' && person.death !== undefined && !person.deathNote?.trim()) {
        approxGaps.push(`${person.id} 卒年`);
      }
      if (!person.polity || person.polity.length === 0) polityGaps.push(person.id);
    }
  }
  if (approxGaps.length > 0) {
    messages.push({
      level: 'warning',
      path: 'registry/people',
      message: `约略年份缺少 note（${approxGaps.length} 处）：${approxGaps.join(' ')}`,
    });
  }
  if (polityGaps.length > 0) {
    messages.push({
      level: 'warning',
      path: 'registry/people',
      message: `登记缺 polity（${polityGaps.length} 人）：${polityGaps.join(' ')}`,
    });
  }

  for (const draft of data.topics) {
    const path = `topics/${draft.meta.id}`;
    if (!regionIds.has(draft.catalog.region)) {
      messages.push({ level: 'error', path, message: `region ${draft.catalog.region} 不在词表中` });
    }
    for (const era of draft.catalog.eras) {
      if (!eraIds.has(era)) {
        messages.push({ level: 'error', path, message: `era ${era} 不在词表中` });
      }
    }
    for (const theme of draft.catalog.themes) {
      if (!themeIds.has(theme)) {
        messages.push({ level: 'error', path, message: `theme ${theme} 不在词表中` });
      }
    }
    if (draft.catalog.eras.length === 0 || draft.catalog.themes.length === 0) {
      messages.push({ level: 'error', path, message: 'eras / themes 不能为空' });
    }

    const overlayIds = new Set<string>();
    for (const overlay of draft.people) {
      if (overlayIds.has(overlay.id)) {
        messages.push({ level: 'error', path, message: `人物重复收录：${overlay.id}` });
      }
      overlayIds.add(overlay.id);
      usedPeople.add(overlay.id);
      if (!data.people.has(overlay.id)) {
        messages.push({ level: 'error', path, message: `人物未登记：${overlay.id}` });
      }
    }

    for (const rel of draft.relations) {
      if (!rel.note?.trim()) {
        messages.push({
          level: 'error',
          path: `${path}/relations`,
          message: `${rel.source}→${rel.target} 缺少 note`,
        });
      }
    }

    for (const view of draft.views) {
      if (!view.brief?.trim()) {
        messages.push({ level: 'error', path: `${path}/views/${view.id}`, message: '章节缺少 brief' });
      }
      if (!view.focus) {
        messages.push({ level: 'error', path: `${path}/views/${view.id}`, message: '章节缺少 focus' });
      }
    }
  }

  messages.push(...lintCandidates(data));
  messages.push(...lintEvents(data));
  messages.push(...lintCollections(data));
  messages.push(...lintDiscovery(data));
  for (const message of mergeTopicRelations(data.topics).messages) {
    if (message.message.includes('directed')) {
      messages.push(message);
      continue;
    }
    messages.push({
      ...message,
      level: 'warning',
      message: `[RELATION_CONFLICT] ${message.message}`,
    });
  }

  for (const topic of compiled) {
    const linked = connectedPeople(topic);
    const missing = topic.people
      .filter((person) => {
        const registry = data.people.get(person.id);
        return registry !== undefined && profileOf(registry) === 'full' && !linked.has(person.id);
      })
      .map((person) => person.id);
    if (missing.length > 0) {
      messages.push({
        level: 'warning',
        path: `topics/${topic.meta.id}`,
        message: `详表尚未写关系 ${missing.length} 人：${missing.join(' ')}`,
      });
    }
  }

  for (const id of data.people.keys()) {
    if (!usedPeople.has(id)) {
      messages.push({
        level: 'warning',
        path: data.personPaths.get(id) ?? `pipeline/registry/people/${id}.json`,
        message: '已登记但未被任何专题收录',
      });
    }
  }

  return messages;
}
