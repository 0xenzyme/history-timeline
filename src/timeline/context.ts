import type { TimelineEvent, Topic, View } from '../types';
import type { Layout } from './layout';

export interface RenderContext {
  topic: Topic;
  layout: Layout;
  view: View;
  domain: [number, number];
  /** 历史年份 → 像素。比例尺内部已去掉公元 0 年。 */
  x: (year: number) => number;
  zonePeople: Set<string>;
  zoneEvents: Set<string>;
  focusId: string | null;
  hoverId: string | null;
  showAllRelations: boolean;
  eventRows: Map<string, number>;
  adjacency: Map<string, Set<string>>;
}

export function opacityOf(ctx: RenderContext, id: string): number {
  const hot = activeId(ctx);
  if (hot === null) return 1;
  if (id === hot) return 1;
  return ctx.adjacency.get(hot)?.has(id) === true ? 1 : 0.22;
}

export function activeId(ctx: Pick<RenderContext, 'focusId' | 'hoverId'>): string | null {
  return ctx.hoverId ?? ctx.focusId;
}

export function visibleEvents(ctx: RenderContext): TimelineEvent[] {
  return ctx.topic.events.filter((event) => ctx.zoneEvents.has(event.id));
}

export function buildAdjacency(topic: Topic): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const rel of topic.relations) {
    touch(rel.source, rel.target);
    touch(rel.target, rel.source);
  }
  return map;
}
