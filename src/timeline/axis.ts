import { formatYearShort } from '../format';
import type { RenderContext } from './context';
import { AXIS_H } from './layout';
import { round } from './svg';

const STEPS = [5, 10, 20, 25, 50, 100, 200, 500, 1000];

export function tickYears(domain: [number, number]): number[] {
  const span = domain[1] - domain[0];
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

export function renderAxisTicks(ctx: RenderContext): string {
  const { x, layout } = ctx;
  const parts: string[] = [];
  const labelY = AXIS_H - 13;
  for (const year of tickYears(ctx.domain)) {
    const px = round(x(year));
    parts.push(`<line class="axis-tick" x1="${px}" y1="${AXIS_H - 7}" x2="${px}" y2="${AXIS_H}" />`);
    parts.push(
      `<text class="axis-label" x="${px}" y="${labelY}" text-anchor="middle">${formatYearShort(year)}</text>`,
    );
  }
  parts.push(
    `<line class="axis-base" x1="${round(layout.plotLeft)}" y1="${AXIS_H}" x2="${round(layout.plotRight)}" y2="${AXIS_H}" />`,
  );
  const span = ctx.domain[1] - ctx.domain[0];
  const hint = span < 0.5 ? '不足一年' : `${Math.round(span)} 年跨度`;
  parts.push(
    `<text class="axis-span" x="${round(layout.plotRight)}" y="${round(layout.plotBottom + 16)}" text-anchor="end">视野 ${hint}</text>`,
  );
  return parts.join('');
}
