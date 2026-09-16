import type { RenderContext } from './context';
import { activeId } from './context';
import { nominalRange } from './geometry';
import { clamp, esc, round } from './svg';

export function renderRelations(ctx: RenderContext): string {
  const { topic, layout, x } = ctx;
  const byId = new Map(topic.people.map((p) => [p.id, p]));
  const types = new Map(topic.relationTypes.map((t) => [t.id, t]));
  const hot = activeId(ctx);
  const pairSeen = new Map<string, number>();
  const parts: string[] = [];

  for (const rel of topic.relations) {
    const a = byId.get(rel.source);
    const b = byId.get(rel.target);
    if (!a || !b) continue;
    if (!ctx.zonePeople.has(a.id) || !ctx.zonePeople.has(b.id)) continue;
    const rowA = layout.rows.get(a.id);
    const rowB = layout.rows.get(b.id);
    if (!rowA || !rowB) continue;

    const touches = hot !== null && (a.id === hot || b.id === hot);
    if (!ctx.showAllRelations && !touches) continue;

    const [aStart, aEnd] = nominalRange(a, layout.topicFrom, layout.topicTo);
    const [bStart, bEnd] = nominalRange(b, layout.topicFrom, layout.topicTo);
    const overlapMid = (Math.max(aStart, bStart) + Math.min(aEnd, bEnd)) / 2;

    const pairKey = [a.id, b.id].sort().join('|');
    const index = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, index + 1);
    const shift = index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2) * 26;

    const px = x(clamp(overlapMid, layout.topicFrom, layout.topicTo)) + shift;
    const y1 = rowA.y;
    const y2 = rowB.y;
    const dy = Math.abs(y2 - y1);
    const bulge = Math.min(56, 16 + dy * 0.55);

    const d =
      y2 >= y1
        ? `M ${round(px)} ${round(y1)} C ${round(px + bulge)} ${round(y1 + dy * 0.4)}, ${round(px - bulge)} ${round(y2 - dy * 0.4)}, ${round(px)} ${round(y2)}`
        : `M ${round(px)} ${round(y1)} C ${round(px - bulge)} ${round(y1 - dy * 0.4)}, ${round(px + bulge)} ${round(y2 + dy * 0.4)}, ${round(px)} ${round(y2)}`;

    const type = types.get(rel.type);
    const color = type?.color ?? '#8a8f98';
    const dash = type?.dash ? ` stroke-dasharray="${esc(type.dash)}"` : '';
    const opacity = hot === null ? 0.45 : touches ? 0.95 : 0.08;

    parts.push(
      `<path class="relation" data-relation="${esc(a.id)}|${esc(b.id)}" d="${d}" stroke="${esc(color)}"${dash} opacity="${round(opacity)}" />`,
    );

    if (touches) {
      parts.push(
        `<circle class="relation-cap" cx="${round(px)}" cy="${round(y1)}" r="2.8" fill="${esc(color)}" />`,
        `<circle class="relation-cap" cx="${round(px)}" cy="${round(y2)}" r="2.8" fill="${esc(color)}" />`,
      );
    }
  }
  return parts.join('');
}
