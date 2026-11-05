import type { CenturySegment, EventRecord } from '../src/types';

/** 公元 1—100 年是 1 世纪；前 1600—前 1501 年是 -16 世纪。没有公元 0 年。 */
export function centuryOf(year: number): number {
  if (year === 0) throw new Error('事件年份不存在公元 0 年');
  if (year > 0) return Math.floor((year - 1) / 100) + 1;
  return -(Math.floor((-year - 1) / 100) + 1);
}

export function centuryRange(century: number): [number, number] {
  if (century > 0) return [(century - 1) * 100 + 1, century * 100];
  return [century * 100, (century + 1) * 100 - 1];
}

function centuryLabel(century: number): string {
  return century > 0 ? `${century} 世纪` : `前 ${-century} 世纪`;
}

function centuryCode(century: number): string {
  return century > 0 ? `ad${century}` : `bc${-century}`;
}

export function segmentId(fromCentury: number, toCentury: number): string {
  return fromCentury === toCentury
    ? `seg-${centuryCode(fromCentury)}`
    : `seg-${centuryCode(fromCentury)}-${centuryCode(toCentury)}`;
}

/** 同号只写一个「世纪」后缀：前 16—前 11 世纪、13—14 世纪。 */
export function segmentLabel(fromCentury: number, toCentury: number): string {
  if (fromCentury === toCentury) return centuryLabel(fromCentury);
  if (fromCentury < 0 && toCentury < 0) return `前 ${-fromCentury}—${-toCentury} 世纪`;
  if (fromCentury > 0 && toCentury > 0) return `${fromCentury}—${toCentury} 世纪`;
  return `${centuryLabel(fromCentury)}—${centuryLabel(toCentury)}`;
}

interface CenturyGroup {
  from: number;
  to: number;
  count: number;
}

/**
 * 按世纪切段，稀疏段并入相邻段。
 * 段内事件少于 minCount 条时合并，并入相邻段中条数较少者；条数相同并入前一段，保证结果确定。
 */
export function buildSegments(events: EventRecord[], range: [number, number], minCount = 3): CenturySegment[] {
  const buckets = new Map<number, number>();
  for (const event of events) {
    const century = centuryOf(event.year);
    buckets.set(century, (buckets.get(century) ?? 0) + 1);
  }
  const groups: CenturyGroup[] = [...buckets.keys()]
    .sort((left, right) => centuryRange(left)[0] - centuryRange(right)[0])
    .map((century) => ({ from: century, to: century, count: buckets.get(century) ?? 0 }));

  let merged = true;
  while (merged && groups.length > 1) {
    merged = false;
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i].count >= minCount) continue;
      const previous = groups[i - 1];
      const next = groups[i + 1];
      let target: number;
      if (!previous) target = i + 1;
      else if (!next) target = i - 1;
      else if (next.count < previous.count) target = i + 1;
      else target = i - 1;
      const [low, high] = target < i ? [target, i] : [i, target];
      groups[low] = { from: groups[low].from, to: groups[high].to, count: groups[low].count + groups[high].count };
      groups.splice(high, 1);
      merged = true;
      break;
    }
  }

  return groups.map((group) => {
    const from = Math.max(centuryRange(group.from)[0], range[0]);
    const to = Math.min(centuryRange(group.to)[1], range[1]);
    const ids = events
      .filter((event) => {
        const century = centuryOf(event.year);
        return century >= group.from && century <= group.to;
      })
      .sort(
        (left, right) =>
          left.year - right.year || right.importance - left.importance || left.id.localeCompare(right.id),
      )
      .map((event) => event.id);
    return {
      id: segmentId(group.from, group.to),
      label: segmentLabel(group.from, group.to),
      from,
      to,
      events: ids,
    };
  });
}
