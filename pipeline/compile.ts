import {
  CONTRACT_VERSION,
  type Catalog,
  type CatalogLine,
  type DynastyTerm,
  type EraDetail,
  type EraSummary,
  type EventLineView,
  type EventRecord,
  type EventDetail,
  type Person,
  type PersonDetail,
  type RegistryCollection,
  type CollectionDetail,
  type CollectionSummary,
  type SearchRecord,
  type Topic,
} from '../src/types';
import { validateCatalog, validateEventLine, validateTopic } from '../src/contract';
import { buildSegments } from './segments';
import type { PersonOverlay, PipelineData, RegistryEvent, RegistryPerson } from './types';
import { profileOf, mergeTopicRelations, resolveCollectionRelationKey } from './lint';

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
    collectionCategories: data.collectionCategories,
    editorial: data.homeEditorial,
  };
}

const DYNASTY_GROUPS: Record<string, EraSummary['group']> = {
  xia: 'pre-qin',
  shang: 'pre-qin',
  'western-zhou': 'pre-qin',
  'spring-autumn': 'pre-qin',
  'warring-states': 'pre-qin',
  qin: 'qin-han',
  'western-han': 'qin-han',
  xin: 'qin-han',
  'eastern-han': 'qin-han',
  'three-kingdoms': 'weijin-nanbei',
  'western-jin': 'weijin-nanbei',
  'eastern-jin': 'weijin-nanbei',
  shiliuguo: 'weijin-nanbei',
  'northern-southern': 'weijin-nanbei',
  sui: 'sui-tang-wudai',
  tang: 'sui-tang-wudai',
  wudai: 'sui-tang-wudai',
  liao: 'song-liao-jin-yuan',
  song: 'song-liao-jin-yuan',
  xixia: 'song-liao-jin-yuan',
  'jin-chao': 'song-liao-jin-yuan',
  mongol: 'song-liao-jin-yuan',
  yuan: 'song-liao-jin-yuan',
  ming: 'ming-qing',
  qing: 'ming-qing',
  minguo: 'minguo',
};

function dynastyTopics(data: PipelineData, dynastyId: string): string[] {
  const profileTopics = data.dynastyProfiles.get(dynastyId)?.topics ?? [];
  return data.topics
    .filter((topic) => profileTopics.includes(topic.meta.id) || topic.catalog.eras.includes(dynastyId))
    .map((topic) => topic.meta.id);
}

function eraPeople(data: PipelineData, topics: Topic[], dynastyId: string): Person[] {
  const topicIds = new Set(dynastyTopics(data, dynastyId));
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const topic of topics) {
    if (!topicIds.has(topic.meta.id)) continue;
    for (const person of topic.people) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      people.push(personCard(data.people.get(person.id)!));
    }
  }
  return people;
}

export function compileEraSummaries(data: PipelineData, topics: Topic[], events: EventRecord[]): EraSummary[] {
  return data.dynasties.map((dynasty) => {
    const profile = data.dynastyProfiles.get(dynasty.id);
    return {
      ...dynasty,
      contractVersion: CONTRACT_VERSION,
      aliases: profile?.aliases,
      summary: profile?.summary,
      group: profile?.group ?? DYNASTY_GROUPS[dynasty.id] ?? 'ming-qing',
      personCount: eraPeople(data, topics, dynasty.id).length,
      eventCount: events.filter((event) => event.dynasties?.includes(dynasty.id)).length,
    };
  });
}

export function compileEraDetails(data: PipelineData, topics: Topic[], events: EventRecord[]): EraDetail[] {
  const summaries = new Map(compileEraSummaries(data, topics, events).map((summary) => [summary.id, summary]));
  const collectionSummaries = compileCollectionSummaries(data);
  return data.dynasties.map((dynasty) => {
    const profile = data.dynastyProfiles.get(dynasty.id);
    const allPeople = eraPeople(data, topics, dynasty.id);
    const peopleById = new Map(allPeople.map((person) => [person.id, person]));
    const matchingEvents = events.filter((event) => event.dynasties?.includes(dynasty.id));
    const eventsById = new Map(matchingEvents.map((event) => [event.id, event]));
    const people = (
      profile?.featuredPeople?.length
        ? profile.featuredPeople.flatMap((id) => {
            const person = peopleById.get(id);
            return person ? [person] : [];
          })
        : allPeople.slice(0, 6)
    ).slice(0, 6);
    const eraEvents = (
      profile?.featuredEvents?.length
        ? profile.featuredEvents.flatMap((id) => {
            const event = eventsById.get(id);
            return event ? [event] : [];
          })
        : matchingEvents
            .slice()
            .sort(
              (left, right) =>
                right.importance - left.importance || left.year - right.year || left.id.localeCompare(right.id),
            )
            .slice(0, 6)
    ).sort(
      (left, right) => left.year - right.year || right.importance - left.importance || left.id.localeCompare(right.id),
    );
    const collectionIds = [
      ...new Set([
        ...(profile?.collections ?? []),
        ...[...data.collections.values()]
          .filter((collection) => (collection.dynasties ?? []).includes(dynasty.id))
          .map((collection) => collection.id),
      ]),
    ];
    return {
      ...summaries.get(dynasty.id)!,
      body: profile?.body,
      note: profile?.note,
      capitals: profile?.capitals,
      founderRecords: (profile?.founders ?? []).flatMap((founder) => {
        const person = data.people.get(founder.id);
        return person ? [personCard(person)] : [];
      }),
      topics: dynastyTopics(data, dynasty.id),
      people,
      events: eraEvents,
      collections: collectionIds,
      collectionRecords: collectionSummaries.filter((collection) => collectionIds.includes(collection.id)),
      cover: profile?.cover,
      sources: profile?.sources ?? [],
    };
  });
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
    partOf: registry.partOf,
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

export function compilePeopleSearch(data: PipelineData, topics: Topic[]): SearchRecord[] {
  const rows = compilePeopleIndex(topics);
  for (const row of rows) {
    const registry = data.people.get(row.id);
    if (!registry) continue;
    if (registry.aliases?.length) row.aliases = registry.aliases;
    if (registry.bio) row.bio = registry.bio;
  }
  return rows;
}

function personBase(registry: RegistryPerson): Omit<Person, 'lane'> {
  return {
    id: registry.id,
    name: registry.name,
    display: registry.display,
    birth: registry.birth,
    birthAccuracy: registry.birthAccuracy,
    death: registry.death,
    deathAccuracy: registry.deathAccuracy,
    birthNote: registry.birthNote,
    deathNote: registry.deathNote,
    title: registry.title,
    bio: registry.bio,
    tags: registry.tags,
    categories: registry.categories,
    primary: registry.primary,
    polity: registry.polity,
    gender: registry.gender,
  };
}

function personCard(registry: RegistryPerson): Person {
  return { ...personBase(registry), lane: '' };
}

function collectionIds(data: PipelineData, predicate: (collection: RegistryCollection) => boolean): string[] {
  return [...data.collections.values()]
    .filter(predicate)
    .sort(
      (left, right) =>
        (left.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (right.featuredOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    )
    .map((collection) => collection.id);
}

export function compilePersonDetails(data: PipelineData, events: EventRecord[]): PersonDetail[] {
  const mergedRelations = mergeTopicRelations(data.topics).relations;
  return [...data.people.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((registry) => {
      const detail: PersonDetail = {
        ...personBase(registry),
        contractVersion: CONTRACT_VERSION,
        id: registry.id,
        profile: profileOf(registry),
        topics: data.topics
          .filter((topic) => topic.people.some((person) => person.id === registry.id))
          .map((topic) => ({
            id: topic.meta.id,
            title: topic.meta.title,
            lane: topic.people.find((person) => person.id === registry.id)!.lane,
          })),
        relations: mergedRelations
          .filter((relation) => relation.source === registry.id || relation.target === registry.id)
          .map((relation) => ({
            source: relation.source,
            target: relation.target,
            type: relation.type,
            directed: relation.directed,
            since: relation.since,
            notes: relation.notes,
            topicIds: relation.topicIds,
          })),
        events: events
          .filter(
            (event) =>
              (event.people ?? []).includes(registry.id) ||
              (event.commanders ?? []).some((commander) => commander.id === registry.id),
          )
          .map((event) => ({
            id: event.id,
            roles: [
              ...((event.people ?? []).includes(registry.id) ? (['person'] as const) : []),
              ...((event.commanders ?? []).some((commander) => commander.id === registry.id)
                ? (['commander'] as const)
                : []),
            ],
          })),
        collections: collectionIds(data, (collection) =>
          collection.members.some((member) => member.id === registry.id),
        ),
        aliases: registry.aliases,
        works: registry.works,
        experiences: registry.experiences,
        sources: registry.sources,
      };
      return detail;
    });
}

export function compileEventDetails(data: PipelineData, events: EventRecord[]): EventDetail[] {
  return events.map((event) => ({
    ...event,
    contractVersion: CONTRACT_VERSION,
    children: events
      .filter((candidate) => candidate.parent === event.id)
      .sort(
        (left, right) =>
          left.year - right.year || right.importance - left.importance || left.id.localeCompare(right.id),
      )
      .map((candidate) => candidate.id),
    components: events
      .flatMap((candidate) =>
        (candidate.partOf ?? []).filter((part) => part.id === event.id).map((part) => ({ ...part, event: candidate })),
      )
      .sort((left, right) => left.event.year - right.event.year || left.event.id.localeCompare(right.event.id)),
    personRecords: [...new Set([...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)])]
      .map((id) => data.people.get(id))
      .filter((person): person is RegistryPerson => person !== undefined)
      .map(personCard),
    collections: collectionIds(data, (collection) => (collection.events ?? []).includes(event.id)),
  }));
}

export function compileCollectionSummaries(data: PipelineData): CollectionSummary[] {
  return [...data.collections.values()].map((collection) => ({
    contractVersion: CONTRACT_VERSION,
    id: collection.id,
    name: collection.name,
    aliases: collection.aliases,
    category: collection.category,
    summary: collection.summary,
    tags: collection.tags,
    featuredOrder: collection.featuredOrder,
    cover: collection.cover,
    memberCount: collection.members.length,
    featuredMembers: collection.members
      .filter((member) => member.featured)
      .sort((left, right) => left.order - right.order)
      .map((member) => {
        const registry = data.people.get(member.id);
        if (!registry) throw new Error(`Collection ${collection.id} 的成员不存在 ${member.id}`);
        return personCard(registry);
      }),
  }));
}

export function compileCollectionDetails(data: PipelineData, events: EventRecord[]): CollectionDetail[] {
  const relations = mergeTopicRelations(data.topics).relations;
  return [...data.collections.values()].map((collection) => {
    for (const member of collection.members) {
      if (!data.people.has(member.id)) throw new Error(`Collection ${collection.id} 的成员不存在 ${member.id}`);
    }
    for (const eventId of collection.events ?? []) {
      if (!events.some((event) => event.id === eventId))
        throw new Error(`Collection ${collection.id} 的事件不存在 ${eventId}`);
    }
    const memberIds = new Set(collection.members.map((member) => member.id));
    const eventIds = new Set(collection.events ?? []);
    return {
      ...collection,
      contractVersion: CONTRACT_VERSION,
      people: collection.members
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((member) => personCard(data.people.get(member.id)!)),
      resolvedRelations: relations
        .filter((relation) => memberIds.has(relation.source) && memberIds.has(relation.target))
        .filter((relation) =>
          (collection.relations ?? []).some((ref) => resolveCollectionRelationKey(data.topics, ref) === relation.key),
        )
        .map((relation) => ({
          source: relation.source,
          target: relation.target,
          type: relation.type,
          directed: relation.directed,
          since: relation.since,
          notes: relation.notes,
          topicIds: relation.topicIds,
        })),
      eventRecords: events.filter((event) => eventIds.has(event.id)),
    };
  });
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
