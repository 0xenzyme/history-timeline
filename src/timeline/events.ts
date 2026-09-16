import type { RenderContext } from './context';
import { AXIS_H, EVENT_BAND_H } from './layout';
import { esc, round } from './svg';

const LABEL_CHAR_W = 12.6;
const LABEL_ROWS = 4;
const LABEL_GAP = 10;
/** 放不下时不画文字，只画标记 */
export const NO_LABEL = -1;

function labelWidth(name: string): number {
  return name.length * LABEL_CHAR_W + 14;
}

function rowY(row: number): number {
  return AXIS_H + 14 + row * 15;
}

interface LabelItem {
  id: string;
  name: string;
  span: boolean;
  x1: number;
  x2: number;
  start: number;
  width: number;
}

export function assignEventRows(
  ctx: Pick<RenderContext, 'topic' | 'x' | 'zoneEvents'>,
): Map<string, number> {
  const items: LabelItem[] = ctx.topic.events
    .filter((event) => ctx.zoneEvents.has(event.id))
    .map((event) => {
      const x1 = ctx.x(event.year);
      const x2 =
        event.kind === 'span' && event.endYear !== undefined ? ctx.x(event.endYear) : x1;
      const width = labelWidth(event.name);
      const start = event.kind === 'span' ? (x1 + x2) / 2 - width / 2 : x1;
      return { id: event.id, name: event.name, span: event.kind === 'span', x1, x2, start, width };
    })
    .sort((a, b) => a.start - b.start);

  const rowEdges: number[] = [];
  const result = new Map<string, number>();

  for (const item of items) {
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
  const parts: string[] = [];
  for (const event of ctx.topic.events) {
    if (!ctx.zoneEvents.has(event.id)) continue;
    const row = ctx.eventRows.get(event.id) ?? NO_LABEL;
    if (row === NO_LABEL) continue;
    const x1 = ctx.x(event.year);
    const y = rowY(row);
    const width = labelWidth(event.name);
    let anchorX = x1;
    let textAnchor = 'start';
    if (event.kind === 'span' && event.endYear !== undefined) {
      const x2 = ctx.x(event.endYear);
      anchorX = (x1 + x2) / 2;
      textAnchor = 'middle';
    }
    const boxX = textAnchor === 'middle' ? anchorX - width / 2 : anchorX;
    parts.push(
      `<rect class="event-label-bg" x="${round(boxX)}" y="${round(y - 11)}" width="${round(width)}" height="15" rx="3" />`,
    );
    parts.push(
      `<text class="event-label" x="${round(textAnchor === 'middle' ? anchorX : anchorX + 2)}" y="${round(y)}" text-anchor="${textAnchor}">${esc(event.name)}</text>`,
    );
  }
  return parts.join('');
}
