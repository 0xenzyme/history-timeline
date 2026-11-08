import { SCALE_NAMES } from '../app/skins';
import type { EventDetail, EventPartRef, EventRecord } from '../types';
import { bannerPicture } from './banner';
import { entityLink, eventDates, eventType, expandableSources, pageError, sourceList } from './components';
import { loadEvent, polityName, type SiteLibrary } from './data';
import { escapeHtml } from './escape';
import { formatEventRange, yearNote } from './format';
import { icon, type IconId } from './icons';

interface EventAnchor {
  id: string;
  label: string;
  icon: IconId;
}

function timelineUrl(event: EventRecord): string {
  const padding = Math.max(5, Math.round(((event.endYear ?? event.year) - event.year) * 0.5));
  const line = event.catalogs?.includes('history') ? 'history' : 'military';
  return `/timeline?line=${line}&event=${encodeURIComponent(event.id)}&from=${event.year - padding}&to=${(event.endYear ?? event.year) + padding}`;
}

function dynastyName(library: SiteLibrary, id: string): string | null {
  for (const line of library.events) {
    const dynasty = line.dynasties.find((item) => item.id === id);
    if (dynasty) return dynasty.name;
  }
  return null;
}

function compareEvents(a: EventRecord, b: EventRecord): number {
  return a.year - b.year || b.importance - a.importance || a.id.localeCompare(b.id);
}

function heading(iconId: IconId, id: string, label: string, count?: number): string {
  return `<h2 id="${id}">${icon(iconId)}<span>${label}</span>${count === undefined ? '' : `<span class="lt-event-count">${count}</span>`}</h2>`;
}

function anchorLinks(items: EventAnchor[]): string {
  return items
    .map(
      (item, index) =>
        `<a class="lt-event-anchor" href="#${item.id}"${index === 0 ? ' aria-current="location"' : ''}>${icon(item.icon)}<span>${item.label}</span></a>`,
    )
    .join('');
}

function fact(label: string, value: string): string {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function eventRow(event: EventRecord, note?: string, sources?: EventPartRef['sources'], showDate = true): string {
  return `<article class="lt-event-row"><div class="lt-event-row-heading"><div class="lt-event-row-title">${entityLink('event', event.id, event.display || event.name, 'lt-related-name')}${showDate ? `<span class="lt-data">${eventDates(event)}</span>` : ''}</div>${eventType(event)}</div>${note ? `<p class="lt-event-row-note">${escapeHtml(note)}</p>` : event.desc ? `<p class="lt-event-row-note">${escapeHtml(event.desc)}</p>` : ''}${sources ? expandableSources(sources) : ''}</article>`;
}

function chronologyGroup(title: string, note: string, rows: string[]): string {
  return `<section class="lt-event-relation-group"><h3>${title}</h3><p class="lt-section-note">${note}</p><ol class="lt-event-chronology">${rows.join('')}</ol></section>`;
}

function chronologyItem(event: EventRecord, note?: string, sources?: EventPartRef['sources']): string {
  return `<li><span class="lt-event-chronology-marker" aria-hidden="true"></span><div class="lt-event-chronology-date">${eventDates(event)}</div>${eventRow(event, note, sources, false)}</li>`;
}

function peopleSection(event: EventDetail, library: SiteLibrary): string {
  if (event.personRecords.length === 0) return '';
  const commanders = new Map((event.commanders ?? []).map((item) => [item.id, item]));
  const related = new Set(event.people ?? []);
  const cards = event.personRecords
    .map((person) => {
      const commander = commanders.get(person.id);
      const role = [commander ? '主将' : '', related.has(person.id) ? '相关人物' : ''].filter(Boolean).join('、');
      const name = person.display || person.name;
      return `<article class="lt-related-card lt-event-person-card"><span class="lt-event-person-monogram" data-person-image="${escapeHtml(person.id)}" data-person-image-size="400" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span><div>${entityLink('person', person.id, name, 'lt-related-name')}<p>${escapeHtml(role || '相关人物')}</p>${commander?.side ? `<small>${escapeHtml(polityName(library, commander.side))}方</small>` : ''}</div></article>`;
    })
    .join('');
  return `<section class="lt-section lt-event-card lt-event-people-module" id="event-people" aria-labelledby="event-people-title">${heading('people', 'event-people-title', '相关人物', event.personRecords.length)}<div class="lt-event-people-grid">${cards}</div></section>`;
}

function collectionsSection(event: EventDetail, library: SiteLibrary): string {
  const collections = event.collections.flatMap((id) => {
    const collection = library.collections.find((item) => item.id === id);
    return collection ? [collection] : [];
  });
  if (collections.length === 0) return '';
  return `<section class="lt-section lt-event-card" id="event-collections" aria-labelledby="event-collections-title">${heading('collections', 'event-collections-title', '相关群像')}<ul class="lt-event-collection-list">${collections
    .map(
      (collection) =>
        `<li><a href="/collections/${encodeURIComponent(collection.id)}">${escapeHtml(collection.name)}${icon('arrow-up-right')}</a><p>${escapeHtml(collection.summary)}</p></li>`,
    )
    .join('')}</ul></section>`;
}

export function renderEventDetail(event: EventDetail, library: SiteLibrary): string {
  const records = new Map(library.events.flatMap((line) => line.events).map((item) => [item.id, item]));
  const parent = event.parent ? records.get(event.parent) : undefined;
  const children = event.children.flatMap((id) => {
    const child = records.get(id);
    return child ? [child] : [];
  });
  children.sort(compareEvents);
  const components = event.components.slice().sort((a, b) => compareEvents(a.event, b.event));
  const dynastyNames = (event.dynasties ?? []).flatMap((id) => {
    const name = dynastyName(library, id);
    return name ? [name] : [];
  });
  const timeline = timelineUrl(event);
  const nature = event.scale ? SCALE_NAMES[event.scale] : event.kind === 'span' ? '跨年事件' : '单年事件';
  const parties = event.belligerents?.length
    ? fact('交战方', event.belligerents.map((id) => escapeHtml(polityName(library, id))).join('、'))
    : event.polity?.length
      ? fact('政权', event.polity.map((id) => escapeHtml(polityName(library, id))).join('、'))
      : '';

  const chronology = [
    components.length
      ? chronologyGroup(
          '组成事件',
          '组成表示各事件为何构成当前组合的一部分，与军事层级分开记录，不表示因果。',
          components.map((part) => chronologyItem(part.event, part.note, part.sources)),
        )
      : '',
    children.length
      ? chronologyGroup(
          '下级军事行动',
          '军事层级表示战争与其下军事行动，不表示因果。',
          children.map((child) => chronologyItem(child)),
        )
      : '',
  ].join('');
  const chronologySection = chronology
    ? `<section class="lt-section lt-event-card" id="event-chronology" aria-labelledby="event-chronology-title">${heading('timeline', 'event-chronology-title', '事件年表')}${chronology}</section>`
    : '';

  const relations = [
    parent
      ? `<section class="lt-event-relation-group"><h3>上级军事行动</h3><p class="lt-section-note">军事层级表示战争与其下军事行动，不表示因果。</p>${eventRow(parent)}</section>`
      : '',
    event.partOf?.length
      ? `<section class="lt-event-relation-group"><h3>所属组合事件</h3><p class="lt-section-note">组成表示当前事件为何构成组合的一部分，不表示因果。</p>${event.partOf
          .map((part) => {
            const combined = records.get(part.id);
            return combined ? eventRow(combined, part.note, part.sources) : '';
          })
          .join('')}</section>`
      : '',
  ].join('');
  const relationsSection = relations
    ? `<section class="lt-section lt-event-card" id="event-relations" aria-labelledby="event-relations-title">${heading('events', 'event-relations-title', '相关战争或上级事件')}${relations}</section>`
    : '';
  const people = peopleSection(event, library);
  const collections = collectionsSection(event, library);

  const anchors: EventAnchor[] = [
    { id: 'event-overview', label: '事件概览', icon: 'book' },
    { id: 'event-time-place', label: '时间与地点', icon: 'calendar' },
    ...(event.desc ? [{ id: 'event-background', label: '背景与经过', icon: 'events' as const }] : []),
    ...(event.result ? [{ id: 'event-result', label: '结果与影响', icon: 'arrow-right' as const }] : []),
    ...(chronologySection ? [{ id: 'event-chronology', label: '事件年表', icon: 'timeline' as const }] : []),
    ...(people ? [{ id: 'event-people', label: '相关人物', icon: 'people' as const }] : []),
    ...(relationsSection ? [{ id: 'event-relations', label: '相关战争或上级事件', icon: 'events' as const }] : []),
    ...(collections ? [{ id: 'event-collections', label: '相关群像', icon: 'collections' as const }] : []),
    { id: 'event-sources', label: '出处', icon: 'book' },
  ];
  const navigation = anchorLinks(anchors);
  const summary = event.desc?.split('\n')[0];

  return `
    <main class="lt-page lt-event-page" id="main-content">
      <header class="lt-page-banner lt-page-banner-wood lt-event-banner">
        ${bannerPicture(event.id === 'anshi-zhiluan' ? 'event-anshi' : 'events')}
        <div class="lt-page-banner-inner lt-event-banner-inner">
          <div class="lt-page-banner-text lt-event-banner-copy">
            <div class="lt-event-banner-top"><button class="lt-event-return" type="button" data-return-fallback="${escapeHtml(timeline)}">${icon('arrow-right', 'lt-event-return-icon')}<span>返回</span></button><nav class="lt-event-breadcrumb" aria-label="面包屑"><ol><li><a href="/events" data-site-link>纪事</a></li><li aria-current="page">${escapeHtml(event.display)}</li></ol></nav></div>
            <h1 tabindex="-1">${escapeHtml(event.display)}</h1>
            <div class="lt-event-banner-meta"><p class="lt-event-banner-dates">${icon('calendar')}${formatEventRange(event)}</p><div class="lt-tags lt-event-banner-tags">${eventType(event)}${dynastyNames.map((name) => `<span class="lt-tag">${escapeHtml(name)}</span>`).join('')}</div></div>
            ${summary ? `<p class="lt-page-banner-subtitle lt-event-summary">${escapeHtml(summary)}</p>` : ''}
          </div>
          <div class="lt-page-banner-actions lt-event-banner-actions"><a class="lt-button" href="${escapeHtml(timeline)}">${icon('timeline')}<span>在年表中查看</span>${icon('arrow-right')}</a></div>
        </div>
      </header>
      <div class="lt-event-layout">
        <nav class="lt-anchor-nav" aria-label="本页内容"><strong>纪事导航</strong>${navigation}</nav>
        <details class="lt-event-mobile-nav"><summary><span>本页内容</span><strong>事件概览</strong></summary><nav aria-label="本页内容（移动端）">${navigation}</nav></details>
        <div class="lt-detail-main lt-event-main">
          <section class="lt-section lt-event-card" id="event-overview" aria-labelledby="event-overview-title">${heading('book', 'event-overview-title', '事件概览')}<dl class="lt-event-facts">${fact('时间', formatEventRange(event))}${fact('类型', eventType(event))}${dynastyNames.length ? fact('朝代', dynastyNames.map(escapeHtml).join('、')) : ''}${fact('性质', nature)}</dl></section>
          <section class="lt-section lt-event-card" id="event-time-place" aria-labelledby="event-time-place-title">${heading('calendar', 'event-time-place-title', '时间与地点')}<dl class="lt-event-time-list">${fact('时间范围', `<span class="lt-data">${formatEventRange(event)}</span>${yearNote('起始', event.yearNote)}${yearNote('结束', event.endYearNote)}`)}${event.place ? fact('地点', `${escapeHtml(event.place)}${event.placeNow ? `<small>${escapeHtml(event.placeNow)}</small>` : ''}`) : event.placeNow ? fact('今地', escapeHtml(event.placeNow)) : ''}${parties}</dl></section>
          ${event.desc ? `<section class="lt-section lt-event-card" id="event-background" aria-labelledby="event-background-title">${heading('events', 'event-background-title', '背景与经过')}<p class="lt-prose">${escapeHtml(event.desc)}</p></section>` : ''}
          ${event.result ? `<section class="lt-section lt-event-card" id="event-result" aria-labelledby="event-result-title">${heading('arrow-right', 'event-result-title', '结果与影响')}<p class="lt-prose">${escapeHtml(event.result)}</p></section>` : ''}
          ${chronologySection}
        </div>
        <aside class="lt-detail-aside lt-event-aside" aria-label="相关人物、事件与出处">
          ${people}
          ${relationsSection}
          ${collections}
          <section class="lt-section lt-event-card" id="event-sources" aria-labelledby="event-sources-title">${heading('book', 'event-sources-title', '出处')}${sourceList(event.sources)}</section>
        </aside>
      </div>
    </main>`;
}

export async function eventPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    return renderEventDetail(await loadEvent(id), library);
  } catch (error) {
    return pageError('event', id, error instanceof Error && error.message.includes('404'));
  }
}
