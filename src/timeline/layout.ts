import { scaleLinear, type ScaleLinear } from 'd3-scale';
import type { Lane, Person, Topic, View } from '../types';

export const AXIS_H = 34;
export const EVENT_BAND_H = 62;
export const LABEL_W = 124;
export const ROW_H = 28;
export const LANE_HEAD_H = 20;
export const BAR_H = 13;
/** 生年/卒年不详时，开放条在屏幕空间的延伸长度 */
export const OPEN_STUB = 56;
/** 年代为约略或异说时，该端在屏幕空间的渐隐长度 */
export const FADE_APPROX = 16;

export interface Row {
  person: Person;
  lane: Lane;
  rowIndex: number;
  y: number;
}

export interface LaneBox {
  lane: Lane;
  top: number;
  bottom: number;
  rows: Row[];
}

export interface Layout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  lanes: LaneBox[];
  rows: Map<string, Row>;
  /** 专题全范围的比例尺，缩放以它为基础 */
  xTopic: ScaleLinear<number, number>;
  topicFrom: number;
  topicTo: number;
}

export function sortYear(person: Person): number {
  return person.birth ?? person.death ?? 0;
}

function comparePeople(a: Person, b: Person): number {
  const diff = sortYear(a) - sortYear(b);
  if (diff !== 0) return diff;
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
}

export function buildLayout(topic: Topic, width: number, view?: View): Layout {
  const [topicFrom, topicTo] = topic.meta.range;
  const plotLeft = LABEL_W;
  const plotRight = Math.max(plotLeft + 360, width - 16);
  const plotTop = AXIS_H + EVENT_BAND_H;
  const keep = view?.people !== undefined ? new Set(view.people) : null;

  const lanes: LaneBox[] = [];
  const rows = new Map<string, Row>();
  let cursor = plotTop;

  for (const lane of topic.lanes) {
    const members = topic.people
      .filter((person) => person.lane === lane.id && (keep === null || keep.has(person.id)))
      .sort(comparePeople);
    if (members.length === 0) continue;
    const top = cursor;
    const innerTop = top + LANE_HEAD_H;
    const rowsOfLane = members.map((person, index) => {
      const y = innerTop + index * ROW_H + ROW_H / 2;
      const row: Row = { person, lane, rowIndex: index, y };
      rows.set(person.id, row);
      return row;
    });
    const bottom = innerTop + members.length * ROW_H;
    lanes.push({ lane, top, bottom, rows: rowsOfLane });
    cursor = bottom;
  }

  return {
    width,
    height: cursor + 24,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom: cursor,
    lanes,
    rows,
    xTopic: scaleLinear().domain([topicFrom, topicTo]).range([plotLeft, plotRight]),
    topicFrom,
    topicTo,
  };
}
