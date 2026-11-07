import type { CollectionSummary, EraSummary, EventRecord, SearchRecord } from '../types';
import { entityLink, eventDates, eventType, lifeDates } from './components';
import { categoryName, collectionCategoryName, personName, polityName, type SiteLibrary } from './data';
import { escapeHtml } from './escape';

export function eraCard(era: EraSummary): string {
  const years = `${era.from < 0 ? `前 ${-era.from}` : era.from}—${era.to < 0 ? `前 ${-era.to}` : era.to}`;
  return `<article class="lt-era-card"><a href="/eras/${encodeURIComponent(era.id)}" data-era-id="${escapeHtml(era.id)}"><h3>${escapeHtml(era.name)}</h3><p class="lt-data">${years} 年</p>${era.summary ? `<p>${escapeHtml(era.summary)}</p>` : '<p class="lt-muted">时代资料尚未整理。</p>'}<p class="lt-era-counts">${era.personCount} 位收录人物 · ${era.eventCount} 条关联事件</p></a></article>`;
}

export function collectionCard(collection: CollectionSummary, categoryLabel: string): string {
  const featured = collection.featuredMembers.slice(0, 3);
  return `<article class="lt-collection-card"><div class="lt-collection-mark" aria-hidden="true">${escapeHtml(categoryLabel.slice(0, 1))}</div><div class="lt-collection-copy"><span class="lt-tag">${escapeHtml(categoryLabel)}</span><a class="lt-card-primary" href="/collections/${encodeURIComponent(collection.id)}"><h3>${escapeHtml(collection.name)}</h3></a><p>${escapeHtml(collection.summary)}</p>${featured.length ? `<p class="lt-collection-members">代表人物：${featured.map((person) => entityLink('person', person.id, person.display || person.name)).join(' · ')}</p>` : ''}<p class="lt-data">${collection.memberCount} 位系列人物</p></div></article>`;
}

export function personDirectoryCard(person: SearchRecord, library: SiteLibrary): string {
  const collections = library.collections.filter((collection) =>
    collection.featuredMembers.some((member) => member.id === person.id),
  );
  return `<article class="lt-person-card"><a class="lt-person-card-monogram lt-card-primary" href="/people/${encodeURIComponent(person.id)}" data-entity-kind="person" data-entity-id="${escapeHtml(person.id)}" aria-label="查看${escapeHtml(person.display || person.name)}详情">${escapeHtml((person.display || person.name).slice(0, 1))}</a><div class="lt-person-card-copy"><h3>${entityLink('person', person.id, person.display || person.name)}</h3><p class="lt-data">${lifeDates({ birth: person.birth, birthAccuracy: person.birthAccuracy ?? 'unknown', death: person.death, deathAccuracy: person.deathAccuracy ?? 'unknown' })}</p>${person.title ? `<p class="lt-person-card-title">${escapeHtml(person.title)}</p>` : ''}${person.bio ? `<p class="lt-card-summary">${escapeHtml(person.bio.split('\n')[0])}</p>` : ''}<div class="lt-tags">${(person.categories ?? []).map((id) => `<span class="lt-tag">${escapeHtml(categoryName(library, id))}</span>`).join('')}${(person.polity ?? []).map((id) => `<span class="lt-tag">${escapeHtml(polityName(library, id))}</span>`).join('')}</div>${collections.length ? `<p class="lt-card-collections">代表群像：${collections.map((collection) => `<a href="/collections/${encodeURIComponent(collection.id)}">${escapeHtml(collection.name)}</a>`).join('、')}</p>` : ''}</div></article>`;
}

export function eventDirectoryCard(event: EventRecord, library: SiteLibrary, view: string): string {
  const people = [
    ...new Set([...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)]),
  ].slice(0, 5);
  return `<article class="lt-event-directory-card ${view === 'list' ? 'lt-event-directory-row' : ''}"><div class="lt-event-card-main"><h3>${entityLink('event', event.id, event.display || event.name)}</h3><p class="lt-data">${eventDates(event)}</p>${event.desc ? `<p class="lt-card-summary">${escapeHtml(event.desc.split('\n')[0])}</p>` : ''}</div><dl class="lt-event-card-facts"><div><dt>地点</dt><dd>${escapeHtml(event.place ?? '未记录')}</dd></div><div><dt>类型</dt><dd>${eventType(event)}</dd></div><div><dt>朝代</dt><dd>${(event.dynasties ?? []).map((id) => escapeHtml(library.eras.find((era) => era.id === id)?.name ?? id)).join('、') || '未标注'}</dd></div><div><dt>展示优先级</dt><dd>${event.importance} / 3</dd></div></dl>${people.length ? `<div class="lt-event-card-people">相关人物：${people.map((id) => entityLink('person', id, personName(library, id))).join(' · ')}</div>` : ''}</article>`;
}

export function collectionSummaryCard(id: string, library: SiteLibrary): string {
  const collection = library.collections.find((item) => item.id === id);
  return collection ? collectionCard(collection, collectionCategoryName(library, collection.category)) : '';
}
