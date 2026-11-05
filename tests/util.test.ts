import assert from 'node:assert/strict';
import test from 'node:test';

import { esc, fmtYear, pickStep } from '../src/app/util';

test('esc 转义 HTML 特殊字符，包括单引号', () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('esc 对非字符串输入先转字符串', () => {
  assert.equal(esc(42), '42');
  assert.equal(esc(null), 'null');
});

test('esc 保持普通中日韩文本不变', () => {
  assert.equal(esc('汉武帝 · 前156—前87'), '汉武帝 · 前156—前87');
});

test('fmtYear 把负数年份写成公元前', () => {
  assert.equal(fmtYear(-2070), '前2070');
  assert.equal(fmtYear(1949), '1949');
});

test('pickStep 返回 1/2/5 进制步长', () => {
  assert.equal(pickStep(3), 5);
  assert.equal(pickStep(120), 200);
  assert.equal(pickStep(5000), 1000);
});
