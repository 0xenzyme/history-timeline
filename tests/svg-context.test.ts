import assert from 'node:assert/strict';
import test from 'node:test';

import { SvgContext, renderToSvgMarkup } from '../src/app/svg-context';

const measure = (text: string): number => text.length * 5;

function context(): SvgContext {
  return new SvgContext(measure);
}

test('fillRect 输出带填充色的 rect', () => {
  const svg = context();
  svg.fillStyle = '#ff0000';
  svg.fillRect(1, 2, 30, 40);
  const markup = svg.toMarkup(100, 50);
  assert.match(markup, /<rect x="1" y="2" width="30" height="40"[^>]*fill="#ff0000"/);
});

test('fillText 转义文本并映射对齐与基线', () => {
  const svg = context();
  svg.font = 'bold 11px "PingFang SC",sans-serif';
  svg.textAlign = 'center';
  svg.textBaseline = 'middle';
  svg.fillText(`<a &'">`, 10, 20);
  const markup = svg.toMarkup(100, 50);
  assert.ok(markup.includes('&lt;a &amp;&#39;&quot;&gt;'));
  assert.ok(markup.includes('font-weight="bold"'));
  assert.ok(markup.includes('text-anchor="middle"'));
  assert.ok(markup.includes('dominant-baseline="central"'));
  assert.ok(markup.includes('font-family="&quot;PingFang SC&quot;,sans-serif"'));
});

test('measureText 使用注入的测量器', () => {
  const svg = context();
  assert.equal(svg.measureText('abcd').width, 20);
});

test('save/restore 恢复变换与样式', () => {
  const svg = context();
  svg.save();
  svg.translate(0, 30);
  svg.fillStyle = '#00ff00';
  svg.fillRect(0, 0, 10, 10);
  svg.restore();
  svg.fillRect(0, 0, 10, 10);
  const markup = svg.toMarkup(100, 50);
  assert.ok(markup.includes('transform="translate(0,30)"'), '平移期间的元素带变换');
  const rects = markup.match(/<rect[^>]*>/g) ?? [];
  assert.equal(rects.length, 2);
  assert.ok(!rects[1].includes('transform'), 'restore 之后不再带变换');
  assert.ok(rects[1].includes('fill="#000000"'), 'restore 恢复默认填充色');
});

test('clip 生成 clipPath，并把后续元素包进裁剪组', () => {
  const svg = context();
  svg.save();
  svg.beginPath();
  svg.rect(0, 10, 100, 40);
  svg.clip();
  svg.translate(0, -5);
  svg.fillRect(0, 0, 8, 8);
  svg.restore();
  svg.fillRect(50, 20, 8, 8);
  const markup = svg.toMarkup(100, 50);
  assert.match(
    markup,
    /<clipPath id="ht-clip-1" clipPathUnits="userSpaceOnUse"><path d="M0 10h100v40h-100Z"\/><\/clipPath>/,
  );
  assert.match(markup, /<g clip-path="url\(#ht-clip-1\)"><rect[^>]*transform="translate\(0,-5\)"[^>]*\/><\/g>/);
});

test('stroke 输出虚线与线宽', () => {
  const svg = context();
  svg.strokeStyle = '#123456';
  svg.lineWidth = 1.5;
  svg.setLineDash([4, 3]);
  svg.beginPath();
  svg.moveTo(0, 0);
  svg.lineTo(10, 0);
  svg.stroke();
  const markup = svg.toMarkup(100, 50);
  assert.ok(markup.includes('stroke="#123456"'));
  assert.ok(markup.includes('stroke-width="1.5"'));
  assert.ok(markup.includes('stroke-dasharray="4 3"'));
  assert.ok(markup.includes('d="M0 0L10 0"'));
});

test('线性渐变进入 defs，并以 url 引用', () => {
  const svg = context();
  const gradient = svg.createLinearGradient(0, 0, 0, 100);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, '#ff0000');
  svg.fillStyle = gradient;
  svg.fillRect(0, 0, 10, 100);
  const markup = svg.toMarkup(100, 100);
  assert.match(markup, /<linearGradient id="ht-grad-1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">/);
  assert.ok(markup.includes('<stop offset="1" stop-color="#ff0000"/>'));
  assert.ok(markup.includes('fill="url(#ht-grad-1)"'));
});

test('shadowBlur 生成 feDropShadow 滤镜', () => {
  const svg = context();
  svg.shadowColor = '#b0442f';
  svg.shadowBlur = 8;
  svg.fillStyle = '#b0442f';
  svg.fillRect(0, 0, 5, 5);
  const markup = svg.toMarkup(100, 50);
  assert.ok(markup.includes('<feDropShadow'));
  assert.ok(markup.includes('stdDeviation="4"'));
  assert.ok(markup.includes('filter="url(#ht-glow-1)"'));
});

test('roundRect 输出圆角路径', () => {
  const svg = context();
  svg.beginPath();
  svg.roundRect(0, 0, 20, 10, 3);
  svg.fill();
  const markup = svg.toMarkup(100, 50);
  assert.match(markup, /d="M3 0H17A3 3 0 0 1 20 3V7A3 3 0 0 1 17 10H3A3 3 0 0 1 0 7V3A3 3 0 0 1 3 0Z"/);
});

test('globalAlpha 输出为 opacity', () => {
  const svg = context();
  svg.globalAlpha = 0.15;
  svg.fillRect(0, 0, 5, 5);
  assert.ok(svg.toMarkup(10, 10).includes('opacity="0.15"'));
});

test('renderToSvgMarkup 铺背景并输出完整 SVG 文档', () => {
  const markup = renderToSvgMarkup(
    (c) => {
      c.fillStyle = '#00ff00';
      c.fillRect(2, 2, 4, 4);
    },
    100,
    50,
    '#fafafa',
    measure,
  );
  assert.ok(markup.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(markup.includes('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">'));
  assert.ok(markup.includes('fill="#fafafa"'), '先铺一层 paper 背景');
  assert.ok(markup.includes('fill="#00ff00"'));
  assert.ok(markup.trimEnd().endsWith('</svg>'));
});
