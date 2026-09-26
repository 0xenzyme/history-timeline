import type { RenderContext } from './context';
import { AXIS_H, EVENT_BAND_H } from './layout';
import { clamp, esc, round } from './svg';

const LABEL_CHAR_W = 12.6;
const LABEL_ROWS = 3;
const LABEL_GAP = 12;
const ROW_STEP = 14;
/** 事件标记的顶端，标签引导线画到这一高度 */
const PIN_TOP = AXIS_H + EVENT_BAND_H - 11;
/** 放不下时不画文字，只画标记 */
export const NO_LABEL = -1;

function labelWidth(name: string): number {
  return name.length * LABEL_CHAR_W + 6;
}

/** 标签自下而上排布，row 0 紧贴事件标记 */
function rowY(row: number): number {
  return PIN_TOP - 4 - row * ROW_STEP;
}

interface LabelItem {
  id: string;
  name: string;
  span: boolean;
  /** 事件在时间轴上的锚点，引导线画在这里 */
  anchor: number;
  /** 文字盒子的左边界 */
  start: number;
  width: number;
}

type LabelCtx = Pick<RenderContext, 'topic' | 'x' | 'zoneEvents' | 'layout'>;

function labelItems(ctx: LabelCtx): LabelItem[] {
  const { layout, x } = ctx;
  const items: LabelItem[] = [];

  for (const event of ctx.topic.events) {
    if (!ctx.zoneEvents.has(event.id)) continue;
    const rawX1 = x(event.year);
    const x1 = clamp(rawX1, layout.plotLeft, layout.plotRight);
    const x2 =
      event.kind === 'span' && event.endYear !== undefined
        ? clamp(x(event.endYear), layout.plotLeft, layout.plotRight)
        : x1;
    const width = Math.min(labelWidth(event.name), layout.plotRight - layout.plotLeft);

    if (event.kind === 'span') {
      const mid = (x1 + x2) / 2;
      const start = clamp(mid - width / 2, layout.plotLeft, layout.plotRight - width);
      items.push({ id: event.id, name: event.name, span: true, anchor: mid, start, width });
      continue;
    }

    const right = x1 + 5;
    const start = right + width <= layout.plotRight ? right : Math.max(layout.plotLeft, x1 - 5 - width);
    items.push({ id: event.id, name: event.name, span: false, anchor: x1, start, width });
  }

  return items.sort((a, b) => a.start - b.start);
}

export function assignEventRows(ctx: LabelCtx): Map<string, number> {
  const rowEdges: number[] = [];
  const result = new Map<string, number>();

  for (const item of labelItems(ctx)) {
    let placed = NO_LABEL;
    for (let row = 0; row < rowEdges.length; row += 1) {
      if (item.start - rowEdges[row] >= LABEL_GAP) {
        rowEdges[row] = item.start + item.width;
        placed = row;
        break;
      }
    }
    if (placed === NO_LABEL && rowEdges.length < LABEL_ROWS) {
      rowEdges.push(item.start + item.width);
      placed = rowEdges.length - 1;
    }
    result.set(item.id, placed);
  }
  return result;
}

export function renderEventRibbon(ctx: RenderContext): string {
  const { layout } = ctx;
  return `<rect class="event-ribbon" x="${round(layout.plotLeft)}" y="${AXIS_H}" width="${round(layout.plotRight - layout.plotLeft)}" height="${EVENT_BAND_H}" />`;
}

export function renderEventBands(ctx: RenderContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const event of ctx.topic.events) {
    if (event.kind !== 'span' || !ctx.zoneEvents.has(event.id)) continue;
    const x1 = Math.max(layout.plotLeft, x(event.year));
    const x2 = Math.min(layout.plotRight, x(event.endYear ?? event.year));
    if (x2 - x1 < 1) continue;
    parts.push(
      `<rect class="event-band" x="${round(x1)}" y="${round(layout.plotTop)}" width="${round(x2 - x1)}" height="${round(layout.plotBottom - layout.plotTop)}" />`,
    );
  }
  return parts.join('');
}

export function renderEventLines(ctx: RenderContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const event of ctx.topic.events) {
    if (event.kind !== 'point' || !ctx.zoneEvents.has(event.id)) continue;
    const px = round(x(event.year));
    parts.push(
      `<line class="event-line" x1="${px}" y1="${round(layout.plotTop)}" x2="${px}" y2="${round(layout.plotBottom)}" />`,
    );
    parts.push(
      `<polygon class="event-pin" points="${px},${AXIS_H + EVENT_BAND_H - 4} ${round(Number(px) + 4)},${AXIS_H + EVENT_BAND_H - 11} ${round(Number(px) - 4)},${AXIS_H + EVENT_BAND_H - 11}" />`,
    );
  }
  return parts.join('');
}

export function renderEventLabels(ctx: RenderContext): string {
  const { layout } = ctx;
  const items = labelItems(ctx);
  const parts: string[] = [];
  let hidden = 0;

  for (const item of items) {
    const row = ctx.eventRows.get(item.id) ?? NO_LABEL;
    if (row === NO_LABEL) {
      hidden += 1;
      continue;
    }
    const y = rowY(row);
    parts.push(
      `<line class="event-leader" x1="${round(item.anchor)}" y1="${round(y + 3)}" x2="${round(item.anchor)}" y2="${PIN_TOP}" />`,
    );
    parts.push(
      `<text class="event-label" x="${round(item.start)}" y="${round(y)}">${esc(item.name)}</text>`,
    );
  }

  if (hidden > 0 && layout.plotRight - (items.length > 0 ? items[items.length - 1].start : 0) > 40) {
    parts.push(
      `<text class="event-more" x="${round(layout.plotRight)}" y="${round(rowY(0))}" text-anchor="end">+${hidden}</text>`,
    );
  }

  return parts.join('');
}
