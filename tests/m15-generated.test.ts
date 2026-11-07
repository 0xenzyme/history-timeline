import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  validateCollectionDetail,
  validateCollectionIndex,
  validateEventDetail,
  validatePersonDetail,
} from '../src/contract';
import type { CollectionDetail, CollectionSummary, EventDetail, PersonDetail } from '../src/types';

function read<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

test('所有生成详情与 Collection 产物通过运行时 contract', () => {
  const personIds = readdirSync('public/data/people').filter((name) => name.endsWith('.json'));
  assert.equal(personIds.length, 3510);
  for (const name of personIds) {
    const id = name.slice(0, -'.json'.length);
    assert.deepEqual(validatePersonDetail(read<PersonDetail>(`public/data/people/${name}`), id), [], id);
  }
  const eventIds = readdirSync('public/data/events').filter((name) => name.endsWith('.json'));
  assert.equal(eventIds.length, 708);
  for (const name of eventIds) {
    const id = name.slice(0, -'.json'.length);
    assert.deepEqual(validateEventDetail(read<EventDetail>(`public/data/events/${name}`), id), [], id);
  }
  assert.deepEqual(validateCollectionIndex(read<CollectionSummary[]>('public/data/collections.json')), []);
  for (const collection of read<CollectionSummary[]>('public/data/collections.json')) {
    assert.deepEqual(
      validateCollectionDetail(read<CollectionDetail>(`public/data/collections/${collection.id}.json`), collection.id),
      [],
    );
  }
});

test('人物事件反查去重且只来自显式 people 或 commanders', () => {
  const person = read<PersonDetail>('public/data/people/li-bai.json');
  assert.equal(
    person.events.some((event) => event.id === 'anshi-zhiluan'),
    false,
  );
  assert.equal(new Set(person.events.map((event) => event.id)).size, person.events.length);
  for (const ref of person.events) {
    const event = read<EventDetail>(`public/data/events/${ref.id}.json`);
    assert.ok(
      (event.people ?? []).includes(person.id) ||
        (event.commanders ?? []).some((commander) => commander.id === person.id),
    );
  }
});
