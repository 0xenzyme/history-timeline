import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeHash, formatHash, formatLineEventHash, formatLineHash, parseHash } from '../src/routing';
import { catalog } from './fixtures';

const data = catalog();

test('空地址落到目录里的第一个专题', () => {
  const route = parseHash('', data);
  assert.equal(route.axis, 'topic');
  assert.equal(route.topicId, 'han');
  assert.equal(route.viewId, null);
});

test('topic/view 地址解析出专题与章节', () => {
  const route = parseHash('#qin/founding', data);
  assert.equal(route.axis, 'topic');
  assert.equal(route.topicId, 'qin');
  assert.equal(route.viewId, 'founding');
  assert.equal(route.canonicalize, false);
});

test('未知专题保留原名，不改写成默认专题', () => {
  const route = parseHash('#nope/leaf', data);
  assert.equal(route.unknownTopic, 'nope');
  assert.equal(route.topicId, 'han');
});

test('旧链接 #wudi 规范化到 han/wudi', () => {
  const route = parseHash('#wudi', data);
  assert.equal(route.topicId, 'han');
  assert.equal(route.viewId, 'wudi');
  assert.equal(route.canonicalize, true);
});

test('单段专题名按规范链接处理', () => {
  const route = parseHash('#qin', data);
  assert.equal(route.topicId, 'qin');
  assert.equal(route.canonicalize, true);
});

test('事件线优先于专题解析', () => {
  const route = parseHash('#military/event/e1', data);
  assert.equal(route.axis, 'time');
  assert.equal(route.lineId, 'military');
  assert.equal(route.eventId, 'e1');
  assert.equal(route.segmentId, null);
});

test('旧的 segment 形式保留并标记规范化', () => {
  const route = parseHash('#history/seg-1/e1', data);
  assert.equal(route.lineId, 'history');
  assert.equal(route.segmentId, 'seg-1');
  assert.equal(route.eventId, 'e1');
  assert.equal(route.canonicalize, true);
});

test('畸形百分号不会让解码崩溃', () => {
  assert.equal(decodeHash('%zz'), '%zz');
  assert.equal(decodeHash('#%E4%B8%89'), '#三');
});

test('链接格式化稳定', () => {
  assert.equal(formatHash('han', 'wudi'), '#han/wudi');
  assert.equal(formatLineHash('military', 'seg-1'), '#military/seg-1');
  assert.equal(formatLineHash('military', 'seg-1', 'e1'), '#military/event/e1');
  assert.equal(formatLineEventHash('history', 'e1'), '#history/event/e1');
});
