import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCatalog, validateEventLine, validateTopic } from '../src/contract';
import { CONTRACT_VERSION } from '../src/types';
import { catalog, event, eventLine, topic } from './fixtures';

test('合法目录通过校验', () => {
  assert.deepEqual(validateCatalog(catalog()), []);
});

test('目录版本、专题 id 与文件名重复会被拒绝', () => {
  const problems = validateCatalog(
    catalog({
      contractVersion: CONTRACT_VERSION + 1,
      topics: [
        {
          id: 'han',
          title: '汉',
          subtitle: '',
          file: 'han.json',
          region: 'china',
          eras: ['han'],
          themes: ['unified'],
        },
        {
          id: 'han',
          title: '汉二',
          subtitle: '',
          file: 'han.json',
          region: 'china',
          eras: ['han'],
          themes: ['unified'],
        },
      ],
    }),
  );
  assert.ok(problems.some((item) => item.includes('contractVersion')));
  assert.ok(problems.some((item) => item.includes('专题 id 重复')));
  assert.ok(problems.some((item) => item.includes('专题 file 重复')));
});

test('目录里的非法文件名与未知词表会被拒绝', () => {
  const problems = validateCatalog(
    catalog({
      topics: [
        {
          id: 'han',
          title: '汉',
          subtitle: '',
          file: 'han yan.json',
          region: 'mars',
          eras: ['unknown-era'],
          themes: ['unknown-theme'],
        },
      ],
    }),
  );
  assert.ok(problems.some((item) => item.includes('file 非法')));
  assert.ok(problems.some((item) => item.includes('region mars')));
  assert.ok(problems.some((item) => item.includes('era unknown-era')));
  assert.ok(problems.some((item) => item.includes('theme unknown-theme')));
});

test('合法专题通过校验', () => {
  assert.deepEqual(validateTopic(topic(), 'han'), []);
});

test('专题校验覆盖泳道、生卒顺序与 id 重复', () => {
  const problems = validateTopic(
    topic({
      people: [
        {
          id: 'a',
          name: 'a',
          display: 'a',
          lane: 'missing',
          birth: -50,
          death: -100,
          birthAccuracy: 'exact',
          deathAccuracy: 'exact',
        },
        { id: 'a', name: 'a2', display: 'a2', lane: 'lane-a', birthAccuracy: 'unknown', deathAccuracy: 'unknown' },
      ],
      relations: [{ source: 'a', target: 'ghost', type: 'friend', note: '无' }],
    }),
    'han',
  );
  assert.ok(problems.some((item) => item.includes('people 存在重复 id')));
  assert.ok(problems.some((item) => item.includes('不存在的泳道')));
  assert.ok(problems.some((item) => item.includes('生年晚于卒年')));
  assert.ok(problems.some((item) => item.includes('target 人物不存在')));
  assert.ok(problems.some((item) => item.includes('关系类型 friend 不存在')));
});

test('专题 id 与目录不一致会被拒绝', () => {
  const problems = validateTopic(topic(), 'qin');
  assert.ok(problems.some((item) => item.includes('与目录中的 qin 不一致')));
});

test('合法事件线通过校验', () => {
  assert.deepEqual(validateEventLine(eventLine(), 'military'), []);
});

test('事件线校验覆盖公元 0 年、重复 id 与分段归属', () => {
  const problems = validateEventLine(
    eventLine({
      events: [
        event({ id: 'e1', year: 0 }),
        event({ id: 'e1', year: -450, endYear: -400, kind: 'span', endYearAccuracy: 'exact' }),
      ],
      segments: [
        { id: 's1', label: '一', from: -600, to: -400, events: ['e1'] },
        { id: 's2', label: '二', from: -600, to: -400, events: ['e1'] },
      ],
    }),
  );
  assert.ok(problems.some((item) => item.includes('不能是公元 0 年')));
  assert.ok(problems.some((item) => item.includes('id 重复')));
  assert.ok(problems.some((item) => item.includes('应恰好属于一个分段')));
});

test('事件线的 id 与范围不变量会被校验', () => {
  const problems = validateEventLine(eventLine({ id: 'people' as 'military', events: [] }), 'military');
  assert.ok(problems.some((item) => item.includes('id 为 people，期望 military')));
  assert.ok(problems.some((item) => item.includes('事件线 id 必须是')));
});

test('线段范围必须与事件年份一致', () => {
  const problems = validateEventLine(
    eventLine({
      segments: [{ id: 'seg-1', label: '一', from: -100, to: 100, events: ['e1'] }],
    }),
  );
  assert.ok(problems.some((item) => item.includes('年份不在所属分段范围内')));
});
