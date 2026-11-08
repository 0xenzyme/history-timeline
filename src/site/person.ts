import { pageBanner } from './banner';
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
import { icon, type IconId } from './icons';
import type { EventRecord, PersonDetail, PersonExperience } from '../types';

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

function panel(id: string, title: string, iconId: IconId, body: string): string {
  return `<section class="lt-section lt-person-panel" aria-labelledby="${id}"><h2 id="${id}">${icon(iconId)}<span>${escapeHtml(title)}</span></h2>${body}</section>`;
}

function identityFacts(person: PersonDetail, library: SiteLibrary): string {
  const facts: Array<[string, string]> = [];
  if (person.display !== person.name) facts.push(['姓名', person.name]);
  const polities = (person.polity ?? []).map((id) => polityName(library, id));
  const categories = (person.categories ?? []).map((id) => categoryName(library, id));
  if (polities.length) facts.push(['朝代', polities.join('、')]);
  if (categories.length) facts.push(['领域', categories.join('、')]);
  if (!facts.length) return '';
  return `<dl class="lt-person-facts">${facts
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')}</dl>`;
}

function relationList(person: PersonDetail, library: SiteLibrary): string {
  return person.relations
    .map((relation) => {
      const otherId = relation.source === person.id ? relation.target : relation.source;
      const other = library.people.find((item) => item.id === otherId && item.kind !== 'event');
      const otherName = other?.display || other?.name || otherId;
      const direction = relation.directed
        ? relation.source === person.id
          ? `→ ${otherName}`
          : `← ${otherName}`
        : `与 ${otherName}`;
      const topics = relation.topicIds.map(
        (id) => library.catalog?.topics.find((topic) => topic.id === id)?.title ?? id,
      );
      return `<li><div class="lt-person-relation-heading"><span class="lt-person-relation-monogram" aria-hidden="true">${escapeHtml(otherName.slice(0, 1))}</span><div class="lt-person-relation-copy">${other ? entityLink('person', other.id, otherName, 'lt-person-relation-name') : `<span class="lt-person-relation-name">${escapeHtml(otherName)}</span>`}<span class="lt-relation-type">${escapeHtml(relation.type)} · ${escapeHtml(direction)}</span></div></div>${relation.since !== undefined ? `<span class="lt-data lt-person-relation-since">${formatYear(relation.since)}</span>` : ''}${relation.notes
        .filter((note) => note.trim())
        .map((note) => `<p class="lt-person-relation-note">${escapeHtml(note)}</p>`)
        .join('')}${topics.length ? `<small>来源专题：${escapeHtml(topics.join('、'))}</small>` : ''}</li>`;
    })
    .join('');
}

function experienceItem(item: PersonExperience): string {
  const dated = item.year !== undefined && item.yearAccuracy !== 'unknown';
  return `<li><div class="lt-experience-year">${dated ? formatEventRange(item) : '年份待考'}</div><div class="lt-person-experience-copy"><h3>${escapeHtml(item.label)}</h3>${item.place ? `<p class="lt-data lt-person-experience-place">${escapeHtml(item.place)}</p>` : ''}<p class="lt-person-experience-note">${escapeHtml(item.note)}</p>${accuracyNote(item.yearAccuracy, item.yearNote)}${accuracyNote(item.endYearAccuracy, item.endYearNote, '结束')}${item.event ? entityLink('event', item.event, '相关公共事件', 'lt-person-event-link') : ''}${expandableSources(item.sources)}</div></li>`;
}

export function renderPersonDetail(person: PersonDetail, library: SiteLibrary): string {
  const timeline = timelineUrl(person);
  const works = person.works ?? [];
  const experiences = person.experiences ?? [];
  const datedExperiences = experiences
    .filter((item) => item.year !== undefined && item.yearAccuracy !== 'unknown')
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const undatedExperiences = experiences.filter((item) => item.year === undefined || item.yearAccuracy === 'unknown');
  const events = personEvents(person, library);
  const collections = person.collections.flatMap((id) => {
    const collection = library.collections.find((item) => item.id === id);
    return collection ? [collection] : [];
  });
  const tags = [
    ...(person.categories ?? []).map((id) => `<span class="lt-tag">${escapeHtml(categoryName(library, id))}</span>`),
    ...(person.polity ?? []).map(
      (id) => `<span class="lt-tag lt-person-era-tag">${escapeHtml(polityName(library, id))}</span>`,
    ),
  ];
  const breadcrumb = `<div class="lt-page-banner-breadcrumb lt-return-row lt-person-breadcrumb"><button class="lt-return" type="button" data-return-fallback="${escapeHtml(timeline ?? directoryFallback('person'))}">← 返回</button><span class="lt-person-breadcrumb-separator" aria-hidden="true">/</span><nav aria-label="面包屑"><ol><li><a href="/people" data-site-link>列传</a></li><li aria-current="page">${escapeHtml(person.display)}</li></ol></nav></div>`;
  const identity = `<aside class="lt-person-identity" aria-label="人物身份"><div class="lt-person-monogram" data-person-image="${escapeHtml(person.id)}" aria-hidden="true">${escapeHtml(person.display.slice(0, 1))}</div><div class="lt-identity-copy"><p class="lt-life-dates">${lifeDates(person)}</p>${accuracyNote(person.birthAccuracy, person.birthNote, '生')}${accuracyNote(person.deathAccuracy, person.deathNote, '卒')}${tags.length ? `<div class="lt-tags">${tags.join('')}</div>` : ''}${timeline ? `<a class="lt-button lt-person-timeline-button" href="${escapeHtml(timeline)}">${icon('timeline')}<span>在年表中查看</span>${icon('arrow-right')}</a>` : '<p class="lt-notice">缺少可定位的年份。</p>'}${identityFacts(person, library)}</div></aside>`;
  const biography = panel(
    'person-bio',
    '生平简介',
    'book',
    `<p class="lt-prose">${escapeHtml(person.bio ?? '详细生平尚未整理。')}</p>`,
  );
  const experiencePanel = experiences.length
    ? panel(
        'person-experiences',
        '个人经历',
        'calendar',
        `${datedExperiences.length ? `<ol class="lt-experience-list lt-person-experience-list">${datedExperiences.map(experienceItem).join('')}</ol>` : ''}${undatedExperiences.length ? `<h3 class="lt-person-undated-title">年份待考</h3><ol class="lt-experience-list lt-person-experience-list">${undatedExperiences.map(experienceItem).join('')}</ol>` : ''}`,
      )
    : '';
  const workPanel = works.length
    ? panel(
        'person-works',
        '代表作品',
        'book',
        `<div class="lt-work-list lt-person-work-list">${works
          .map(
            (work) =>
              `<article><div class="lt-person-work-heading"><h3><span class="lt-person-work-chip">《${escapeHtml(work.title)}》</span></h3>${work.kind ? `<span class="lt-tag">${escapeHtml(work.kind === 'poetry' ? '诗歌' : work.kind)}</span>` : ''}${work.year !== undefined ? `<span class="lt-data">${formatYear(work.year, work.yearAccuracy)}</span>` : ''}</div>${work.note ? `<p>${escapeHtml(work.note)}</p>` : ''}${accuracyNote(work.yearAccuracy, work.yearNote)}${expandableSources(work.sources)}</article>`,
          )
          .join('')}</div>`,
      )
    : '';
  const relationPanel = person.relations.length
    ? panel(
        'person-relations',
        '重要关系',
        'people',
        `<ul class="lt-relation-list lt-person-relation-list">${relationList(person, library)}</ul>`,
      )
    : '';
  const collectionPanel = collections.length
    ? panel(
        'person-collections',
        '所属群像',
        'collections',
        `<ul class="lt-linked-list lt-person-collection-list">${collections
          .map(
            (collection) =>
              `<li><a href="/collections/${encodeURIComponent(collection.id)}" data-site-link>${escapeHtml(collection.name)}${icon('arrow-up-right')}</a><p>${escapeHtml(collection.summary)}</p></li>`,
          )
          .join('')}</ul>`,
      )
    : '';
  const eventPanel = panel(
    'person-events',
    '时代事件',
    'events',
    events.length
      ? `<ul class="lt-linked-list lt-person-event-list">${events
          .map(
            (event) =>
              `<li>${entityLink('event', event.id, event.display || event.name)}<span class="lt-data">${eventDates(event)}</span>${event.desc ? `<p>${escapeHtml(event.desc)}</p>` : ''}</li>`,
          )
          .join('')}</ul>`
      : '<p class="lt-empty">尚无直接关联事件。</p>',
  );
  const sourcesPanel = person.sources.length
    ? panel('person-sources', '人物出处', 'book', sourceList(person.sources))
    : '';

  return `<main class="lt-page lt-person-page" id="main-content">${pageBanner({
    image: 'people',
    title: person.display,
    subtitle: person.title,
    breadcrumb,
    tone: 'paper',
  })}<div class="lt-detail-grid lt-person-layout">${identity}<div class="lt-detail-main">${biography}${experiencePanel}${workPanel}</div><aside class="lt-detail-aside" aria-label="人物关联">${relationPanel}${collectionPanel}${eventPanel}${sourcesPanel}</aside></div></main>`;
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
