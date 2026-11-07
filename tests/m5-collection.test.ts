import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Catalog, CollectionDetail, PersonDetail } from '../src/types';
import {
  availableCollectionViews,
  collectionTimelineBounds,
  collectionTimelineUrl,
  collectionUrl,
  featuredCollectionMembers,
  resolveCollectionView,
  timelineMembers,
} from '../src/site/collection-views';
import { renderCollectionDetail } from '../src/site/collection';
import { loadCollectionPeople, retrySiteData, type SiteLibrary } from '../src/site/data';

const realCollection = JSON.parse(
  readFileSync('public/data/collections/rujia-chuancheng.json', 'utf8'),
) as CollectionDetail;
const library: SiteLibrary = {
  catalog: JSON.parse(readFileSync('public/data/index.json', 'utf8')) as Catalog,
  people: [],
  events: [],
  collections: [],
  eras: [],
  failures: [],
};

test('M5 真实 Collection 只开放已有四个视图并保留显式关系', () => {
  assert.equal(realCollection.id, 'rujia-chuancheng');
  assert.deepEqual(
    realCollection.members.map((member) => member.id),
    ['kong-zi', 'yan-hui', 'zeng-zi', 'meng-zi', 'zhu-xi'],
  );
  assert.deepEqual(availableCollectionViews(realCollection), ['overview', 'members', 'timeline', 'relations']);
  assert.equal(realCollection.resolvedRelations.length, 2);
  assert.equal(realCollection.eventRecords.length, 0);
  assert.equal(realCollection.defaultView, 'overview');
  for (const member of realCollection.members) {
    const detail = JSON.parse(readFileSync(`public/data/people/${member.id}.json`, 'utf8')) as PersonDetail;
    assert.equal(detail.works?.length ?? 0, 0, `${member.id} 不应被补造作品`);
  }
  assert.deepEqual(
    featuredCollectionMembers(realCollection).map((member) => member.id),
    ['kong-zi', 'meng-zi', 'zhu-xi'],
  );
});

test('M5 跨时代范围覆盖朱熹并保留未知、BCE 和日期精度', () => {
  assert.deepEqual(collectionTimelineBounds(realCollection), { from: -604, to: 1253 });
  assert.equal(
    collectionTimelineUrl(realCollection, 'chunqiu'),
    '/timeline?topic=chunqiu&person=kong-zi&from=-604&to=1253',
  );
  assert.equal(timelineMembers(realCollection).dated.length, 5);
  assert.equal(timelineMembers(realCollection).undated.length, 0);
  const html = renderCollectionDetail(
    realCollection,
    library,
    resolveCollectionView(realCollection, '?tab=timeline'),
    collectionTimelineUrl(realCollection, 'chunqiu'),
  );
  assert.match(html, /前 551（异说）/);
  assert.match(html, /约 前 372/);
  assert.match(html, /1130—1200/);
  assert.match(html, /生年取《史记》前 551 年说/);
  assert.doesNotMatch(html, /from=-560|to=-90/);
});

test('M5 tab/defaultView/member 由 Collection 契约驱动，非法参数明确回退', () => {
  const state = resolveCollectionView(realCollection, '?tab=bad&member=bad&relation=bad');
  assert.equal(state.tab, 'overview');
  assert.deepEqual(state.invalid, ['tab', 'member', 'relation']);
  assert.equal(collectionUrl(realCollection, { tab: 'overview' }), '/collections/rujia-chuancheng');
  assert.equal(
    collectionUrl(realCollection, { tab: 'relations', member: 'zhu-xi', relationMode: 'list' }),
    '/collections/rujia-chuancheng?tab=relations&member=zhu-xi&relation=list',
  );
  const generic = { ...realCollection, defaultView: 'members' as const };
  assert.equal(resolveCollectionView(generic, '').tab, 'members');
  assert.equal(collectionUrl(generic, { tab: 'members' }), '/collections/rujia-chuancheng');
  assert.equal(resolveCollectionView(realCollection, '?tab=events').tab, 'overview');
  assert.equal(resolveCollectionView(realCollection, '?tab=works').tab, 'overview');
});

test('M5 关系图包含孤立成员但不生成额外关系，移动默认可读列表', () => {
  const state = resolveCollectionView(realCollection, '?tab=relations&member=meng-zi', 'list');
  const html = renderCollectionDetail(realCollection, library, state, null);
  assert.equal((html.match(/class="lt-relation-node[ "]/g) ?? []).length, 5);
  assert.equal((html.match(/class="lt-relation-edge[ "]/g) ?? []).length, 2);
  assert.match(html, /当前成员：<strong>孟子<\/strong>/);
  assert.match(html, /该成员没有系列内直接关系/);
  assert.match(html, /lt-relation-graph-container" hidden/);
  assert.doesNotMatch(html, /孟子 → 朱熹|朱熹 → 孟子/);
});

test('M5 成员详情并行加载且缓存成功结果，失败可单独重试', async (context) => {
  retrySiteData();
  const originalFetch = globalThis.fetch;
  const counts = new Map<string, number>();
  context.after(() => {
    globalThis.fetch = originalFetch;
    retrySiteData();
  });
  const response = (id: string): PersonDetail => ({
    contractVersion: 1,
    id,
    name: id,
    display: id,
    birthAccuracy: 'unknown',
    deathAccuracy: 'unknown',
    profile: 'brief',
    topics: [],
    relations: [],
    events: [],
    collections: [],
    sources: [{ work: '测试夹具' }],
  });
  let fail = true;
  globalThis.fetch = async (input) => {
    const id = String(input).split('/').pop()!.replace('.json', '');
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (id === 'fixture-b' && fail) return new Response('failed', { status: 500 });
    return new Response(JSON.stringify(response(id)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const first = await loadCollectionPeople(['fixture-a', 'fixture-b']);
  assert.deepEqual(
    first.people.map((person) => person.id),
    ['fixture-a'],
  );
  assert.deepEqual(first.failedIds, ['fixture-b']);
  const cached = await loadCollectionPeople(['fixture-a']);
  assert.equal(cached.people.length, 1);
  assert.equal(counts.get('fixture-a'), 1);
  fail = false;
  const retried = await loadCollectionPeople(['fixture-a', 'fixture-b']);
  assert.equal(retried.people.length, 2);
  assert.equal(retried.failedIds.length, 0);
  assert.equal(counts.get('fixture-a'), 1);
  assert.equal(counts.get('fixture-b'), 2);
});
