import type { Accuracy, EventRecord, Person, Relation, Topic } from '../types';
import type { Library } from './model';
import {
  EVENT_COLORS,
  SCALE_NAMES,
  SOURCE_KIND_NAMES,
  TYPE_NAMES,
  skinColor,
  type Palette,
  type SkinId,
} from './skins';
import { esc, fmtYear } from './util';

export interface CardContext {
  library: Library;
  skin: SkinId;
  palette: Palette;
  topic: Topic | null;
}

/** 人物卡的字段来源：当前专题里的完整记录，或跨专题瘦索引。 */
interface PersonView {
  id: string;
  name: string;
  display: string;
  title?: string;
  bio?: string;
  lane?: string;
  birth?: number;
  death?: number;
  birthAccuracy?: Accuracy;
  deathAccuracy?: Accuracy;
  birthNote?: string;
  deathNote?: string;
  tags?: string[];
  categories?: string[];
  polity?: string[];
}

function edge(year: number | undefined, accuracy: Accuracy | undefined): string {
  if (year == null) return '不详';
  const mark = accuracy === 'approx' || accuracy === 'disputed' ? '约' : '';
  return `${mark}${fmtYear(year)}`;
}

function chips(items: string[]): string {
  return items.map((item) => `<span class="card-chip">${esc(item)}</span>`).join('');
}

function link(kind: 'person' | 'event', id: string, text: string): string {
  // 人物链接附水墨意象头像，缺图时保留首字 monogram。
  const portrait =
    kind === 'person'
      ? `<span class="lt-portrait-thumb" data-person-image="${esc(id)}" data-person-image-size="400" aria-hidden="true">${esc(text.slice(0, 1))}</span>`
      : '';
  return `<span class="card-link" data-kind="${kind}" data-id="${esc(id)}">${portrait}${esc(text)}</span>`;
}

export function resolvePerson(ctx: CardContext, id: string): PersonView | null {
  const inTopic: Person | undefined = ctx.topic?.people.find((person) => person.id === id);
  if (inTopic) return inTopic;
  const record = ctx.library.personById.get(id);
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    display: record.display,
    title: record.title,
    tags: record.tags,
    categories: record.categories,
    polity: record.polity,
    birth: record.birth,
    death: record.death,
    birthAccuracy: record.birthAccuracy,
    deathAccuracy: record.deathAccuracy,
  };
}

function personLabel(ctx: CardContext, id: string): string | null {
  const person = resolvePerson(ctx, id);
  if (!person) return null;
  return person.display || person.name;
}

function relationsOf(ctx: CardContext, id: string): Relation[] {
  const relations = ctx.topic?.relations ?? [];
  return relations.filter((relation) => relation.source === id || relation.target === id);
}

export function renderPersonCard(ctx: CardContext, id: string): string {
  const person = resolvePerson(ctx, id);
  if (!person) return `<div class="card-kicker">人物</div><div class="card-title">未知条目</div>`;
  const { library, palette: c } = ctx;
  const lane = ctx.topic?.lanes.find((item) => item.id === person.lane);
  const topicEntry = library.topics.find((item) => item.id === ctx.topic?.meta.id);
  const kicker = `人物 · ${lane?.name ?? topicEntry?.title ?? ''}`.trim();

  const notes = [person.birthNote, person.deathNote].filter(Boolean) as string[];
  const life = `${edge(person.birth, person.birthAccuracy)} — ${edge(person.death, person.deathAccuracy)}`;
  const categories = (person.categories ?? []).map((item) => library.categoryNames.get(item) ?? item);
  const polities = (person.polity ?? []).map((item) => library.polityNames.get(item) ?? item);

  const relationRows = relationsOf(ctx, id)
    .map((relation) => {
      const otherId = relation.source === id ? relation.target : relation.source;
      const label = personLabel(ctx, otherId);
      if (!label) return null;
      const type = ctx.topic?.relationTypes.find((item) => item.id === relation.type);
      const typeText = type ? ` <span class="card-meta">${esc(type.name)}</span>` : '';
      const note = relation.note ? ` <span class="card-meta">${esc(relation.note)}</span>` : '';
      return `${link('person', otherId, label)}${typeText}${note}`;
    })
    .filter((row): row is string => Boolean(row));

  const events = (library.eventsByPerson.get(id) ?? []).slice(0, 24);
  const eventRows = events.map((event) => {
    const year = event.endYear ? `${fmtYear(event.year)}—${fmtYear(event.endYear)}` : fmtYear(event.year);
    return `${link('event', event.id, event.display || event.name)} <span class="card-meta">${esc(year)}</span>`;
  });
  const moreEvents = (library.eventsByPerson.get(id) ?? []).length - events.length;

  return `
    <div class="card-media card-media-person"><span class="card-portrait" data-person-image="${esc(id)}" data-person-image-size="400" aria-hidden="true">${esc((person.display || person.name).slice(0, 1))}</span></div>
    <div class="card-kicker">${esc(kicker)}</div>
    <div class="card-title">${esc(person.display || person.name)}</div>
    ${person.title ? `<div class="card-sub">${esc(person.title)}</div>` : ''}
    ${person.display && person.display !== person.name ? `<div class="card-sub">${esc(person.name)}</div>` : ''}
    <div class="card-label">生卒</div>
    <div>${esc(life)}</div>
    ${notes.length > 0 ? `<div class="card-meta">${esc(notes.join('；'))}</div>` : ''}
    ${categories.length > 0 ? `<div class="card-label">分类</div><div>${chips(categories)}</div>` : ''}
    ${polities.length > 0 ? `<div class="card-label">政权</div><div>${chips(polities)}</div>` : ''}
    ${(person.tags ?? []).length > 0 ? `<div class="card-label">标签</div><div>${chips(person.tags ?? [])}</div>` : ''}
    ${person.bio ? `<div class="card-label">简介</div><div>${esc(person.bio)}</div>` : ''}
    ${relationRows.length > 0 ? `<div class="card-label">关系</div><div>${relationRows.join('<br>')}</div>` : ''}
    ${eventRows.length > 0 ? `<div class="card-label">生平事件</div><div>${eventRows.join('<br>')}${moreEvents > 0 ? `<div class="card-meta">另有 ${moreEvents} 条</div>` : ''}</div>` : ''}
    <div class="card-actions">
      <a class="tool" data-open-detail href="/people/${encodeURIComponent(id)}">查看详情</a>
    </div>
    ${person.bio === undefined && !ctx.topic?.people.some((item) => item.id === id) ? `<div class="card-meta" style="color:${esc(c.muted)}">完整条目在它所属的专题里，切换专题后可看简介。</div>` : ''}
  `;
}

export function renderEventCard(ctx: CardContext, event: EventRecord): string {
  const { library, palette: c } = ctx;
  const time =
    event.endYear && event.endYear !== event.year
      ? `${fmtYear(event.year)} — ${fmtYear(event.endYear)}`
      : fmtYear(event.year);
  const notes = [event.yearNote, event.endYearNote].filter(Boolean) as string[];
  const badges = [
    `<span class="badge" data-event-type="${esc(event.type)}" style="background:${esc(skinColor(ctx.skin, EVENT_COLORS[event.type]))}">${esc(TYPE_NAMES[event.type])}</span>`,
    event.scale ? `<span class="badge" style="background:${esc(c.muted)}">${esc(SCALE_NAMES[event.scale])}</span>` : '',
    `<span class="badge" style="background:${esc(c.accent)}">${'★'.repeat(event.importance)}</span>`,
  ]
    .filter(Boolean)
    .join('');

  const belligerents = (event.belligerents ?? []).map((id) => library.polityNames.get(id) ?? id);
  const commanders = (event.commanders ?? []).map((commander) => {
    const label = personLabel(ctx, commander.id) ?? commander.id;
    const side = commander.side ? `（${library.polityNames.get(commander.side) ?? commander.side}）` : '';
    const inner = resolvePerson(ctx, commander.id) ? link('person', commander.id, label) : esc(label);
    return `${inner}${esc(side)}`;
  });
  const people = (event.people ?? [])
    .map((id) => {
      const label = personLabel(ctx, id);
      return label ? link('person', id, label) : null;
    })
    .filter((row): row is string => Boolean(row));

  const parent = event.parent ? library.eventById.get(event.parent) : undefined;
  const dynasties = (event.dynasties ?? []).map((id) => library.dynasties.find((item) => item.id === id)?.name ?? id);

  const sources = new Map<string, string[]>();
  for (const source of event.sources ?? []) {
    const kind = SOURCE_KIND_NAMES[source.kind ?? 'classic'];
    const text = `${source.work}${source.part ? ` · ${source.part}` : ''}${source.note ? ` —— ${source.note}` : ''}`;
    const list = sources.get(kind);
    if (list) list.push(text);
    else sources.set(kind, [text]);
  }
  const sourceHtml = [...sources.entries()]
    .map(
      ([kind, items]) =>
        `<div class="card-src"><span class="card-meta">${esc(kind)}</span>${items.map((item) => `<div>${esc(item)}</div>`).join('')}</div>`,
    )
    .join('');

  return `
    <div class="card-media"><img src="/media/banners/banner-${event.id === 'anshi-zhiluan' ? 'event-anshi' : 'events'}-768.webp" width="2400" height="800" alt="" aria-hidden="true" loading="lazy" decoding="async" /></div>
    <div class="card-kicker">事件 · ${esc(TYPE_NAMES[event.type])}</div>
    <div class="card-title">${esc(event.display || event.name)}</div>
    <div class="card-sub">${esc(time)}　${badges}</div>
    ${notes.length > 0 ? `<div class="card-meta">${esc(notes.join('；'))}</div>` : ''}
    ${event.place ? `<div class="card-label">地点</div><div>${esc(event.place)}${event.placeNow ? `<div class="card-meta">${esc(event.placeNow)}</div>` : ''}</div>` : ''}
    ${belligerents.length > 0 ? `<div class="card-label">交战方</div><div>${esc(belligerents.join(' ／ '))}</div>` : ''}
    ${commanders.length > 0 ? `<div class="card-label">主将</div><div>${commanders.join('、')}</div>` : ''}
    ${event.result ? `<div class="card-label">结果</div><div>${esc(event.result)}</div>` : ''}
    ${event.desc ? `<div class="card-label">描述</div><div>${esc(event.desc)}</div>` : ''}
    ${parent ? `<div class="card-label">上级事件</div><div>${link('event', parent.id, parent.display || parent.name)}</div>` : ''}
    ${dynasties.length > 0 ? `<div class="card-label">朝代</div><div>${chips(dynasties)}</div>` : ''}
    ${(event.aliases ?? []).length > 0 ? `<div class="card-label">别名</div><div>${chips(event.aliases ?? [])}</div>` : ''}
    ${people.length > 0 ? `<div class="card-label">相关人物</div><div>${people.join('、')}</div>` : ''}
    ${sourceHtml ? `<div class="card-label">出处</div>${sourceHtml}` : ''}
    <div class="card-actions">
      <a class="tool" data-open-detail href="/events/${encodeURIComponent(event.id)}">查看详情</a>
    </div>
  `;
}
