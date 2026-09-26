import type { Person } from '../types';
import { FADE_APPROX } from './layout';

/** 关系线落在双方都知道的年份上；只有一端时落在已知的那一年。 */
export function relationAnchorYear(
  a: Person,
  b: Person,
  since: number | undefined,
  from: number,
  to: number,
): number {
  if (since !== undefined) return since;
  const a0 = a.birth ?? a.death;
  const a1 = a.death ?? a.birth;
  const b0 = b.birth ?? b.death;
  const b1 = b.death ?? b.birth;
  if (a0 !== undefined && a1 !== undefined && b0 !== undefined && b1 !== undefined) {
    const start = Math.max(a0, b0);
    const end = Math.min(a1, b1);
    if (end >= start) return (start + end) / 2;
  }
  const marks = [a.death ?? a.birth, b.death ?? b.birth].filter((year): year is number => year !== undefined);
  if (marks.length > 0) return marks.reduce((sum, year) => sum + year, 0) / marks.length;
  return (from + to) / 2;
}

/** 把视野对准一个人的生卒，并限制在专题 range 内 */
export function fitPersonDomain(person: Person, range: [number, number]): [number, number] {
  const [from, to] = range;
  const pad = Math.max(16, (to - from) * 0.06);
  const lifeStart = person.birth ?? person.death ?? from;
  const lifeEnd = person.death ?? person.birth ?? to;
  let start = lifeStart - pad;
  let end = lifeEnd + pad;
  if (end - start < 40) {
    const mid = (start + end) / 2;
    start = mid - 20;
    end = mid + 20;
  }
  if (start < from) {
    end += from - start;
    start = from;
  }
  if (end > to) {
    start -= end - to;
    end = to;
  }
  start = Math.max(from, start);
  end = Math.min(to, end);
  if (end <= start) return [from, to];
  return [start, end];
}

export type BarEndKind = 'open' | 'approx' | 'exact';

export interface BarGeom {
  /** 两端均不知，只画一个标记 */
  markerOnly: boolean;
  x1: number;
  x2: number;
  width: number;
  leftFade: number;
  rightFade: number;
  leftKind: BarEndKind;
  rightKind: BarEndKind;
  leftOpen: boolean;
  rightOpen: boolean;
}

export function barGeom(
  person: Person,
  x: (year: number) => number,
  plotLeft: number,
  plotRight: number,
): BarGeom {
  const hasBirth = person.birth !== undefined;
  const hasDeath = person.death !== undefined;

  if (!hasBirth || !hasDeath) {
    const known = hasDeath ? person.death : hasBirth ? person.birth : undefined;
    const px = known !== undefined ? x(known) : plotLeft + 12;
    return {
      markerOnly: true,
      x1: px,
      x2: px,
      width: 0,
      leftFade: 0,
      rightFade: 0,
      leftKind: 'exact',
      rightKind: 'exact',
      leftOpen: hasDeath && !hasBirth,
      rightOpen: hasBirth && !hasDeath,
    };
  }

  let x1 = Math.max(plotLeft, x(person.birth as number));
  let x2 = Math.min(plotRight, x(person.death as number));
  if (x2 - x1 < 3) x2 = x1 + 3;

  const fuzzy = (accuracy: Person['birthAccuracy']) => accuracy === 'approx' || accuracy === 'disputed';

  const leftKind: BarEndKind = fuzzy(person.birthAccuracy) ? 'approx' : 'exact';
  const rightKind: BarEndKind = fuzzy(person.deathAccuracy) ? 'approx' : 'exact';

  const leftFade = leftKind === 'approx' ? FADE_APPROX : 0;
  const rightFade = rightKind === 'approx' ? FADE_APPROX : 0;

  return {
    markerOnly: false,
    x1,
    x2,
    width: x2 - x1,
    leftFade: Math.min(leftFade, x2 - x1),
    rightFade: Math.min(rightFade, x2 - x1),
    leftKind,
    rightKind,
    leftOpen: !hasBirth,
    rightOpen: !hasDeath,
  };
}

export interface GradientStop {
  offset: number;
  opacity: number;
}

export function barStops(geom: BarGeom): GradientStop[] {
  const stops: GradientStop[] = [];
  const ratio = (px: number) => Math.min(1, Math.max(0, px / geom.width));

  if (geom.leftKind === 'open') {
    stops.push({ offset: 0, opacity: 0.14 });
    stops.push({ offset: ratio(geom.leftFade), opacity: 1 });
  } else {
    stops.push({ offset: 0, opacity: 1 });
  }

  if (geom.rightKind === 'open') {
    stops.push({ offset: ratio(geom.width - geom.rightFade), opacity: 1 });
    stops.push({ offset: 1, opacity: 0.14 });
  } else {
    stops.push({ offset: 1, opacity: 1 });
  }

  for (let i = 1; i < stops.length; i += 1) {
    if (stops[i].offset < stops[i - 1].offset) stops[i].offset = stops[i - 1].offset;
  }
  return stops;
}
