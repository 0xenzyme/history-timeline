import type { Accuracy, EventRecord, Person, SourceRef } from '../types';
import { SOURCE_KIND_NAMES, TYPE_NAMES } from '../app/skins';
import { escapeHtml } from './escape';
import { formatEventRange, formatLifeRange } from './format';

export function entityLink(kind: 'person' | 'event', id: string, label: string, className = ''): string {
  return `<a class="${escapeHtml(className)}" href="/${kind === 'person' ? 'people' : 'events'}/${encodeURIComponent(id)}" data-entity-kind="${kind}" data-entity-id="${escapeHtml(id)}">${escapeHtml(label)}</a>`;
}

export function sourceList(sources: SourceRef[], compact = false): string {
  if (sources.length === 0) return '<p class="lt-muted">出处尚未整理。</p>';
  const groups = new Map<string, SourceRef[]>();
  for (const source of sources) {
    const kind = source.kind ?? 'classic';
    groups.set(kind, [...(groups.get(kind) ?? []), source]);
  }
  return `<div class="lt-sources ${compact ? 'lt-sources-compact' : ''}">${[...groups]
    .map(
      ([kind, values]) =>
        `<section><h3>${SOURCE_KIND_NAMES[kind as keyof typeof SOURCE_KIND_NAMES]}</h3><ul>${values
          .map(
            (source) =>
              `<li><span>${escapeHtml(source.work)}${source.part ? ` · ${escapeHtml(source.part)}` : ''}</span>${kind === 'database' ? '<span class="lt-tag">检索线索</span>' : ''}${source.note ? `<small>${escapeHtml(source.note)}</small>` : ''}</li>`,
          )
          .join('')}</ul></section>`,
    )
    .join('')}</div>`;
}

export function expandableSources(sources: SourceRef[]): string {
  if (sources.length === 0) return '';
  return `<details class="lt-source-details"><summary>查看出处</summary>${sourceList(sources, true)}</details>`;
}

export function lifeDates(person: Pick<Person, 'birth' | 'birthAccuracy' | 'death' | 'deathAccuracy'>): string {
  return formatLifeRange(person);
}

export function eventDates(event: EventRecord): string {
  return formatEventRange(event);
}

export function accuracyNote(_accuracy: Accuracy | undefined, note: string | undefined, label = '查看'): string {
  if (!note) return '';
  return `<details class="lt-year-note"><summary>${escapeHtml(label)}年份说明</summary><p>${escapeHtml(note)}</p></details>`;
}

export function eventType(event: EventRecord): string {
  return `<span class="lt-event-type" data-event-type="${event.type}"><span aria-hidden="true" class="lt-event-shape"></span>${TYPE_NAMES[event.type]}</span>`;
}

export function personCard(person: Person): string {
  return `<article class="lt-related-card">${entityLink('person', person.id, person.display || person.name, 'lt-related-name')}<span class="lt-data">${lifeDates(person)}</span>${person.title ? `<p>${escapeHtml(person.title)}</p>` : ''}</article>`;
}

export function pageError(kind: 'person' | 'event', id: string, notFound: boolean): string {
  const label = kind === 'person' ? '人物' : '事件';
  return `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">${notFound ? `未找到该${label}` : `暂时无法加载该${label}`}</h1><p>${notFound ? `「${escapeHtml(id)}」的链接可能已失效。` : '数据请求未完成，请重试。'}</p><div class="lt-actions">${notFound ? '' : '<button type="button" class="lt-button" data-retry>重试</button>'}<a class="lt-button lt-button-secondary" href="/search">全站搜索</a><a class="lt-button lt-button-secondary" href="/timeline">返回年表</a></div></main>`;
}
