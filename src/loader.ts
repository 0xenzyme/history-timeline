import type { Catalog, CatalogEntry, Topic } from './types';

const FILE_PATTERN = /^[A-Za-z0-9_-]+\.json$/;

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
  const problems = validate(topic);
  if (expectedId !== undefined && topic.meta.id !== expectedId) {
    problems.push(`专题 id 为 ${topic.meta.id}，与目录中的 ${expectedId} 不一致`);
  }
  if (problems.length > 0) {
    console.error('[数据校验]', problems);
    throw new Error(`数据校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return topic;
}

function validate(topic: Topic): string[] {
  const problems: string[] = [];
  const personIds = new Set(topic.people.map((p) => p.id));
  const laneIds = new Set(topic.lanes.map((l) => l.id));
  const typeIds = new Set(topic.relationTypes.map((t) => t.id));
  const eventIds = new Set(topic.events.map((e) => e.id));

  if (personIds.size !== topic.people.length) problems.push('people 存在重复 id');
  if (eventIds.size !== topic.events.length) problems.push('events 存在重复 id');

  const [rangeFrom, rangeTo] = topic.meta.range;
  if (rangeFrom >= rangeTo) problems.push('meta.range 无效');

  for (const person of topic.people) {
    const tag = `人物 ${person.id}`;
    if (!laneIds.has(person.lane)) problems.push(`${tag} 引用了不存在的泳道 ${person.lane}`);
    if (person.birth === undefined && person.death === undefined) {
      problems.push(`${tag} 生卒年全为空`);
    }
    if (person.birth !== undefined && person.death !== undefined && person.birth > person.death) {
      problems.push(`${tag} 生年晚于卒年`);
    }
    if (person.birth === undefined && person.birthAccuracy !== 'unknown') {
      problems.push(`${tag} 缺少生年，birthAccuracy 应为 unknown`);
    }
    if (person.death === undefined && person.deathAccuracy !== 'unknown') {
      problems.push(`${tag} 缺少卒年，deathAccuracy 应为 unknown`);
    }
    for (const year of [person.birth, person.death]) {
      if (year !== undefined && (year < rangeFrom - 200 || year > rangeTo + 200)) {
        problems.push(`${tag} 的生卒年 ${year} 远超专题范围`);
      }
    }
  }

  for (const rel of topic.relations) {
    const tag = `关系 ${rel.source}→${rel.target}`;
    if (!personIds.has(rel.source)) problems.push(`${tag} 的 source 人物不存在`);
    if (!personIds.has(rel.target)) problems.push(`${tag} 的 target 人物不存在`);
    if (!typeIds.has(rel.type)) problems.push(`${tag} 的关系类型 ${rel.type} 不存在`);
    if (rel.source === rel.target) problems.push(`${tag} 指向自身`);
  }

  for (const event of topic.events) {
    const tag = `事件 ${event.id}`;
    if (event.kind === 'span' && event.endYear === undefined) {
      problems.push(`${tag} 为时段型但缺少 endYear`);
    }
    if (event.endYear !== undefined && event.endYear < event.year) {
      problems.push(`${tag} 结束年份早于开始年份`);
    }
    for (const pid of event.people ?? []) {
      if (!personIds.has(pid)) problems.push(`${tag} 引用了不存在的人物 ${pid}`);
    }
  }

  for (const view of topic.views) {
    const tag = `章节 ${view.id}`;
    if (view.from >= view.to) problems.push(`${tag} 的时间窗无效`);
    if (view.focus !== undefined && !personIds.has(view.focus)) {
      problems.push(`${tag} 的 focus 人物不存在`);
    }
    for (const pid of view.people ?? []) {
      if (!personIds.has(pid)) problems.push(`${tag} 引用了不存在的人物 ${pid}`);
    }
    for (const eid of view.events ?? []) {
      if (!eventIds.has(eid)) problems.push(`${tag} 引用了不存在的事件 ${eid}`);
    }
  }

  return problems;
}

function validateCatalog(catalog: Catalog): string[] {
  const problems: string[] = [];
  if (!Array.isArray(catalog.topics) || catalog.topics.length === 0) {
    problems.push('topics 为空');
    return problems;
  }
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const item of catalog.topics) {
    if (!item.id) problems.push('存在缺少 id 的专题');
    if (!item.title) problems.push(`专题 ${item.id} 缺少 title`);
    if (!item.file) problems.push(`专题 ${item.id} 缺少 file`);
    else if (!FILE_PATTERN.test(item.file)) {
      problems.push(`专题 ${item.id} 的 file 非法：${item.file}`);
    }
    if (item.id) {
      if (ids.has(item.id)) problems.push(`专题 id 重复：${item.id}`);
      ids.add(item.id);
    }
    if (item.file) {
      if (files.has(item.file)) problems.push(`专题 file 重复：${item.file}`);
      files.add(item.file);
    }
  }
  return problems;
}
