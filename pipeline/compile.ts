import {
  CONTRACT_VERSION,
  type Catalog,
  type CatalogLine,
  type DynastyTerm,
  type EventLineView,
  type EventRecord,
  type Person,
  type SearchRecord,
  type Topic,
} from '../src/types';
import { validateCatalog, validateEventLine, validateTopic } from '../src/contract';
import { buildSegments } from './segments';
import type { PersonOverlay, PipelineData, RegistryEvent, RegistryPerson } from './types';

/** 两条时间线的收录范围。含夏，止于民国结束。起点跟 vocab/dynasties.json 的 xia 对齐。 */
export const EVENT_RANGE: [number, number] = [-2070, 1949];

const LINES: CatalogLine[] = [
  { id: 'people', title: '人物', subtitle: '按朝代专题编排', axis: 'topic' },
  {
    id: 'military',
    title: '军事',
    subtitle: '战争 · 战役 · 会战',
    axis: 'time',
    file: 'military.json',
    range: EVENT_RANGE,
  },
  {
    id: 'history',
    title: '历史事件',
    subtitle: '政变 · 变法 · 盟约 · 文化',
    axis: 'time',
    file: 'history.json',
    range: EVENT_RANGE,
  },
];

function lineTitle(id: 'military' | 'history'): string {
  return id === 'military' ? '军事' : '历史事件';
}

/**
 * 目录是实体的过滤视图。显式 catalogs 是目录成员资格的唯一来源；
 * importance 只影响绘制与排序。缺省 catalogs 时保留旧规则，便于存量记录兼容。
 */
export function inLine(event: EventRecord, line: 'military' | 'history'): boolean {
  if (event.catalogs && event.catalogs.length > 0) return event.catalogs.includes(line);
  if (line === 'military') return event.type === 'military';
  return event.type !== 'military' || event.importance >= 2;
}

/** 父事件是子事件的结构上下文；即使父事件本身不满足目录筛选，也必须随子事件进入该目录。 */
function eventsForLine(events: EventRecord[], line: 'military' | 'history'): EventRecord[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const selected = new Map(events.filter((event) => inLine(event, line)).map((event) => [event.id, event]));
  for (const event of [...selected.values()]) {
    let parent = event.parent ? byId.get(event.parent) : undefined;
    while (parent && !selected.has(parent.id)) {
      selected.set(parent.id, parent);
      parent = parent.parent ? byId.get(parent.parent) : undefined;
    }
  }
  return events.filter((event) => selected.has(event.id));
}

/** 事件的年份区间与朝代区间有交集即命中。只是筛选标签，不是归属判定。 */
export function dynastyHits(dynasties: DynastyTerm[], year: number, endYear?: number): string[] {
  const to = endYear ?? year;
  return dynasties.filter((item) => item.from <= to && item.to >= year).map((item) => item.id);
}

/** 未显式指定 primary 时，按词表 rank 取最高的分类作为主分类 */
export function primaryOf(categories: string[], ranks: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestRank = Number.NEGATIVE_INFINITY;
  for (const id of categories) {
    const rank = ranks.get(id) ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = id;
    }
  }
  return best;
}

function mergePerson(registry: RegistryPerson, overlay: PersonOverlay, ranks: Map<string, number>): Person {
  const person: Person = {
    id: registry.id,
    name: registry.name,
    display: overlay.display ?? registry.display,
    lane: overlay.lane,
    birthAccuracy: registry.birthAccuracy,
    deathAccuracy: registry.deathAccuracy,
  };
  if (registry.birth !== undefined) person.birth = registry.birth;
  if (registry.death !== undefined) person.death = registry.death;
  if (registry.birthNote) person.birthNote = registry.birthNote;
  if (registry.deathNote) person.deathNote = registry.deathNote;
  const title = overlay.title ?? registry.title;
  if (title) person.title = title;
  const bio = overlay.bio ?? registry.bio;
  if (bio) person.bio = bio;
  const tags = overlay.tags ?? registry.tags;
  if (tags && tags.length > 0) person.tags = tags;
  if (registry.categories && registry.categories.length > 0) person.categories = registry.categories;
  if (registry.primary) person.primary = registry.primary;
  else if (registry.categories && registry.categories.length > 0) {
    person.primary = primaryOf(registry.categories, ranks);
  }
  if (registry.polity && registry.polity.length > 0) person.polity = registry.polity;
  if (registry.gender) person.gender = registry.gender;
  if (overlay.order !== undefined) person.order = overlay.order;
  return person;
}

export function compileTopic(data: PipelineData, topicId: string): Topic {
  const draft = data.topics.find((item) => item.meta.id === topicId);
  if (!draft) throw new Error(`找不到专题 ${topicId}`);

  const ranks = new Map(data.categories.map((item) => [item.id, item.rank]));
  const people = draft.people.map((overlay) => {
    const registry = data.people.get(overlay.id);
    if (!registry) throw new Error(`专题 ${topicId} 引用了未登记人物 ${overlay.id}`);
    return mergePerson(registry, overlay, ranks);
  });

  return {
    contractVersion: CONTRACT_VERSION,
    meta: draft.meta,
    lanes: draft.lanes,
    people,
    relationTypes: draft.relationTypes,
    relations: draft.relations,
    events: draft.events,
    views: draft.views,
  };
}

export function compileCatalog(data: PipelineData): Catalog {
  return {
    contractVersion: CONTRACT_VERSION,
    regions: data.regions,
    eras: data.eras,
    themes: data.themes,
    categories: data.categories,
    polities: data.polities,
    topics: data.topics.map((draft) => ({
      id: draft.meta.id,
      title: draft.meta.title,
      subtitle: draft.catalog.subtitle ?? draft.meta.subtitle,
      file: `${draft.meta.id}.json`,
      region: draft.catalog.region,
      eras: draft.catalog.eras,
      themes: draft.catalog.themes,
    })),
    lines: LINES,
  };
}

/** 事件实体编译。kind 由 endYear 推导，display 回退 name。 */
export function compileEvent(registry: RegistryEvent, dynasties: DynastyTerm[]): EventRecord {
  return {
    id: registry.id,
    name: registry.name,
    display: registry.display ?? registry.name,
    kind: registry.endYear === undefined ? 'point' : 'span',
    type: registry.type,
    catalogs: registry.catalogs,
    scale: registry.scale,
    importance: registry.importance,
    year: registry.year,
    yearAccuracy: registry.yearAccuracy,
    yearNote: registry.yearNote,
    endYear: registry.endYear,
    endYearAccuracy: registry.endYearAccuracy,
    endYearNote: registry.endYearNote,
    place: registry.place,
    placeNow: registry.placeNow,
    belligerents: registry.belligerents,
    polity: registry.polity,
    commanders: registry.commanders,
    people: registry.people,
    result: registry.result,
    parent: registry.parent,
    aliases: registry.aliases,
    tags: registry.tags,
    dynasties: dynastyHits(dynasties, registry.year, registry.endYear),
    desc: registry.desc,
    sources: registry.sources,
  };
}

/** 全量实体，按 id 排序，保证产物确定。 */
export function compileEvents(data: PipelineData): EventRecord[] {
  return [...data.events.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((registry) => compileEvent(registry, data.dynasties));
}

export function compileLine(data: PipelineData, line: 'military' | 'history'): EventLineView {
  const meta = LINES.find((item) => item.id === line);
  if (!meta) throw new Error(`没有这条内容线：${line}`);
  const events = eventsForLine(compileEvents(data), line);
  return {
    contractVersion: CONTRACT_VERSION,
    id: line,
    title: meta.title,
    subtitle: meta.subtitle,
    range: EVENT_RANGE,
    segments: buildSegments(events, EVENT_RANGE),
    dynasties: data.dynasties,
    events,
  };
}

/** 人物瘦索引：卡片与搜索共用字段，但不含事件行，供首屏加载。 */
export function compilePeopleIndex(topics: Topic[]): SearchRecord[] {
  return compileSearch(topics, []).filter((row) => row.kind !== 'event');
}

export function compileSearch(topics: Topic[], events: EventRecord[]): SearchRecord[] {
  const rows: SearchRecord[] = [];
  for (const topic of topics) {
    for (const person of topic.people) {
      const row: SearchRecord = {
        id: person.id,
        name: person.name,
        display: person.display,
        birthAccuracy: person.birthAccuracy,
        deathAccuracy: person.deathAccuracy,
        topicId: topic.meta.id,
        topicTitle: topic.meta.title,
      };
      if (person.title) row.title = person.title;
      if (person.tags && person.tags.length > 0) row.tags = person.tags;
      if (person.categories && person.categories.length > 0) row.categories = person.categories;
      if (person.primary) row.primary = person.primary;
      if (person.polity && person.polity.length > 0) row.polity = person.polity;
      if (person.gender) row.gender = person.gender;
      if (person.birth !== undefined) row.birth = person.birth;
      if (person.death !== undefined) row.death = person.death;
      rows.push(row);
    }
  }
  // 搜索索引与两条目录使用同一套父事件闭包。一个事件可能同时出现在
  // military 与 history（例如高重要度军事事件），因此保留两条可跳转记录。
  for (const line of ['military', 'history'] as const) {
    for (const event of eventsForLine(events, line)) {
      const row: SearchRecord = {
        id: event.id,
        name: event.name,
        display: event.display,
        kind: 'event',
        year: event.year,
        yearAccuracy: event.yearAccuracy,
        type: event.type,
        catalogs: event.catalogs,
        importance: event.importance,
        topicId: line,
        topicTitle: lineTitle(line),
      };
      if (event.endYear !== undefined) row.endYear = event.endYear;
      rows.push(row);
    }
  }
  return rows;
}

export function compileAll(data: PipelineData): {
  catalog: Catalog;
  topics: Topic[];
  events: EventRecord[];
  lines: EventLineView[];
} {
  const catalog = compileCatalog(data);
  const topics = data.topics.map((draft) => compileTopic(data, draft.meta.id));
  const events = compileEvents(data);
  const lines = [compileLine(data, 'military'), compileLine(data, 'history')];
  const problems = [
    ...validateCatalog(catalog).map((item) => `目录：${item}`),
    ...topics.flatMap((topic) => validateTopic(topic, topic.meta.id).map((item) => `${topic.meta.id}：${item}`)),
    // 事件线产物是前端直接读取的独立 JSON，不能只靠运行时 loader 把关。
    ...lines.flatMap((line) => validateEventLine(line, line.id).map((item) => `${line.id}：${item}`)),
  ];
  if (problems.length > 0) {
    throw new Error(`编译校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return { catalog, topics, events, lines };
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
