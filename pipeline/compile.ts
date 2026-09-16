import { CONTRACT_VERSION, type Catalog, type Person, type Topic } from '../src/types';
import { validateCatalog, validateTopic } from '../src/contract';
import type { PersonOverlay, PipelineData, RegistryPerson } from './types';

function mergePerson(registry: RegistryPerson, overlay: PersonOverlay): Person {
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
  if (overlay.order !== undefined) person.order = overlay.order;
  return person;
}

export function compileTopic(data: PipelineData, topicId: string): Topic {
  const draft = data.topics.find((item) => item.meta.id === topicId);
  if (!draft) throw new Error(`找不到专题 ${topicId}`);

  const people = draft.people.map((overlay) => {
    const registry = data.people.get(overlay.id);
    if (!registry) throw new Error(`专题 ${topicId} 引用了未登记人物 ${overlay.id}`);
    return mergePerson(registry, overlay);
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
