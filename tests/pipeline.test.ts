import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compileAll } from '../pipeline/compile';
import { lintPipeline } from '../pipeline/lint';
import { loadPipeline } from '../pipeline/load';

const pipelineRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'pipeline');

test('真实内容可以加载、编译并通过错误级校验', () => {
  const data = loadPipeline(pipelineRoot);
  assert.ok(data.order.length > 0, '专题列表不能为空');
  assert.ok(data.people.size > 0, '人物库不能为空');
  assert.ok(data.events.size > 0, '事件库不能为空');

  const { catalog, topics, events, lines } = compileAll(data);

  assert.equal(topics.length, data.order.length);
  assert.deepEqual(
    catalog.topics.map((item) => item.id),
    data.order,
  );
  assert.equal(lines.length, 2);
  assert.ok(events.length >= data.events.size, '编译后的事件不能少于源文件数');

  for (const topic of topics) assert.equal(topic.contractVersion, catalog.contractVersion);
  const ids = new Set(events.map((item) => item.id));
  assert.equal(ids.size, events.length, '事件 id 必须全局唯一');

  const errors = lintPipeline(data, topics, catalog).filter((item) => item.level === 'error');
  assert.deepEqual(
    errors.map((item) => `${item.path}: ${item.message}`),
    [],
  );
});
