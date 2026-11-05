/**
 * 绘制引擎：坐标换算、画布场景、吸顶头部、事件密度带、星空与关系线。
 * 只读取 runtime 的共享状态，不发起导航或 DOM 装配。
 */

import type { DynastyTerm, EventRecord, Person, Topic } from '../types';
import { AXIS_H, BAR_H, LANE_TITLE_H, PAD_X, STRIP_H, barTop, type LaneLayout, type LayoutItem } from './layout';
import { EVENT_COLORS, SKINS, paletteFor, skinColor, type Palette } from './skins';
import { FONT_SANS, clamp, fmtYear, personFrom, personTo, pickStep, roundRect } from './util';
import { contentH, ctx, dom, H, layouts, loadingTopic, rctx, sctx, state, W } from './runtime';

// ---------- 坐标 ----------

/**
 * 人物线的可达跨度：专题声明的范围，并覆盖每条人物条形的实际端点。
 * 专题数据一次载入后不再变，所以按专题 id 缓存。
 */
let peopleSpanCache: { topicId: string; span: [number, number] } | null = null;

export function peopleSpan(topic: Topic): [number, number] {
  if (peopleSpanCache && peopleSpanCache.topicId === topic.meta.id) {
    const cached = peopleSpanCache.span;
    return [cached[0], cached[1]];
  }
  let [lo, hi] = topic.meta.range;
  for (const person of topic.people) {
    lo = Math.min(lo, personFrom(person.birth, person.death));
    hi = Math.max(hi, personTo(person.birth, person.death));
  }
  peopleSpanCache = { topicId: topic.meta.id, span: [lo, hi] };
  return [lo, hi];
}

/** 视野钳制的完整跨度：人物线跟着当前专题，事件线跟着该条目录自己的范围。 */
export function fullSpan(): [number, number] {
  const line = state.line;
  if (line === 'people') return state.topic ? peopleSpan(state.topic) : state.library.lines.history.range;
  return state.library.lines[line].range;
}

export function xOf(year: number): number {
  const [d0, d1] = state.domain;
  if (d1 === d0) return PAD_X;
  return PAD_X + ((year - d0) / (d1 - d0)) * (W - PAD_X * 2);
}

export function yearAt(px: number): number {
  const [d0, d1] = state.domain;
  return d0 + ((px - PAD_X) / (W - PAD_X * 2)) * (d1 - d0);
}

export function hdrH(): number {
  return AXIS_H + (state.line === 'people' && state.stripOpen ? STRIP_H : 0);
}

export function maxScroll(): number {
  return Math.max(0, contentH - (H - hdrH()));
}

// ---------- 筛选 ----------

/** 当前内容线要画的事件：人物线取全量，事件线取本目录。 */
export function visibleEvents(): EventRecord[] {
  if (state.line === 'people') return state.library.events;
  return state.library.lines[state.line].events;
}

export function chipMatchEvent(event: EventRecord): boolean {
  const chip = state.chip;
  if (chip === 'all') return true;
  if (chip === 'female') return false;
  const groups: Record<'military' | 'political' | 'cultural', EventRecord['type'][]> = {
    military: ['military', 'rebellion'],
    political: ['political', 'institutional', 'diplomatic'],
    cultural: ['cultural'],
  };
  return groups[chip].includes(event.type);
}

export function personDim(person: Person): boolean {
  if (state.chip === 'female') return person.gender !== 'female';
  return false;
}

// ---------- 绘制 ----------

export function skinPalette(): Palette {
  return paletteFor(state.skin);
}

export function draw(): void {
  renderScene(ctx, W, H);
  renderRibbon(rctx, 0, 0, dom.ribbon.clientWidth, dom.ribbon.clientHeight);
  updateNebula();
}

export function renderScene(c: CanvasRenderingContext2D, width: number, height: number): void {
  const C = skinPalette();
  c.clearRect(0, 0, width, height);
  if (state.skin === 'voyage') {
    c.fillStyle = C.paper;
    c.fillRect(0, 0, width, height);
  }
  if (layouts.length === 0) {
    c.fillStyle = C.muted;
    c.font = `13px ${FONT_SANS}`;
    c.textAlign = 'center';
    c.fillText(loadingTopic ? '正在载入专题…' : '当前筛选下没有条目', width / 2, height / 2);
    c.textAlign = 'left';
    return;
  }
  drawGridlines(c);
  drawLanes(c, width, height);
  drawHeader(c, width);
}

function drawGridlines(c: CanvasRenderingContext2D): void {
  const C = skinPalette();
  const [d0, d1] = state.domain;
  const step = pickStep((d1 - d0) / 12);
  c.strokeStyle = C.hair;
  c.lineWidth = 1;
  c.beginPath();
  for (let year = Math.ceil(d0 / step) * step; year <= d1; year += step) {
    const x = Math.round(xOf(year)) + 0.5;
    c.moveTo(x, hdrH());
    c.lineTo(x, H);
  }
  c.stroke();
}

function drawLanes(c: CanvasRenderingContext2D, width: number, height: number): void {
  const skin = SKINS[state.skin];
  const C = skinPalette();
  c.save();
  c.beginPath();
  c.rect(0, hdrH(), width, height - hdrH());
  c.clip();
  c.translate(0, hdrH() - state.scrollY);

  if (state.line === 'people') {
    for (const event of state.library.events) {
      if (event.kind !== 'span' || event.endYear === undefined) continue;
      const x0 = xOf(event.year);
      const x1 = xOf(event.endYear);
      const color = skinColor(state.skin, EVENT_COLORS[event.type]);
      if (skin.glow) {
        const gradient = c.createLinearGradient(0, 0, 0, contentH);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.25, color);
        gradient.addColorStop(0.75, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gradient;
      } else {
        c.fillStyle = color;
      }
      c.globalAlpha = chipMatchEvent(event) ? C.eventAlpha : C.eventAlphaDim;
      c.fillRect(x0, 0, Math.max(2, x1 - x0), contentH);
    }
    c.globalAlpha = 1;
    if (state.selected && state.selected.kind === 'person') drawRelations(c);
  }

  for (const lane of layouts) {
    c.fillStyle = C.laneLabel;
    c.font = `12px ${FONT_SANS}`;
    c.textAlign = 'left';
    c.fillText(lane.name, PAD_X, lane.y + 15);
    c.strokeStyle = C.hair;
    c.beginPath();
    c.moveTo(PAD_X, lane.y + LANE_TITLE_H - 6);
    c.lineTo(width - PAD_X, lane.y + LANE_TITLE_H - 6);
    c.stroke();

    const placements = labelPlacements(c, lane);
    for (const item of lane.items) {
      const yTop = barTop(lane, item.row);
      const placement = placements.get(item.id) ?? 'none';
      if (item.kind === 'event') drawEventBar(c, item, lane, yTop, placement);
      else drawPersonBar(c, item.person, lane, yTop, placement);
    }
  }
  c.restore();
}

/** 行内标签避让：条内 > 右侧 > 左侧 > 不画（hover 有 tooltip 兜底）。 */
function layoutRowLabels(
  entries: { key: string; x0: number; x1: number; lw: number; canInside: boolean }[],
): Map<string, Placement> {
  const occupied = entries.map((entry) => [entry.x0, entry.x1] as [number, number]);
  const fits = (a0: number, a1: number): boolean => !occupied.some(([b0, b1]) => a0 < b1 && a1 > b0);
  const result = new Map<string, Placement>();
  for (const entry of entries) {
    if (entry.canInside && entry.lw + 10 <= entry.x1 - entry.x0) {
      result.set(entry.key, 'inside');
      continue;
    }
    const right0 = entry.x1 + 5;
    if (fits(right0, right0 + entry.lw)) {
      result.set(entry.key, 'right');
      occupied.push([right0, right0 + entry.lw]);
      continue;
    }
    const left1 = entry.x0 - 5;
    if (fits(left1 - entry.lw, left1)) {
      result.set(entry.key, 'left');
      occupied.push([left1 - entry.lw, left1]);
      continue;
    }
    result.set(entry.key, 'none');
  }
  return result;
}

type Placement = 'inside' | 'right' | 'left' | 'none';

export function entryRect(item: LayoutItem): {
  key: string;
  x0: number;
  x1: number;
  label: string;
  canInside: boolean;
} {
  if (item.kind === 'person') {
    const x0 = xOf(item.from);
    const x1 = Math.max(x0 + 3, xOf(item.to));
    return { key: item.id, x0, x1, label: item.person.display || item.person.name, canInside: true };
  }
  const label = item.event.display || item.event.name;
  if (item.event.kind === 'span') {
    const x0 = xOf(item.event.year);
    const x1 = Math.max(x0 + 4, xOf(item.event.endYear ?? item.event.year));
    return { key: item.id, x0, x1, label, canInside: true };
  }
  const radius = markerRadius(item.event);
  const x = xOf(item.event.year);
  return { key: item.id, x0: x - radius, x1: x + radius, label, canInside: false };
}

export function labelPlacements(c: CanvasRenderingContext2D, lane: LaneLayout): Map<string, Placement> {
  c.font = `11px ${FONT_SANS}`;
  const rows = new Map<number, { key: string; x0: number; x1: number; lw: number; canInside: boolean }[]>();
  for (const item of lane.items) {
    const rect = entryRect(item);
    const entry = { ...rect, lw: c.measureText(rect.label).width };
    const list = rows.get(item.row);
    if (list) list.push(entry);
    else rows.set(item.row, [entry]);
  }
  const out = new Map<string, Placement>();
  for (const list of rows.values()) {
    for (const [key, value] of layoutRowLabels(list)) out.set(key, value);
  }
  return out;
}

export const markerRadius = (event: EventRecord): number => 4 + (event.importance || 1) * 1.2;

function drawEventBar(
  c: CanvasRenderingContext2D,
  item: Extract<LayoutItem, { kind: 'event' }>,
  lane: LaneLayout,
  yTop: number,
  placement: Placement,
): void {
  const C = skinPalette();
  const event = item.event;
  const color = laneColor(lane);
  const selected = state.selected?.kind === 'event' && state.selected.id === event.id;
  const dim = !chipMatchEvent(event);
  c.globalAlpha = dim ? 0.15 : 1;

  if (event.kind === 'span') {
    const x0 = xOf(event.year);
    const x1 = xOf(event.endYear ?? event.year);
    const width = Math.max(4, x1 - x0);
    c.fillStyle = color;
    if (SKINS[state.skin].glow && !dim) {
      c.shadowColor = color;
      c.shadowBlur = 7;
    }
    c.beginPath();
    roundRect(c, x0, yTop, width, BAR_H, 3);
    c.fill();
    c.shadowBlur = 0;
    drawLabel(c, event.display || event.name, placement, x0, x0 + width, yTop, dim);
    if (selected) {
      c.strokeStyle = C.accent;
      c.lineWidth = 2;
      if (SKINS[state.skin].glow) {
        c.shadowColor = C.accent;
        c.shadowBlur = 12;
      }
      c.beginPath();
      roundRect(c, x0 - 2.5, yTop - 2.5, width + 5, BAR_H + 5, 5);
      c.stroke();
      c.shadowBlur = 0;
    }
  } else {
    const x = xOf(event.year);
    const radius = markerRadius(event);
    c.fillStyle = color;
    if (SKINS[state.skin].glow && !dim) {
      c.shadowColor = color;
      c.shadowBlur = 8;
    }
    c.beginPath();
    c.moveTo(x, yTop + BAR_H / 2 - radius);
    c.lineTo(x + radius, yTop + BAR_H / 2);
    c.lineTo(x, yTop + BAR_H / 2 + radius);
    c.lineTo(x - radius, yTop + BAR_H / 2);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    drawLabel(
      c,
      event.display || event.name,
      placement === 'inside' ? 'right' : placement,
      x - radius,
      x + radius,
      yTop,
      dim,
    );
    if (selected) {
      c.strokeStyle = C.accent;
      c.lineWidth = 2;
      if (SKINS[state.skin].glow) {
        c.shadowColor = C.accent;
        c.shadowBlur = 12;
      }
      c.beginPath();
      c.arc(x, yTop + BAR_H / 2, radius + 3.5, 0, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0;
    }
  }
  c.globalAlpha = 1;
}

function drawPersonBar(
  c: CanvasRenderingContext2D,
  person: Person,
  lane: LaneLayout,
  yTop: number,
  placement: Placement,
): void {
  const C = skinPalette();
  const hasBirth = person.birth != null;
  const hasDeath = person.death != null;
  const x0 = xOf(personFrom(person.birth, person.death));
  const x1 = xOf(personTo(person.birth, person.death));
  const width = Math.max(3, x1 - x0);
  const selected = state.selected?.kind === 'person' && state.selected.id === person.id;
  const dim = personDim(person);
  const color = laneColor(lane);

  c.globalAlpha = dim ? 0.15 : 1;
  if (!hasBirth || !hasDeath) {
    const gradient = c.createLinearGradient(x0, 0, x0 + width, 0);
    if (!hasBirth) {
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.45, color);
      gradient.addColorStop(1, color);
    } else {
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.55, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    }
    c.fillStyle = gradient;
  } else {
    c.fillStyle = color;
  }
  if (SKINS[state.skin].glow && !dim) {
    c.shadowColor = color;
    c.shadowBlur = 7;
  }
  c.beginPath();
  roundRect(c, x0, yTop, width, BAR_H, 3);
  c.fill();
  c.shadowBlur = 0;

  const accuracies = [person.birthAccuracy, person.deathAccuracy];
  if (accuracies.includes('disputed')) {
    c.strokeStyle = color;
    c.setLineDash([1.5, 3]);
    c.lineWidth = 1.5;
    c.beginPath();
    roundRect(c, x0, yTop, width, BAR_H, 3);
    c.stroke();
    c.setLineDash([]);
  } else if (accuracies.includes('approx')) {
    c.strokeStyle = color;
    c.setLineDash([4, 3]);
    c.lineWidth = 1;
    c.beginPath();
    roundRect(c, x0, yTop, width, BAR_H, 3);
    c.stroke();
    c.setLineDash([]);
  }

  drawLabel(c, person.display || person.name, placement, x0, x0 + width, yTop, dim);

  if (selected) {
    c.strokeStyle = C.accent;
    c.lineWidth = 2;
    if (SKINS[state.skin].glow) {
      c.shadowColor = C.accent;
      c.shadowBlur = 12;
    }
    c.beginPath();
    roundRect(c, x0 - 2.5, yTop - 2.5, width + 5, BAR_H + 5, 5);
    c.stroke();
    c.shadowBlur = 0;
  }
  c.globalAlpha = 1;
}

function drawLabel(
  c: CanvasRenderingContext2D,
  label: string,
  placement: Placement,
  x0: number,
  x1: number,
  yTop: number,
  dim: boolean,
): void {
  const C = skinPalette();
  if (placement === 'none') return;
  c.font = `11px ${FONT_SANS}`;
  if (placement === 'inside') {
    c.fillStyle = C.labelInBar;
    c.textAlign = 'left';
    c.fillText(label, x0 + 5, yTop + BAR_H - 4.5);
  } else if (placement === 'right') {
    c.fillStyle = dim ? C.muted : C.ink2;
    c.textAlign = 'left';
    c.fillText(label, x1 + 5, yTop + BAR_H - 4.5);
  } else {
    c.fillStyle = dim ? C.muted : C.ink2;
    c.textAlign = 'right';
    c.fillText(label, x0 - 5, yTop + BAR_H - 4.5);
    c.textAlign = 'left';
  }
}

function laneColor(lane: LaneLayout): string {
  return skinColor(state.skin, lane.color);
}

function drawRelations(c: CanvasRenderingContext2D): void {
  const selection = state.selected;
  const topic = state.topic;
  if (!selection || selection.kind !== 'person' || !topic) return;
  const mine = barCenter(selection.id);
  if (!mine) return;
  const C = skinPalette();
  for (const relation of topic.relations) {
    if (relation.source !== selection.id && relation.target !== selection.id) continue;
    const otherId = relation.source === selection.id ? relation.target : relation.source;
    const other = barCenter(otherId);
    if (!other) continue;
    const type = topic.relationTypes.find((item) => item.id === relation.type);
    const color = type?.color ? skinColor(state.skin, type.color) : C.muted;
    const midX = (mine.x + other.x) / 2;
    const midY = (mine.y + other.y) / 2 - 24;
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    if (SKINS[state.skin].glow) {
      c.shadowColor = color;
      c.shadowBlur = 6;
    }
    if (type?.dash) c.setLineDash(type.dash.split(' ').map(Number));
    c.beginPath();
    c.moveTo(mine.x, mine.y);
    c.quadraticCurveTo(midX, midY, other.x, other.y);
    c.stroke();
    c.setLineDash([]);
    c.shadowBlur = 0;
    if (type) {
      c.fillStyle = color;
      c.font = `10px ${FONT_SANS}`;
      c.textAlign = 'center';
      c.fillText(type.name, midX, midY - 2);
      c.textAlign = 'left';
    }
  }
}

function barCenter(id: string): { x: number; y: number } | null {
  for (const lane of layouts) {
    for (const item of lane.items) {
      if (item.id !== id || item.kind !== 'person') continue;
      return {
        x: (xOf(item.from) + xOf(item.to)) / 2,
        y: barTop(lane, item.row) + BAR_H / 2,
      };
    }
  }
  return null;
}

// ---------- 吸顶头部 ----------

function drawHeader(c: CanvasRenderingContext2D, width: number): void {
  const skin = SKINS[state.skin];
  const C = skinPalette();
  c.save();
  c.fillStyle = C.headerBg;
  c.fillRect(0, 0, width, hdrH());

  const dynasties = state.library.dynasties;
  const paintOrder = [...dynasties].sort((a, b) => b.to - b.from - (a.to - a.from));
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const hues = dynastyHues(dynasties);
  for (const dynasty of paintOrder) {
    const x0 = Math.max(0, xOf(dynasty.from));
    const x1 = Math.min(width, xOf(dynasty.to));
    const bandW = x1 - x0;
    if (x1 <= 0 || x0 >= width || bandW < 2) continue;
    c.fillStyle = skin.footerBand(hues.get(dynasty.id) ?? 0);
    c.fillRect(x0, 0, bandW, AXIS_H);
    if (coveredAt((dynasty.from + dynasty.to) / 2, dynasty, dynasties)) continue;
    c.fillStyle = C.ribbonText;
    if (bandW > 110) {
      c.font = `bold 11px ${FONT_SANS}`;
      c.fillText(`${dynasty.name} ${fmtYear(dynasty.from)}—${fmtYear(dynasty.to)}`, (x0 + x1) / 2, 15);
    } else if (bandW > 40) {
      c.font = `bold 11px ${FONT_SANS}`;
      c.fillText(dynasty.name, (x0 + x1) / 2, 15);
    }
  }

  const [d0, d1] = state.domain;
  c.lineWidth = 1;

  const step = pickStep((d1 - d0) / 12);
  c.fillStyle = C.ink2;
  c.strokeStyle = C.ink2;
  c.font = `11px ${FONT_SANS}`;
  c.textAlign = 'center';
  c.beginPath();
  for (let year = Math.ceil(d0 / step) * step; year <= d1; year += step) {
    const x = Math.round(xOf(year)) + 0.5;
    c.moveTo(x, AXIS_H - 22);
    c.lineTo(x, AXIS_H - 16);
    c.fillText(fmtYear(year), x, AXIS_H - 4);
  }
  c.stroke();

  if (d0 < 0 && d1 > 0) {
    const x = Math.round(xOf(0)) + 0.5;
    c.strokeStyle = C.accent;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, hdrH());
    c.stroke();
  }

  c.strokeStyle = C.line;
  c.beginPath();
  c.moveTo(0, AXIS_H + 0.5);
  c.lineTo(width, AXIS_H + 0.5);
  c.stroke();

  if (state.line === 'people' && state.stripOpen) drawEventStrip(c, width);

  c.strokeStyle = C.line;
  c.beginPath();
  c.moveTo(0, hdrH() - 0.5);
  c.lineTo(width, hdrH() - 0.5);
  c.stroke();
  c.restore();
}

/** 一个更窄的朝代覆盖中心年份时，不再画这条朝代的标签。 */
function coveredAt(year: number, self: DynastyTerm, all: DynastyTerm[]): boolean {
  const span = self.to - self.from;
  return all.some((item) => item.id !== self.id && item.to - item.from < span && year >= item.from && year <= item.to);
}

function dynastyHues(dynasties: DynastyTerm[]): Map<string, number> {
  const hues = new Map<string, number>();
  dynasties.forEach((dynasty, index) => hues.set(dynasty.id, (index * 41) % 360));
  return hues;
}

/** 事件条带：像素距离小于 32 时聚合成计数标记。 */
function drawEventStrip(c: CanvasRenderingContext2D, width: number): void {
  const skin = SKINS[state.skin];
  const C = skinPalette();
  const [d0, d1] = state.domain;
  const events = state.library.events
    .filter((event) => event.year >= d0 - 5 && event.year <= d1 + 5 && chipMatchEvent(event))
    .sort((a, b) => a.year - b.year);
  if (events.length === 0) return;

  const clusters: EventRecord[][] = [];
  let current: EventRecord[] = [events[0]];
  for (let i = 1; i < events.length; i += 1) {
    const event = events[i];
    const distance = xOf(event.year) - xOf(current[current.length - 1].year);
    if (distance < 32) current.push(event);
    else {
      clusters.push(current);
      current = [event];
    }
  }
  clusters.push(current);

  const stripTop = AXIS_H;
  let labelRow = 0;
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const event = cluster[0];
      const x = xOf(event.year);
      const color = skinColor(state.skin, EVENT_COLORS[event.type]);
      const selected = state.selected?.kind === 'event' && state.selected.id === event.id;
      if (skin.glow) {
        c.shadowColor = color;
        c.shadowBlur = 8;
      }
      c.fillStyle = color;
      if (event.kind === 'span' && event.endYear !== undefined) {
        const x1 = xOf(event.endYear);
        c.beginPath();
        roundRect(c, x, stripTop + STRIP_H - 12, Math.max(3, x1 - x), 8, 3);
        c.fill();
      } else {
        const radius = 2.5 + (event.importance || 1) * 1.5;
        c.beginPath();
        c.moveTo(x, stripTop + STRIP_H - 16 - radius);
        c.lineTo(x + radius, stripTop + STRIP_H - 16);
        c.lineTo(x, stripTop + STRIP_H - 16 + radius);
        c.lineTo(x - radius, stripTop + STRIP_H - 16);
        c.closePath();
        c.fill();
      }
      c.shadowBlur = 0;
      if ((event.importance || 1) >= 3) {
        c.fillStyle = C.ink2;
        c.font = `10px ${FONT_SANS}`;
        c.textAlign = 'left';
        c.fillText(event.display || event.name, x + 5, stripTop + 11 + (labelRow % 2) * 10);
        labelRow += 1;
      }
      if (selected) {
        c.strokeStyle = C.accent;
        c.lineWidth = 2;
        if (skin.glow) {
          c.shadowColor = C.accent;
          c.shadowBlur = 10;
        }
        c.beginPath();
        c.arc(x, stripTop + STRIP_H - 16, 9, 0, Math.PI * 2);
        c.stroke();
        c.shadowBlur = 0;
      }
    } else {
      const years = cluster.map((event) => event.year);
      const center = xOf(Math.round((Math.min(...years) + Math.max(...years)) / 2));
      const color = skinColor(state.skin, EVENT_COLORS[cluster[0].type]);
      c.fillStyle = color;
      if (skin.glow) {
        c.shadowColor = color;
        c.shadowBlur = 8;
      }
      c.beginPath();
      roundRect(c, center - 12, stripTop + STRIP_H - 15, 24, 14, 4);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = C.labelInBar;
      c.font = `10px ${FONT_SANS}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(cluster.length), center, stripTop + STRIP_H - 8);
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
    }
  }
  void width;
}

// ---------- 底部朝代带 ----------

let densityCache: number[] | null = null;
const DENSITY_BUCKETS = 240;

function densityBuckets(): number[] {
  if (densityCache) return densityCache;
  const [g0, g1] = fullSpan();
  const counts = new Array<number>(DENSITY_BUCKETS).fill(0);
  for (const event of state.library.events) {
    const index = clamp(Math.floor(((event.year - g0) / (g1 - g0)) * DENSITY_BUCKETS), 0, DENSITY_BUCKETS - 1);
    counts[index] += 1;
  }
  densityCache = counts;
  return counts;
}

export function renderRibbon(c: CanvasRenderingContext2D, x0: number, y0: number, width: number, height: number): void {
  const skin = SKINS[state.skin];
  const C = skinPalette();
  c.save();
  c.translate(x0, y0);
  // ribbonBg 是半透明的（外框也用它）。先铺一层不透明的 paper 当底，
  // 每帧都从同一底色重画，既不会累积上一帧的辉光，导出位图也不会留下透明区。
  c.fillStyle = C.paper;
  c.fillRect(0, 0, width, height);
  c.fillStyle = C.ribbonBg;
  c.fillRect(0, 0, width, height);
  if (width <= 0) {
    c.restore();
    return;
  }

  const [g0, g1] = fullSpan();
  const rx = (year: number): number => ((year - g0) / (g1 - g0)) * width;

  const counts = densityBuckets();
  const maxCount = Math.max(...counts, 1);
  c.fillStyle = C.density;
  const bucketW = width / DENSITY_BUCKETS;
  for (let i = 0; i < DENSITY_BUCKETS; i += 1) {
    const barH = (counts[i] / maxCount) * 13;
    if (barH > 0.4) c.fillRect(i * bucketW, 14 - barH, Math.max(0.6, bucketW - 0.4), barH);
  }

  const bandY = 18;
  const bandH = height - bandY - 8;
  const dynasties = state.library.dynasties;
  const hues = dynastyHues(dynasties);
  const paintOrder = [...dynasties].sort((a, b) => b.to - b.from - (a.to - a.from));
  c.font = `10px ${FONT_SANS}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const dynasty of paintOrder) {
    const bx0 = rx(dynasty.from);
    const bx1 = rx(dynasty.to);
    const bandW = bx1 - bx0;
    if (bandW < 0.5) continue;
    c.fillStyle = skin.ribbonBand(hues.get(dynasty.id) ?? 0);
    c.fillRect(bx0, bandY, Math.max(1, bandW - 1), bandH);
    if (bandW > 26 && !coveredAt((dynasty.from + dynasty.to) / 2, dynasty, dynasties)) {
      c.fillStyle = C.ribbonText;
      c.fillText(dynasty.name, (bx0 + bx1) / 2, bandY + bandH / 2);
    }
  }
  c.textBaseline = 'alphabetic';

  const vx0 = rx(state.domain[0]);
  const vx1 = rx(state.domain[1]);
  c.fillStyle = C.viewportWash;
  c.fillRect(vx0, 2, vx1 - vx0, height - 4);
  c.strokeStyle = C.accent;
  c.lineWidth = 1.5;
  if (skin.glow) {
    c.shadowColor = C.accent;
    c.shadowBlur = 8;
  }
  c.strokeRect(vx0, 2, Math.max(4, vx1 - vx0), height - 4);
  c.shadowBlur = 0;
  c.fillStyle = C.accent;
  c.fillRect(vx0 - 1.5, height / 2 - 9, 3, 18);
  c.fillRect(vx1 - 1.5, height / 2 - 9, 3, 18);
  c.restore();
}

export function ribbonXAt(clientX: number): number {
  const rect = dom.ribbon.getBoundingClientRect();
  const [g0, g1] = fullSpan();
  const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  return g0 + ratio * (g1 - g0);
}

// ---------- 星空与星云（仅深空） ----------

const STARS = Array.from({ length: 240 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.3 + 0.3,
  depth: 0.25 + Math.random() * 0.75,
  phase: Math.random() * Math.PI * 2,
}));

export function drawStars(time: number): void {
  if (!SKINS[state.skin].stars) return;
  const SW = dom.stars.clientWidth;
  const SH = dom.stars.clientHeight;
  if (SW === 0 || SH === 0) return;
  sctx.clearRect(0, 0, SW, SH);
  const full = fullSpan();
  const center = (state.domain[0] + state.domain[1]) / 2;
  const offset = (center - (full[0] + full[1]) / 2) * 0.35;
  const zoomK = 200 / Math.max(1, state.domain[1] - state.domain[0]);
  sctx.fillStyle = '#ffffff';
  for (const star of STARS) {
    const sx = (((star.x * SW + offset * star.depth) % SW) + SW) % SW;
    const twinkle = 0.55 + 0.45 * Math.sin(time / 900 + star.phase);
    sctx.globalAlpha = 0.25 * twinkle + 0.12;
    sctx.beginPath();
    sctx.arc(sx, star.y * SH, star.r * (0.8 + zoomK * 0.2 * star.depth), 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.globalAlpha = 1;
}

let nebulaIndex = -1;

function updateNebula(): void {
  if (!SKINS[state.skin].stars) {
    nebulaIndex = -1;
    return;
  }
  const center = (state.domain[0] + state.domain[1]) / 2;
  const dynasties = state.library.dynasties;
  let index = dynasties.findIndex((dynasty) => center >= dynasty.from && center <= dynasty.to);
  if (index === -1) index = 0;
  if (index === nebulaIndex) return;
  nebulaIndex = index;
  const hue = (index * 41) % 360;
  dom.nebula.style.background =
    `radial-gradient(120% 90% at 50% 115%, hsla(${hue}, 58%, 26%, 0.6), transparent 62%),` +
    `radial-gradient(80% 60% at 18% -10%, hsla(${(hue + 60) % 360}, 50%, 18%, 0.5), transparent 60%)`;
}

/** 换皮肤后强制造一次星云渐变；背景色随后由 updateNebula 按当前视窗重算。 */
export function resetNebula(): void {
  nebulaIndex = -1;
}
