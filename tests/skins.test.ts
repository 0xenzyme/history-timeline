import assert from 'node:assert/strict';
import test from 'node:test';

import { SKINS, brighten, invalidatePalette, paletteFor, skinColor } from '../src/app/skins';

interface GlobalStubs {
  document?: unknown;
  getComputedStyle?: unknown;
}

const globals = globalThis as unknown as GlobalStubs;

function stubDom(bodyHasSkin: boolean, variableValue: string): void {
  globals.document = { body: { classList: { contains: () => bodyHasSkin } } };
  globals.getComputedStyle = () => ({ getPropertyValue: () => variableValue });
}

function clearDom(): void {
  delete globals.document;
  delete globals.getComputedStyle;
}

test('body 没有皮肤 class 时 paletteFor 抛错，不画错配色', () => {
  invalidatePalette();
  stubDom(false, '#ffffff');
  try {
    assert.throws(() => paletteFor('voyage'), /skin-voyage/);
  } finally {
    clearDom();
    invalidatePalette();
  }
});

test('styles.css 缺变量时 paletteFor 抛错并列出缺失变量', () => {
  invalidatePalette();
  stubDom(true, '');
  try {
    assert.throws(() => paletteFor('voyage'), /缺少变量/);
    assert.throws(() => paletteFor('voyage'), /--bg/);
  } finally {
    clearDom();
    invalidatePalette();
  }
});

test('变量齐全时 paletteFor 读回全部 token 并带上皮肤的事件透明度', () => {
  invalidatePalette();
  stubDom(true, '#abcdef');
  try {
    const palette = paletteFor('deepspace');
    assert.equal(palette.paper, '#abcdef');
    assert.equal(palette.accent, '#abcdef');
    assert.equal(palette.eventAlpha, SKINS.deepspace.eventAlpha);
    assert.equal(palette.eventAlphaDim, SKINS.deepspace.eventAlphaDim);
  } finally {
    clearDom();
    invalidatePalette();
  }
});

test('巡航皮肤保留原色，深空皮肤把颜色调亮', () => {
  assert.equal(skinColor('voyage', '#b0442f'), '#b0442f');
  const brightened = skinColor('deepspace', '#b0442f');
  assert.notEqual(brightened, '#b0442f');
  assert.match(brightened, /^hsl\(/);
});

test('brighten 对非十六进制输入原样返回', () => {
  assert.equal(brighten('hsl(10, 20%, 30%)'), 'hsl(10, 20%, 30%)');
});
