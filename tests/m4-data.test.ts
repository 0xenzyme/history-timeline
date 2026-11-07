import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { validateEraDetail, validateEraIndex } from '../src/contract';
import { loadEraDetail, loadEraIndex } from '../src/loader';
import { lintDiscovery } from '../pipeline/lint';
import { loadPipeline } from '../pipeline/load';
import type { EraDetail, EraSummary } from '../src/types';

function read<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

test('全部断代产物通过运行时契约，推荐真实去重且朝代区间完整', () => {
  const eras = read<EraSummary[]>('public/data/eras.json');
  assert.equal(eras.length, 26);
  assert.deepEqual(validateEraIndex(eras), []);
  for (const era of eras) {
    const detail = read<EraDetail>(`public/data/eras/${era.id}.json`);
    assert.deepEqual(validateEraDetail(detail, era.id), [], era.id);
    assert.equal(new Set(detail.people.map((person) => person.id)).size, detail.people.length);
    assert.equal(new Set(detail.events.map((event) => event.id)).size, detail.events.length);
    for (const event of detail.events) assert.ok(event.dynasties?.includes(era.id));
  }
  const tang = read<EraDetail>('public/data/eras/tang.json');
  assert.deepEqual(
    tang.events.map((event) => event.id),
    ['xuanwu-zhibian', 'zhenguan-zhizhi', 'kaiyuan-shengshi', 'anshi-zhiluan', 'huangchao-zhi-luan'],
  );
  assert.equal(tang.founderRecords[0]?.id, 'li-yuan');
  assert.equal(tang.collections.length, 0);
});

test('首页编辑推荐只引用真实朝代和 published Collection，Discovery lint 通过', () => {
  const data = loadPipeline('pipeline');
  assert.deepEqual(
    lintDiscovery(data).filter((message) => message.level === 'error'),
    [],
  );
  const catalog = read<{ editorial: { dynasties: string[]; collections: string[] } }>('public/data/index.json');
  const eras = new Set(read<EraSummary[]>('public/data/eras.json').map((era) => era.id));
  const collections = new Set(read<Array<{ id: string }>>('public/data/collections.json').map((item) => item.id));
  assert.ok(catalog.editorial.dynasties.every((id) => eras.has(id)));
  assert.ok(catalog.editorial.collections.every((id) => collections.has(id)));
  assert.equal(readdirSync('public/data/eras').length, 26);
});

test('断代 loader 校验 expected id、重复推荐与非法区间', async () => {
  const detail = read<EraDetail>('public/data/eras/tang.json');
  globalThis.fetch = async () =>
    new Response(JSON.stringify(detail), { headers: { 'Content-Type': 'application/json' } });
  assert.equal((await loadEraDetail('/eras/tang.json', 'tang')).id, 'tang');
  await assert.rejects(loadEraDetail('/eras/tang.json', 'song'), /id 不匹配/);
  globalThis.fetch = async () =>
    new Response(JSON.stringify([detail, detail]), { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(loadEraIndex('/eras.json'), /id 或版本无效/);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ...detail, people: [detail.people[0], detail.people[0]] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  await assert.rejects(loadEraDetail('/eras/tang.json', 'tang'), /推荐人物不能重复/);
});
