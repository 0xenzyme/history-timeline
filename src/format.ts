import type { Accuracy, Person } from './types';
import { spannedYears } from './timeline/years';

export function formatYear(year: number): string {
  if (year === 0) return '—';
  return year < 0 ? `公元前${-year}年` : `公元${year}年`;
}

export function formatYearShort(year: number): string {
  if (year === 0) return '—';
  return year < 0 ? `前${-year}` : `${year}`;
}

const MARK: Record<Accuracy, string> = {
  exact: '',
  approx: '约',
  disputed: '约',
  unknown: '',
};

export function formatEdge(year: number | undefined, accuracy: Accuracy): string {
  if (year === undefined) return '不详';
  if (accuracy === 'disputed') return `${MARK.disputed}${formatYear(year)}`;
  return `${MARK[accuracy]}${formatYear(year)}`;
}

export function formatLifespan(person: Person): string {
  if (person.birth === undefined && person.death === undefined) return '生卒皆不详';
  return `${formatEdge(person.birth, person.birthAccuracy)} — ${formatEdge(person.death, person.deathAccuracy)}`;
}

export function lifespanSpan(person: Person): string | null {
  if (person.birth === undefined || person.death === undefined) return null;
  const years = spannedYears(person.birth, person.death);
  const fuzzy =
    person.birthAccuracy === 'approx' ||
    person.birthAccuracy === 'disputed' ||
    person.deathAccuracy === 'approx' ||
    person.deathAccuracy === 'disputed';
  return fuzzy ? `约 ${years} 岁` : `${years} 岁`;
}

export const ACCURACY_LABEL: Record<Accuracy, string> = {
  exact: '确切',
  approx: '约略',
  disputed: '有异说',
  unknown: '不详',
};
