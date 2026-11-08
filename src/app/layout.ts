import type { EventRecord, EventType, Person, Topic } from '../types';
import { EVENT_COLORS, TYPE_NAMES } from './skins';
import { personFrom, personTo } from './util';

export const AXIS_H = 48;
export const STRIP_H = 40;
export const BAR_H = 16;
export const ROW_GAP = 4;
export const LANE_TITLE_H = 32;
export const LANE_PAD_B = 12;
export const PAD_X = 28;
export const LARGE_ROW_PITCH = 64;
export const LARGE_ROW_GUTTER = 168;
export const COMPACT_LARGE_ROW_GUTTER = 112;
export const EXPANDED_EVENT_H = 40;

export type LanePresentation = 'dense' | 'large';

export interface PersonItem {
  kind: 'person';
  id: string;
  from: number;
  to: number;
  row: number;
  person: Person;
  /** 合并人物区仍保留原始专题 lane 色。 */
  color?: string;
}

export interface EventItem {
  kind: 'event';
  id: string;
  from: number;
  to: number;
  row: number;
  event: EventRecord;
}

export type LayoutItem = PersonItem | EventItem;

export interface LaneLayout {
  id: string;
  name: string;
  color: string;
  y: number;
  height: number;
  rows: number;
  /** 行距。密条内容不足一屏时可拉开，大行保持固定行高。 */
  pitch: number;
  presentation?: LanePresentation;
  items: LayoutItem[];
}

/** 一行的密条顶位置。大行的人物信息与生命线共用这一垂直中心。 */
export function barTop(lane: LaneLayout, row: number): number {
  return lane.y + LANE_TITLE_H + row * lane.pitch + (lane.pitch - BAR_H) / 2;
}

export function itemHeight(lane: LaneLayout, item: LayoutItem): number {
  return lane.presentation === 'large' && item.kind === 'event' && item.event.kind === 'span'
    ? EXPANDED_EVENT_H
    : BAR_H;
}

export function itemTop(lane: LaneLayout, item: LayoutItem): number {
  return barTop(lane, item.row) - (itemHeight(lane, item) - BAR_H) / 2;
}

function laneHeight(rows: number, pitch: number): number {
  return LANE_TITLE_H + rows * pitch + LANE_PAD_B;
}

/** 军事 / 历史事件线各自的行定义。行 = 事件 type。 */
export const LINE_TYPES: Record<'military' | 'history', EventType[]> = {
  military: ['military', 'rebellion'],
  history: ['military', 'political', 'rebellion', 'institutional', 'diplomatic', 'cultural'],
};

function pack<T>(
  items: T[],
  from: (item: T) => number,
  to: (item: T) => number,
  gap: number,
  make: (item: T, row: number) => LayoutItem,
): { items: LayoutItem[]; rows: number } {
  const rowEnd: number[] = [];
  const laid: LayoutItem[] = [];
  for (const item of items) {
    let row = rowEnd.findIndex((end) => end + gap < from(item));
    if (row === -1) {
      row = rowEnd.length;
      rowEnd.push(-Infinity);
    }
    rowEnd[row] = to(item);
    laid.push(make(item, row));
  }
  return { items: laid, rows: rowEnd.length };
}

function overlapsDomain(from: number, to: number, domain: [number, number] | undefined): boolean {
  return !domain || (to >= domain[0] && from <= domain[1]);
}

/** 章节 people 是明确的人物编排；没有名单的章节保留专题全量。 */
export function topicPeopleForView(topic: Topic, viewId: string | null | undefined): Person[] {
  const view = topic.views.find((item) => item.id === viewId);
  if (!view?.people) return topic.people;
  const included = new Set(view.people);
  return topic.people.filter((person) => included.has(person.id));
}

/** 人物线：独立泳道内按生卒重叠打包行。旧版与测试继续使用此布局。 */
export function buildPeopleLayout(topic: Topic, hiddenLanes: Set<string>, pitch: number): LaneLayout[] {
  const layouts: LaneLayout[] = [];
  let y = 0;
  for (const lane of topic.lanes) {
    if (hiddenLanes.has(lane.id)) continue;
    const members = topic.people
      .filter((person) => person.lane === lane.id)
      .sort((a, b) => personFrom(a.birth, a.death) - personFrom(b.birth, b.death) || (a.order ?? 99) - (b.order ?? 99));
    const packed = pack(
      members,
      (person) => personFrom(person.birth, person.death),
      (person) => personTo(person.birth, person.death),
      2,
      (person, row): LayoutItem => ({
        kind: 'person',
        id: person.id,
        from: personFrom(person.birth, person.death),
        to: personTo(person.birth, person.death),
        row,
        person,
        color: lane.color,
      }),
    );
    const height = laneHeight(packed.rows, pitch);
    layouts.push({
      id: lane.id,
      name: lane.name,
      color: lane.color,
      y,
      height,
      rows: packed.rows,
      pitch,
      presentation: 'dense',
      items: packed.items,
    });
    y += height;
  }
  return layouts;
}

/** 事件线：按 type 分行，行内按年份重叠打包。 */
export function buildEventLayout(
  events: EventRecord[],
  line: 'military' | 'history',
  hiddenLanes: Set<string>,
  pitch: number,
): LaneLayout[] {
  const layouts: LaneLayout[] = [];
  let y = 0;
  for (const type of LINE_TYPES[line]) {
    if (hiddenLanes.has(type)) continue;
    const inRow = events.filter((event) => event.type === type).sort((a, b) => a.year - b.year);
    if (inRow.length === 0) continue;
    const packed = pack(
      inRow,
      (event) => event.year,
      (event) => event.endYear ?? event.year,
      1,
      (event, row): LayoutItem => ({
        kind: 'event',
        id: event.id,
        from: event.year,
        to: event.endYear ?? event.year,
        row,
        event,
      }),
    );
    const height = laneHeight(packed.rows, pitch);
    layouts.push({
      id: type,
      name: TYPE_NAMES[type],
      color: EVENT_COLORS[type],
      y,
      height,
      rows: packed.rows,
      pitch,
      presentation: 'dense',
      items: packed.items,
    });
    y += height;
  }
  return layouts;
}

export function layoutHeight(layouts: LaneLayout[]): number {
  return layouts.length === 0 ? 0 : layouts[layouts.length - 1].y + layouts[layouts.length - 1].height;
}

/** 02 同图的三类实体分组：人物（专题泳道）、战事、历史事件。 */
export interface EntityGroups {
  people: boolean;
  war: boolean;
  history: boolean;
}

export interface CombinedLayoutOptions {
  viewId?: string | null;
  domain?: [number, number];
  largeRows?: boolean;
}

const WAR_TYPES: EventType[] = ['military', 'rebellion'];
const HISTORY_TYPES: EventType[] = ['political', 'institutional', 'diplomatic', 'cultural'];

/** 合并人物区：原始 lane 只负责筛选和颜色，不再把首屏拆成许多小区块。 */
function buildCombinedPeopleLayout(
  topic: Topic,
  hiddenLanes: Set<string>,
  pitch: number,
  options: CombinedLayoutOptions,
): LaneLayout {
  const members = topicPeopleForView(topic, options.viewId)
    .filter((person) => !hiddenLanes.has(person.lane))
    .filter((person) =>
      overlapsDomain(personFrom(person.birth, person.death), personTo(person.birth, person.death), options.domain),
    )
    .sort((a, b) => personFrom(a.birth, a.death) - personFrom(b.birth, b.death) || (a.order ?? 99) - (b.order ?? 99));
  const laneColors = new Map(topic.lanes.map((lane) => [lane.id, lane.color]));
  const make = (person: Person, row: number): LayoutItem => ({
    kind: 'person',
    id: person.id,
    from: personFrom(person.birth, person.death),
    to: personTo(person.birth, person.death),
    row,
    person,
    color: laneColors.get(person.lane),
  });
  const packed = options.largeRows
    ? { items: members.map((person, row) => make(person, row)), rows: members.length }
    : pack(
        members,
        (person) => personFrom(person.birth, person.death),
        (person) => personTo(person.birth, person.death),
        2,
        make,
      );
  return {
    id: 'people',
    name: '人物（生卒年）',
    color: topic.lanes[0]?.color ?? EVENT_COLORS.political,
    y: 0,
    height: laneHeight(packed.rows, pitch),
    rows: packed.rows,
    pitch,
    presentation: options.largeRows ? 'large' : 'dense',
    items: packed.items,
  };
}

/**
 * 人物、战事、历史事件共用当前时间窗。大行一人一行，密条继续按生卒重叠打包。
 * 窗外实体不占行号，也不参与首屏高度与标签避让。
 */
export function buildCombinedLayout(
  topic: Topic,
  events: EventRecord[],
  hiddenLanes: Set<string>,
  groups: EntityGroups,
  pitch: number,
  options: CombinedLayoutOptions = {},
): LaneLayout[] {
  const layouts: LaneLayout[] = [];
  if (groups.people) layouts.push(buildCombinedPeopleLayout(topic, hiddenLanes, pitch, options));
  const sections: Array<{ key: 'war' | 'history'; name: string; types: EventType[]; color: string }> = [
    { key: 'war', name: '战事', types: WAR_TYPES, color: EVENT_COLORS.military },
    { key: 'history', name: '历史事件', types: HISTORY_TYPES, color: EVENT_COLORS.political },
  ];
  for (const section of sections) {
    if (!groups[section.key]) continue;
    const inSection = events
      .filter((event) => section.types.includes(event.type))
      .filter((event) => overlapsDomain(event.year, event.endYear ?? event.year, options.domain))
      .sort((a, b) => a.year - b.year);
    if (inSection.length === 0) continue;
    const packed = pack(
      inSection,
      (event) => event.year,
      (event) => event.endYear ?? event.year,
      1,
      (event, row): LayoutItem => ({
        kind: 'event',
        id: event.id,
        from: event.year,
        to: event.endYear ?? event.year,
        row,
        event,
      }),
    );
    const y = layoutHeight(layouts);
    layouts.push({
      id: section.key,
      name: section.name,
      color: section.color,
      y,
      height: laneHeight(packed.rows, pitch),
      rows: packed.rows,
      pitch,
      presentation: options.largeRows ? 'large' : 'dense',
      items: packed.items,
    });
  }
  return layouts;
}
