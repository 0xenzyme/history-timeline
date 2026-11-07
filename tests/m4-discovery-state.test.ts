import assert from 'node:assert/strict';
import test from 'node:test';

import { directoryUrl, parseDirectoryQuery, searchScore } from '../src/site/discovery-state';

test('目录 query 保留合法筛选，忽略非法值并回到默认排序和视图', () => {
  const state = parseDirectoryQuery(
    '?q=%E6%9D%8E%E7%99%BD&dynasty=tang&category=poetry,official,bad&sort=nope&page=-2&view=bad',
    {
      dynasty: { values: ['tang'] },
      category: { values: ['poetry', 'official'], multiple: true },
      sort: { values: ['birth', 'birth-desc'] },
      view: { values: ['grid', 'list'] },
    },
    { sort: 'birth', view: 'grid' },
  );
  assert.equal(state.q, '李白');
  assert.deepEqual(state.values.category, ['poetry', 'official']);
  assert.equal(state.sort, 'birth');
  assert.equal(state.page, 1);
  assert.equal(state.view, 'grid');
  assert.deepEqual(state.invalid.sort(), ['category', 'page', 'sort', 'view']);
  assert.match(directoryUrl('/people', state, { page: 2 }), /page=2/);
});

test('搜索精确名称和别名优先于其他字段，无命中返回 -1', () => {
  assert.equal(searchScore('李白', ['李白'], ['唐代诗人']), 0);
  assert.equal(searchScore('太白', ['李白', '李太白'], ['唐代诗人']), 2);
  assert.equal(searchScore('李', ['李白'], ['唐代诗人']), 1);
  assert.equal(searchScore('诗人', ['李白'], ['唐代诗人']), 3);
  assert.equal(searchScore('不存在', ['李白'], ['唐代诗人']), -1);
});
