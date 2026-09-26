import type { RenderContext } from './context';
import { opacityOf } from './context';
import { barGeom, barStops } from './geometry';
import { esc, round, shade } from './svg';

export function renderBarDefs(ctx: RenderContext): string {
  const { layout, x } = ctx;
  const parts: string[] = [];

  const zoneLanes = new Map<string, string>();
  for (const person of ctx.topic.people) {
    const row = layout.rows.get(person.id);
    if (!row || !ctx.zonePeople.has(person.id)) continue;
    zoneLanes.set(row.lane.id, row.lane.color);
  }
  for (const [laneId, color] of zoneLanes) {
    parts.push(
      `<pattern id="bar-hatch-${esc(laneId)}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="${esc(color)}" opacity="0.5" /></pattern>`,
    );
  }

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
    const lifeLabel = `${person.birth !== undefined ? person.birth : '生年不详'}至${person.death !== undefined ? person.death : '卒年不详'}`;
    const ariaLabel = `${person.display}，${lifeLabel}`;
    parts.push(
      `<rect class="hit" data-person="${esc(person.id)}" x="${round(layout.plotLeft)}" y="${round(row.y - layout.rowH / 2)}" width="${round(width)}" height="${round(layout.rowH)}" tabindex="0" role="button" aria-label="${esc(ariaLabel)}"><title>查看${esc(person.display)}详情</title></rect>`,
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
    const stroke = shade(row.lane.color, 0.68);

    if (geom.markerOnly) {
      if (geom.x1 < layout.plotLeft || geom.x1 > layout.plotRight) continue;
      const cx = geom.x1;
      parts.push(
        `<polygon class="${cls}" points="${round(cx)},${round(row.y - 7)} ${round(cx + 6)},${round(row.y)} ${round(cx)},${round(row.y + 7)} ${round(cx - 6)},${round(row.y)}" fill="${esc(row.lane.color)}" stroke="${esc(stroke)}" stroke-width="1" opacity="${opacity}" />`,
      );
      if (geom.leftOpen) {
        parts.push(
          `<polyline class="bar-open" points="${round(cx - 9)},${round(row.y - 5)} ${round(cx - 14)},${round(row.y)} ${round(cx - 9)},${round(row.y + 5)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
        );
      }
      if (geom.rightOpen) {
        parts.push(
          `<polyline class="bar-open" points="${round(cx + 9)},${round(row.y - 5)} ${round(cx + 14)},${round(row.y)} ${round(cx + 9)},${round(row.y + 5)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
        );
      }
      continue;
    }

    const height = hot ? layout.barH + 5 : layout.barH;
    parts.push(
      `<rect class="${cls}" x="${round(geom.x1)}" y="${round(row.y - height / 2)}" width="${round(geom.width)}" height="${height}" rx="${hot ? 3.5 : 2.5}" fill="url(#bar-${esc(person.id)})" stroke="${esc(stroke)}" stroke-width="1" opacity="${opacity}" />`,
    );

    if (geom.leftKind === 'approx') {
      parts.push(
        `<rect class="bar-fade" x="${round(geom.x1 + 0.5)}" y="${round(row.y - height / 2 + 0.5)}" width="${round(geom.leftFade)}" height="${round(height - 1)}" fill="url(#bar-hatch-${esc(row.lane.id)})" opacity="${opacity}" />`,
      );
    }
    if (geom.rightKind === 'approx') {
      parts.push(
        `<rect class="bar-fade" x="${round(geom.x2 - geom.rightFade)}" y="${round(row.y - height / 2 + 0.5)}" width="${round(geom.rightFade)}" height="${round(height - 1)}" fill="url(#bar-hatch-${esc(row.lane.id)})" opacity="${opacity}" />`,
      );
    }

    if (geom.leftOpen) {
      parts.push(
        `<polyline class="bar-open" points="${round(geom.x1 + 7)},${round(row.y - 6)} ${round(geom.x1 + 1)},${round(row.y)} ${round(geom.x1 + 7)},${round(row.y + 6)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
      );
    }
    if (geom.rightOpen) {
      parts.push(
        `<polyline class="bar-open" points="${round(geom.x2 - 7)},${round(row.y - 6)} ${round(geom.x2 - 1)},${round(row.y)} ${round(geom.x2 - 7)},${round(row.y + 6)}" stroke="${esc(row.lane.color)}" opacity="${opacity}" />`,
      );
    }
  }
  return parts.join('');
}
