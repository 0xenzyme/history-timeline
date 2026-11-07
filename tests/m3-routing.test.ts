import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTimelineState } from '../src/timeline-state';
import { formatEventRange, formatLifeRange, formatYear } from '../src/site/format';

test('年表 query 保留实体、时间窗、筛选和分类状态', () => {
  const state = parseTimelineState(
    '?topic=tang&view=tianbao&person=li-bai&from=710&to=770&chip=female&hide=lane%3Ageneral%2Clane%3Akin&strip=1&scroll=420',
  );
  assert.deepEqual(state, {
    topic: 'tang',
    view: 'tianbao',
    person: 'li-bai',
    from: 710,
    to: 770,
    chip: 'female',
    hidden: ['lane:general', 'lane:kin'],
    strip: true,
    scroll: 420,
  });
  assert.equal(parseTimelineState('?from=bad&to=770').from, undefined);
  assert.equal(parseTimelineState('?from=0&to=770').from, undefined);
  assert.equal(parseTimelineState('?line=unknown').line, undefined);
});

test('日期精度与 BCE 不从缺失字段推断', () => {
  assert.equal(formatYear(742, 'approx'), '约 742 年');
  assert.equal(formatYear(-551, 'disputed'), '前 551 年（异说）');
  assert.equal(
    formatLifeRange({ birth: 701, birthAccuracy: 'exact', death: 762, deathAccuracy: 'exact' }),
    '701—762 年',
  );
  assert.equal(
    formatEventRange({ year: 755, yearAccuracy: 'exact', endYear: 763, endYearAccuracy: 'exact' }),
    '755—763 年',
  );
  assert.equal(formatEventRange({ yearAccuracy: 'unknown' }), '年份待考');
});
