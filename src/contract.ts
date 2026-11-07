import {
  CONTRACT_VERSION,
  type Catalog,
  type CollectionDetail,
  type CollectionSummary,
  type EventDetail,
  type EraDetail,
  type EraSummary,
  type EventLineView,
  type PersonDetail,
  type SourceRef,
  type Topic,
} from './types';

const detailAccuracies = new Set(['exact', 'approx', 'disputed', 'unknown']);

function sourceProblems(sources: SourceRef[] | undefined, label: string): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return [`${label} 缺少 sources`];
  return sources
    .filter((source) => !source || typeof source.work !== 'string' || !source.work.trim())
    .map(() => `${label} 的出处缺少 work`);
}

function optionalYearProblems(
  value: {
    year?: number;
    yearAccuracy?: string;
    yearNote?: string;
    endYear?: number;
    endYearAccuracy?: string;
    endYearNote?: string;
  },
  label: string,
): string[] {
  const problems: string[] = [];
  if (value.year !== undefined && (!Number.isInteger(value.year) || value.year === 0))
    problems.push(`${label} year 无效`);
  if (value.yearAccuracy !== undefined && !detailAccuracies.has(value.yearAccuracy))
    problems.push(`${label} yearAccuracy 无效`);
  if ((value.yearAccuracy === 'approx' || value.yearAccuracy === 'disputed') && !value.yearNote?.trim())
    problems.push(`${label} 缺 yearNote`);
  if (value.yearAccuracy === 'unknown' && value.year !== undefined) problems.push(`${label} unknown 不应有 year`);
  if (value.endYear !== undefined) {
    if (
      !Number.isInteger(value.endYear) ||
      value.endYear === 0 ||
      (value.year !== undefined && value.endYear < value.year)
    )
      problems.push(`${label} endYear 无效`);
    if (!detailAccuracies.has(value.endYearAccuracy ?? '') || value.endYearAccuracy === 'unknown')
      problems.push(`${label} endYearAccuracy 无效`);
    if ((value.endYearAccuracy === 'approx' || value.endYearAccuracy === 'disputed') && !value.endYearNote?.trim())
      problems.push(`${label} 缺 endYearNote`);
  }
  return problems;
}

export function validatePersonDetail(detail: PersonDetail, expectedId?: string): string[] {
  const problems: string[] = [];
  if (!detail || detail.contractVersion !== CONTRACT_VERSION)
    problems.push(`人物详情 contractVersion 应为 ${CONTRACT_VERSION}`);
  if (!detail?.id || (expectedId !== undefined && detail.id !== expectedId)) problems.push('人物详情 id 不匹配');
  if (!detail?.name?.trim() || !detail?.display?.trim()) problems.push('人物详情缺 name 或 display');
  if (detail?.profile !== 'brief' && detail?.profile !== 'full') problems.push('人物详情 profile 无效');
  if (
    !Array.isArray(detail?.topics) ||
    !Array.isArray(detail?.relations) ||
    !Array.isArray(detail?.events) ||
    !Array.isArray(detail?.collections)
  )
    problems.push('人物详情派生索引无效');
  problems.push(...sourceProblems(detail?.sources, `人物 ${detail?.id}`));
  if (detail?.works !== undefined && (!Array.isArray(detail.works) || detail.works.length === 0))
    problems.push('works 空数组或类型无效，应省略');
  if (detail?.experiences !== undefined && (!Array.isArray(detail.experiences) || detail.experiences.length === 0))
    problems.push('experiences 空数组或类型无效，应省略');
  const works = Array.isArray(detail?.works) ? detail.works : [];
  const experiences = Array.isArray(detail?.experiences) ? detail.experiences : [];
  for (const [index, work] of works.entries()) {
    const label = `作品 ${work?.id ?? index}`;
    if (!work.id || !work.title?.trim()) problems.push(`${label} 缺 id 或 title`);
    problems.push(...optionalYearProblems(work, label), ...sourceProblems(work.sources, label));
  }
  for (const [index, experience] of experiences.entries()) {
    const label = `经历 ${experience?.id ?? index}`;
    if (!experience.id || !experience.label?.trim() || !experience.note?.trim())
      problems.push(`${label} 缺 id、label 或 note`);
    if (!detailAccuracies.has(experience.yearAccuracy)) problems.push(`${label} yearAccuracy 无效`);
    problems.push(...optionalYearProblems(experience, label), ...sourceProblems(experience.sources, label));
    if (
      experience.event &&
      (experience.year !== undefined || experience.endYear !== undefined || experience.place !== undefined)
    )
      problems.push(`${label} 不得复制公共事件时间或地点`);
  }
  return problems;
}

export function validateEventDetail(detail: EventDetail, expectedId?: string): string[] {
  const problems: string[] = [];
  if (!detail || detail.contractVersion !== CONTRACT_VERSION)
    problems.push(`事件详情 contractVersion 应为 ${CONTRACT_VERSION}`);
  if (!detail?.id || (expectedId !== undefined && detail.id !== expectedId)) problems.push('事件详情 id 不匹配');
  if (
    !Array.isArray(detail?.children) ||
    !Array.isArray(detail?.components) ||
    !Array.isArray(detail?.personRecords) ||
    !Array.isArray(detail?.collections)
  )
    problems.push('事件详情派生索引无效');
  if (detail?.partOf?.length === 0) problems.push('partOf 空数组应省略');
  const partIds = new Set<string>();
  for (const part of detail?.partOf ?? []) {
    if (!part.id || part.id === detail.id || partIds.has(part.id) || !part.note?.trim())
      problems.push(`事件 ${detail.id} 的 partOf 引用无效`);
    partIds.add(part.id);
    problems.push(...sourceProblems(part.sources, `事件 ${detail.id} 的 partOf/${part.id}`));
  }
  if (new Set(detail?.children ?? []).size !== (detail?.children ?? []).length) problems.push('children 不能重复');
  if (
    new Set((detail?.components ?? []).map((component) => component.event?.id)).size !==
    (detail?.components ?? []).length
  )
    problems.push('components 不能重复');
  for (const component of detail?.components ?? []) {
    if (
      !component.event ||
      !component.note?.trim() ||
      component.event.partOf?.some((part) => part.id === detail.id) !== true
    )
      problems.push(`组成 ${component.event?.id ?? '(空)'} 缺少合法反向引用`);
    problems.push(...sourceProblems(component.sources, `组成 ${component.event?.id}`));
  }
  return problems;
}

export function validateCollectionIndex(collections: CollectionSummary[]): string[] {
  if (!Array.isArray(collections)) return ['Collection 索引必须是数组'];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const collection of collections) {
    if (!collection || collection.contractVersion !== CONTRACT_VERSION || !collection.id || ids.has(collection.id)) {
      problems.push(`Collection 索引 id 或版本无效 ${collection?.id}`);
      continue;
    }
    ids.add(collection.id);
    if (
      !collection.name?.trim() ||
      !collection.summary?.trim() ||
      !Number.isInteger(collection.memberCount) ||
      collection.memberCount < 2
    )
      problems.push(`Collection ${collection.id} 的索引内容无效`);
    if (!Array.isArray(collection.featuredMembers)) problems.push(`Collection ${collection.id} 缺代表成员数组`);
  }
  return problems;
}

export function validateCollectionDetail(detail: CollectionDetail, expectedId?: string): string[] {
  const problems: string[] = [];
  if (!detail || detail.contractVersion !== CONTRACT_VERSION)
    problems.push(`Collection contractVersion 应为 ${CONTRACT_VERSION}`);
  if (!detail?.id || (expectedId !== undefined && detail.id !== expectedId)) problems.push('Collection id 不匹配');
  if (!detail?.name?.trim() || !detail?.summary?.trim() || !detail?.category?.trim())
    problems.push('Collection 缺名称、简介或分类');
  const members = Array.isArray(detail?.members) ? detail.members : [];
  if (members.length < 2) problems.push('Collection 至少需要两名成员');
  if (!Array.isArray(detail?.people) || detail.people.length !== members.length)
    problems.push('Collection 成员卡与成员引用不一致');
  if (!Array.isArray(detail?.resolvedRelations) || !Array.isArray(detail?.eventRecords))
    problems.push('Collection 派生关系或事件无效');
  if (!Array.isArray(detail?.views) || !detail.views.includes(detail.defaultView))
    problems.push('Collection defaultView 不可用');
  const memberIds = new Set(members.map((member) => member.id));
  if (memberIds.size !== members.length) problems.push('Collection 成员重复');
  for (const relation of detail?.resolvedRelations ?? []) {
    if (
      !memberIds.has(relation.source) ||
      !memberIds.has(relation.target) ||
      !Array.isArray(relation.notes) ||
      relation.notes.length === 0
    )
      problems.push('Collection 关系无效');
  }
  problems.push(...sourceProblems(detail?.sources, `Collection ${detail?.id}`));
  return problems;
}

export function validateEraIndex(eras: EraSummary[]): string[] {
  if (!Array.isArray(eras)) return ['断代索引必须是数组'];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const era of eras) {
    if (!era || era.contractVersion !== CONTRACT_VERSION || !era.id || ids.has(era.id)) {
      problems.push(`断代索引 id 或版本无效 ${era?.id}`);
      continue;
    }
    ids.add(era.id);
    if (!era.name?.trim() || !Number.isInteger(era.from) || !Number.isInteger(era.to) || era.to < era.from)
      problems.push(`断代 ${era.id} 的名称或区间无效`);
    if (
      !Number.isInteger(era.personCount) ||
      era.personCount < 0 ||
      !Number.isInteger(era.eventCount) ||
      era.eventCount < 0
    )
      problems.push(`断代 ${era.id} 的计数无效`);
    if (!era.group?.trim()) problems.push(`断代 ${era.id} 缺 group`);
  }
  return problems;
}

export function validateEraDetail(detail: EraDetail, expectedId?: string): string[] {
  const problems = validateEraIndex([detail]);
  if (expectedId !== undefined && detail?.id !== expectedId) problems.push('断代详情 id 不匹配');
  if (!Array.isArray(detail?.people) || !Array.isArray(detail?.events) || !Array.isArray(detail?.collections))
    problems.push('断代推荐或反查索引无效');
  if (
    !Array.isArray(detail?.topics) ||
    !Array.isArray(detail?.founderRecords) ||
    !Array.isArray(detail?.collectionRecords)
  )
    problems.push('断代入口或人物卡无效');
  if (new Set(detail?.people?.map((person) => person.id)).size !== detail?.people?.length)
    problems.push('断代推荐人物不能重复');
  if (new Set(detail?.events?.map((event) => event.id)).size !== detail?.events?.length)
    problems.push('断代推荐事件不能重复');
  if (new Set(detail?.collections).size !== detail?.collections?.length) problems.push('断代相关群像不能重复');
  for (const event of detail?.events ?? [])
    if (!event.dynasties?.includes(detail.id)) problems.push(`断代推荐事件未命中区间 ${event.id}`);
  if (detail?.sources !== undefined && !Array.isArray(detail.sources)) problems.push('断代出处无效');
  else if (detail?.sources?.some((source) => !source?.work?.trim())) problems.push('断代出处缺 work');
  return problems;
}

export const FILE_PATTERN = /^[A-Za-z0-9_-]+\.json$/;

/**
 * 校验编译后的事件线。事件线是独立 JSON 产物，不能只依赖管线保证；
 * 这里只做结构/引用/时间不变量检查，不把 dynasty 命中当作 polity 归属。
 */
export function validateEventLine(line: EventLineView, expectedId?: string): string[] {
  const problems: string[] = [];
  if (!line || line.contractVersion !== CONTRACT_VERSION) {
    problems.push(`事件线 contractVersion 应为 ${CONTRACT_VERSION}`);
  }
  if (expectedId !== undefined && line?.id !== expectedId) {
    problems.push(`事件线 id 为 ${line?.id}，期望 ${expectedId}`);
  }
  if (line?.id !== 'military' && line?.id !== 'history') problems.push('事件线 id 必须是 military 或 history');
  if (
    !Array.isArray(line?.range) ||
    line.range.length !== 2 ||
    !line.range.every(Number.isFinite) ||
    line.range[0] >= line.range[1]
  ) {
    problems.push('事件线 range 无效');
  }
  if (!Array.isArray(line?.events)) problems.push('事件线 events 不是数组');
  if (!Array.isArray(line?.segments)) problems.push('事件线 segments 不是数组');
  if (!Array.isArray(line?.dynasties)) problems.push('事件线 dynasties 不是数组');

  const eventRows = Array.isArray(line?.events) ? line.events : [];
  const segmentRows = Array.isArray(line?.segments) ? line.segments : [];
  const eventIds = new Set<string>();
  const eventTypes = new Set(['military', 'political', 'rebellion', 'institutional', 'diplomatic', 'cultural']);
  const accuracies = new Set(['exact', 'approx', 'disputed', 'unknown']);
  for (const event of eventRows) {
    const tag = `事件 ${event?.id ?? '(空)'}`;
    if (!event || typeof event !== 'object') {
      problems.push(`${tag} 不是对象`);
      continue;
    }
    if (typeof event.id !== 'string' || event.id.length === 0) problems.push(`${tag} 缺少 id`);
    else if (eventIds.has(event.id)) problems.push(`${tag} id 重复`);
    else eventIds.add(event.id);
    if (typeof event.name !== 'string' || event.name.trim() === '') problems.push(`${tag} 缺少 name`);
    if (typeof event.display !== 'string' || event.display.trim() === '') problems.push(`${tag} 缺少 display`);
    if (event.kind !== 'point' && event.kind !== 'span') problems.push(`${tag} kind 无效`);
    if (!Number.isInteger(event.year) || event.year === 0) problems.push(`${tag} year 无效（不能是公元 0 年）`);
    if (eventTypes.has(event.type) === false) problems.push(`${tag} type 无效`);
    if (!accuracies.has(event.yearAccuracy)) problems.push(`${tag} yearAccuracy 无效`);
    if (
      event.endYear !== undefined &&
      (!Number.isInteger(event.endYear) || event.endYear === 0 || event.endYear < event.year)
    ) {
      problems.push(`${tag} endYear 无效`);
    }
    if (event.endYear !== undefined && !accuracies.has(event.endYearAccuracy ?? ''))
      problems.push(`${tag} endYearAccuracy 无效`);
    if (event.kind === 'span' && event.endYear === undefined) problems.push(`${tag} span 缺少 endYear`);
    if (event.kind === 'point' && event.endYear !== undefined) problems.push(`${tag} point 不应有 endYear`);
    if (![1, 2, 3].includes(event.importance)) problems.push(`${tag} importance 无效`);
    if (!Array.isArray(event.sources) || event.sources.length === 0) problems.push(`${tag} 缺少 sources`);
    if (event.catalogs !== undefined) {
      if (
        !Array.isArray(event.catalogs) ||
        event.catalogs.length === 0 ||
        event.catalogs.some((catalog) => catalog !== 'military' && catalog !== 'history')
      ) {
        problems.push(`${tag} catalogs 无效`);
      }
    }
    if (Array.isArray(line.range) && line.range.length === 2) {
      if (event.year < line.range[0] || event.year > line.range[1]) problems.push(`${tag} 超出事件线范围`);
      if (event.endYear !== undefined && (event.endYear < line.range[0] || event.endYear > line.range[1]))
        problems.push(`${tag} endYear 超出事件线范围`);
    }
  }

  const segmentIds = new Set<string>();
  const segmentMembership = new Map<string, number>();
  for (const segment of segmentRows) {
    const tag = `分段 ${segment?.id ?? '(空)'}`;
    if (!segment || typeof segment !== 'object' || typeof segment.id !== 'string' || segment.id.length === 0) {
      problems.push(`${tag} 缺少 id`);
      continue;
    }
    if (segmentIds.has(segment.id)) problems.push(`${tag} id 重复`);
    segmentIds.add(segment.id);
    if (!Number.isFinite(segment.from) || !Number.isFinite(segment.to) || segment.from >= segment.to)
      problems.push(`${tag} 时间范围无效`);
    if (!Array.isArray(segment.events)) {
      problems.push(`${tag} events 不是数组`);
      continue;
    }
    for (const id of segment.events) {
      if (!eventIds.has(id)) problems.push(`${tag} 引用了不存在的事件 ${id}`);
      segmentMembership.set(id, (segmentMembership.get(id) ?? 0) + 1);
    }
  }
  for (const event of eventRows) {
    if (!event || typeof event !== 'object' || typeof event.id !== 'string') continue;
    const membership = segmentMembership.get(event.id) ?? 0;
    if (membership !== 1) problems.push(`事件 ${event.id} 应恰好属于一个分段，实际 ${membership}`);
    const segment = segmentRows.find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        Array.isArray(candidate.events) &&
        candidate.events.includes(event.id),
    );
    if (segment && (event.year < segment.from || event.year > segment.to)) {
      problems.push(`事件 ${event.id} 的年份不在所属分段范围内`);
    }
  }
  return problems;
}

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
    if (typeof rel.note !== 'string' || rel.note.trim() === '') problems.push(`${tag} 缺少 note`);
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
    if (typeof view.brief !== 'string' || view.brief.trim() === '') problems.push(`${tag} 缺少 brief`);
    if (typeof view.focus !== 'string' || view.focus.trim() === '') problems.push(`${tag} 缺少 focus`);
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
    if (typeof term.name !== 'string' || term.name.trim() === '') problems.push(`${label} ${term.id} 缺少 name`);
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
  const polityIds = vocabIds(catalog.polities, 'polities', problems);

  if (!Array.isArray(catalog.categories) || catalog.categories.length === 0) {
    problems.push('categories 为空');
  } else {
    const seen = new Set<string>();
    for (const term of catalog.categories) {
      if (!term?.id) {
        problems.push('categories 存在缺少 id 的词条');
        continue;
      }
      if (typeof term.name !== 'string' || term.name.trim() === '') problems.push(`categories ${term.id} 缺少 name`);
      if (typeof term.rank !== 'number') problems.push(`categories ${term.id} 缺少 rank`);
      if (seen.has(term.id)) problems.push(`categories id 重复：${term.id}`);
      seen.add(term.id);
    }
  }

  const lineIds = new Set<string>();
  const lineFiles = new Set<string>();
  if (!Array.isArray(catalog.lines) || catalog.lines.length === 0) {
    problems.push('lines 为空');
  } else {
    for (const line of catalog.lines) {
      if (!line?.id) problems.push('存在缺少 id 的内容线');
      if (!line?.title) problems.push(`内容线 ${line?.id ?? '(空)'} 缺少 title`);
      if (line?.axis !== 'topic' && line?.axis !== 'time') {
        problems.push(`内容线 ${line?.id ?? '(空)'} 的 axis 无效`);
      }
      if (line?.axis === 'time') {
        if (!line.file || !FILE_PATTERN.test(line.file)) {
          problems.push(`内容线 ${line.id ?? '(空)'} 的 file 非法：${String(line.file ?? '(空)')}`);
        }
        if (!Array.isArray(line.range) || line.range.length !== 2 || line.range[0] >= line.range[1]) {
          problems.push(`内容线 ${line.id ?? '(空)'} 的 range 无效`);
        }
      }
      if (line?.id) {
        if (lineIds.has(line.id)) problems.push(`内容线 id 重复：${line.id}`);
        lineIds.add(line.id);
      }
      if (line?.file) {
        if (lineFiles.has(line.file)) problems.push(`内容线 file 重复：${line.file}`);
        lineFiles.add(line.file);
      }
    }
  }

  if (polityIds.size > 0 && Array.isArray(catalog.polities)) {
    for (const term of catalog.polities) {
      if (!term?.id) continue;
      if (term.name.trim() === '') problems.push(`polities ${term.id} 缺少 name`);
    }
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

export function filterTopics(
  catalog: Catalog,
  filters: { region: string | null; era: string | null; theme: string | null },
): Catalog['topics'] {
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
