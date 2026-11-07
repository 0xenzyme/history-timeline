import { escapeHtml } from './escape';
import { entityLink, eventDates, eventType, expandableSources, pageError, sourceList } from './components';
import { loadEvent, polityName, type SiteLibrary } from './data';
import { formatEventRange } from './format';
import type { EventDetail, EventPartRef, EventRecord } from '../types';

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

function eventRow(event: EventRecord, note?: string, sources?: EventPartRef['sources']): string {
  return `<article class="lt-event-row"><div>${entityLink('event', event.id, event.display || event.name, 'lt-related-name')}<span class="lt-data">${eventDates(event)}</span></div>${eventType(event)}${note ? `<p>${escapeHtml(note)}</p>` : event.desc ? `<p>${escapeHtml(event.desc)}</p>` : ''}${sources ? expandableSources(sources) : ''}</article>`;
}

function people(event: EventDetail, library: SiteLibrary): string {
  const commanderIds = new Set((event.commanders ?? []).map((item) => item.id));
  const roles = new Map(
    event.personRecords.map((person) => [
      person.id,
      [commanderIds.has(person.id) ? '主将' : '', (event.people ?? []).includes(person.id) ? '相关人物' : '']
        .filter(Boolean)
        .join('、'),
    ]),
  );
  if (roles.size === 0) return '<p class="lt-empty">尚无直接关联人物。</p>';
  return `<div class="lt-related-grid">${event.personRecords.map((person) => `<article class="lt-related-card">${entityLink('person', person.id, person.display || person.name, 'lt-related-name')}<p>${escapeHtml(roles.get(person.id) ?? '相关人物')}</p>${(event.commanders ?? []).find((item) => item.id === person.id)?.side ? `<small>${escapeHtml(polityName(library, (event.commanders ?? []).find((item) => item.id === person.id)!.side!))}</small>` : ''}</article>`).join('')}</div>`;
}

export function renderEventDetail(event: EventDetail, library: SiteLibrary): string {
  const parent = event.parent
    ? library.events.flatMap((line) => line.events).find((item) => item.id === event.parent)
    : undefined;
  const children = event.children.flatMap((id) => {
    const child = library.events.flatMap((line) => line.events).find((item) => item.id === id);
    return child ? [child] : [];
  });
  return `
    <main class="lt-page lt-event-page" id="main-content">
      <div class="lt-return-row"><button class="lt-return" type="button" data-return-fallback="${timelineUrl(event)}">← 返回</button><nav aria-label="面包屑"><ol><li><a href="/events" data-site-link>纪事</a></li><li aria-current="page">${escapeHtml(event.display)}</li></ol></nav></div>
      <header class="lt-event-hero"><div><h1 tabindex="-1">${escapeHtml(event.display)}</h1><p class="lt-life-dates">${formatEventRange(event)}</p><div class="lt-tags">${eventType(event)}${(
        event.dynasties ?? []
      )
        .flatMap((id) => {
          const name = dynastyName(library, id);
          return name ? [`<span class="lt-tag">${escapeHtml(name)}</span>`] : [];
        })
        .join(
          '',
        )}</div><p class="lt-event-summary">${escapeHtml(event.desc?.split('\n')[0] ?? '事件说明尚未整理。')}</p></div><a class="lt-button" href="${timelineUrl(event)}">在年表中查看 →</a></header>
      <div class="lt-event-layout"><nav class="lt-anchor-nav" aria-label="本页内容"><strong>本页内容</strong><a href="#event-overview">事件概览</a>${event.result ? '<a href="#event-result">结果与影响</a>' : ''}<a href="#event-composition">事件关系</a><a href="#event-people">相关人物</a><a href="#event-sources">出处</a></nav>
        <div class="lt-detail-main">
          <section class="lt-section" id="event-overview"><h2>事件概览</h2><dl class="lt-facts"><div><dt>时间</dt><dd>${formatEventRange(event)}${event.yearNote ? `<details class="lt-year-note"><summary>年份说明</summary><p>${escapeHtml(event.yearNote)}</p></details>` : ''}</dd></div><div><dt>类型</dt><dd>${eventType(event)}</dd></div><div><dt>地点</dt><dd>${escapeHtml(event.place ?? '地点未记录')}${event.placeNow ? `<small>${escapeHtml(event.placeNow)}</small>` : ''}</dd></div>${event.belligerents?.length ? `<div><dt>交战方</dt><dd>${event.belligerents.map((id) => escapeHtml(polityName(library, id))).join('、')}</dd></div>` : event.polity?.length ? `<div><dt>政权</dt><dd>${event.polity.map((id) => escapeHtml(polityName(library, id))).join('、')}</dd></div>` : ''}</dl><p class="lt-prose">${escapeHtml(event.desc ?? '事件说明尚未整理。')}</p></section>
          ${event.result ? `<section class="lt-section" id="event-result"><h2>结果与影响</h2><p class="lt-prose">${escapeHtml(event.result)}</p></section>` : ''}
          <section class="lt-section" id="event-composition"><h2>事件关系</h2>
            ${parent ? `<section class="lt-relation-group"><h3>上级军事行动</h3><p class="lt-section-note">军事层级表示战争与其下军事行动，不表示因果。</p>${eventRow(parent)}</section>` : ''}
            ${children.length ? `<section class="lt-relation-group"><h3>下级军事行动</h3><p class="lt-section-note">军事层级表示战争与其下军事行动，不表示因果。</p>${children.map((child) => eventRow(child)).join('')}</section>` : ''}
            ${
              event.partOf?.length
                ? `<section class="lt-relation-group"><h3>所属组合事件</h3><p class="lt-section-note">组成表示当前事件为何构成组合的一部分，不表示因果。</p>${event.partOf
                    .map((part) => {
                      const combined = library.events
                        .flatMap((line) => line.events)
                        .find((item) => item.id === part.id);
                      return combined ? eventRow(combined, part.note, part.sources) : '';
                    })
                    .join('')}</section>`
                : ''
            }
            ${event.components.length ? `<section class="lt-relation-group"><h3>组成事件</h3><p class="lt-section-note">组成表示各事件为何构成当前组合的一部分，与军事层级分开记录，不表示因果。</p>${event.components.map((part) => eventRow(part.event, part.note, part.sources)).join('')}</section>` : ''}
            ${!parent && !children.length && !event.partOf?.length && !event.components.length ? '<p class="lt-empty">尚无直接事件关系。</p>' : ''}
          </section>
          <section class="lt-section" id="event-people"><h2>相关人物</h2>${people(event, library)}</section>
        </div>
      </div>
      <section class="lt-section lt-sources-section" id="event-sources"><h2>出处</h2>${sourceList(event.sources)}</section>
      ${
        event.collections.length
          ? `<section class="lt-section"><h2>相关群像</h2><ul class="lt-linked-list">${event.collections
              .map((id) => {
                const collection = library.collections.find((item) => item.id === id);
                return collection
                  ? `<li><a href="/collections/${encodeURIComponent(id)}">${escapeHtml(collection.name)}</a></li>`
                  : '';
              })
              .join('')}</ul></section>`
          : ''
      }
    </main>`;
}

export async function eventPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    return renderEventDetail(await loadEvent(id), library);
  } catch (error) {
    return pageError('event', id, error instanceof Error && error.message.includes('404'));
  }
}
