import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadCollectionDetail, loadCollectionIndex, loadEventDetail, loadPersonDetail } from '../src/loader';
import type { EventDetail, PersonDetail } from '../src/types';

function read<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function localFetch(url: string): Promise<Response> {
  const path = url.startsWith('/') ? url.slice(1) : url;
  return Promise.resolve(new Response(readFileSync(path, 'utf8'), { status: 200 }));
}

test('李白作品、经历、出处与别名贯通正式 loader，不生成安史之乱关系', async () => {
  globalThis.fetch = localFetch as typeof fetch;
  const person = await loadPersonDetail('public/data/people/li-bai.json', 'li-bai');
  assert.ok(person.aliases?.includes('李太白'));
  assert.ok(person.sources.some((source) => source.work === '新唐书'));
  assert.equal(person.works?.[0].title, '蜀道难');
  assert.equal(person.works?.[0].year, undefined);
  assert.equal(person.works?.[0].yearAccuracy, undefined);
  assert.equal(person.experiences?.[0].yearAccuracy, 'approx');
  assert.match(person.experiences?.[0].yearNote ?? '', /天宝初/);
  assert.equal(
    person.events.some((event) => event.id === 'anshi-zhiluan'),
    false,
  );
  assert.deepEqual(person.collections, []);
});

test('资料不足人物缺省读取，不伪造年份、归属或可选字段', async () => {
  globalThis.fetch = localFetch as typeof fetch;
  const brief = await loadPersonDetail('public/data/people/yuan-shang.json', 'yuan-shang');
  assert.equal(brief.profile, 'brief');
  assert.equal(brief.birthAccuracy, 'unknown');
  assert.equal(brief.bio, undefined);
  assert.equal(brief.works, undefined);
  assert.equal(brief.experiences, undefined);
  const legacy = read<PersonDetail>('public/data/people/bao-xu.json');
  assert.equal(legacy.birth, undefined);
  assert.equal(legacy.polity, undefined);
  assert.equal(legacy.works, undefined);
  assert.equal(legacy.experiences, undefined);
});

test('安史之乱组合保留事实类型，成员和组成说明、出处可往返', async () => {
  globalThis.fetch = localFetch as typeof fetch;
  const event = await loadEventDetail('public/data/events/anshi-zhiluan.json', 'anshi-zhiluan');
  assert.equal(event.type, 'rebellion');
  assert.equal(event.parent, undefined);
  assert.deepEqual(event.children, []);
  assert.deepEqual(event.components.map((component) => component.event.id).sort(), [
    'suiyang-baowei-zhan',
    'xiangjisi-zhizhan',
  ]);
  for (const component of event.components) {
    assert.ok(component.note.length > 0);
    assert.ok(component.sources.length > 0);
    assert.equal(component.event.people?.includes('li-bai'), false);
  }
  const child = read<EventDetail>('public/data/events/xiangjisi-zhizhan.json');
  assert.equal(child.type, 'military');
  assert.equal(child.partOf?.[0].id, 'anshi-zhiluan');
});

test('儒家 Collection 跨专题含朱熹，成员反查和显式关系正确', async () => {
  globalThis.fetch = localFetch as typeof fetch;
  const index = await loadCollectionIndex('public/data/collections.json');
  assert.deepEqual(
    index.map((collection) => collection.id),
    ['rujia-chuancheng'],
  );
  const collection = await loadCollectionDetail('public/data/collections/rujia-chuancheng.json', 'rujia-chuancheng');
  assert.deepEqual(
    collection.members.map((member) => member.id),
    ['kong-zi', 'yan-hui', 'zeng-zi', 'meng-zi', 'zhu-xi'],
  );
  assert.equal(collection.people.length, 5);
  assert.deepEqual(
    collection.resolvedRelations.map((relation) => `${relation.source}/${relation.target}`),
    ['kong-zi/yan-hui', 'kong-zi/zeng-zi'],
  );
  assert.equal(
    collection.resolvedRelations.some((relation) => relation.target === 'zhu-xi'),
    false,
  );
  assert.deepEqual(read<PersonDetail>('public/data/people/zhu-xi.json').collections, ['rujia-chuancheng']);
  const personTopics = new Map(
    collection.members.map((member) => [
      member.id,
      read<PersonDetail>(`public/data/people/${member.id}.json`).topics.map((topic) => topic.id),
    ]),
  );
  assert.ok(personTopics.get('kong-zi')?.includes('rujia'));
  assert.ok(personTopics.get('kong-zi')?.includes('chunqiu'));
  assert.ok(personTopics.get('zhu-xi')?.includes('song'));
});
