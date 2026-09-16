import { CONTRACT_VERSION, type Catalog, type Topic } from './types';

export const FILE_PATTERN = /^[A-Za-z0-9_-]+\.json$/;

export function validateTopic(topic: Topic, expectedId?: string): string[] {
  const problems: string[] = [];
  if (topic.contractVersion !== CONTRACT_VERSION) {
    problems.push(`contractVersion 应为 ${CONTRACT_VERSION}，实际为 ${String(topic.contractVersion)}`);
  }

  const personIds = new Set(topic.people.map((person) => person.id));
  const laneIds = new Set(topic.lanes.map((lane) => lane.id));
  const typeIds = new Set(topic.relationTypes.map((item) => item.id));
  const eventIds = new Set(topic.events.map((event) => event.id));

  if (personIds.size !== topic.people.length) problems.push('people 存在重复 id');
  if (eventIds.size !== topic.events.length) problems.push('events 存在重复 id');

  if (!topic.meta?.id) problems.push('meta.id 缺失');
  if (expectedId !== undefined && topic.meta?.id !== expectedId) {
    problems.push(`专题 id 为 ${topic.meta.id}，与目录中的 ${expectedId} 不一致`);
  }

  const range = topic.meta?.range;
  if (!Array.isArray(range) || range.length !== 2 || range[0] >= range[1]) {
    problems.push('meta.range 无效');
  }
  const rangeFrom = range?.[0];
  const rangeTo = range?.[1];

  for (const person of topic.people ?? []) {
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
    if (rangeFrom !== undefined && rangeTo !== undefined) {
      for (const year of [person.birth, person.death]) {
        if (year !== undefined && (year < rangeFrom - 200 || year > rangeTo + 200)) {
          problems.push(`${tag} 的生卒年 ${year} 远超专题范围`);
        }
      }
    }
  }

  for (const rel of topic.relations ?? []) {
    const tag = `关系 ${rel.source}→${rel.target}`;
    if (!personIds.has(rel.source)) problems.push(`${tag} 的 source 人物不存在`);
    if (!personIds.has(rel.target)) problems.push(`${tag} 的 target 人物不存在`);
    if (!typeIds.has(rel.type)) problems.push(`${tag} 的关系类型 ${rel.type} 不存在`);
    if (rel.source === rel.target) problems.push(`${tag} 指向自身`);
  }

  for (const event of topic.events ?? []) {
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

  for (const view of topic.views ?? []) {
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

function vocabIds(terms: Catalog['regions'] | undefined, label: string, problems: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(terms) || terms.length === 0) {
    problems.push(`${label} 为空`);
    return ids;
  }
  for (const term of terms) {
    if (!term?.id) {
      problems.push(`${label} 存在缺少 id 的词条`);
      continue;
    }
    if (!term.name) problems.push(`${label} ${term.id} 缺少 name`);
    if (ids.has(term.id)) problems.push(`${label} id 重复：${term.id}`);
    ids.add(term.id);
  }
  return ids;
}

export function validateCatalog(catalog: Catalog): string[] {
  const problems: string[] = [];
  if (catalog.contractVersion !== CONTRACT_VERSION) {
    problems.push(`目录 contractVersion 应为 ${CONTRACT_VERSION}，实际为 ${String(catalog.contractVersion)}`);
  }
  if (!Array.isArray(catalog.topics) || catalog.topics.length === 0) {
    problems.push('topics 为空');
    return problems;
  }

  const regionIds = vocabIds(catalog.regions, 'regions', problems);
  const eraIds = vocabIds(catalog.eras, 'eras', problems);
  const themeIds = vocabIds(catalog.themes, 'themes', problems);

  const ids = new Set<string>();
  const files = new Set<string>();
  for (const item of catalog.topics) {
    if (!item.id) problems.push('存在缺少 id 的专题');
    if (!item.title) problems.push(`专题 ${item.id} 缺少 title`);
    if (!item.file) problems.push(`专题 ${item.id} 缺少 file`);
    else if (!FILE_PATTERN.test(item.file)) {
      problems.push(`专题 ${item.id} 的 file 非法：${item.file}`);
    }
    if (!item.region) problems.push(`专题 ${item.id} 缺少 region`);
    else if (regionIds.size > 0 && !regionIds.has(item.region)) {
      problems.push(`专题 ${item.id} 的 region ${item.region} 不在目录词表中`);
    }
    if (!Array.isArray(item.eras) || item.eras.length === 0) {
      problems.push(`专题 ${item.id} 缺少 eras`);
    } else {
      for (const era of item.eras) {
        if (eraIds.size > 0 && !eraIds.has(era)) {
          problems.push(`专题 ${item.id} 的 era ${era} 不在目录词表中`);
        }
      }
    }
    if (!Array.isArray(item.themes) || item.themes.length === 0) {
      problems.push(`专题 ${item.id} 缺少 themes`);
    } else {
      for (const theme of item.themes) {
        if (themeIds.size > 0 && !themeIds.has(theme)) {
          problems.push(`专题 ${item.id} 的 theme ${theme} 不在目录词表中`);
        }
      }
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

export function filterTopics(catalog: Catalog, filters: { region: string | null; era: string | null; theme: string | null }): Catalog['topics'] {
  return catalog.topics.filter((item) => {
    if (filters.region && item.region !== filters.region) return false;
    if (filters.era && !item.eras.includes(filters.era)) return false;
    if (filters.theme && !item.themes.includes(filters.theme)) return false;
    return true;
  });
}

export function filtersActive(filters: { region: string | null; era: string | null; theme: string | null }): boolean {
  return filters.region !== null || filters.era !== null || filters.theme !== null;
}
