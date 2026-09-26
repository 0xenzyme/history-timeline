import { scaleLinear, type ScaleLinear } from 'd3-scale';
import type { Lane, Person, Topic, View } from '../types';
import { toAxis } from './years';

export const AXIS_H = 34;
export const EVENT_BAND_H = 62;
export const LABEL_W = 124;
export const ROW_H = 28;
export const ROW_H_MIN = 26;
export const ROW_H_MAX = 44;
export const LANE_HEAD_H = 20;
export const BAR_H = 13;
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
  /** 当前行距与条高，随可用高度自适应 */
  rowH: number;
  barH: number;
  /** 计算行距时使用的可用高度，用于判断是否需要重排 */
  availHeight: number;
  lanes: LaneBox[];
  rows: Map<string, Row>;
  /**
   * 专题全范围的比例尺。定义域是去掉公元 0 年之后的轴坐标，不是历史年份。
   * 历史年份先经 toAxis 再送进这个比例尺。
   */
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

export function buildLayout(topic: Topic, width: number, view?: View, availHeight?: number): Layout {
  const [topicFrom, topicTo] = topic.meta.range;
  const plotLeft = LABEL_W;
  const plotRight = Math.max(plotLeft + 80, width - 16);
  const plotTop = AXIS_H + EVENT_BAND_H;
  const keep = view?.people !== undefined ? new Set(view.people) : null;

  const rowsPerLane = topic.lanes.map((lane) => {
    const members = topic.people
      .filter((person) => person.lane === lane.id && (keep === null || keep.has(person.id)))
      .sort(comparePeople);
    return { lane, members };
  });
  const visible = rowsPerLane.filter((entry) => entry.members.length > 0);
  const totalRows = visible.reduce((sum, entry) => sum + entry.members.length, 0);

  // 行距在可用高度内自适应，lane 少的专题撑满绘图区，多的保持可滚动
  let rowH = ROW_H;
  if (availHeight !== undefined && availHeight > plotTop && totalRows > 0) {
    const avail = availHeight - plotTop - 24 - visible.length * LANE_HEAD_H;
    rowH = Math.min(ROW_H_MAX, Math.max(ROW_H_MIN, avail / totalRows));
  }
  const barH = Math.round(Math.min(22, Math.max(14, rowH * 0.55)));

  const lanes: LaneBox[] = [];
  const rows = new Map<string, Row>();
  let cursor = plotTop;

  for (const { lane, members } of rowsPerLane) {
    if (members.length === 0) continue;
    const top = cursor;
    const innerTop = top + LANE_HEAD_H;
    const rowsOfLane = members.map((person, index) => {
      const y = innerTop + index * rowH + rowH / 2;
      const row: Row = { person, lane, rowIndex: index, y };
      rows.set(person.id, row);
      return row;
    });
    const bottom = innerTop + members.length * rowH;
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
    rowH,
    barH,
    availHeight: availHeight ?? 0,
    lanes,
    rows,
    xTopic: scaleLinear().domain([toAxis(topicFrom), toAxis(topicTo)]).range([plotLeft, plotRight]),
    topicFrom,
    topicTo,
  };
}
