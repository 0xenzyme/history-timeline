import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Topic } from '../src/types';
import type {
  CandidateEntry,
  DynastyTerm,
  LintMessage,
  PipelineData,
  RegistryEvent,
  RegistryPerson,
  SourceRef,
} from './types';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));

/** person.schema.json 里用到的 JSON Schema 子集：type / enum / items / required / properties */
interface SchemaProp {
  type?: string;
  enum?: string[];
  items?: SchemaProp;
  required?: string[];
  properties?: Record<string, SchemaProp>;
}

const personSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'person.schema.json'), 'utf8'),
) as SchemaProp;

const eventSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'event.schema.json'), 'utf8'),
) as SchemaProp;

function typeMismatch(value: unknown, rule: SchemaProp | undefined): boolean {
  switch (rule?.type) {
    case 'integer':
      return typeof value !== 'number' || !Number.isInteger(value);
    case 'string':
      return typeof value !== 'string';
    case 'array':
      return !Array.isArray(value);
    case 'object':
      return typeof value !== 'object' || value === null || Array.isArray(value);
    default:
      return false;
  }
}

function enumViolation(value: unknown, rule: SchemaProp | undefined): boolean {
  return Boolean(rule?.enum) && !rule!.enum!.includes(value as string);
}

/** 按 schema 的字段表逐项校验。未知字段先只告警：历史登记尚未按 schema 审计过。 */
function lintSchemaProps(
  record: Record<string, unknown>,
  schema: SchemaProp,
  schemaName: string,
  path: string,
): LintMessage[] {
  const messages: LintMessage[] = [];
  const props = schema.properties ?? {};

  for (const [key, value] of Object.entries(record)) {
    const rule = props[key];
    if (!rule) {
      messages.push({ level: 'warning', path, message: `字段 ${key} 不在 ${schemaName} 中` });
      continue;
    }
    if (value === undefined) continue;
    if (typeMismatch(value, rule)) {
      messages.push({ level: 'error', path, message: `字段 ${key} 类型应为 ${rule.type}` });
      continue;
    }
    if (enumViolation(value, rule)) {
      messages.push({ level: 'error', path, message: `字段 ${key} 取值 ${String(value)} 不合法` });
    }
    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (typeMismatch(item, rule.items)) {
        messages.push({ level: 'error', path, message: `字段 ${key} 的元素类型应为 ${rule.items?.type}` });
      }
      if (rule.items?.type !== 'object') continue;

      const object = item as Record<string, unknown>;
      for (const required of rule.items.required ?? []) {
        if (object[required] === undefined) {
          messages.push({ level: 'error', path, message: `字段 ${key} 的元素缺少 ${required}` });
        }
      }
      for (const [subKey, subValue] of Object.entries(object)) {
        const subRule = rule.items.properties?.[subKey];
        if (!subRule) {
          messages.push({ level: 'warning', path, message: `字段 ${key} 的 ${subKey} 不在 ${schemaName} 中` });
        } else if (enumViolation(subValue, subRule)) {
          messages.push({ level: 'error', path, message: `字段 ${key} 的 ${subKey} 取值 ${String(subValue)} 不合法` });
        }
      }
    }
  }

  return messages;
}

function lintSchemaRequired(
  record: Record<string, unknown>,
  schema: SchemaProp,
  path: string,
): LintMessage[] {
  const messages: LintMessage[] = [];
  for (const key of schema.required ?? []) {
    if (record[key] === undefined) {
      messages.push({ level: 'error', path, message: `缺少必填字段 ${key}` });
    }
  }
  return messages;
}

function lintPersonSchema(person: RegistryPerson, path: string): LintMessage[] {
  const record = person as unknown as Record<string, unknown>;
  return [
    ...lintSchemaRequired(record, personSchema, path),
    ...lintSchemaProps(record, personSchema, 'person.schema.json', path),
  ];
}

function lintEventSchema(event: RegistryEvent, path: string): LintMessage[] {
  const record = event as unknown as Record<string, unknown>;
  return [
    ...lintSchemaRequired(record, eventSchema, path),
    ...lintSchemaProps(record, eventSchema, 'event.schema.json', path),
  ];
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

function sourceKind(source: SourceRef): 'classic' | 'modern' | 'database' {
  return source.kind ?? 'classic';
}

function hasReliableSource(sources: SourceRef[] | undefined): boolean {
  return Boolean(sources?.some((source) => source.work.trim() && sourceKind(source) !== 'database'));
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
  for (const category of person.categories ?? []) {
    if (!categoryIds.has(category)) {
      messages.push({ level: 'error', path, message: `category ${category} 不在词表中` });
    }
  }
  if (person.primary && person.categories && !person.categories.includes(person.primary)) {
    messages.push({ level: 'error', path, message: `primary ${person.primary} 不在 categories 中` });
  }
  for (const polity of person.polity ?? []) {
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
  return messages;
}

/** 事件线的收录范围。含夏商，止于民国结束。 */
export const EVENT_YEAR_MIN = -1600;
export const EVENT_YEAR_MAX = 1949;

export interface EventLintContext {
  polityIds: Set<string>;
  people: Set<string>;
  events: Map<string, RegistryEvent>;
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
    if (event.scale === 'war' && event.place) {
      messages.push({ level: 'error', path, message: 'war 是跨地域战争，不应写 place' });
    }
    if (event.scale && event.scale !== 'war' && !event.place?.trim()) {
      messages.push({ level: 'error', path, message: `${event.scale} 缺少 place` });
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
  if (event.yearAccuracy === 'disputed' && !event.yearNote?.trim()) {
    messages.push({ level: 'error', path, message: '年份有异说必须写 yearNote' });
  }
  if (event.yearAccuracy === 'approx' && !event.yearNote?.trim()) {
    messages.push({ level: 'error', path, message: '年份约略必须写 yearNote' });
  }
  if (event.endYear !== undefined && event.endYear < event.year) {
    messages.push({ level: 'error', path, message: 'endYear 早于 year' });
  }
  if (event.year < EVENT_YEAR_MIN || event.year > EVENT_YEAR_MAX) {
    messages.push({ level: 'error', path, message: `year ${event.year} 超出收录范围 ${EVENT_YEAR_MIN}—${EVENT_YEAR_MAX}` });
  }
  if (event.endYear !== undefined && (event.endYear < EVENT_YEAR_MIN || event.endYear > EVENT_YEAR_MAX)) {
    messages.push({ level: 'error', path, message: `endYear ${event.endYear} 超出收录范围 ${EVENT_YEAR_MIN}—${EVENT_YEAR_MAX}` });
  }
  if (!hasReliableSource(event.sources)) {
    messages.push({ level: 'error', path, message: '年份不能只靠 database 出处支撑，需要 classic 或 modern' });
  }

  for (const polity of [...(event.belligerents ?? []), ...(event.polity ?? [])]) {
    if (!ctx.polityIds.has(polity)) {
      messages.push({ level: 'error', path, message: `政权 ${polity} 不在词表中` });
    }
  }
  const sides = new Set(event.belligerents ?? []);
  for (const commander of event.commanders ?? []) {
    if (commander.side && !sides.has(commander.side)) {
      messages.push({ level: 'error', path, message: `主将 ${commander.id} 的 side ${commander.side} 不在 belligerents 中` });
    }
  }
  for (const id of [...(event.commanders ?? []).map((item) => item.id), ...(event.people ?? [])]) {
    if (!ctx.people.has(id)) {
      messages.push({ level: 'error', path, message: `引用的人物不存在：${id}` });
    }
  }

  if (event.parent !== undefined) {
    if (event.parent === event.id) {
      messages.push({ level: 'error', path, message: 'parent 不能指向自己' });
    } else {
      const parent = ctx.events.get(event.parent);
      if (!parent) {
        messages.push({ level: 'error', path, message: `parent ${event.parent} 不存在` });
      } else if (parent.parent) {
        messages.push({ level: 'error', path, message: `parent ${event.parent} 自身还有 parent，只允许两层` });
      }
    }
  }

  if (event.importance === 3 && !event.desc?.trim()) {
    messages.push({ level: 'warning', path, message: 'importance 为 3 但还没写正文' });
  }
  if (event.name.length > 8 && !event.display) {
    messages.push({ level: 'warning', path, message: '名称较长但没有 display，轴上标签会挤' });
  }
  if (military && !event.result?.trim()) {
    messages.push({ level: 'warning', path, message: '军事事件缺少 result' });
  }
  if (!military && (event.sources?.length ?? 0) < 2) {
    messages.push({ level: 'warning', path, message: '非军事事件建议两条出处' });
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
    events: data.events,
  };
  const messages: LintMessage[] = [];
  for (const event of data.events.values()) {
    const path = data.eventPaths.get(event.id) ?? `content/events/${event.id}.md`;
    messages.push(...lintRegistryEvent(event, ctx, path));
  }
  messages.push(...lintDynasties(data.dynasties));
  return messages;
}

function lintCandidates(data: PipelineData): LintMessage[] {
  const messages: LintMessage[] = [];
  for (const draft of data.topics) {
    const topicId = draft.meta.id;
    const path = `topics/${topicId}/candidates.json`;
    const entries = data.candidates.get(topicId) ?? [];
    const laneIds = new Set(draft.lanes.map((lane) => lane.id));
    const topicPeople = new Set(draft.people.map((person) => person.id));
    const seen = new Set<string>();

    for (const entry of entries) {
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
  if (!entry.id || !CANDIDATE_ID.test(entry.id)) {
    messages.push({ level: 'error', path, message: `候选 id 不合法：${entry.id || '(空)'}` });
    return messages;
  }
  if (seen.has(entry.id)) {
    messages.push({ level: 'error', path, message: `候选 id 重复：${entry.id}` });
  }
  seen.add(entry.id);
  if (!entry.name?.trim()) {
    messages.push({ level: 'error', path, message: `${entry.id} 缺少 name` });
  }
  if (!entry.seat || !laneIds.has(entry.seat)) {
    messages.push({ level: 'error', path, message: `${entry.id} 的 seat 不是本专题泳道` });
  }
  if (entry.status !== 'pending' && entry.status !== 'rejected') {
    messages.push({ level: 'error', path, message: `${entry.id} 的 status 只能是 pending 或 rejected` });
    return messages;
  }
  if (entry.status === 'pending') {
    if (!entry.anchor?.trim()) {
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
    if (!entry.reason?.trim()) {
      messages.push({ level: 'error', path, message: `${entry.id} 已标不收但缺少 reason` });
    }
    if (topicPeople.has(entry.id)) {
      messages.push({ level: 'error', path, message: `${entry.id} 已标不收，但仍在专题 people 里` });
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

export function lintPipeline(data: PipelineData, compiled: Topic[]): LintMessage[] {
  const messages: LintMessage[] = [];
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
