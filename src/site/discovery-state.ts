import { escapeHtml } from './escape';

export interface DirectoryQuery {
  q: string;
  values: Record<string, string | string[]>;
  sort: string;
  page: number;
  view: string;
  invalid: string[];
}

interface QueryRule {
  values?: readonly string[];
  multiple?: boolean;
}

export function parseDirectoryQuery(
  search: string,
  rules: Record<string, QueryRule>,
  defaults: { sort: string; view: string },
): DirectoryQuery {
  const query = new URLSearchParams(search);
  const invalid: string[] = [];
  const values: DirectoryQuery['values'] = {};
  for (const [key, rule] of Object.entries(rules)) {
    const raw = rule.multiple ? query.getAll(key).flatMap((value) => value.split(',')) : [query.get(key) ?? ''];
    const selected = raw.filter(Boolean);
    const allowed = selected.filter((value) => !rule.values || rule.values.includes(value));
    if (allowed.length !== selected.length) invalid.push(key);
    if (allowed.length > 0) values[key] = rule.multiple ? allowed : allowed[0];
  }
  const rawPage = query.get('page');
  const page = rawPage === null || rawPage === '' ? 1 : Number(rawPage);
  if (!/^\d+$/.test(rawPage ?? '1') || !Number.isSafeInteger(page) || page < 1) invalid.push('page');
  const sort = query.get('sort') ?? defaults.sort;
  if (rules.sort?.values && !rules.sort.values.includes(sort)) invalid.push('sort');
  const view = query.get('view') ?? defaults.view;
  if (rules.view?.values && !rules.view.values.includes(view)) invalid.push('view');
  return {
    q: query.get('q')?.trim() ?? '',
    values,
    sort: rules.sort?.values?.includes(sort) ? sort : defaults.sort,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    view: rules.view?.values?.includes(view) ? view : defaults.view,
    invalid: [...new Set(invalid)],
  };
}

export function directoryUrl(
  path: string,
  state: DirectoryQuery,
  changes: Record<string, string | number | string[] | undefined> = {},
): string {
  const query = new URLSearchParams();
  const merged: Record<string, string | number | string[] | undefined> = {
    q: state.q || undefined,
    ...state.values,
    sort: state.sort,
    page: state.page,
    view: state.view,
    ...changes,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') continue;
    query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ''}`;
}

export function pagination(path: string, state: DirectoryQuery, total: number, perPage: number): string {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return '';
  const page = state.page;
  const candidates = [...new Set([1, page - 1, page, page + 1, pages])].filter((value) => value >= 1 && value <= pages);
  return `<nav class="lt-pagination" aria-label="分页"><a href="${directoryUrl(path, state, { page: page - 1 })}" data-site-link ${page <= 1 ? 'aria-disabled="true" tabindex="-1"' : ''}>上一页</a>${candidates
    .map(
      (value) =>
        `<a href="${directoryUrl(path, state, { page: value })}" data-site-link ${value === page ? 'aria-current="page"' : ''} aria-label="第 ${value} 页">${value}</a>`,
    )
    .join(
      '',
    )}<a href="${directoryUrl(path, state, { page: page + 1 })}" data-site-link ${page >= pages ? 'aria-disabled="true" tabindex="-1"' : ''}>下一页</a></nav>`;
}

export function pageRange(_total: number, state: DirectoryQuery, perPage: number): { start: number; end: number } {
  return { start: (state.page - 1) * perPage, end: state.page * perPage };
}

export function invalidNotice(state: DirectoryQuery): string {
  return state.invalid.length
    ? `<aside class="lt-notice" role="status">已忽略无法识别的筛选、排序或页码参数：${state.invalid.map(escapeHtml).join('、')}。其余条件仍然有效。</aside>`
    : '';
}

export function searchScore(query: string, names: string[], otherFields: string[]): number {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const normalizedNames = names.filter(Boolean).map((name) => name.toLocaleLowerCase());
  if (normalizedNames.some((name) => name === needle)) return 0;
  if (normalizedNames.some((name) => name.startsWith(needle))) return 1;
  if (normalizedNames.some((name) => name.includes(needle))) return 2;
  if (otherFields.some((field) => field.toLocaleLowerCase().includes(needle))) return 3;
  return -1;
}

export function filterSummary(state: DirectoryQuery): string {
  const labels: Record<string, string> = {
    dynasty: '时期',
    category: '身份',
    type: '类型',
    catalog: '目录',
    person: '人物',
  };
  return [
    state.q ? `关键词「${escapeHtml(state.q)}」` : '',
    ...Object.entries(state.values)
      .filter(([key]) => key !== 'sort' && key !== 'view' && key !== 'tab')
      .map(([key]) => labels[key] ?? key),
  ]
    .filter(Boolean)
    .join('；');
}
