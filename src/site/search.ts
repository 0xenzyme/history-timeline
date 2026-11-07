import type { CollectionSummary, EraSummary, EventRecord, SearchRecord } from '../types';
import { entityLink, eventDates, lifeDates } from './components';
import { categoryName, eventRecords, type SiteLibrary } from './data';
import { searchScore } from './discovery-state';
import { escapeHtml } from './escape';

export type SearchKind = 'all' | 'person' | 'event' | 'collection' | 'dynasty';

function searchId(value: SearchRecord | EventRecord | CollectionSummary | EraSummary): string {
  return value.id;
}

function ranked<T extends SearchRecord | EventRecord | CollectionSummary | EraSummary>(
  values: T[],
  query: string,
  score: (value: T) => number,
): T[] {
  if (!query) return [];
  return values
    .map((value) => ({ value, score: score(value) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => left.score - right.score || searchId(left.value).localeCompare(searchId(right.value)))
    .map((item) => item.value);
}

export function searchPage(query: string, type: SearchKind, library: SiteLibrary, invalidType = false): string {
  const needle = query.trim();
  const people =
    type === 'all' || type === 'person'
      ? ranked(
          [
            ...new Map(
              library.people.filter((person) => person.kind !== 'event').map((person) => [person.id, person]),
            ).values(),
          ],
          needle,
          (person) =>
            searchScore(
              needle,
              [person.name, person.display, ...(person.aliases ?? [])],
              [
                ...(person.tags ?? []),
                person.title ?? '',
                person.bio ?? '',
                ...(person.categories ?? []),
                ...(person.categories ?? []).map((id) => categoryName(library, id)),
              ],
            ),
        ).slice(0, 50)
      : [];
  const events =
    type === 'all' || type === 'event'
      ? ranked(eventRecords(library), needle, (event) =>
          searchScore(
            needle,
            [event.name, event.display, ...(event.aliases ?? [])],
            [event.place ?? '', event.placeNow ?? '', event.desc ?? '', ...(event.tags ?? [])],
          ),
        ).slice(0, 50)
      : [];
  const collections =
    type === 'all' || type === 'collection'
      ? ranked(library.collections, needle, (collection) =>
          searchScore(
            needle,
            [collection.name, ...(collection.aliases ?? [])],
            [collection.summary, ...(collection.tags ?? [])],
          ),
        ).slice(0, 50)
      : [];
  const eras =
    type === 'all' || type === 'dynasty'
      ? ranked(library.eras, needle, (era) =>
          searchScore(needle, [era.name, ...(era.aliases ?? [])], [era.summary ?? '']),
        ).slice(0, 50)
      : [];
  const count = people.length + events.length + collections.length + eras.length;
  const tabs: Array<[SearchKind, string]> = [
    ['all', '全部'],
    ['person', '人物'],
    ['event', '事件'],
    ['collection', '群像'],
    ['dynasty', '朝代'],
  ];
  const section = (title: string, content: string, length: number) =>
    `<section class="lt-section lt-search-group"><h2>${title} <span>${length}</span></h2>${content}</section>`;
  return `<main class="lt-page" id="main-content">${invalidType ? '<aside class="lt-notice" role="status">已忽略无法识别的搜索类型，当前显示全部结果。</aside>' : ''}<div class="lt-search-heading"><h1 tabindex="-1">搜索</h1><form action="/search" method="get" role="search" data-native-form><label for="search-page-query">全站搜索</label><div><input id="search-page-query" type="search" name="q" value="${escapeHtml(query)}" placeholder="搜索人物、事件、群像、朝代……" required /><input type="hidden" name="type" value="${type}" /><button type="submit" class="lt-button">搜索</button></div></form></div><nav class="lt-search-tabs" aria-label="搜索结果类型">${tabs.map(([id, label]) => `<a href="/search?q=${encodeURIComponent(query)}&type=${id}" data-site-link ${type === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>${!needle ? '<p>输入姓名、事件、群像或朝代名称开始搜索。</p>' : `<p aria-live="polite">「${escapeHtml(query)}」共找到 ${count} 条结果${count >= 50 ? '（按类型最多显示 50 条）' : ''}。</p>${count === 0 ? '<section class="lt-empty-results"><h2>没有符合当前条件的结果</h2><p>尝试更换关键词，或切换到其他实体类型。</p><a class="lt-button" href="/search" data-site-link>清除搜索</a></section>' : ''}${(type === 'all' || type === 'person') && people.length ? section('人物', `<div class="lt-search-results">${people.map((person) => `<article>${entityLink('person', person.id, person.display || person.name)}<p class="lt-data">${lifeDates({ birth: person.birth, birthAccuracy: person.birthAccuracy ?? 'unknown', death: person.death, deathAccuracy: person.deathAccuracy ?? 'unknown' })}</p><p>${escapeHtml(person.title ?? person.bio ?? '')}</p></article>`).join('')}</div>`, people.length) : ''}${(type === 'all' || type === 'event') && events.length ? section('事件', `<div class="lt-search-results">${events.map((event) => `<article>${entityLink('event', event.id, event.display || event.name)}<p class="lt-data">${eventDates(event)}</p><p>${escapeHtml(event.desc ?? '')}</p></article>`).join('')}</div>`, events.length) : ''}${(type === 'all' || type === 'collection') && collections.length ? section('群像', `<div class="lt-search-results">${collections.map((collection) => `<article><a href="/collections/${encodeURIComponent(collection.id)}"><h3>${escapeHtml(collection.name)}</h3></a><p>${escapeHtml(collection.summary)}</p><p class="lt-data">${collection.memberCount} 位系列人物</p></article>`).join('')}</div>`, collections.length) : ''}${(type === 'all' || type === 'dynasty') && eras.length ? section('朝代', `<div class="lt-search-results">${eras.map((era) => `<article><a href="/eras/${encodeURIComponent(era.id)}" data-era-id="${escapeHtml(era.id)}"><h3>${escapeHtml(era.name)}</h3></a><p class="lt-data">${era.from < 0 ? `前 ${-era.from}` : era.from}—${era.to < 0 ? `前 ${-era.to}` : era.to} 年</p><p>${escapeHtml(era.summary ?? '时代资料尚未整理。')}</p></article>`).join('')}</div>`, eras.length) : ''}`}</main>`;
}
