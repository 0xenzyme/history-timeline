import { formatYearShort } from '../format';
import type { RenderContext } from './context';
import { AXIS_H } from './layout';
import { esc, round } from './svg';
import { toAxis } from './years';

const STEPS = [5, 10, 20, 25, 50, 100, 200, 500, 1000];

export function tickYears(domain: [number, number]): number[] {
  const span = toAxis(domain[1]) - toAxis(domain[0]);
  const target = span / 9;
  const step = STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1];
  const years: number[] = [];
  for (let year = Math.ceil(domain[0] / step) * step; year <= domain[1]; year += step) {
    if (year === 0) continue;
    years.push(year);
  }
  return years;
}

export function renderGrid(ctx: RenderContext): string {
  const { x } = ctx;
  const parts: string[] = [];
  for (const year of tickYears(ctx.domain)) {
    const px = round(x(year));
    parts.push(`<line class="gridline" x1="${px}" y1="0" x2="${px}" y2="${ctx.layout.height}" />`);
  }
  parts.push(
    `<line class="gridline-major" x1="${round(ctx.layout.plotLeft)}" y1="0" x2="${round(ctx.layout.plotRight)}" y2="0" />`,
  );
  return parts.join('');
}

export function renderPinnedAxis(ctx: RenderContext, laneName: string): string {
  const { x, layout } = ctx;
  const parts: string[] = [];
  const labelY = AXIS_H - 12;
  if (laneName) {
    parts.push(
      `<text class="axis-lane" x="14" y="${labelY}" text-anchor="start">${esc(laneName)}</text>`,
    );
  }
  for (const year of tickYears(ctx.domain)) {
    const raw = x(year);
    const px = round(raw);
    parts.push(`<line class="axis-tick" x1="${px}" y1="${AXIS_H - 7}" x2="${px}" y2="${AXIS_H}" />`);
    if (raw > layout.plotLeft + 22 && raw < layout.plotRight - 18) {
      parts.push(
        `<text class="axis-label" x="${px}" y="${labelY}" text-anchor="middle">${formatYearShort(year)}</text>`,
      );
    }
  }
  parts.push(
    `<line class="axis-base" x1="${round(layout.plotLeft)}" y1="${AXIS_H - 0.5}" x2="${round(layout.plotRight)}" y2="${AXIS_H - 0.5}" />`,
  );
  return parts.join('');
}
