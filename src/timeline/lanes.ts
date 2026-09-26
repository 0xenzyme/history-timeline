import type { RenderContext } from './context';
import { opacityOf } from './context';
import { LANE_HEAD_H } from './layout';
import { esc, round } from './svg';

export function renderLanes(ctx: RenderContext): string {
  const { layout } = ctx;
  const plotWidth = layout.plotRight - layout.plotLeft;
  const parts: string[] = [];

  for (const box of layout.lanes) {
    const rows = box.rows.filter((row) => ctx.zonePeople.has(row.person.id));
    if (rows.length === 0) continue;
    parts.push(
      `<rect class="lane-bg" x="${round(layout.plotLeft)}" y="${round(box.top)}" width="${round(plotWidth)}" height="${round(box.bottom - box.top)}" fill="${esc(box.lane.color)}" />`,
    );
    parts.push(
      `<line class="lane-sep" x1="${round(layout.plotLeft)}" y1="${round(box.top)}" x2="${round(layout.plotRight)}" y2="${round(box.top)}" />`,
    );
  }
  parts.push(
    `<line class="lane-sep" x1="${round(layout.plotLeft)}" y1="${round(layout.plotBottom)}" x2="${round(layout.plotRight)}" y2="${round(layout.plotBottom)}" />`,
  );
  return parts.join('');
}

export function renderGutter(ctx: RenderContext): string {
  const { layout } = ctx;
  const parts: string[] = [];

  for (const box of layout.lanes) {
    if (!box.rows.some((row) => ctx.zonePeople.has(row.person.id))) continue;
    const headY = box.top + LANE_HEAD_H / 2 + 4;
    parts.push(
      `<rect class="gutter-lane-bar" x="${layout.plotLeft - 5}" y="${round(box.top + 3)}" width="3" height="${round(box.bottom - box.top - 6)}" rx="1.5" fill="${esc(box.lane.color)}" />`,
    );
    parts.push(
      `<text class="gutter-lane" x="8" y="${round(headY)}" fill="${esc(box.lane.color)}">${esc(box.lane.name)}</text>`,
    );
  }

  for (const box of layout.lanes) {
    for (const row of box.rows) {
      if (!ctx.zonePeople.has(row.person.id)) continue;
      const hot = ctx.hoverId === row.person.id || ctx.focusId === row.person.id;
      // 名字是最重要的导航元素，聚焦时其余名字只轻微退后，不降到 bar 的 0.22
      const opacity = hot ? 1 : Math.max(0.62, opacityOf(ctx, row.person.id));
      parts.push(
        `<text class="gutter-name${hot ? ' is-hot' : ''}" data-person="${esc(row.person.id)}" aria-hidden="true" x="${layout.plotLeft - 14}" y="${round(row.y + 4)}" text-anchor="end" opacity="${round(opacity)}">${esc(row.person.display)}</text>`,
      );
    }
  }

  for (const box of layout.lanes) {
    if (!box.rows.some((row) => ctx.zonePeople.has(row.person.id))) continue;
    parts.push(
      `<line class="gutter-sep" x1="${layout.plotLeft}" y1="${round(box.top)}" x2="${layout.plotLeft}" y2="${round(box.bottom)}" />`,
    );
  }
  return parts.join('');
}
