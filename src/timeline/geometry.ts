import type { Person } from '../types';
import { FADE_APPROX, OPEN_STUB } from './layout';

/**
 * 生卒年不详时的名义跨度，仅用于计算关系线锚点与视觉占位，
 * 不参与任何长度展示。
 */
export const NOMINAL_SPAN = 55;

export function nominalRange(person: Person, from: number, to: number): [number, number] {
  const start = person.birth ?? (person.death !== undefined ? person.death - NOMINAL_SPAN : from);
  const end = person.death ?? (person.birth !== undefined ? person.birth + NOMINAL_SPAN : to);
  return [start, end];
}

/** 把视野对准一个人的生卒，并限制在专题 range 内 */
export function fitPersonDomain(person: Person, range: [number, number]): [number, number] {
  const [from, to] = range;
  const pad = Math.max(16, (to - from) * 0.06);
  const [lifeStart, lifeEnd] = nominalRange(person, from, to);
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

export interface BarGeom {
  /** 两端均不知，只画一个标记 */
  markerOnly: boolean;
  x1: number;
  x2: number;
  width: number;
  leftFade: number;
  rightFade: number;
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

  if (!hasBirth && !hasDeath) {
    return {
      markerOnly: true,
      x1: plotLeft,
      x2: plotLeft + 10,
      width: 10,
      leftFade: 0,
      rightFade: 0,
      leftOpen: false,
      rightOpen: false,
    };
  }

  const openStart = hasBirth
    ? x(person.birth as number)
    : x(person.death as number) - OPEN_STUB;
  const openEnd = hasDeath
    ? x(person.death as number)
    : x(person.birth as number) + OPEN_STUB;

  let x1 = Math.max(plotLeft, openStart);
  let x2 = Math.min(plotRight, openEnd);
  if (x2 - x1 < 3) x2 = x1 + 3;

  const fuzzy = (accuracy: Person['birthAccuracy']) => accuracy === 'approx' || accuracy === 'disputed';

  const leftFade = !hasBirth ? OPEN_STUB : fuzzy(person.birthAccuracy) ? FADE_APPROX : 0;
  const rightFade = !hasDeath ? OPEN_STUB : fuzzy(person.deathAccuracy) ? FADE_APPROX : 0;

  return {
    markerOnly: false,
    x1,
    x2,
    width: x2 - x1,
    leftFade: Math.min(leftFade, x2 - x1),
    rightFade: Math.min(rightFade, x2 - x1),
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

  if (geom.leftFade > 0) {
    stops.push({ offset: 0, opacity: geom.leftOpen ? 0.06 : 0.3 });
    stops.push({ offset: ratio(geom.leftFade), opacity: 1 });
  } else {
    stops.push({ offset: 0, opacity: 1 });
  }

  if (geom.rightFade > 0) {
    stops.push({ offset: ratio(geom.width - geom.rightFade), opacity: 1 });
    stops.push({ offset: 1, opacity: geom.rightOpen ? 0.06 : 0.3 });
  } else {
    stops.push({ offset: 1, opacity: 1 });
  }

  for (let i = 1; i < stops.length; i += 1) {
    if (stops[i].offset < stops[i - 1].offset) stops[i].offset = stops[i - 1].offset;
  }
  return stops;
}
