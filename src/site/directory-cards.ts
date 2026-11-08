import type { CollectionSummary, EraSummary, EventRecord, SearchRecord } from '../types';
import { entityLink, eventDates, eventType, lifeDates } from './components';
import { categoryName, collectionCategoryName, personName, polityName, type SiteLibrary } from './data';
import { escapeHtml } from './escape';
import { icon } from './icons';

export function eraCard(era: EraSummary, featured = false): string {
  const years = `${era.from < 0 ? `前 ${-era.from}` : era.from}—${era.to < 0 ? `前 ${-era.to}` : era.to}`;
  return `<article class="lt-era-card${featured ? ' lt-era-card-featured' : ''}"><a href="/eras/${encodeURIComponent(era.id)}" data-era-id="${escapeHtml(era.id)}"><h3>${escapeHtml(era.name)}</h3><p class="lt-data">${years} 年</p>${era.summary ? `<p>${escapeHtml(era.summary)}</p>` : '<p class="lt-muted">时代资料尚未整理。</p>'}<p class="lt-era-counts">${era.personCount} 位收录人物 · ${era.eventCount} 条关联事件</p></a></article>`;
}

export function collectionCard(collection: CollectionSummary, categoryLabel: string): string {
  const featured = collection.featuredMembers.slice(0, 3);
  const href = `/collections/${encodeURIComponent(collection.id)}`;
  return `<article class="lt-collection-card"><div class="lt-collection-mark" aria-hidden="true">${escapeHtml(categoryLabel.slice(0, 1))}</div><div class="lt-collection-copy"><div class="lt-collection-card-meta"><span class="lt-tag">${escapeHtml(categoryLabel)}</span><span class="lt-collection-count">系列人物 ${collection.memberCount} 位</span></div><a class="lt-card-primary" href="${href}"><h3>${escapeHtml(collection.name)}</h3></a><p>${escapeHtml(collection.summary)}</p>${featured.length ? `<p class="lt-collection-members">代表人物：${featured.map((person) => entityLink('person', person.id, person.display || person.name)).join(' · ')}</p>` : ''}<footer class="lt-directory-card-footer"><a href="${href}" aria-label="进入${escapeHtml(collection.name)}系列">进入系列 ${icon('arrow-up-right')}</a></footer></div></article>`;
}

export function personDirectoryCard(person: SearchRecord, library: SiteLibrary): string {
  const collections = library.collections.filter((collection) =>
    collection.featuredMembers.some((member) => member.id === person.id),
  );
  const name = person.display || person.name;
  const href = `/people/${encodeURIComponent(person.id)}`;
  return `<article class="lt-person-card"><a class="lt-person-card-monogram lt-card-primary" href="${href}" data-entity-kind="person" data-entity-id="${escapeHtml(person.id)}" aria-label="查看${escapeHtml(name)}详情">${escapeHtml(name.slice(0, 1))}</a><div class="lt-person-card-copy"><h3>${entityLink('person', person.id, name)}</h3><p class="lt-data">${lifeDates({ birth: person.birth, birthAccuracy: person.birthAccuracy ?? 'unknown', death: person.death, deathAccuracy: person.deathAccuracy ?? 'unknown' })}</p>${person.title ? `<p class="lt-person-card-title">${escapeHtml(person.title)}</p>` : ''}${person.bio ? `<p class="lt-card-summary">${escapeHtml(person.bio.split('\n')[0])}</p>` : ''}<div class="lt-tags">${(person.categories ?? []).map((id) => `<span class="lt-tag">${escapeHtml(categoryName(library, id))}</span>`).join('')}${(person.polity ?? []).map((id) => `<span class="lt-tag">${escapeHtml(polityName(library, id))}</span>`).join('')}</div>${collections.length ? `<p class="lt-card-collections">代表群像：${collections.map((collection) => `<a href="/collections/${encodeURIComponent(collection.id)}">${escapeHtml(collection.name)}</a>`).join('、')}</p>` : ''}<footer class="lt-directory-card-footer"><a href="${href}" data-entity-kind="person" data-entity-id="${escapeHtml(person.id)}" aria-label="查看${escapeHtml(name)}列传">查看列传 ${icon('arrow-up-right')}</a></footer></div></article>`;
}

export function eventDirectoryCard(event: EventRecord, library: SiteLibrary, view: string): string {
  const people = [
    ...new Set([...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)]),
  ].slice(0, 5);
  return `<article class="lt-event-directory-card ${view === 'list' ? 'lt-event-directory-row' : ''}"><div class="lt-event-card-main"><h3>${entityLink('event', event.id, event.display || event.name)}</h3><p class="lt-data">${eventDates(event)}</p>${event.desc ? `<p class="lt-card-summary">${escapeHtml(event.desc.split('\n')[0])}</p>` : ''}</div><dl class="lt-event-card-facts"><div><dt>地点</dt><dd>${escapeHtml(event.place ?? '未记录')}</dd></div><div><dt>类型</dt><dd>${eventType(event)}</dd></div><div><dt>朝代</dt><dd>${(event.dynasties ?? []).map((id) => escapeHtml(library.eras.find((era) => era.id === id)?.name ?? id)).join('、') || '未标注'}</dd></div><div><dt>展示优先级</dt><dd>${event.importance} / 3</dd></div></dl>${people.length ? `<div class="lt-event-card-people">相关人物：${people.map((id) => entityLink('person', id, personName(library, id))).join(' · ')}</div>` : ''}</article>`;
}

export function eventDirectoryTable(events: EventRecord[], library: SiteLibrary): string {
  return `<div class="lt-event-table-wrap"><table class="lt-event-table"><caption>事件检索结果</caption><thead><tr><th scope="col">事件名称 / 简介</th><th scope="col">时间</th><th scope="col">地点</th><th scope="col">类型</th><th scope="col">相关人物</th><th scope="col">展示优先级</th></tr></thead><tbody>${events
    .map((event) => {
      const people = [
        ...new Set([...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)]),
      ];
      const relatedPeople = people
        .slice(0, 3)
        .map((id) => entityLink('person', id, personName(library, id)))
        .join('<span class="lt-event-person-separator" aria-hidden="true"> · </span>');
      return `<tr class="lt-event-directory-card lt-event-table-row"><td data-label="事件"><div class="lt-event-table-title"><span class="lt-event-row-marker" data-event-type="${escapeHtml(event.type)}" aria-hidden="true"></span>${entityLink('event', event.id, event.display || event.name, 'lt-event-table-name')}</div>${event.desc ? `<p class="lt-event-table-summary">${escapeHtml(event.desc.split('\n')[0])}</p>` : ''}</td><td data-label="时间"><span class="lt-data">${eventDates(event)}</span></td><td data-label="地点">${escapeHtml(event.place ?? '未记录')}</td><td data-label="类型">${eventType(event)}</td><td data-label="相关人物">${relatedPeople ? `<div class="lt-event-table-people">${relatedPeople}${people.length > 3 ? `<span class="lt-event-people-more">等 ${people.length} 人</span>` : ''}</div>` : '<span class="lt-muted">暂无关联人物</span>'}</td><td data-label="展示优先级"><span class="lt-event-importance">${event.importance} / 3</span></td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}

export function collectionSummaryCard(id: string, library: SiteLibrary): string {
  const collection = library.collections.find((item) => item.id === id);
  return collection ? collectionCard(collection, collectionCategoryName(library, collection.category)) : '';
}
