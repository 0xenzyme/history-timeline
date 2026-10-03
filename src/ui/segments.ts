import type { CenturySegment, EventLineView } from '../types';
import { esc } from '../timeline/svg';

/** 事件线没有 overview，第一个分段就是入口。 */
export function entrySegment(line: EventLineView): CenturySegment {
  return line.segments[0];
}

export function findSegment(line: EventLineView, id: string | null | undefined): CenturySegment {
  if (!id) return entrySegment(line);
  return line.segments.find((segment) => segment.id === id) ?? entrySegment(line);
}

export function renderSegments(line: EventLineView, activeId: string): string {
  return line.segments
    .map(
      (segment) =>
        `<button type="button" class="chapter${segment.id === activeId ? ' is-active' : ''}" data-segment="${esc(segment.id)}" aria-current="${segment.id === activeId ? 'page' : 'false'}">${esc(segment.label)}</button>`,
    )
    .join('');
}

/** 事件落在本段的哪个分段里，用于从人物线或搜索跳转过来时定位。 */
export function segmentForEvent(line: EventLineView, eventId: string): CenturySegment | null {
  return line.segments.find((segment) => segment.events.includes(eventId)) ?? null;
}
