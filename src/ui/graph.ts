import type { Person, Relation, Topic } from '../types';
import { formatLifespan } from '../format';
import { esc, round } from '../timeline/svg';

interface Neighbor {
  person: Person;
  relations: Relation[];
}

const CENTER_R = 34;
const NODE_R = 24;

export function personRelationCount(topic: Topic, personId: string): number {
  return topic.relations.filter((rel) => rel.source === personId || rel.target === personId).length;
}

export function renderGraph(
  topic: Topic,
  centerId: string,
  width: number,
  height: number,
  hoverId: string | null,
): string {
  const people = new Map(topic.people.map((person) => [person.id, person]));
  const types = new Map(topic.relationTypes.map((type) => [type.id, type]));
  const center = people.get(centerId);
  if (!center) return '';

  const w = Math.max(480, width);
  const h = Math.max(360, height);
  const cx = w / 2;
  const cy = h / 2 + 6;
  const neighbors = collectNeighbors(topic, centerId, people);
  const radius = Math.max(110, Math.min(230, Math.min(w, h) * 0.32));

  const placed = placeNeighbors(neighbors, cx, cy, radius);
  const laneColor = (person: Person): string =>
    topic.lanes.find((lane) => lane.id === person.lane)?.color ?? '#6b6254';

  const markerIds = new Set<string>();
  const parts: string[] = [];

  for (const item of placed) {
    for (const rel of item.relations) {
      const type = types.get(rel.type);
      const color = type?.color ?? '#8a8f98';
      const dash = type?.dash ? ` stroke-dasharray="${esc(type.dash)}"` : '';
      const directed = type?.directed === true;
      if (directed) markerIds.add(rel.type);
      const fromCenter = rel.source === centerId;
      const line = shorten(cx, cy, item.x, item.y, CENTER_R + 2, NODE_R + 2);
      const marker = directed ? ` marker-end="url(#graph-arrow-${esc(rel.type)})"` : '';
      const title = [type?.name, rel.note].filter(Boolean).join(' · ');
      const d = fromCenter
        ? `M ${round(line.x1)} ${round(line.y1)} L ${round(line.x2)} ${round(line.y2)}`
        : `M ${round(line.x2)} ${round(line.y2)} L ${round(line.x1)} ${round(line.y1)}`;
      parts.push(
        `<path class="graph-edge" d="${d}" stroke="${esc(color)}"${dash}${marker}><title>${esc(title)}</title></path>`,
      );
    }
  }

  const markers = [...markerIds]
    .map((id) => {
      const color = types.get(id)?.color ?? '#8a8f98';
      return `<marker id="graph-arrow-${esc(id)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="${esc(color)}" /></marker>`;
    })
    .join('');

  const centerHot = hoverId === center.id;
  parts.push(renderNode(center, cx, cy, CENTER_R, laneColor(center), true, centerHot, 0));

  for (const item of placed) {
    const hot = hoverId === item.person.id;
    const angle = Math.atan2(item.y - cy, item.x - cx);
    parts.push(renderNode(item.person, item.x, item.y, NODE_R, laneColor(item.person), false, hot, angle));
  }

  const empty =
    neighbors.length === 0
      ? `<text class="graph-empty" x="${round(cx)}" y="${round(cy + CENTER_R + 36)}" text-anchor="middle">还没有录入关系</text>`
      : '';

  return `<defs>${markers}</defs>${parts.join('')}${empty}`;
}

function collectNeighbors(
  topic: Topic,
  centerId: string,
  people: Map<string, Person>,
): Neighbor[] {
  const byId = new Map<string, Neighbor>();
  for (const rel of topic.relations) {
    if (rel.source !== centerId && rel.target !== centerId) continue;
    const otherId = rel.source === centerId ? rel.target : rel.source;
    const person = people.get(otherId);
    if (!person) continue;
    const existing = byId.get(otherId);
    if (existing) {
      existing.relations.push(rel);
      continue;
    }
    byId.set(otherId, { person, relations: [rel] });
  }

  const order = new Map(topic.relationTypes.map((type, index) => [type.id, index]));
  return [...byId.values()].sort((a, b) => {
    const ai = order.get(a.relations[0]?.type ?? '') ?? 99;
    const bi = order.get(b.relations[0]?.type ?? '') ?? 99;
    if (ai !== bi) return ai - bi;
    return a.person.display.localeCompare(b.person.display, 'zh');
  });
}

function placeNeighbors(
  neighbors: Neighbor[],
  cx: number,
  cy: number,
  radius: number,
): Array<Neighbor & { x: number; y: number }> {
  if (neighbors.length === 0) return [];
  const groups: Neighbor[][] = [];
  for (const item of neighbors) {
    const key = item.relations[0]?.type ?? '';
    const last = groups[groups.length - 1];
    if (last && last[0]?.relations[0]?.type === key) last.push(item);
    else groups.push([item]);
  }

  const gap = groups.length > 1 ? 0.18 : 0;
  const usable = Math.PI * 2 - gap * groups.length;
  const total = neighbors.length;
  let cursor = -Math.PI / 2;
  const placed: Array<Neighbor & { x: number; y: number }> = [];

  for (const group of groups) {
    const slice = (group.length / total) * usable;
    for (let i = 0; i < group.length; i += 1) {
      const angle = cursor + ((i + 0.5) / group.length) * slice;
      placed.push({
        ...group[i],
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }
    cursor += slice + gap;
  }
  return placed;
}

function shorten(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * r1,
    y1: y1 + uy * r1,
    x2: x2 - ux * r2,
    y2: y2 - uy * r2,
  };
}

function renderNode(
  person: Person,
  x: number,
  y: number,
  r: number,
  color: string,
  isCenter: boolean,
  hot: boolean,
  angle: number,
): string {
  const labelR = r + (isCenter ? 18 : 16);
  const lx = isCenter ? x : x + Math.cos(angle) * labelR;
  const ly = isCenter ? y + r + 20 : y + Math.sin(angle) * labelR;
  let anchor = 'middle';
  if (!isCenter) {
    if (Math.cos(angle) > 0.35) anchor = 'start';
    else if (Math.cos(angle) < -0.35) anchor = 'end';
  }
  const cls = `graph-node${isCenter ? ' is-center' : ''}${hot ? ' is-hot' : ''}`;
  const nameY = isCenter ? ly : ly + (Math.sin(angle) > 0.25 ? 4 : -2);
  const ariaLabel = `${isCenter ? '当前人物' : '切换到'}：${person.display}`;
  return `
    <g class="${cls}" data-person="${esc(person.id)}" tabindex="0" role="button" aria-label="${esc(ariaLabel)}">
      <circle class="graph-disc" cx="${round(x)}" cy="${round(y)}" r="${r}" fill="${esc(color)}" />
      <text class="graph-label" x="${round(lx)}" y="${round(nameY)}" text-anchor="${anchor}">${esc(person.display)}</text>
      ${isCenter ? `<text class="graph-sub" x="${round(x)}" y="${round(nameY + 16)}" text-anchor="middle">${esc(formatLifespan(person))}</text>` : ''}
    </g>
  `;
}
