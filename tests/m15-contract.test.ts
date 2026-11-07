import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const documents = ['docs/decisions/m1-5-event-composition.md', 'docs/兰台数据规格.md', 'docs/事件线规则.md'].map(
  (path) => readFileSync(path, 'utf8'),
);

test('M1.5 契约固定 partOf 与 parent 的独立语义', () => {
  for (const text of documents) {
    assert.match(text, /partOf/);
    assert.match(text, /parent/);
    assert.match(text, /循环/);
    assert.match(text, /note/);
    assert.match(text, /sources/);
    assert.match(text, /相交/);
    assert.match(text, /rebellion/);
  }
});

test('详情与 Collection 契约有明确 canonical 位置和版本策略', () => {
  const data = documents[1];
  for (const term of [
    'people/<id>.json',
    'events/<id>.json',
    'collections.json',
    'collections/<id>.json',
    'works',
    'experiences',
    'contractVersion',
    '空数组',
    'draft',
  ]) {
    assert.ok(data.includes(term), `缺少契约项 ${term}`);
  }
});
