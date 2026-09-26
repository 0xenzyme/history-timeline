import { CONTRACT_VERSION, type Catalog, type Person, type SearchRecord, type Topic } from '../src/types';
import { validateCatalog, validateTopic } from '../src/contract';
import type { PersonOverlay, PipelineData, RegistryPerson } from './types';

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
    topics: data.topics.map((draft) => ({
      id: draft.meta.id,
      title: draft.meta.title,
      subtitle: draft.catalog.subtitle ?? draft.meta.subtitle,
      file: `${draft.meta.id}.json`,
      region: draft.catalog.region,
      eras: draft.catalog.eras,
      themes: draft.catalog.themes,
    })),
  };
}

export function compileSearch(topics: Topic[]): SearchRecord[] {
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
  return rows;
}

export function compileAll(data: PipelineData): { catalog: Catalog; topics: Topic[] } {
  const catalog = compileCatalog(data);
  const topics = data.topics.map((draft) => compileTopic(data, draft.meta.id));
  const problems = [
    ...validateCatalog(catalog).map((item) => `目录：${item}`),
    ...topics.flatMap((topic) => validateTopic(topic, topic.meta.id).map((item) => `${topic.meta.id}：${item}`)),
  ];
  if (problems.length > 0) {
    throw new Error(`编译校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return { catalog, topics };
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
