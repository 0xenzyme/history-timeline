import type { EventRecord } from '../types';
import { opacityOfEvent, type EventLineContext } from './context';
import { EVENT_SPAN_H, ROW_GAP, SHADOW_BAR_H, type EventLayout, type EventTypeRow } from './layout';
import { clamp, esc, round } from './svg';

/** importance 1 / 2 / 3 对应的菱形半径 */
const MARK_R = [3.4, 4.4, 5.6];
const LABEL_CHAR_W = 12.6;
const LABEL_GAP = 10;

function markRadius(event: EventRecord): number {
  return MARK_R[event.importance - 1] ?? MARK_R[0];
}

function labelWidth(name: string): number {
  return name.length * LABEL_CHAR_W + 4;
}

/** 行底色 + 行顶分隔线。颜色内联，导出时不会丢。 */
export function renderTypeRows(ctx: EventLineContext): string {
  const { layout } = ctx;
  const width = round(layout.plotRight - layout.plotLeft);
  const parts: string[] = [];
  for (const row of layout.typeRows) {
    parts.push(
      `<rect class="ev-row-bg" x="${layout.plotLeft}" y="${round(row.top)}" width="${width}" height="${round(row.bottom - row.top)}" fill="${row.color}" />`,
    );
    parts.push(
      `<line class="ev-row-sep" x1="${layout.plotLeft}" y1="${round(row.top)}" x2="${layout.plotRight}" y2="${round(row.top)}" />`,
    );
  }
  if (layout.typeRows.length > 0) {
    const last = layout.typeRows[layout.typeRows.length - 1];
    parts.push(
      `<line class="ev-row-sep" x1="${layout.plotLeft}" y1="${round(last.bottom)}" x2="${layout.plotRight}" y2="${round(last.bottom)}" />`,
    );
  }
  return parts.join('');
}

/** 战争（scale=war）在军事行内画成整行高的背景带。 */
export function renderWarBands(ctx: EventLineContext): string {
  const { layout, x } = ctx;
  const military = layout.typeRows.find((row) => row.id === 'military');
  if (!military) return '';
  const parts: string[] = [];
  for (const event of military.events) {
    if (event.scale !== 'war' || !ctx.zoneEvents.has(event.id)) continue;
    const x1 = clamp(x(event.year), layout.plotLeft, layout.plotRight);
    const x2 = clamp(x(event.endYear ?? event.year), layout.plotLeft, layout.plotRight);
    if (x2 - x1 < 1) continue;
    const opacity = opacityOfEvent(ctx, event.id);
    parts.push(
      `<rect class="ev-war-band" x="${round(x1)}" y="${round(military.top)}" width="${round(x2 - x1)}" height="${round(military.bottom - military.top)}" fill="${military.color}" opacity="${round(opacity * 0.16)}" />`,
    );
    const mid = (x1 + x2) / 2;
    parts.push(
      `<text class="ev-war-label" x="${round(mid)}" y="${round(military.top + 13)}" text-anchor="middle" fill="${military.color}" opacity="${round(opacity)}">${esc(event.display)}</text>`,
    );
  }
  return parts.join('');
}

/** 命中区：整行高，宽度覆盖事件标记。带 data-event 供点击与键盘聚焦。 */
export function renderEventHits(ctx: EventLineContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const row of layout.typeRows) {
    for (const event of row.events) {
      if (!ctx.zoneEvents.has(event.id)) continue;
      const px = clamp(x(event.year), layout.plotLeft, layout.plotRight);
      const half = Math.max(8, markRadius(event) + 4);
      parts.push(
        `<rect class="ev-hit" data-event="${esc(event.id)}" tabindex="0" role="button" aria-label="${esc(event.name)}" x="${round(px - half)}" y="${round(row.top)}" width="${round(half * 2)}" height="${round(row.bottom - row.top)}" />`,
      );
    }
  }
  return parts.join('');
}

/** 事件本体：point 画菱形，span 画胶囊。 */
export function renderEventMarks(ctx: EventLineContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const row of layout.typeRows) {
    for (const event of row.events) {
      if (!ctx.zoneEvents.has(event.id)) continue;
      const opacity = opacityOfEvent(ctx, event.id);
      if (event.kind === 'span' && event.endYear !== undefined) {
        const x1 = clamp(x(event.year), layout.plotLeft, layout.plotRight);
        const x2 = clamp(x(event.endYear), layout.plotLeft, layout.plotRight);
        if (x2 - x1 < 1) continue;
        parts.push(
          `<rect class="ev-span" x="${round(x1)}" y="${round(row.y - EVENT_SPAN_H / 2)}" width="${round(Math.max(x2 - x1, 3))}" height="${EVENT_SPAN_H}" rx="${EVENT_SPAN_H / 2}" fill="${row.color}" opacity="${round(opacity)}" />`,
        );
        continue;
      }
      const r = markRadius(event);
      const px = clamp(x(event.year), layout.plotLeft, layout.plotRight);
      const cy = round(row.y);
      parts.push(
        `<polygon class="ev-mark" points="${round(px)},${round(row.y - r)} ${round(px + r)},${cy} ${round(px)},${round(row.y + r)} ${round(px - r)},${cy}" fill="${row.color}" opacity="${round(opacity)}" />`,
      );
    }
  }
  return parts.join('');
}

interface LabelBox {
  id: string;
  name: string;
  row: EventTypeRow;
  anchor: number;
  start: number;
  width: number;
}

/** 行内标签避让：优先放右侧，放不下翻到左侧，都放不下就不画。 */
function packRowLabels(
  row: EventTypeRow,
  events: EventRecord[],
  layout: EventLayout,
  x: (year: number) => number,
): LabelBox[] {
  const boxes: LabelBox[] = [];
  let lastRight = Number.NEGATIVE_INFINITY;

  for (const event of [...events].sort((left, right) => left.year - right.year)) {
    const anchor = clamp(x(event.year), layout.plotLeft, layout.plotRight);
    const width = Math.min(labelWidth(event.display), layout.plotRight - layout.plotLeft);
    const r = event.kind === 'span' ? EVENT_SPAN_H / 2 : markRadius(event);
    const right = anchor + r + 5;
    const left = anchor - r - 5 - width;
    let start = Number.NaN;
    if (right + width <= layout.plotRight && right >= lastRight + LABEL_GAP) start = right;
    else if (left >= layout.plotLeft && left + width + LABEL_GAP <= lastRight) start = left;
    if (Number.isNaN(start)) continue;
    boxes.push({ id: event.id, name: event.display, row, anchor, start, width });
    lastRight = start + width;
  }
  return boxes;
}

/** 事件线的行内标签。与人物线顶部带的那套（events.ts）不同，故另起名。 */
export function renderLineLabels(ctx: EventLineContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  let hidden = 0;
  let lastBottom = Number.NEGATIVE_INFINITY;

  for (const row of layout.typeRows) {
    const events = row.events.filter((event) => ctx.zoneEvents.has(event.id));
    const boxes = packRowLabels(row, events, layout, x);
    const seen = new Set(boxes.map((box) => box.id));
    for (const event of events) {
      if (!seen.has(event.id)) hidden += 1;
    }
    for (const box of boxes) {
      const opacity = opacityOfEvent(ctx, box.id);
      lastBottom = Math.max(lastBottom, box.start + box.width);
      parts.push(
        `<text class="ev-label" x="${round(box.start)}" y="${round(row.y + 4)}" fill="${box.row.color}" opacity="${round(opacity)}">${esc(box.name)}</text>`,
      );
    }
  }

  if (hidden > 0 && layout.plotRight - lastBottom > 40) {
    parts.push(
      `<text class="ev-more" x="${round(layout.plotRight)}" y="${round(layout.plotTop + 14)}" text-anchor="end">+${hidden}</text>`,
    );
  }
  return parts.join('');
}

/** 军事轴背景上的人物影子条。生卒不全的画菱形。 */
export function renderShadowBars(ctx: EventLineContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const shadow of layout.shadows) {
    const { ref, y } = shadow;
    const hasBirth = ref.birth !== undefined;
    const hasDeath = ref.death !== undefined;
    if (!hasBirth && !hasDeath) continue;
    const attrs = `data-person="${esc(ref.id)}" data-person-topic="${esc(ref.topicId)}"`;
    if (!hasBirth || !hasDeath) {
      const px = clamp(x(hasBirth ? ref.birth! : ref.death!), layout.plotLeft, layout.plotRight);
      parts.push(
        `<polygon class="ev-shadow-mark" ${attrs} points="${round(px)},${round(y - 3.5)} ${round(px + 3.5)},${round(y)} ${round(px)},${round(y + 3.5)} ${round(px - 3.5)},${round(y)}" />`,
      );
      parts.push(
        `<text class="ev-shadow-name" x="${round(px + 7)}" y="${round(y + 3.5)}">${esc(ref.display)}</text>`,
      );
      continue;
    }
    const x1 = clamp(x(ref.birth!), layout.plotLeft, layout.plotRight);
    const x2 = clamp(x(ref.death!), layout.plotLeft, layout.plotRight);
    if (x2 - x1 < 1) continue;
    parts.push(
      `<rect class="ev-shadow" ${attrs} x="${round(x1)}" y="${round(y - SHADOW_BAR_H / 2)}" width="${round(x2 - x1)}" height="${SHADOW_BAR_H}" rx="2" />`,
    );
    parts.push(
      `<text class="ev-shadow-name" x="${round(x2 + 6)}" y="${round(y + 3.5)}">${esc(ref.display)}</text>`,
    );
  }
  return parts.join('');
}

/** 左侧行名栏，与人物线的 gutter 位置一致。 */
export function renderTypeGutter(ctx: EventLineContext): string {
  const { layout } = ctx;
  const parts: string[] = [];
  for (const row of layout.typeRows) {
    parts.push(
      `<rect class="ev-gutter-bar" x="${layout.plotLeft - 5}" y="${round(row.top)}" width="3" height="${round(row.bottom - row.top)}" fill="${row.color}" />`,
    );
    parts.push(
      `<text class="ev-row-name" x="${layout.plotLeft - 14}" y="${round(row.y + 4)}" text-anchor="end" fill="${row.color}">${esc(row.name)}</text>`,
    );
  }
  if (layout.shadows.length > 0) {
    const top = layout.shadows[0].y - layout.plotTop;
    parts.push(
      `<text class="ev-row-name" x="${layout.plotLeft - 14}" y="${round(layout.plotTop + top / 2 + 4)}" text-anchor="end">参战人物</text>`,
    );
  }
  return parts.join('');
}

/** 筛选后或本段没有事件时的空态。 */
export function renderEventEmpty(ctx: EventLineContext): string {
  if (ctx.layout.visibleCount > 0) return '';
  const { layout } = ctx;
  const mid = (layout.plotLeft + layout.plotRight) / 2;
  const y = layout.plotTop + ROW_GAP + 24;
  return `<text class="ev-empty" x="${round(mid)}" y="${round(y)}" text-anchor="middle">本段暂无事件</text>`;
}
