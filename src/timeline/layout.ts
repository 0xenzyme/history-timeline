import { scaleLinear, type ScaleLinear } from 'd3-scale';
import type {
  CenturySegment,
  EventLineView,
  EventRecord,
  EventType,
  Lane,
  Person,
  SearchRecord,
  Topic,
  View,
} from '../types';
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

// 事件线。轴几何与人物线共用 AxisLayout，行距另有一套常量。
export const HEAD_GAP = 12;
export const ROW_H_EVENT = 46;
export const ROW_H_EVENT_MIN = 38;
export const ROW_H_EVENT_MAX = 64;
export const ROW_GAP = 8;
export const SHADOW_ROW_H = 16;
export const SHADOW_BAR_H = 7;
export const EVENT_SPAN_H = 9;

export const EVENT_TYPE_ORDER: EventType[] = [
  'military',
  'political',
  'rebellion',
  'institutional',
  'diplomatic',
  'cultural',
];

/** 行色沿用人物泳道的色板，不新造颜色。 */
export const EVENT_TYPE_META: Record<EventType, { name: string; color: string }> = {
  military: { name: '军事', color: '#a04030' },
  political: { name: '政变 · 事变', color: '#6b5b95' },
  rebellion: { name: '起义 · 民变', color: '#c87f28' },
  institutional: { name: '制度 · 改革', color: '#2f6f9f' },
  diplomatic: { name: '盟约 · 和议', color: '#1f7f8f' },
  cultural: { name: '文化工程', color: '#3f7d52' },
};

/** 人物线与事件线共用的轴几何。yearX / 缩放 / grid 只吃这些字段。 */
export interface AxisLayout {
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
  xTopic: ScaleLinear<number, number>;
  topicFrom: number;
  topicTo: number;
}

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

export interface Layout extends AxisLayout {
  lanes: LaneBox[];
  rows: Map<string, Row>;
}

/** 事件线的一行 = 一个 type。 */
export interface EventTypeRow {
  id: EventType;
  name: string;
  color: string;
  top: number;
  bottom: number;
  /** 行内事件标记的中心线 */
  y: number;
  events: EventRecord[];
}

/** 军事轴背景上的人物影子条。 */
export interface ShadowRow {
  ref: SearchRecord;
  y: number;
}

export interface EventLayout extends AxisLayout {
  /** 按 EVENT_TYPE_ORDER 排布，空 type 不出现 */
  typeRows: EventTypeRow[];
  /** 事件 id → 中心线 y */
  eventY: Map<string, number>;
  shadows: ShadowRow[];
  /** 当前分段，空表示全线 */
  segment: CenturySegment | null;
  /** 本段命中筛选的事件总数，用于空态判断 */
  visibleCount: number;
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

function clampRowH(value: number): number {
  return Math.min(ROW_H_EVENT_MAX, Math.max(ROW_H_EVENT_MIN, value));
}

/**
 * 事件线布局：按 type 分行，行内事件按时间定位。
 * 军事线可以带人物影子条，影子区画在 type 行之上。
 */
export function buildEventLayout(
  line: EventLineView,
  segment: CenturySegment | null,
  filter: { dynasty: string | null },
  width: number,
  availHeight?: number,
  shadows: SearchRecord[] = [],
): EventLayout {
  const [lineFrom, lineTo] = line.range;
  const plotLeft = LABEL_W;
  const plotRight = Math.max(plotLeft + 80, width - 16);
  const plotTop = AXIS_H + HEAD_GAP;

  const byId = new Map(line.events.map((event) => [event.id, event]));
  const scoped = segment
    ? (segment.events.map((id) => byId.get(id)).filter(Boolean) as EventRecord[])
    : [...line.events];
  const visible = filter.dynasty
    ? scoped.filter((event) => event.dynasties?.includes(filter.dynasty!))
    : scoped;

  const shadowH = shadows.length > 0 ? shadows.length * SHADOW_ROW_H + ROW_GAP : 0;
  const rowsTop = plotTop + shadowH;

  const grouped = new Map<EventType, EventRecord[]>();
  for (const event of visible) {
    const list = grouped.get(event.type);
    if (list) list.push(event);
    else grouped.set(event.type, [event]);
  }
  const order = EVENT_TYPE_ORDER.filter((type) => grouped.has(type));

  let rowH = ROW_H_EVENT;
  if (availHeight !== undefined && availHeight > plotTop && order.length > 0) {
    const avail = availHeight - rowsTop - 24;
    rowH = clampRowH(avail / order.length);
  }

  const typeRows: EventTypeRow[] = [];
  const eventY = new Map<string, number>();
  let cursor = rowsTop;
  for (const type of order) {
    const members = grouped.get(type)!.slice().sort((left, right) => left.year - right.year);
    const meta = EVENT_TYPE_META[type];
    const y = cursor + rowH / 2;
    for (const event of members) eventY.set(event.id, y);
    typeRows.push({ id: type, name: meta.name, color: meta.color, top: cursor, bottom: cursor + rowH, y, events: members });
    cursor += rowH;
  }

  const shadowRows: ShadowRow[] = shadows.map((ref, index) => ({
    ref,
    y: plotTop + index * SHADOW_ROW_H + SHADOW_ROW_H / 2,
  }));

  const bottom = order.length > 0 ? cursor : rowsTop;
  // 与人物线一致：不撑满屏高，多余空间交给 stage 的滚动区
  const height = Math.max(bottom + 24, 160);

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom: bottom,
    rowH,
    barH: EVENT_SPAN_H,
    availHeight: availHeight ?? 0,
    xTopic: scaleLinear().domain([toAxis(lineFrom), toAxis(lineTo)]).range([plotLeft, plotRight]),
    topicFrom: lineFrom,
    topicTo: lineTo,
    typeRows,
    eventY,
    shadows: shadowRows,
    segment,
    visibleCount: visible.length,
  };
}

/** 分段区间加一点余量，太窄的段撑到最小宽度。 */
export function segmentDomain(segment: CenturySegment, range: [number, number]): [number, number] {
  const span = segment.to - segment.from;
  const pad = Math.max(span * 0.04, 2);
  const from = Math.max(range[0], Math.round(segment.from - pad));
  const to = Math.min(range[1], Math.round(segment.to + pad));
  if (to - from < 40) {
    const mid = Math.round((from + to) / 2);
    return [Math.max(range[0], mid - 20), Math.min(range[1], mid + 20)];
  }
  return [from, to];
}
