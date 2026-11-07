import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCollectionDetail, validateCollectionIndex } from '../src/contract';
import { loadCollectionDetail, loadCollectionIndex, loadEventDetail, loadLine, loadPersonDetail } from '../src/loader';
import { CONTRACT_VERSION } from '../src/types';
import type { CollectionDetail, EventDetail, PersonDetail } from '../src/types';
import { event, eventLine } from './fixtures';

function person(): PersonDetail {
  return {
    contractVersion: CONTRACT_VERSION,
    id: 'old-person',
    name: '旧人物',
    display: '旧人物',
    birthAccuracy: 'unknown',
    death: 700,
    deathAccuracy: 'exact',
    profile: 'brief',
    topics: [],
    relations: [],
    events: [],
    collections: [],
    sources: [{ work: '史记' }],
  };
}

function detail(): EventDetail {
  return {
    ...event({ id: 'old-event' }),
    contractVersion: CONTRACT_VERSION,
    children: [],
    components: [],
    personRecords: [],
    collections: [],
  };
}

function collection(): CollectionDetail {
  const members = [
    { id: 'old-person', order: 1 },
    { id: 'other-person', order: 2 },
  ];
  return {
    contractVersion: CONTRACT_VERSION,
    id: 'series',
    status: 'published',
    name: '系列',
    category: 'thought',
    summary: '策展说明',
    members,
    views: ['overview', 'members', 'timeline'],
    defaultView: 'overview',
    sources: [{ work: '史记' }],
    people: [
      {
        id: 'old-person',
        name: '旧人物',
        display: '旧人物',
        lane: '',
        birthAccuracy: 'unknown',
        deathAccuracy: 'unknown',
      },
      {
        id: 'other-person',
        name: '另一人',
        display: '另一人',
        lane: '',
        birthAccuracy: 'unknown',
        deathAccuracy: 'unknown',
      },
    ],
    resolvedRelations: [],
    eventRecords: [],
  };
}

function mockJson(value: unknown): void {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('旧人物详情缺新增字段仍可读，错误 id 不回退', async () => {
  mockJson(person());
  const value = await loadPersonDetail('/people/old-person.json', 'old-person');
  assert.equal(value.works, undefined);
  assert.equal(value.experiences, undefined);
  await assert.rejects(loadPersonDetail('/people/other.json', 'other'), /id 不匹配/);
});

test('旧事件线无 partOf 可读，事件详情反向引用严格校验', async () => {
  mockJson(eventLine());
  const line = await loadLine('/history.json', 'history');
  assert.equal(line.events.length, 1);
  mockJson(detail());
  const value = await loadEventDetail('/events/old-event.json', 'old-event');
  assert.deepEqual(value.components, []);
  const invalid = { ...detail(), components: [{ id: 'old-event', event: detail(), note: '组成', sources: [] }] };
  mockJson(invalid);
  await assert.rejects(loadEventDetail('/events/old-event.json', 'old-event'), /缺少 sources|反向引用/);
});

test('Collection 索引与详情可加载，draft 不出现在目录', async () => {
  mockJson([]);
  assert.deepEqual(await loadCollectionIndex('/collections.json'), []);
  mockJson(collection());
  const value = await loadCollectionDetail('/collections/series.json', 'series');
  assert.equal(value.status, 'published');
  await assert.rejects(loadCollectionDetail('/collections/other.json', 'other'), /id 不匹配/);
});

test('运行时拒绝空可选字段、缺来源和无效精度', async () => {
  mockJson({ ...person(), works: [] });
  await assert.rejects(loadPersonDetail('/people/old-person.json', 'old-person'), /works 空数组/);
  mockJson({
    ...person(),
    experiences: [{ id: 'bad', label: '经历', yearAccuracy: 'approx', note: '经历', sources: [] }],
  });
  await assert.rejects(loadPersonDetail('/people/old-person.json', 'old-person'), /yearNote|sources/);
});

test('malformed Collection 运行时输入返回问题而不是抛 TypeError', () => {
  assert.ok(validateCollectionDetail({} as never).length > 0);
  assert.ok(validateCollectionDetail({ ...collection(), members: undefined } as never).length > 0);
  assert.ok(validateCollectionIndex([null] as never).length > 0);
  assert.ok(validateCollectionDetail({ ...collection(), people: {} } as never).length > 0);
});
