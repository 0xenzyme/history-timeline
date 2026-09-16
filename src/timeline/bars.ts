import type { RenderContext } from './context';
import { opacityOf } from './context';
import { barGeom, barStops } from './geometry';
import { BAR_H, ROW_H } from './layout';
import { esc, round } from './svg';

export function renderBarDefs(ctx: RenderContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const person of ctx.topic.people) {
    if (!ctx.zonePeople.has(person.id)) continue;
    const row = layout.rows.get(person.id);
    if (!row) continue;
    const geom = barGeom(person, x, layout.plotLeft, layout.plotRight);
    if (geom.markerOnly) continue;
    const stops = barStops(geom)
      .map(
        (stop) =>
          `<stop offset="${round(stop.offset)}" stop-color="${esc(row.lane.color)}" stop-opacity="${round(stop.opacity)}" />`,
      )
      .join('');
    parts.push(
      `<linearGradient id="bar-${esc(person.id)}" gradientUnits="userSpaceOnUse" x1="${round(geom.x1)}" y1="0" x2="${round(geom.x2)}" y2="0">${stops}</linearGradient>`,
    );
  }
  return parts.join('');
}

export function renderHitAreas(ctx: RenderContext): string {
  const { layout } = ctx;
  const width = layout.plotRight - layout.plotLeft;
  const parts: string[] = [];
  for (const person of ctx.topic.people) {
    const row = layout.rows.get(person.id);
    if (!row || !ctx.zonePeople.has(person.id)) continue;
    parts.push(
      `<rect class="hit" data-person="${esc(person.id)}" x="${round(layout.plotLeft)}" y="${round(row.y - ROW_H / 2)}" width="${round(width)}" height="${ROW_H}" />`,
    );
  }
  return parts.join('');
}

export function renderBars(ctx: RenderContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];
  for (const person of ctx.topic.people) {
    const row = layout.rows.get(person.id);
    if (!row || !ctx.zonePeople.has(person.id)) continue;
    const geom = barGeom(person, x, layout.plotLeft, layout.plotRight);
    const opacity = round(opacityOf(ctx, person.id));
    const hot = ctx.hoverId === person.id || ctx.focusId === person.id;
    const cls = `bar${hot ? ' is-hot' : ''}`;

    if (geom.markerOnly) {
      const cx = geom.x1 + 6;
      parts.push(
        `<polygon class="${cls}" points="${round(cx)},${round(row.y - 7)} ${round(cx + 6)},${round(row.y)} ${round(cx)},${round(row.y + 7)} ${round(cx - 6)},${round(row.y)}" fill="${esc(row.lane.color)}" opacity="${opacity}" />`,
      );
      continue;
    }

    const height = hot ? BAR_H + 5 : BAR_H;
    parts.push(
      `<rect class="${cls}" x="${round(geom.x1)}" y="${round(row.y - height / 2)}" width="${round(geom.width)}" height="${height}" rx="${hot ? 3 : 2}" fill="url(#bar-${esc(person.id)})" opacity="${opacity}" />`,
    );

    if (geom.leftOpen) {
      parts.push(
        `<polyline class="bar-open" points="${round(geom.x1 + 7)},${round(row.y - 5)} ${round(geom.x1 + 1)},${round(row.y)} ${round(geom.x1 + 7)},${round(row.y + 5)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
      );
    }
    if (geom.rightOpen) {
      parts.push(
        `<polyline class="bar-open" points="${round(geom.x2 - 7)},${round(row.y - 5)} ${round(geom.x2 - 1)},${round(row.y)} ${round(geom.x2 - 7)},${round(row.y + 5)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
      );
    }
  }
  return parts.join('');
}
