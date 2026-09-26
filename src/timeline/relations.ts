import type { RenderContext } from './context';
import { activeId } from './context';
import { relationAnchorYear } from './geometry';
import { clamp, esc, round } from './svg';

export function renderRelations(ctx: RenderContext): string {
  const { topic, layout, x } = ctx;
  const byId = new Map(topic.people.map((p) => [p.id, p]));
  const types = new Map(topic.relationTypes.map((t) => [t.id, t]));
  const hot = activeId(ctx);
  const pairSeen = new Map<string, number>();
  const markerTypes = new Set<string>();
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

    const overlapMid = relationAnchorYear(a, b, rel.since, layout.topicFrom, layout.topicTo);

    const pairKey = [a.id, b.id].sort().join('|');
    const index = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, index + 1);
    const shift = index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2) * 26;

    const px =
      x(clamp(overlapMid, layout.topicFrom, layout.topicTo)) +
      clamp(shift, layout.plotLeft + 8 - x(overlapMid), layout.plotRight - 8 - x(overlapMid));
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
    const directed = type?.directed === true;
    if (directed) markerTypes.add(rel.type);
    if (touches) {
      // 白色 halo 垫底，让高亮线从底图里浮出来
      parts.push(
        `<path d="${d}" fill="none" stroke="#fffdf9" stroke-width="5.5" stroke-linecap="round" opacity="0.9" />`,
      );
      parts.push(
        `<path class="relation" data-relation="${esc(a.id)}|${esc(b.id)}" d="${d}" stroke="${esc(color)}"${dash}${directed ? ` marker-end="url(#timeline-arrow-${esc(rel.type)})"` : ''} stroke-width="2.2" opacity="1" />`,
      );
      parts.push(
        `<circle class="relation-cap" cx="${round(px)}" cy="${round(y1)}" r="2.4" fill="${esc(color)}" stroke="#fffdf9" stroke-width="1.2" />`,
        `<circle class="relation-cap" cx="${round(px)}" cy="${round(y2)}" r="2.4" fill="${esc(color)}" stroke="#fffdf9" stroke-width="1.2" />`,
      );
      continue;
    }

    if (!ctx.showAllRelations) continue;
    const marker = directed ? ` marker-end="url(#timeline-arrow-${esc(rel.type)})"` : '';
    parts.push(
      `<path class="relation" data-relation="${esc(a.id)}|${esc(b.id)}" d="${d}" stroke="${esc(color)}"${dash}${marker} opacity="0.35" />`,
    );
  }
  const markers = [...markerTypes]
    .map((typeId) => {
      const color = types.get(typeId)?.color ?? '#8a8f98';
      return `<marker id="timeline-arrow-${esc(typeId)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="${esc(color)}" /></marker>`;
    })
    .join('');
  return `<defs>${markers}</defs>${parts.join('')}`;
}
