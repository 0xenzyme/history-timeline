import type { EventRecord, EventType, Person, Topic } from '../types';
import { EVENT_COLORS, TYPE_NAMES } from './skins';
import { personFrom, personTo } from './util';

export const AXIS_H = 44;
export const STRIP_H = 40;
export const BAR_H = 16;
export const ROW_GAP = 4;
export const LANE_TITLE_H = 24;
export const LANE_PAD_B = 12;
export const PAD_X = 28;

export interface PersonItem {
  kind: 'person';
  id: string;
  from: number;
  to: number;
  row: number;
  person: Person;
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
  /** 行距。内容不足一屏时会拉开，条本身仍保持 BAR_H 高。 */
  pitch: number;
  items: LayoutItem[];
}

/** 一行的条顶位置。条在行距内垂直居中。 */
export function barTop(lane: LaneLayout, row: number): number {
  return lane.y + LANE_TITLE_H + row * lane.pitch + (lane.pitch - BAR_H) / 2;
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

/** 人物线：泳道内按生卒重叠打包行。 */
export function buildPeopleLayout(topic: Topic, hiddenLanes: Set<string>, pitch: number): LaneLayout[] {
  const layouts: LaneLayout[] = [];
  let y = 0;
  for (const lane of topic.lanes) {
    if (hiddenLanes.has(lane.id)) continue;
    const members = topic.people
      .filter((person) => person.lane === lane.id)
      .sort((a, b) =>
        personFrom(a.birth, a.death) - personFrom(b.birth, b.death)
        || (a.order ?? 99) - (b.order ?? 99));
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
      }),
    );
    const height = laneHeight(packed.rows, pitch);
    layouts.push({ id: lane.id, name: lane.name, color: lane.color, y, height, rows: packed.rows, pitch, items: packed.items });
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
    const inRow = events
      .filter((event) => event.type === type)
      .sort((a, b) => a.year - b.year);
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
      items: packed.items,
    });
    y += height;
  }
  return layouts;
}

export function layoutHeight(layouts: LaneLayout[]): number {
  return layouts.length === 0 ? 0 : layouts[layouts.length - 1].y + layouts[layouts.length - 1].height;
}
