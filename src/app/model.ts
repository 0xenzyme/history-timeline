import { loadCatalog, loadLine, loadSearchIndex, loadTopic } from '../loader';
import type { Catalog, CatalogEntry, DynastyTerm, EventRecord, SearchRecord, Topic } from '../types';

export type LineId = 'people' | 'military' | 'history';
export type TimeLineId = 'military' | 'history';

const DATA = './data';

function dataUrl(file: string): string {
  return `${DATA}/${file}`;
}

/**
 * 运行时实体库。
 * 事件实体来自军事 / 历史两条目录的并集：两条目录合起来覆盖全部事件，且各自带朝代词表和世纪分段。
 */
export interface Library {
  catalog: Catalog;
  topics: CatalogEntry[];
  lines: Record<TimeLineId, EventLineViewLike>;
  events: EventRecord[];
  eventById: Map<string, EventRecord>;
  eventsByPerson: Map<string, EventRecord[]>;
  dynasties: DynastyTerm[];
  categoryNames: Map<string, string>;
  polityNames: Map<string, string>;
  /** 跨专题人物瘦索引。人物卡、事件卡与检索用它把 id 换成姓名。 */
  people: SearchRecord[];
  personById: Map<string, SearchRecord>;
  topicCache: Map<string, Topic>;
}

interface EventLineViewLike {
  id: TimeLineId;
  title: string;
  subtitle?: string;
  range: [number, number];
  events: EventRecord[];
  dynasties: DynastyTerm[];
}

export async function createLibrary(): Promise<Library> {
  const [catalog, military, history, people] = await Promise.all([
    loadCatalog(dataUrl('index.json')),
    loadLine(dataUrl('military.json'), 'military'),
    loadLine(dataUrl('history.json'), 'history'),
    loadSearchIndex(dataUrl('people.json')),
  ]);

  const personById = new Map<string, SearchRecord>();
  for (const record of people) {
    if (record.kind === 'event') continue;
    if (!personById.has(record.id)) personById.set(record.id, record);
  }

  const events: EventRecord[] = [];
  const eventById = new Map<string, EventRecord>();
  for (const event of [...history.events, ...military.events]) {
    if (eventById.has(event.id)) continue;
    const copy: EventRecord = { ...event };
    eventById.set(event.id, copy);
    events.push(copy);
  }
  events.sort((a, b) => a.year - b.year || b.importance - a.importance);

  const eventsByPerson = new Map<string, EventRecord[]>();
  for (const event of events) {
    for (const personId of event.people ?? []) {
      const list = eventsByPerson.get(personId);
      if (list) list.push(event);
      else eventsByPerson.set(personId, [event]);
    }
  }
  for (const list of eventsByPerson.values()) list.sort((a, b) => a.year - b.year);

  return {
    catalog,
    topics: catalog.topics,
    lines: {
      military: {
        id: 'military',
        title: military.title,
        subtitle: military.subtitle,
        range: military.range,
        events: military.events,
        dynasties: military.dynasties,
      },
      history: {
        id: 'history',
        title: history.title,
        subtitle: history.subtitle,
        range: history.range,
        events: history.events,
        dynasties: history.dynasties,
      },
    },
    events,
    eventById,
    eventsByPerson,
    dynasties: history.dynasties.length > 0 ? history.dynasties : military.dynasties,
    categoryNames: new Map(catalog.categories.map((term) => [term.id, term.name])),
    polityNames: new Map((catalog.polities ?? []).map((term) => [term.id, term.name])),
    people,
    personById,
    topicCache: new Map(),
  };
}

export async function loadTopicData(library: Library, topicId: string): Promise<Topic | null> {
  const cached = library.topicCache.get(topicId);
  if (cached) return cached;
  const entry = library.topics.find((topic) => topic.id === topicId);
  if (!entry) return null;
  const topic = await loadTopic(dataUrl(entry.file), topicId);
  library.topicCache.set(topicId, topic);
  return topic;
}

export function findTopicEntry(library: Library, topicId: string): CatalogEntry | null {
  return library.topics.find((topic) => topic.id === topicId) ?? null;
}

/** 朝代区间 → 专题：取与该朝代重叠最多的专题。用于底部朝代带跳转。 */
export function topicForDynasty(library: Library, dynastyId: string): CatalogEntry | null {
  const dynasty = library.dynasties.find((item) => item.id === dynastyId);
  if (!dynasty) return null;
  let best: CatalogEntry | null = null;
  let bestOverlap = 0;
  let nearest: CatalogEntry | null = null;
  let nearestGap = Infinity;
  for (const entry of library.topics) {
    const range = topicRange(library, entry);
    if (!range) continue;
    const overlap = Math.min(range[1], dynasty.to) - Math.max(range[0], dynasty.from);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = entry;
    }
    const gap = Math.max(range[0] - dynasty.to, dynasty.from - range[1], 0);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = entry;
    }
  }
  return best ?? nearest;
}

/** 专题年份区间。目录里没有区间，用已加载专题的 meta，缺失时按朝代词表估算。 */
const rangeCache = new Map<string, [number, number] | null>();

/** 专题 eras 用的是 17 个时代 id，朝代词表用的是 26 个朝代 id，少数节点要换名。 */
const ERA_ALIASES: Record<string, string[]> = {
  jin: ['western-jin', 'eastern-jin'],
  'sixteen-kingdoms': ['shiliuguo'],
};

function topicRange(library: Library, entry: CatalogEntry): [number, number] | null {
  const cached = rangeCache.get(entry.id);
  if (cached !== undefined) return cached;
  const loaded = library.topicCache.get(entry.id);
  if (loaded) {
    rangeCache.set(entry.id, loaded.meta.range);
    return loaded.meta.range;
  }
  const eraIds = entry.eras.flatMap((eraId) => ERA_ALIASES[eraId] ?? [eraId]);
  const eras = eraIds
    .map((eraId) => library.dynasties.find((item) => item.id === eraId))
    .filter((item): item is DynastyTerm => Boolean(item));
  const range: [number, number] | null =
    eras.length > 0 ? [Math.min(...eras.map((item) => item.from)), Math.max(...eras.map((item) => item.to))] : null;
  rangeCache.set(entry.id, range);
  return range;
}
