import { escapeHtml } from './escape';
import {
  accuracyNote,
  entityLink,
  eventDates,
  expandableSources,
  lifeDates,
  pageError,
  sourceList,
} from './components';
import { categoryName, eventRecords, loadPerson, polityName, type SiteLibrary } from './data';
import { directoryFallback } from './context';
import { formatEventRange, formatYear } from './format';
import type { EventRecord, PersonDetail } from '../types';

function timelineUrl(person: PersonDetail): string | null {
  if (person.birth === undefined && person.death === undefined) return null;
  const start = person.birth ?? person.death!;
  const end = person.death ?? person.birth!;
  const padding = Math.max(8, Math.round((end - start) * 0.15));
  const topic = person.topics[0]?.id;
  if (!topic) return null;
  return `/timeline?topic=${encodeURIComponent(topic)}&person=${encodeURIComponent(person.id)}&from=${start - padding}&to=${end + padding}`;
}

function personEvents(person: PersonDetail, library: SiteLibrary): EventRecord[] {
  const records = new Map(eventRecords(library).map((event) => [event.id, event]));
  return person.events.flatMap((ref) => {
    const event = records.get(ref.id);
    return event ? [event] : [];
  });
}

export function renderPersonDetail(person: PersonDetail, library: SiteLibrary): string {
  const timeline = timelineUrl(person);
  const works = person.works ?? [];
  const experiences = person.experiences ?? [];
  const datedExperiences = experiences
    .filter((item) => item.year !== undefined)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const undatedExperiences = experiences.filter((item) => item.year === undefined);
  const relations = person.relations.map((relation) => {
    const otherId = relation.source === person.id ? relation.target : relation.source;
    const other = library.people.find((item) => item.id === otherId && item.kind !== 'event');
    const direction = relation.directed
      ? relation.source === person.id
        ? `→ ${other?.display || other?.name || otherId}`
        : `← ${other?.display || other?.name || otherId}`
      : `与 ${other?.display || other?.name || otherId}`;
    return `<li>${other ? entityLink('person', other.id, other.display || other.name) : escapeHtml(otherId)}<span class="lt-relation-type">${escapeHtml(relation.type)} · ${escapeHtml(direction)}</span>${relation.since ? `<span class="lt-data">${formatYear(relation.since)}</span>` : ''}${relation.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}<small>来源专题：${relation.topicIds.map((id) => escapeHtml(library.catalog?.topics.find((topic) => topic.id === id)?.title ?? id)).join('、')}</small></li>`;
  });
  const events = personEvents(person, library);
  return `
    <main class="lt-page lt-person-page" id="main-content">
      <div class="lt-return-row"><button class="lt-return" type="button" data-return-fallback="${escapeHtml(timeline ?? directoryFallback('person'))}">← 返回</button><nav aria-label="面包屑"><ol><li><a href="/people" data-site-link>列传</a></li><li aria-current="page">${escapeHtml(person.display)}</li></ol></nav></div>
      <section class="lt-person-identity" aria-labelledby="person-title">
        <div class="lt-person-monogram" data-person-image="${escapeHtml(person.id)}" aria-hidden="true">${escapeHtml(person.display.slice(0, 1))}</div>
        <div class="lt-identity-copy"><h1 id="person-title" tabindex="-1">${escapeHtml(person.display)}</h1>${person.display !== person.name ? `<p class="lt-person-name">${escapeHtml(person.name)}</p>` : ''}<p class="lt-life-dates">${lifeDates(person)}</p>${accuracyNote(person.birthAccuracy, person.birthNote, '生')}${accuracyNote(person.deathAccuracy, person.deathNote, '卒')}${person.title ? `<p class="lt-person-title">${escapeHtml(person.title)}</p>` : ''}<div class="lt-tags">${(person.categories ?? []).map((id) => `<span class="lt-tag">${escapeHtml(categoryName(library, id))}</span>`).join('')}${(person.polity ?? []).map((id) => `<span class="lt-tag">${escapeHtml(polityName(library, id))}</span>`).join('')}</div>${timeline ? `<a class="lt-button" href="${escapeHtml(timeline)}">在年表中查看 →</a>` : '<p class="lt-notice">缺少可定位的年份。</p>'}</div>
      </section>
      <div class="lt-detail-grid">
        <div class="lt-detail-main">
          <section class="lt-section" aria-labelledby="person-bio"><h2 id="person-bio">生平简介</h2><p class="lt-prose">${escapeHtml(person.bio ?? '详细生平尚未整理。')}</p></section>
          ${experiences.length ? `<section class="lt-section" aria-labelledby="person-experiences"><h2 id="person-experiences">个人经历</h2><ol class="lt-experience-list">${datedExperiences.map((item) => `<li><div class="lt-experience-year">${formatEventRange(item)}</div><div><h3>${escapeHtml(item.label)}</h3>${item.place ? `<p class="lt-data">${escapeHtml(item.place)}</p>` : ''}<p>${escapeHtml(item.note)}</p>${accuracyNote(item.yearAccuracy, item.yearNote)}${item.event ? entityLink('event', item.event, '相关公共事件') : ''}${expandableSources(item.sources)}</div></li>`).join('')}</ol>${undatedExperiences.length ? `<h3>年份待考</h3><ul>${undatedExperiences.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.note)}</p>${expandableSources(item.sources)}</li>`).join('')}</ul>` : ''}</section>` : ''}
          <section class="lt-section" aria-labelledby="person-events"><h2 id="person-events">时代事件</h2>${events.length ? `<ul class="lt-linked-list">${events.map((event) => `<li>${entityLink('event', event.id, event.display || event.name)}<span class="lt-data">${eventDates(event)}</span><p>${escapeHtml(event.desc ?? '')}</p></li>`).join('')}</ul>` : '<p class="lt-empty">尚无直接关联事件。</p>'}</section>
          ${works.length ? `<section class="lt-section" aria-labelledby="person-works"><h2 id="person-works">代表作品</h2><div class="lt-work-list">${works.map((work) => `<article><h3>${escapeHtml(work.title)}</h3>${work.kind ? `<span class="lt-tag">${escapeHtml(work.kind === 'poetry' ? '诗歌' : work.kind)}</span>` : ''}${work.year !== undefined ? `<p class="lt-data">${formatYear(work.year, work.yearAccuracy)}</p>` : ''}${work.note ? `<p>${escapeHtml(work.note)}</p>` : ''}${accuracyNote(work.yearAccuracy, work.yearNote)}${expandableSources(work.sources)}</article>`).join('')}</div></section>` : ''}
        </div>
        <aside class="lt-detail-aside">
          <section class="lt-section"><h2>重要关系</h2>${relations.length ? `<ul class="lt-relation-list">${relations.join('')}</ul>` : '<p class="lt-empty">尚无直接关系。</p>'}</section>
      ${
        person.collections.length
          ? `<section class="lt-section"><h2>所属群像</h2><ul class="lt-linked-list">${person.collections
              .map((id) => {
                const collection = library.collections.find((item) => item.id === id);
                return collection
                  ? `<li><a href="/collections/${encodeURIComponent(id)}">${escapeHtml(collection.name)}</a><p>${escapeHtml(collection.summary)}</p></li>`
                  : '';
              })
              .join('')}</ul></section>`
          : ''
      }<section class="lt-section"><h2>人物出处</h2>${sourceList(person.sources)}</section>
        </aside>
      </div>
    </main>`;
}

export async function personPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    const person = await loadPerson(id);
    return renderPersonDetail(person, library);
  } catch (error) {
    const notFound = error instanceof Error && error.message.includes('404');
    return pageError('person', id, notFound);
  }
}
