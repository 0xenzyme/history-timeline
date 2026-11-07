import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compileCollectionDetails, compileEventDetails, compileEvent } from '../pipeline/compile';
import { formatCollectionIndex, formatCollectionMarkdown, parseCollectionMarkdown } from '../pipeline/collection-md';
import { EVENT_TEMPLATE, formatEventIndex, formatEventMarkdown, parseEventMarkdown } from '../pipeline/event-md';
import { formatPersonMarkdown, parsePersonMarkdown } from '../pipeline/person-md';
import { loadPipeline } from '../pipeline/load';
import { lintEventMarkdownFiles } from '../pipeline/events-cli';
import {
  lintCollections,
  lintEventCompositionGraph,
  lintRegistryEvent,
  lintRegistryPerson,
  mergeTopicRelations,
} from '../pipeline/lint';
import type { PipelineData, RegistryEvent, RegistryPerson, TopicDraft } from '../pipeline/types';
import type { RegistryCollection } from '../src/types';

const source = { work: '史记', part: '孔子世家', kind: 'classic' as const };

function person(overrides: Partial<RegistryPerson> = {}): RegistryPerson {
  return {
    id: 'test-person',
    name: '测试人物',
    display: '测试',
    birth: 700,
    birthAccuracy: 'exact',
    death: 760,
    deathAccuracy: 'exact',
    profile: 'brief',
    polity: ['tang'],
    gender: 'male',
    sources: [source],
    ...overrides,
  };
}

function event(overrides: Partial<RegistryEvent> = {}): RegistryEvent {
  return {
    id: 'battle',
    status: 'published',
    name: '会战',
    type: 'military',
    catalogs: ['military'],
    scale: 'battle',
    importance: 2,
    year: 757,
    yearAccuracy: 'exact',
    place: '某地',
    belligerents: ['tang', 'anshi'],
    sources: [{ work: '旧唐书', part: '郭子仪传', kind: 'classic' }],
    ...overrides,
  };
}

function composition(): RegistryEvent {
  return event({
    id: 'rebellion',
    type: 'rebellion',
    catalogs: ['history'],
    scale: undefined,
    year: 755,
    endYear: 763,
    endYearAccuracy: 'exact',
    place: undefined,
    belligerents: undefined,
    polity: ['tang'],
  });
}

function topic(relations: TopicDraft['relations']): TopicDraft {
  return {
    meta: { id: 'test', title: '测试', subtitle: '', range: [700, 800] },
    catalog: { region: 'cn', eras: ['test'], themes: ['test'] },
    lanes: [],
    people: [],
    relationTypes: [{ id: 'mentor', name: '师承', color: '#000000', dash: null, directed: true }],
    relations,
    events: [],
    views: [],
  };
}

function collection(overrides: Partial<RegistryCollection> = {}): RegistryCollection {
  return {
    id: 'test-series',
    status: 'draft',
    name: '测试系列',
    category: 'thought',
    summary: '用于测试的策展说明',
    members: [
      { id: 'test-person', order: 1 },
      { id: 'other-person', order: 2 },
    ],
    views: ['overview', 'members', 'timeline'],
    defaultView: 'overview',
    sources: [source],
    ...overrides,
  };
}

function data(overrides: Partial<PipelineData> = {}): PipelineData {
  return {
    order: [],
    regions: [],
    eras: [],
    themes: [],
    categories: [],
    polities: [],
    dynasties: [],
    dynastyProfiles: new Map(),
    dynastyProfilePaths: new Map(),
    homeEditorial: { dynasties: [], collections: [] },
    collectionCategories: [{ id: 'thought', name: '思想' }],
    people: new Map(),
    personPaths: new Map(),
    events: new Map(),
    eventPaths: new Map(),
    collections: new Map(),
    collectionPaths: new Map(),
    draftCollections: new Map(),
    draftCollectionPaths: new Map(),
    topics: [],
    candidates: new Map(),
    ...overrides,
  };
}

const eventContext = (events: RegistryEvent[]) => ({
  polityIds: new Set(['tang', 'anshi']),
  people: new Set(['test-person']),
  events: new Map(events.map((item) => [item.id, item])),
  publishedEventIds: new Set(events.map((item) => item.id)),
});

test('人物 works 与 experiences 经过 Markdown 格式化和 schema 往返', () => {
  const input = person({
    aliases: ['别名'],
    works: [{ id: 'poem', title: '一首诗', kind: 'poetry', sources: [source] }],
    experiences: [
      {
        id: 'arrival',
        label: '入京',
        year: 742,
        yearAccuracy: 'approx',
        yearNote: '史书只记天宝初',
        note: '入京待诏',
        sources: [source],
      },
    ],
  });
  const formatted = formatPersonMarkdown(input);
  const parsed = parsePersonMarkdown(formatted, 'content/tang/test-person.md');
  assert.deepEqual(parsed.messages, []);
  assert.deepEqual(parsed.person, input);
  assert.deepEqual(lintRegistryPerson(input, new Set(), new Set(['tang'])), []);
  assert.equal(Object.hasOwn(person(), 'works'), false);
});

test('人物扩展拒绝空可选数组、缺来源、精度说明和非法年份', () => {
  const input = person({
    works: [
      {
        id: 'bad',
        title: '作品',
        year: 0,
        yearAccuracy: 'approx',
        sources: [],
      },
    ],
    experiences: [
      {
        id: 'bad',
        label: '经历',
        year: 800,
        yearAccuracy: 'exact',
        endYear: 700,
        endYearAccuracy: 'exact',
        note: '逆序',
        sources: [],
      },
    ],
  });
  const messages = lintRegistryPerson(input, new Set(), new Set(['tang']))
    .map((item) => item.message)
    .join('\n');
  assert.match(messages, /year 必须是非零整数/);
  assert.match(messages, /yearNote/);
  assert.match(messages, /endYear 不得早于 year/);
  assert.match(messages, /至少需要一条 sources/);
  assert.equal(
    lintRegistryPerson(person({ works: [] }), new Set(), new Set(['tang'])).some((item) =>
      item.message.includes('数组至少需要 1 项'),
    ),
    true,
  );
  assert.equal(
    lintRegistryPerson(person({ experiences: [] }), new Set(), new Set(['tang'])).some((item) =>
      item.message.includes('数组至少需要 1 项'),
    ),
    true,
  );
});

test('事件 partOf 格式化保留 rebellion 类型并生成独立 components', () => {
  const parent = composition();
  const child = event({ partOf: [{ id: parent.id, note: '反攻组成会战', sources: [source] }] });
  const parsed = parseEventMarkdown(formatEventMarkdown(child), 'content/events/battle.md');
  assert.deepEqual(parsed.messages, []);
  assert.deepEqual(parsed.event?.partOf, child.partOf);
  assert.deepEqual(
    lintRegistryEvent(child, eventContext([parent, child])).filter((item) => item.level === 'error'),
    [],
  );
  const library = data({
    events: new Map([
      [parent.id, parent],
      [child.id, child],
    ]),
  });
  const compiled = [compileEvent(parent, []), compileEvent(child, [])];
  const parentDetail = compileEventDetails(library, compiled).find((item) => item.id === parent.id)!;
  assert.equal(parentDetail.type, 'rebellion');
  assert.deepEqual(parentDetail.children, []);
  assert.deepEqual(
    parentDetail.components.map((item) => item.event.id),
    [child.id],
  );
});

test('事件组合负例覆盖悬空、自引用、重复、非法组合和时间范围', () => {
  const parent = composition();
  const cases: Array<{ child: RegistryEvent; events: RegistryEvent[]; expected: RegExp }> = [
    {
      child: event({ partOf: [{ id: 'ghost', note: '无', sources: [source] }] }),
      events: [],
      expected: /不存在或不是已发布/,
    },
    {
      child: event({ partOf: [{ id: 'battle', note: '自引用', sources: [source] }] }),
      events: [],
      expected: /不能指向自己/,
    },
    {
      child: event({
        partOf: [
          { id: parent.id, note: '重复', sources: [source] },
          { id: parent.id, note: '重复', sources: [source] },
        ],
      }),
      events: [parent],
      expected: /不能重复/,
    },
    {
      child: event({ partOf: [{ id: parent.id, note: '无来源', sources: [] }] }),
      events: [parent],
      expected: /至少需要一条 sources/,
    },
    {
      child: event({ partOf: [{ id: parent.id, note: '', sources: [source] }] }),
      events: [parent],
      expected: /组成说明/,
    },
    {
      child: event({ year: 800, partOf: [{ id: parent.id, note: '越界', sources: [source] }] }),
      events: [parent],
      expected: /不相交/,
    },
    {
      child: event({ partOf: [{ id: 'battle-other', note: '非法组合', sources: [source] }] }),
      events: [event({ id: 'battle-other' })],
      expected: /不是允许的 span 组合/,
    },
  ];
  for (const { child, events, expected } of cases) {
    const messages = lintRegistryEvent(child, eventContext([...events, child]))
      .map((item) => item.message)
      .join('\n');
    assert.match(messages, expected);
  }
});

test('事件组合负例覆盖组合成员、循环和 draft 引用', () => {
  const parent = composition();
  const nested = event({
    id: 'nested',
    type: 'rebellion',
    catalogs: ['history'],
    scale: undefined,
    place: undefined,
    belligerents: undefined,
    polity: ['tang'],
    endYear: 760,
    endYearAccuracy: 'exact',
    partOf: [{ id: parent.id, note: '组合', sources: [source] }],
  });
  nested.polity = ['tang'];
  const child = event({ partOf: [{ id: nested.id, note: '组合中的组成战役', sources: [source] }] });
  assert.equal(
    lintRegistryEvent(child, eventContext([parent, nested, child])).some((item) => item.level === 'error'),
    false,
  );
  const noEnd = { ...nested, endYear: undefined, endYearAccuracy: undefined };
  const noEndMessages = lintRegistryEvent(child, eventContext([parent, noEnd, child]))
    .map((item) => item.message)
    .join('\n');
  assert.match(noEndMessages, /缺少 endYear/);
  assert.deepEqual(lintEventCompositionGraph(new Map([parent, nested, child].map((item) => [item.id, item]))), []);
  const cycle = composition();
  cycle.id = 'cycle';
  cycle.partOf = [{ id: 'cycle', note: '循环', sources: [source] }];
  assert.match(
    lintEventCompositionGraph(new Map([[cycle.id, cycle]]))
      .map((item) => item.message)
      .join('\n'),
    /循环/,
  );
  const draft = composition();
  draft.status = 'draft';
  const publishedChild = event({ partOf: [{ id: draft.id, note: '草稿', sources: [source] }] });
  const context = eventContext([draft, publishedChild]);
  context.publishedEventIds.delete(draft.id);
  assert.match(
    lintRegistryEvent(publishedChild, context)
      .map((item) => item.message)
      .join('\n'),
    /不存在或不是已发布/,
  );
  assert.equal(lintEventCompositionGraph(new Map([parent, child].map((item) => [item.id, item]))).length, 0);
});

test('事件组合遍历所有父引用分支并拒绝第二分支循环', () => {
  const first = composition();
  first.id = 'first';
  first.partOf = [{ id: 'third', note: '上层', sources: [source] }];
  const second = event({ id: 'second', partOf: [{ id: first.id, note: '第一分支', sources: [source] }] });
  const third = composition();
  third.id = 'third';
  third.partOf = [{ id: second.id, note: '第二分支闭合', sources: [source] }];
  const events = new Map([first, second, third].map((item) => [item.id, item]));
  assert.match(
    lintEventCompositionGraph(events)
      .map((item) => item.message)
      .join('\n'),
    /循环/,
  );
  assert.match(
    lintEventMarkdownFiles(
      [first, second, third].map((item) => ({ path: `content/events/${item.id}.md`, event: item, messages: [] })),
      new Set(['tang', 'anshi']),
      new Set(),
    )
      .map((item) => item.message)
      .join('\n'),
    /循环/,
  );
});

test('独立 events:check 拒绝 published 子事件引用 draft 组合', () => {
  const draft = composition();
  draft.status = 'draft';
  const child = event({ partOf: [{ id: draft.id, note: '引用草稿组合', sources: [source] }] });
  const messages = lintEventMarkdownFiles(
    [draft, child].map((item) => ({ path: `content/events/${item.id}.md`, event: item, messages: [] })),
    new Set(['tang', 'anshi']),
    new Set(),
  );
  assert.match(messages.map((item) => item.message).join('\n'), /不存在或不是已发布/);
});

test('独立 events:check 对解析失败文件返回错误而不是 TypeError', () => {
  const messages = lintEventMarkdownFiles(
    [
      {
        path: 'content/events/broken.md',
        messages: [{ level: 'error', path: 'content/events/broken.md', message: '缺少文首' }],
      },
    ],
    new Set(),
    new Set(),
  );
  assert.equal(messages[0].message, '缺少文首');
});

test('draft Collection 在真实加载路径完整校验但不进入发布集合', () => {
  const root = mkdtempSync(join(tmpdir(), 'lantai-m15-draft-collection-'));
  const pipelineRoot = join(root, 'pipeline');
  const contentRoot = join(root, 'content');
  for (const directory of ['registry/people', 'topics/test', 'vocab'])
    mkdirSync(join(pipelineRoot, directory), { recursive: true });
  mkdirSync(join(contentRoot, 'collections'), { recursive: true });
  mkdirSync(join(contentRoot, 'events'), { recursive: true });
  writeFileSync(join(pipelineRoot, 'topics.json'), '["test"]');
  for (const vocab of ['regions', 'eras', 'themes', 'categories', 'polities', 'dynasties', 'collection-categories']) {
    writeFileSync(
      join(pipelineRoot, `vocab/${vocab}.json`),
      vocab === 'collection-categories' ? '[{"id":"thought","name":"思想"}]' : '[]',
    );
  }
  writeFileSync(join(pipelineRoot, 'topics/test/topic.json'), JSON.stringify(topic([])));
  writeFileSync(join(pipelineRoot, 'topics/test/candidates.json'), '{"people":[]}');
  copyFileSync('content/_template.md', join(contentRoot, '_template.md'));
  copyFileSync('content/_template-full.md', join(contentRoot, '_template-full.md'));
  writeFileSync(join(contentRoot, '_template-event.md'), formatEventMarkdown(EVENT_TEMPLATE));
  writeFileSync(join(contentRoot, 'events.md'), formatEventIndex([]));
  copyFileSync('content/_template-collection.md', join(contentRoot, '_template-collection.md'));
  writeFileSync(join(contentRoot, 'collections.md'), formatCollectionIndex([]));
  writeFileSync(
    join(contentRoot, 'collections/draft-series.md'),
    formatCollectionMarkdown(
      collection({
        id: 'draft-series',
        events: ['missing-event'],
        relations: [{ source: 'test-person', target: 'other-person', type: 'mentor' }],
        views: ['overview', 'members', 'timeline', 'relations', 'events'],
      }),
    ),
  );
  const loaded = loadPipeline(pipelineRoot);
  assert.equal(loaded.collections.size, 0);
  assert.equal(loaded.draftCollections.size, 1);
  const messages = lintCollections(loaded)
    .map((item) => item.message)
    .join('\n');
  assert.match(messages, /成员不存在/);
  assert.match(messages, /事件引用不存在或未发布/);
  assert.match(messages, /关系引用无法解析/);
});

test('Collection draft 格式化和发布编译校验引用，不静默过滤', () => {
  const input = collection({ body: '系列正文' });
  const parsed = parseCollectionMarkdown(formatCollectionMarkdown(input), 'content/collections/test-series.md');
  assert.deepEqual(parsed.messages, []);
  assert.deepEqual(parsed.collection, input);
  assert.equal(parsed.collection?.status, 'draft');
  const people = [person(), person({ id: 'other-person' })];
  const library = data({
    collections: new Map([[input.id, input]]),
    people: new Map(people.map((item) => [item.id, item])),
  });
  assert.equal(compileCollectionDetails(library, [])[0].people.length, 2);
  const ghost = collection({
    id: 'ghost-series',
    members: [
      { id: 'ghost', order: 1 },
      { id: 'test-person', order: 2 },
    ],
  });
  library.collections.set(ghost.id, ghost);
  assert.match(
    lintCollections(library)
      .map((item) => item.message)
      .join('\n'),
    /成员不存在 ghost/,
  );
  assert.throws(() => compileCollectionDetails(library, []), /成员不存在 ghost/);
});

test('Collection 校验空可选、重复成员、事件和视图引用', () => {
  const people = new Map([person(), person({ id: 'other-person' })].map((item) => [item.id, item]));
  const library = data({ people });
  const invalid = collection({
    id: 'invalid',
    events: [],
    views: ['overview', 'members', 'timeline', 'relations'],
    relations: [],
    path: [{ label: '冲突', person: 'test-person', event: 'battle' }],
  });
  library.collections.set(invalid.id, invalid);
  const messages = lintCollections(library)
    .map((item) => item.message)
    .join('\n');
  assert.match(messages, /数组至少需要 1 项/);
  assert.match(messages, /relations 视图需要至少一条关系/);
  assert.match(messages, /至多一个 person 或 event/);
  const duplicate = collection({
    id: 'duplicate',
    members: [
      { id: 'test-person', order: 1 },
      { id: 'test-person', order: 1 },
    ],
  });
  library.collections.set(duplicate.id, duplicate);
  assert.match(
    lintCollections(library)
      .map((item) => item.message)
      .join('\n'),
    /重复成员/,
  );
});

test('关系主键按方向区分，note 合并且冲突定义报错', () => {
  const directed = topic([{ source: 'a', target: 'b', type: 'mentor', note: '第一份', since: 730 }]);
  const duplicate = topic([{ source: 'a', target: 'b', type: 'mentor', note: '第二份', since: 730 }]);
  const merged = mergeTopicRelations([directed, duplicate]);
  assert.deepEqual(merged.messages, []);
  assert.deepEqual(merged.relations[0].notes, ['第一份', '第二份']);
  const conflict = topic([{ source: 'a', target: 'b', type: 'mentor', note: '冲突', since: 731 }]);
  assert.match(
    mergeTopicRelations([directed, conflict])
      .messages.map((item) => item.message)
      .join('\n'),
    /since 冲突/,
  );
  const reversed = topic([{ source: 'b', target: 'a', type: 'mentor', note: '反向', since: 730 }]);
  assert.equal(mergeTopicRelations([directed, reversed]).relations.length, 2);
  const missing = topic([{ source: 'a', target: 'b', type: 'mentor', note: '未知', since: undefined }]);
  assert.equal(mergeTopicRelations([directed, missing]).messages.length, 0);
  assert.equal(mergeTopicRelations([directed, missing]).relations[0].since, 730);
});

test('Collection directed 关系拒绝反向引用，不静默改写方向', () => {
  const directed = topic([{ source: 'test-person', target: 'other-person', type: 'mentor', note: '明确授受' }]);
  const people = new Map([person(), person({ id: 'other-person' })].map((item) => [item.id, item]));
  const input = collection({
    id: 'directed-series',
    relations: [{ source: 'other-person', target: 'test-person', type: 'mentor' }],
    views: ['overview', 'members', 'timeline', 'relations'],
  });
  const library = data({ people, topics: [directed], collections: new Map([[input.id, input]]) });
  assert.match(
    lintCollections(library)
      .map((item) => item.message)
      .join('\n'),
    /关系引用无法解析/,
  );
});
