import { ACCURACY_LABEL, formatEventRange, formatLifespan, formatYearShort, lifespanSpan } from '../format';
import type { EventRecord, EventType, Person, SearchRecord, Topic } from '../types';
import { EVENT_TYPE_META } from '../timeline/layout';
import { esc } from '../timeline/svg';

export function renderCard(topic: Topic, person: Person | null): string {
  if (!person) return '';

  const lanes = new Map(topic.lanes.map((lane) => [lane.id, lane]));
  const people = new Map(topic.people.map((p) => [p.id, p]));
  const types = new Map(topic.relationTypes.map((type) => [type.id, type]));
  const lane = lanes.get(person.lane);

  const relations = topic.relations
    .filter((rel) => rel.source === person.id || rel.target === person.id)
    .map((rel) => {
      const otherId = rel.source === person.id ? rel.target : rel.source;
      const other = people.get(otherId);
      const type = types.get(rel.type);
      if (!other) return '';
      const since = rel.since !== undefined ? `<span class="rel-since">${esc(formatYearShort(rel.since))}</span>` : '';
      return `<li><button type="button" class="rel" data-goto="${esc(other.id)}">
        <span class="rel-top">
          <i class="swatch" style="background:${esc(type?.color ?? '#8a8f98')}"></i>
          <span class="rel-type">${esc(type?.name ?? rel.type)}</span>
          <span class="rel-name">${esc(other.display)}</span>
          ${since}
        </span>
        ${rel.note ? `<em class="rel-note">${esc(rel.note)}</em>` : ''}
      </button></li>`;
    })
    .filter(Boolean)
    .join('');

  const events = topic.events
    .filter((event) => event.people?.includes(person.id) === true)
    .sort((a, b) => a.year - b.year)
    .map(
      (event) =>
        `<li><span class="ev-year">${esc(formatYearShort(event.year))}</span>${esc(event.name)}</li>`,
    )
    .join('');

  const notes: string[] = [];
  if (person.birthAccuracy !== 'exact') {
    notes.push(
      `生年${ACCURACY_LABEL[person.birthAccuracy]}${person.birthNote ? ` · ${person.birthNote}` : ''}`,
    );
  }
  if (person.deathAccuracy !== 'exact') {
    notes.push(
      `卒年${ACCURACY_LABEL[person.deathAccuracy]}${person.deathNote ? ` · ${person.deathNote}` : ''}`,
    );
  }

  const span = lifespanSpan(person);
  const hasRelations = relations.length > 0;

  return `
    <div class="card-head">
      <span class="card-lane" style="color:${esc(lane?.color ?? '#666')}">${esc(lane?.name ?? '')}</span>
      <button type="button" class="card-close" data-close-card="1" aria-label="关闭">×</button>
    </div>
    <h2 class="card-name">${esc(person.display)}<span>${esc(person.name)}</span></h2>
    ${person.title ? `<p class="card-title">${esc(person.title)}</p>` : ''}
    <p class="card-life">${esc(formatLifespan(person))}${span ? `<b>· ${esc(span)}</b>` : ''}</p>
    ${notes.length > 0 ? `<p class="card-note">${notes.map(esc).join('<br />')}</p>` : ''}
    ${person.bio ? `<p class="card-bio">${esc(person.bio)}</p>` : ''}
    ${
      person.tags && person.tags.length > 0
        ? `<div class="card-tags">${person.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>`
        : ''
    }
    <div class="card-actions">
      <button type="button" class="card-action" data-open-graph="1"${hasRelations ? '' : ' disabled'} ${hasRelations ? '' : 'title="还没有录入关系"'}>关系全景</button>
    </div>
    ${relations ? `<h3 class="card-h3">关系</h3><ul class="card-relations">${relations}</ul>` : ''}
    ${events ? `<h3 class="card-h3">相关事件</h3><ul class="card-events">${events}</ul>` : ''}
  `;
}

/** 事件卡。主将复用搜索的跨专题跳转（data-search-jump）。 */
export function renderEventCard(
  event: EventRecord,
  lineId: 'military' | 'history',
  polities: Map<string, string>,
  people: Map<string, SearchRecord>,
): string {
  const meta: { name: string; color: string } = EVENT_TYPE_META[event.type as EventType];
  const range = formatEventRange(event.year, event.endYear, event.yearAccuracy);

  const notes: string[] = [];
  if (event.yearAccuracy !== 'exact') {
    notes.push(`年份${ACCURACY_LABEL[event.yearAccuracy]}${event.yearNote ? ` · ${event.yearNote}` : ''}`);
  }
  if (event.endYear !== undefined && event.endYearAccuracy && event.endYearAccuracy !== 'exact') {
    notes.push(`结束年份${ACCURACY_LABEL[event.endYearAccuracy]}${event.endYearNote ? ` · ${event.endYearNote}` : ''}`);
  }

  const place =
    event.place || event.placeNow
      ? `<p class="card-title">${esc(event.place ?? '')}${event.placeNow ? `<b>· ${esc(event.placeNow)}</b>` : ''}</p>`
      : '';

  const sides = (event.belligerents ?? [])
    .map((id) => `<span>${esc(polities.get(id) ?? id)}</span>`)
    .join('');

  const commanders = (event.commanders ?? [])
    .map((commander) => {
      const ref = people.get(commander.id);
      const label = ref?.display ?? commander.id;
      if (!ref) return `<span>${esc(label)}</span>`;
      return `<button type="button" class="rel" data-search-jump="${esc(ref.topicId)}/${esc(ref.id)}">${esc(label)}</button>`;
    })
    .join('');

  const others = (event.people ?? [])
    .filter((id) => !(event.commanders ?? []).some((commander) => commander.id === id))
    .map((id) => {
      const ref = people.get(id);
      if (!ref) return `<li>${esc(id)}</li>`;
      return `<li><button type="button" class="rel" data-search-jump="${esc(ref.topicId)}/${esc(ref.id)}">${esc(ref.display)}</button></li>`;
    })
    .join('');

  const sources = event.sources
    .map((source) => `<li>${esc(source.work)}${source.part ? ` · ${esc(source.part)}` : ''}</li>`)
    .join('');

  // 显式进入 military catalog 的事件在历史目录里也收录，给它一条回到军事线的路。
  // 缺省 catalogs 的存量事件沿用 type=military 的兼容规则。
  const inMilitary = event.catalogs?.includes('military') ?? event.type === 'military';
  const jump =
    inMilitary && lineId === 'history'
      ? `<button type="button" class="card-action" data-line-jump="military">在军事线查看</button>`
      : '';

  return `
    <div class="card-head">
      <span class="card-lane" style="color:${esc(meta.color)}">${esc(meta.name)}</span>
      <button type="button" class="card-close" data-close-card="1" aria-label="关闭">×</button>
    </div>
    <h2 class="card-name">${esc(event.display)}<span>${esc(event.name)}</span></h2>
    <p class="card-life">${esc(range)}</p>
    ${place}
    ${notes.length > 0 ? `<p class="card-note">${notes.map(esc).join('<br />')}</p>` : ''}
    ${event.result ? `<p class="card-bio">${esc(event.result)}</p>` : ''}
    ${event.desc ? `<p class="card-bio">${esc(event.desc)}</p>` : ''}
    ${sides ? `<h3 class="card-h3">交战方</h3><div class="card-tags">${sides}</div>` : ''}
    ${commanders ? `<h3 class="card-h3">主将</h3><div class="card-tags">${commanders}</div>` : ''}
    ${others ? `<h3 class="card-h3">相关人物</h3><ul class="card-events">${others}</ul>` : ''}
    <div class="card-actions">${jump}</div>
    ${sources ? `<h3 class="card-h3">出处</h3><ul class="card-events">${sources}</ul>` : ''}
  `;
}
