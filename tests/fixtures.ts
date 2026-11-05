import type { Catalog, EventLineView, EventRecord, Person, Topic } from '../src/types';
import { CONTRACT_VERSION } from '../src/types';

export function person(overrides: Partial<Person> & { id: string }): Person {
  return {
    name: overrides.id,
    display: overrides.id,
    lane: 'lane-a',
    birthAccuracy: 'exact',
    deathAccuracy: 'exact',
    ...overrides,
  };
}

export function event(overrides: Partial<EventRecord> & { id: string }): EventRecord {
  return {
    name: overrides.id,
    display: overrides.id,
    kind: 'point',
    type: 'military',
    importance: 2,
    year: -500,
    yearAccuracy: 'exact',
    sources: [{ work: '史记' }],
    ...overrides,
  };
}

export function topic(overrides: Partial<Topic> = {}): Topic {
  return {
    contractVersion: CONTRACT_VERSION,
    meta: {
      id: 'han',
      title: '汉',
      subtitle: '测试专题',
      range: [-206, 220],
    },
    lanes: [{ id: 'lane-a', name: '甲', color: '#111111' }],
    people: [person({ id: 'a', birth: -100, death: -50 })],
    relationTypes: [],
    relations: [],
    events: [],
    views: [],
    ...overrides,
  };
}

export function catalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    contractVersion: CONTRACT_VERSION,
    regions: [{ id: 'china', name: '中国' }],
    eras: [{ id: 'han', name: '汉' }],
    themes: [{ id: 'unified', name: '大一统' }],
    categories: [{ id: 'official', name: '官员', rank: 1 }],
    topics: [
      {
        id: 'han',
        title: '汉',
        subtitle: '测试专题',
        file: 'han.json',
        region: 'china',
        eras: ['han'],
        themes: ['unified'],
      },
      {
        id: 'qin',
        title: '秦',
        subtitle: '测试专题',
        file: 'qin.json',
        region: 'china',
        eras: ['han'],
        themes: ['unified'],
      },
    ],
    polities: [{ id: 'han', name: '汉' }],
    lines: [
      { id: 'people', title: '人物', axis: 'topic' },
      { id: 'military', title: '军事', axis: 'time', file: 'military.json', range: [-2070, 1949] },
      { id: 'history', title: '历史事件', axis: 'time', file: 'history.json', range: [-2070, 1949] },
    ],
    ...overrides,
  };
}

export function eventLine(overrides: Partial<EventLineView> = {}): EventLineView {
  const record = event({ id: 'e1' });
  return {
    contractVersion: CONTRACT_VERSION,
    id: 'military',
    title: '军事',
    range: [-2070, 1949],
    segments: [{ id: 'seg-1', label: '前5世纪', from: -600, to: -400, events: ['e1'] }],
    dynasties: [],
    events: [record],
    ...overrides,
  };
}
