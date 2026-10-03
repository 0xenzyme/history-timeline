import type { Person, SearchRecord, Topic } from '../types';
import { formatEventRange, formatLifespan } from '../format';
import { esc } from '../timeline/svg';

export interface SearchRow {
  key: string;
  personId: string;
  topicId: string | null;
  kind: 'person' | 'event';
  /** 事件行才有：军事 / 历史事件 */
  lineId: string | null;
  display: string;
  meta: string;
  note: string | null;
}

interface Scored {
  score: number;
  note: string | null;
}

export function searchPeople(topic: Topic, query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return topic.people
    .map((person) => ({ person, scored: scoreFields(person.display, person.name, person.title, person.tags, q) }))
    .filter((item) => item.scored.score > 0)
    .sort((a, b) => b.scored.score - a.scored.score || a.person.display.localeCompare(b.person.display, 'zh'))
    .slice(0, 8)
    .map((item) => item.person);
}

/** topic 传 null 表示当前在事件线上，只搜全局索引。 */
export function buildSearchRows(
  topic: Topic | null,
  query: string,
  index: SearchRecord[] | null,
): { rows: SearchRow[]; notice: string | null; pending: boolean } {
  const q = query.trim();
  if (!q) return { rows: [], notice: null, pending: false };
  const needle = q.toLowerCase();

  if (topic) {
    const local = topic.people
      .map((person) => ({
        person,
        scored: scoreFields(person.display, person.name, person.title, person.tags, needle),
      }))
      .filter((item) => item.scored.score > 0)
      .sort((a, b) => b.scored.score - a.scored.score || a.person.display.localeCompare(b.person.display, 'zh'))
      .slice(0, 8)
      .map((item) => rowFromPerson(item.person, item.scored.note));
    if (local.length > 0) return { rows: local, notice: null, pending: false };
  }

  if (!index) return { rows: [], notice: null, pending: true };

  const remote = index
    .filter((record) => record.topicId !== topic?.meta.id)
    .map((record) => ({
      record,
      scored: scoreFields(record.display, record.name, record.title, record.tags, needle),
    }))
    .filter((item) => item.scored.score > 0)
    .sort(
      (a, b) =>
        b.scored.score - a.scored.score ||
        a.record.topicTitle.localeCompare(b.record.topicTitle, 'zh') ||
        a.record.display.localeCompare(b.record.display, 'zh'),
    )
    .slice(0, 6)
    .map((item) =>
      item.record.kind === 'event' ? rowFromEvent(item.record, item.scored.note) : rowFromRecord(item.record, item.scored.note),
    );

  return {
    rows: remote,
    notice: topic ? `${topic.meta.title}没有「${q}」` : null,
    pending: false,
  };
}

function rowFromPerson(person: Person, note: string | null): SearchRow {
  return {
    key: person.id,
    personId: person.id,
    topicId: null,
    kind: 'person',
    lineId: null,
    display: person.display,
    meta: `${person.name} · ${formatLifespan(person)}`,
    note,
  };
}

function rowFromRecord(record: SearchRecord, note: string | null): SearchRow {
  const person: Person = {
    id: record.id,
    name: record.name,
    display: record.display,
    lane: '',
    birthAccuracy: record.birthAccuracy ?? 'unknown',
    deathAccuracy: record.deathAccuracy ?? 'unknown',
  };
  if (record.birth !== undefined) person.birth = record.birth;
  if (record.death !== undefined) person.death = record.death;
  return {
    key: `${record.topicId}/${record.id}`,
    personId: record.id,
    topicId: record.topicId,
    kind: 'person',
    lineId: null,
    display: record.display,
    meta: `${record.topicTitle} · ${formatLifespan(person)}`,
    note,
  };
}

function rowFromEvent(record: SearchRecord, note: string | null): SearchRow {
  return {
    key: `${record.topicId}/${record.id}`,
    personId: record.id,
    topicId: record.topicId,
    kind: 'event',
    lineId: record.topicId,
    display: record.display,
    meta: `${record.topicTitle} · ${formatEventRange(record.year ?? 0, record.endYear, record.yearAccuracy ?? 'exact')}`,
    note,
  };
}

function scoreFields(
  display: string,
  name: string,
  title: string | undefined,
  tags: string[] | undefined,
  q: string,
): Scored {
  const displayL = display.toLowerCase();
  const nameL = name.toLowerCase();
  if (displayL === q || nameL === q) return { score: 100, note: null };
  if (displayL.startsWith(q) || nameL.startsWith(q)) return { score: 80, note: null };
  if (displayL.includes(q) || nameL.includes(q)) return { score: 60, note: null };
  const tag = tags?.find((item) => item.toLowerCase().includes(q));
  if (tag) return { score: 40, note: tag };
  if (title?.toLowerCase().includes(q)) return { score: 20, note: title };
  return { score: 0, note: null };
}

export function renderSearchResults(
  rows: SearchRow[],
  query: string,
  notice: string | null,
  pending: boolean,
  activeIndex = -1,
): string {
  if (!query.trim()) return '';
  const parts: string[] = [];
  if (pending) {
    parts.push(`<p class="search-empty" role="status">正在查找其他专题</p>`);
  } else if (notice) {
    parts.push(`<p class="search-empty" role="status">${esc(notice)}</p>`);
  }
  if (rows.length === 0) {
    if (!pending && !notice) parts.push(`<p class="search-empty" role="status">没有匹配的人物或事件</p>`);
    return parts.join('');
  }
  if (notice && rows.length > 0) {
    parts.push(`<p class="search-elsewhere">其他专题</p>`);
  }
  parts.push(
    `<ul>${rows
      .map((row, index) => {
        const active = index === activeIndex;
        const attrs =
          row.kind === 'event'
            ? `data-search-event="${esc(row.lineId ?? '')}/${esc(row.personId)}"`
            : row.topicId === null
              ? `data-search-hit="${esc(row.personId)}"`
              : `data-search-jump="${esc(row.topicId)}/${esc(row.personId)}"`;
        return `<li><button type="button" id="search-hit-${esc(row.key)}" class="search-hit${active ? ' is-active' : ''}${row.kind === 'event' ? ' is-event' : ''}" role="option" aria-selected="${active}" ${attrs}>
          <span class="search-hit-name">${row.kind === 'event' ? '<i class="search-hit-kind">事件</i>' : ''}${esc(row.display)}</span>
          <span class="search-hit-meta">${esc(row.meta)}</span>
          ${row.note ? `<span class="search-hit-note">${esc(row.note)}</span>` : ''}
        </button></li>`;
      })
      .join('')}</ul>`,
  );
  return parts.join('');
}
