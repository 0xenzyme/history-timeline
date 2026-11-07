import {
  validateCatalog,
  validateCollectionDetail,
  validateCollectionIndex,
  validateEventDetail,
  validateEventLine,
  validateEraDetail,
  validateEraIndex,
  validatePersonDetail,
  validateTopic,
} from './contract';
import type {
  Catalog,
  CatalogEntry,
  CenturySegment,
  CollectionDetail,
  CollectionSummary,
  EventDetail,
  EraDetail,
  EraSummary,
  EventLineView,
  EventRecord,
  PersonDetail,
  SearchRecord,
  Topic,
} from './types';

export { validateEventLine } from './contract';

const EVENT_TYPES = new Set(['military', 'political', 'rebellion', 'institutional', 'diplomatic', 'cultural']);
const EVENT_ACCURACIES = new Set(['exact', 'approx', 'disputed', 'unknown']);

export async function loadCatalog(url: string): Promise<Catalog> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载专题目录失败：${res.status} ${res.statusText} — ${url}`);
  }
  const catalog = (await res.json()) as Catalog;
  const problems = validateCatalog(catalog);
  if (problems.length > 0) {
    console.error('[目录校验]', problems);
    throw new Error(`专题目录校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return catalog;
}

export function findCatalogEntry(catalog: Catalog, id: string): CatalogEntry {
  return catalog.topics.find((item) => item.id === id) ?? catalog.topics[0];
}

export async function loadTopic(url: string, expectedId?: string): Promise<Topic> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载专题数据失败：${res.status} ${res.statusText} — ${url}`);
  }
  const topic = (await res.json()) as Topic;
  const problems = validateTopic(topic, expectedId);
  if (problems.length > 0) {
    console.error('[数据校验]', problems);
    throw new Error(`数据校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return topic;
}

function eventIsUsable(event: EventRecord): boolean {
  return Boolean(
    event &&
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    typeof event.name === 'string' &&
    typeof event.display === 'string' &&
    (event.kind === 'point' || event.kind === 'span') &&
    Number.isFinite(event.year) &&
    event.year !== 0 &&
    EVENT_TYPES.has(event.type) &&
    EVENT_ACCURACIES.has(event.yearAccuracy) &&
    Number.isInteger(event.importance) &&
    event.importance >= 1 &&
    event.importance <= 3 &&
    (event.endYear === undefined || event.endYear >= event.year) &&
    (event.endYear === undefined || event.endYear !== 0) &&
    Array.isArray(event.sources),
  );
}

/** 事件线的运行时契约检查。返回问题而不是抛异常，调用方可以安全降级。 */
function normalizeEventLine(line: EventLineView, expectedId?: string): EventLineView {
  const source = line ?? ({} as EventLineView);
  const events = (Array.isArray(source.events) ? source.events : []).filter(eventIsUsable);
  const ids = new Set(events.map((event) => event.id));
  const segments = (Array.isArray(source.segments) ? source.segments : [])
    .filter((segment): segment is CenturySegment => Boolean(segment && typeof segment === 'object'))
    .map((segment) => ({
      ...segment,
      events: Array.isArray(segment.events) ? segment.events.filter((id) => ids.has(id)) : [],
    }))
    .filter(
      (segment) =>
        segment.id &&
        typeof segment.label === 'string' &&
        Array.isArray(segment.events) &&
        Number.isFinite(segment.from) &&
        Number.isFinite(segment.to) &&
        segment.from < segment.to,
    );
  const fallbackRange: [number, number] =
    Array.isArray(source.range) &&
    source.range.length === 2 &&
    source.range.every((year) => Number.isFinite(year)) &&
    source.range[0] < source.range[1]
      ? source.range
      : [-2070, 1949];
  const safeSegments: CenturySegment[] =
    segments.length > 0
      ? segments
      : [
          {
            id: 'seg-empty',
            label: '暂无事件',
            from: fallbackRange[0],
            to: fallbackRange[1],
            events: [],
          },
        ];
  return {
    ...source,
    id: expectedId === 'military' || expectedId === 'history' ? expectedId : source.id,
    range: fallbackRange,
    events,
    segments: safeSegments,
    dynasties: Array.isArray(source.dynasties) ? source.dynasties : [],
  };
}

/** 军事 / 历史事件线：校验后过滤坏记录，保留可用数据，避免单条坏事件阻塞整条时间线。 */
export async function loadLine(url: string, expectedId?: string): Promise<EventLineView> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载事件线失败：${res.status} ${res.statusText} — ${url}`);
  }
  const line = (await res.json()) as EventLineView;
  const problems = validateEventLine(line, expectedId);
  if (problems.length > 0) console.warn('[事件线校验，已安全降级]', problems);
  return normalizeEventLine(line, expectedId);
}

export async function loadSearchIndex(url: string): Promise<SearchRecord[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载人物索引失败：${res.status} ${res.statusText} — ${url}`);
  }
  return (await res.json()) as SearchRecord[];
}

async function loadDetail<T>(url: string, label: string, validate: (value: T) => string[]): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载${label}失败：${res.status} ${res.statusText} — ${url}`);
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('text/html')) {
    throw new Error(`加载${label}失败：404 Not Found — ${url}`);
  }
  const value = (await res.json()) as T;
  const problems = validate(value);
  if (problems.length > 0) throw new Error(`${label}校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  return value;
}

export async function loadPersonDetail(url: string, expectedId: string): Promise<PersonDetail> {
  return loadDetail(url, '人物详情', (value) => validatePersonDetail(value, expectedId));
}

export async function loadEventDetail(url: string, expectedId: string): Promise<EventDetail> {
  return loadDetail(url, '事件详情', (value) => validateEventDetail(value, expectedId));
}

export async function loadCollectionIndex(url: string): Promise<CollectionSummary[]> {
  return loadDetail(url, '群像索引', validateCollectionIndex);
}

export async function loadCollectionDetail(url: string, expectedId: string): Promise<CollectionDetail> {
  return loadDetail(url, '群像详情', (value) => validateCollectionDetail(value, expectedId));
}

export async function loadEraIndex(url: string): Promise<EraSummary[]> {
  return loadDetail(url, '断代索引', validateEraIndex);
}

export async function loadEraDetail(url: string, expectedId: string): Promise<EraDetail> {
  return loadDetail(url, '断代详情', (value) => validateEraDetail(value, expectedId));
}
