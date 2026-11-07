import type { Accuracy } from '../types';
import { escapeHtml } from './escape';

export function formatYear(year: number, accuracy: Accuracy = 'exact', suffix = true): string {
  const prefix = accuracy === 'approx' ? '约 ' : '';
  const uncertain = accuracy === 'disputed' ? '（异说）' : '';
  const value = year < 0 ? `前 ${Math.abs(year)}` : String(year);
  return `${prefix}${value}${suffix ? ' 年' : ''}${uncertain}`;
}

export function formatLifeRange(input: {
  birth?: number;
  birthAccuracy: Accuracy;
  death?: number;
  deathAccuracy: Accuracy;
}): string {
  const birth = input.birth === undefined ? '生年不详' : formatYear(input.birth, input.birthAccuracy, false);
  const death = input.death === undefined ? '卒年不详' : formatYear(input.death, input.deathAccuracy, false);
  return `${birth}—${death} 年`;
}

export function formatEventRange(input: {
  year?: number;
  yearAccuracy?: Accuracy;
  endYear?: number;
  endYearAccuracy?: Accuracy;
}): string {
  if (input.year === undefined) return '年份待考';
  const start = formatYear(input.year, input.yearAccuracy ?? 'exact', false);
  if (input.endYear === undefined || input.endYear === input.year) return `${start} 年`;
  const end = formatYear(input.endYear, input.endYearAccuracy ?? 'exact', false);
  return `${start}—${end} 年`;
}

export function yearNote(label: string, note?: string): string {
  return note
    ? `<details class="lt-year-note"><summary>${escapeHtml(label)}年份说明</summary><p>${escapeHtml(note)}</p></details>`
    : '';
}
