/**
 * 绘制引擎：坐标换算、画布场景、吸顶头部、事件密度带、星空与关系线。
 * 只读取 runtime 的共享状态，不发起导航或 DOM 装配。
 */

import type { DynastyTerm, EventRecord, Person, Topic } from '../types';
import {
  AXIS_H,
  BAR_H,
  COMPACT_LARGE_ROW_GUTTER,
  LARGE_ROW_GUTTER,
  LANE_TITLE_H,
  PAD_X,
  STRIP_H,
  barTop,
  itemHeight,
  itemTop,
  topicPeopleForView,
  type LaneLayout,
  type LayoutItem,
} from './layout';
import { EVENT_COLORS, SKINS, paletteFor, skinColor, type Palette } from './skins';
import { FONT_SANS, FONT_SERIF, clamp, fmtYear, personFrom, personTo, pickStep, roundRect } from './util';
import { contentH, ctx, dom, getHooks, H, layouts, loadingTopic, rctx, sctx, state, W } from './runtime';
import { syncAccessibleEntities } from './accessibility';

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

export function largeLayoutActive(): boolean {
  return layouts.some((lane) => lane.presentation === 'large');
}

/** 大行的时间轨道从固定人物信息列右侧开始；其他模式沿用紧凑边距。 */
export function plotPadding(): number {
  if (!largeLayoutActive()) return PAD_X;
  return W < 640 ? COMPACT_LARGE_ROW_GUTTER : LARGE_ROW_GUTTER;
}

export function plotWidth(): number {
  return Math.max(1, W - plotPadding() - PAD_X);
}

export function xOf(year: number): number {
  const [d0, d1] = state.domain;
  const padding = plotPadding();
  if (d1 === d0) return padding;
  return padding + ((year - d0) / (d1 - d0)) * plotWidth();
}

export function yearAt(px: number): number {
  const [d0, d1] = state.domain;
  const padding = plotPadding();
  return d0 + ((px - padding) / plotWidth()) * (d1 - d0);
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

/**
 * 02 双模式：窄时间窗内可见人物较少时，人物行切换为「姓名 + 生卒 + 细生命线」的大行。
 * 宽时间窗保留 16px 密集色条，避免几千人的浏览密度损失。
 */
export function largeRowsActive(): boolean {
  if (state.line !== 'people' || !state.topic || !state.groups.people) return false;
  const [d0, d1] = state.domain;
  let count = 0;
  for (const person of topicPeopleForView(state.topic, state.viewId)) {
    if (state.hiddenLanes.has(`lane:${person.lane}`)) continue;
    if (personTo(person.birth, person.death) < d0 || personFrom(person.birth, person.death) > d1) continue;
    count += 1;
    if (count > 12) return false;
  }
  return count > 0;
}

export function draw(): void {
  // domain、章节与筛选都影响可见集合；每次绘制前让布局与当前状态重新对齐。
  getHooks().rebuildLayout();
  syncAccessibleEntities();
  renderScene(ctx, W, H);
  // mini-map 已收进隐藏的旧控件容器，底部朝代导航条接管导航；尺寸为 0 时不画。
  if (dom.ribbon.clientWidth > 0 && dom.ribbon.clientHeight > 0) {
    renderRibbon(rctx, 0, 0, dom.ribbon.clientWidth, dom.ribbon.clientHeight);
  }
  updateNebula();
  getHooks().syncChrome?.();
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
  drawSelectedYearLine(c, height);
  drawLanes(c, width, height);
  drawLargeRowDivider(c, height);
  drawHeader(c, width);
}

function drawLargeRowDivider(c: CanvasRenderingContext2D, height: number): void {
  if (!largeLayoutActive()) return;
  c.save();
  c.strokeStyle = skinPalette().hair;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(plotPadding() - 11.5, hdrH());
  c.lineTo(plotPadding() - 11.5, height);
  c.stroke();
  c.restore();
}

/** 02 基准：选中事件的年份用纵向金色虚线对齐人物、战事与历史事件。 */
function drawSelectedYearLine(c: CanvasRenderingContext2D, height: number): void {
  if (state.selected?.kind !== 'event') return;
  const event = state.library.eventById.get(state.selected.id);
  if (!event) return;
  const x = Math.round(xOf(event.year)) + 0.5;
  c.save();
  c.strokeStyle = '#cf9b53';
  c.lineWidth = 1.5;
  c.setLineDash([5, 4]);
  c.beginPath();
  c.moveTo(x, hdrH());
  c.lineTo(x, height);
  c.stroke();
  c.restore();
}

function axisStep(c: CanvasRenderingContext2D): number {
  const [d0, d1] = state.domain;
  c.font = `12px ${FONT_SANS}`;
  const sample = d0 < 0 ? fmtYear(Math.min(d0, d1)) : fmtYear(Math.max(d0, d1));
  const labelWidth = c.measureText(sample).width + 32;
  const plotWidthValue = plotWidth();
  const labelBudget = Math.max(2, Math.min(12, Math.floor(plotWidthValue / labelWidth)));
  return pickStep((d1 - d0) / labelBudget);
}

function drawGridlines(c: CanvasRenderingContext2D): void {
  const C = skinPalette();
  const [d0, d1] = state.domain;
  const step = axisStep(c);
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

  if (state.line === 'people' && state.skin !== 'voyage') {
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
  }
  if (state.line === 'people' && state.selected?.kind === 'person') drawRelations(c);

  for (const lane of layouts) {
    const topLevelGroup = state.line === 'people' && ['people', 'war', 'history'].includes(lane.id);
    c.fillStyle = topLevelGroup ? C.ink : C.laneLabel;
    c.font = topLevelGroup ? `600 16px ${FONT_SERIF}` : `12px ${FONT_SANS}`;
    c.textAlign = 'left';
    c.fillText(lane.name, PAD_X, lane.y + (topLevelGroup ? 22 : 20));
    c.strokeStyle = C.hair;
    c.beginPath();
    c.moveTo(PAD_X, lane.y + LANE_TITLE_H - 6);
    c.lineTo(width - PAD_X, lane.y + LANE_TITLE_H - 6);
    c.stroke();

    const placements = labelPlacements(c, lane);
    for (const item of lane.items) {
      const yTop = itemTop(lane, item);
      const placement = placements.get(item.id) ?? 'none';
      if (item.kind === 'event') drawEventBar(c, item, lane, yTop, placement);
      else drawPersonBar(c, item, lane, yTop, placement);
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
  c.font = `12px ${FONT_SANS}`;
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

/** 六类事件共用颜色与几何语义，分区底色不再覆盖 point 节点类型。 */
function drawEventNode(
  c: CanvasRenderingContext2D,
  event: EventRecord,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2;
  c.beginPath();
  if (event.type === 'military') {
    c.moveTo(x - radius, y - 3);
    c.lineTo(x + radius, y - 3);
    c.moveTo(x - radius, y + 3);
    c.lineTo(x + radius, y + 3);
    c.stroke();
    return;
  }
  if (event.type === 'political') {
    c.rect(x - radius, y - radius, radius * 2, radius * 2);
  } else if (event.type === 'institutional') {
    c.arc(x, y, radius, 0, Math.PI * 2);
  } else if (event.type === 'cultural') {
    c.moveTo(x, y - radius);
    c.lineTo(x + radius, y + radius);
    c.lineTo(x - radius, y + radius);
    c.closePath();
  } else {
    const sides = event.type === 'diplomatic' ? 6 : 4;
    for (let index = 0; index < sides; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }
  c.fill();
}

function drawEventBar(
  c: CanvasRenderingContext2D,
  item: Extract<LayoutItem, { kind: 'event' }>,
  lane: LaneLayout,
  yTop: number,
  placement: Placement,
): void {
  const C = skinPalette();
  const event = item.event;
  const color = skinColor(state.skin, EVENT_COLORS[event.type]);
  const selected = state.selected?.kind === 'event' && state.selected.id === event.id;
  const dim = !chipMatchEvent(event);
  c.globalAlpha = dim ? 0.15 : 1;

  if (event.kind === 'span') {
    const barHeight = itemHeight(lane, item);
    const expanded = lane.presentation === 'large' && barHeight > BAR_H;
    const rawX0 = xOf(event.year);
    const rawX1 = xOf(event.endYear ?? event.year);
    const x0 = expanded ? Math.max(plotPadding(), rawX0) : rawX0;
    const x1 = expanded ? Math.min(W - PAD_X, rawX1) : rawX1;
    const width = Math.max(4, x1 - x0);
    // 02 同图：战事用深红渐变卡，历史事件用浅金卡；其他线保持类型色。
    const isWar = lane.id === 'war';
    const isHistory = lane.id === 'history';
    if (isWar) {
      const gradient = c.createLinearGradient(x0, 0, x0 + width, 0);
      gradient.addColorStop(0, '#901b07');
      gradient.addColorStop(1, '#c14d24');
      c.fillStyle = gradient;
    } else if (isHistory) {
      c.fillStyle = selected ? '#fbdd8f' : '#f3dfb7';
    } else {
      c.fillStyle = color;
    }
    if (SKINS[state.skin].glow && !dim) {
      c.shadowColor = color;
      c.shadowBlur = 7;
    }
    if (selected && isHistory) {
      c.shadowColor = '#f5c85c';
      c.shadowBlur = 14;
    }
    c.beginPath();
    roundRect(c, x0, yTop, width, barHeight, expanded ? 6 : 3);
    c.fill();
    c.shadowBlur = 0;
    if (isHistory) {
      // 历史事件卡的菱形节点。
      const nx = x0 + 7;
      const ny = yTop - 3;
      c.fillStyle = '#b8883f';
      c.beginPath();
      c.moveTo(nx, ny - 4);
      c.lineTo(nx + 4, ny);
      c.lineTo(nx, ny + 4);
      c.lineTo(nx - 4, ny);
      c.closePath();
      c.fill();
    }
    if (expanded && width >= 72) {
      const textColor = isWar ? '#f5e8ce' : '#352519';
      const time = `${fmtYear(event.year)} — ${fmtYear(event.endYear ?? event.year)}`;
      c.textAlign = 'left';
      c.fillStyle = textColor;
      c.font = `600 14px ${FONT_SERIF}`;
      c.fillText(fitCanvasText(c, event.display || event.name, width - 20), x0 + 10, yTop + 16);
      c.font = `12px ${FONT_SANS}`;
      c.fillText(fitCanvasText(c, time, width - 20), x0 + 10, yTop + 33);
    } else {
      drawLabel(
        c,
        event.display || event.name,
        placement,
        x0,
        x0 + width,
        yTop,
        dim,
        isWar ? '#f5e8ce' : isHistory ? '#352519' : undefined,
      );
    }
    if (selected) {
      c.strokeStyle = C.accent;
      c.lineWidth = 2;
      if (SKINS[state.skin].glow) {
        c.shadowColor = C.accent;
        c.shadowBlur = 12;
      }
      c.beginPath();
      roundRect(c, x0 - 2.5, yTop - 2.5, width + 5, barHeight + 5, expanded ? 8 : 5);
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
    drawEventNode(c, event, x, yTop + BAR_H / 2, radius, color);
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
  item: Extract<LayoutItem, { kind: 'person' }>,
  lane: LaneLayout,
  yTop: number,
  placement: Placement,
): void {
  const person = item.person;
  if (lane.presentation === 'large') {
    drawPersonLifeRow(c, item, lane, yTop);
    return;
  }
  const C = skinPalette();
  const hasBirth = person.birth != null;
  const hasDeath = person.death != null;
  const x0 = xOf(personFrom(person.birth, person.death));
  const x1 = xOf(personTo(person.birth, person.death));
  const width = Math.max(3, x1 - x0);
  const selected = state.selected?.kind === 'person' && state.selected.id === person.id;
  const dim = personDim(person);
  const color = item.color ? skinColor(state.skin, item.color) : laneColor(lane);

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

  drawLabel(c, person.display || person.name, placement, x0, x0 + width, yTop, dim, contrastLabel(color));

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

/** 02 大行模式：固定人物信息列 + 首字圆章 + 细生命线 + 显式关联事件。 */
function drawPersonLifeRow(
  c: CanvasRenderingContext2D,
  item: Extract<LayoutItem, { kind: 'person' }>,
  lane: LaneLayout,
  yTop: number,
): void {
  const person = item.person;
  const C = skinPalette();
  const color = item.color ? skinColor(state.skin, item.color) : laneColor(lane);
  const x0 = Math.max(plotPadding(), xOf(personFrom(person.birth, person.death)));
  const x1 = Math.min(W - PAD_X, Math.max(x0 + 3, xOf(personTo(person.birth, person.death))));
  const midY = yTop + BAR_H / 2;
  const selected = state.selected?.kind === 'person' && state.selected.id === person.id;
  const dim = personDim(person);
  const compact = W < 640;
  const gutter = plotPadding();
  const avatarX = compact ? 20 : 36;
  const avatarRadius = compact ? 16 : 21;
  const labelX = compact ? 42 : 68;
  const rowTop = lane.y + LANE_TITLE_H + item.row * lane.pitch;
  c.globalAlpha = dim ? 0.15 : 1;

  if (selected) {
    c.fillStyle = 'rgba(207, 155, 83, 0.12)';
    c.beginPath();
    roundRect(c, 8, rowTop + 3, W - 16, lane.pitch - 6, 8);
    c.fill();
    c.strokeStyle = '#cf9b53';
    c.lineWidth = 2;
    c.stroke();
  }

  const accuracies = [person.birthAccuracy, person.deathAccuracy];
  c.strokeStyle = color;
  c.lineWidth = 3;
  if (accuracies.includes('disputed')) c.setLineDash([2, 3]);
  else if (accuracies.includes('approx')) c.setLineDash([7, 3]);
  c.beginPath();
  c.moveTo(x0, midY);
  c.lineTo(x1, midY);
  c.stroke();
  c.setLineDash([]);

  c.fillStyle = C.paper;
  const endpoints: Array<[number | undefined, number]> = [
    [person.birth, x0],
    [person.death, x1],
  ];
  for (const [year, x] of endpoints) {
    if (year == null || year < state.domain[0] || year > state.domain[1]) continue;
    c.beginPath();
    c.arc(x, midY, 4.5, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.8;
    c.stroke();
  }

  // 首字圆章是明确的缺图回退，不把生成图像伪装成真实历史画像。
  c.beginPath();
  c.arc(avatarX, midY, avatarRadius, 0, Math.PI * 2);
  c.fillStyle = C.paper;
  c.fill();
  c.strokeStyle = selected ? '#cf9b53' : color;
  c.lineWidth = selected ? 2.5 : 1.5;
  c.stroke();
  c.fillStyle = color;
  c.font = `600 ${compact ? 16 : 20}px ${FONT_SERIF}`;
  c.textAlign = 'center';
  c.fillText((person.display || person.name).slice(0, 1), avatarX, midY + (compact ? 5 : 7));

  c.textAlign = 'left';
  c.fillStyle = C.ink;
  c.font = `600 ${compact ? 14 : 20}px ${FONT_SERIF}`;
  c.fillText(fitCanvasText(c, person.display || person.name, gutter - labelX - 8), labelX, midY - (compact ? 1 : 2));
  c.font = `12px ${FONT_SANS}`;
  c.fillStyle = C.ink2;
  const birth = lifeEdgeLabel(person.birth, person.birthAccuracy, '生年不详');
  const death = lifeEdgeLabel(person.death, person.deathAccuracy, '卒年不详');
  c.fillText(fitCanvasText(c, `${birth} — ${death}`, gutter - labelX - 8), labelX, midY + 17);

  drawPersonEventMarkers(c, person, midY, gutter);
  c.globalAlpha = 1;
  c.textAlign = 'left';
}

function lifeEdgeLabel(year: number | undefined, accuracy: Person['birthAccuracy'], unknown: string): string {
  if (year == null) return unknown;
  if (accuracy === 'approx') return `约 ${fmtYear(year)}`;
  if (accuracy === 'disputed') return `${fmtYear(year)}（异说）`;
  return fmtYear(year);
}

function fitCanvasText(c: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (c.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && c.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function relativeLuminance(color: string): number | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  let rgb: [number, number, number] | null = null;
  if (hex) {
    rgb = [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16) / 255) as [number, number, number];
  } else {
    const hsl = /^hsl\(\s*(-?[\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i.exec(color.trim());
    if (hsl) {
      const h = (((Number(hsl[1]) % 360) + 360) % 360) / 360;
      const s = Number(hsl[2]) / 100;
      const l = Number(hsl[3]) / 100;
      if (s === 0) rgb = [l, l, l];
      else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue = (offset: number): number => {
          let t = h + offset;
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        rgb = [hue(1 / 3), hue(0), hue(-1 / 3)];
      }
    }
  }
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === null || b === null) return 0;
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** 条内姓名不能统一用白字；按实际 lane 色选择可读的深木或米白。 */
function contrastLabel(background: string): string {
  const dark = '#261a14';
  const light = '#fff7e9';
  const darkRatio = contrastRatio(background, dark);
  const lightRatio = contrastRatio(background, light);
  if (darkRatio >= 4.5 || lightRatio >= 4.5) return darkRatio >= lightRatio ? dark : light;
  return darkRatio > lightRatio ? dark : light;
}

/** 只画运行库中显式引用该人物的公共事件，不按生卒重叠推断关系。 */
function drawPersonEventMarkers(c: CanvasRenderingContext2D, person: Person, midY: number, gutter: number): void {
  const linked = (state.library.eventsByPerson.get(person.id) ?? [])
    .filter((event) => event.year >= state.domain[0] && event.year <= state.domain[1])
    .sort((a, b) => a.year - b.year || b.importance - a.importance);
  let previousX = -Infinity;
  let drawn = 0;
  for (const event of linked) {
    const x = xOf(event.year);
    if (x < gutter + 36 || x > W - PAD_X - 24 || x - previousX < 84 || drawn >= 3) continue;
    const color = skinColor(state.skin, EVENT_COLORS[event.type]);
    c.fillStyle = skinPalette().paper;
    c.beginPath();
    c.arc(x, midY, 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = skinPalette().ink;
    c.font = `12px ${FONT_SANS}`;
    c.textAlign = 'center';
    c.fillText(fitCanvasText(c, event.display || event.name, 96), x, midY - 12);
    previousX = x;
    drawn += 1;
  }
}

function drawLabel(
  c: CanvasRenderingContext2D,
  label: string,
  placement: Placement,
  x0: number,
  x1: number,
  yTop: number,
  dim: boolean,
  insideColor?: string,
): void {
  const C = skinPalette();
  if (placement === 'none') return;
  c.font = `12px ${FONT_SANS}`;
  if (placement === 'inside') {
    c.fillStyle = insideColor ?? C.labelInBar;
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
      c.font = `12px ${FONT_SANS}`;
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
  // 02 基准：巡航皮肤的刻度尺是深木底 + 米白刻度，不再铺淡彩朝代色带；
  // 朝代定位由中央场景头与底部朝代导航条承担。深空皮肤保留原色带。
  const paintBands = state.skin !== 'voyage';
  for (const dynasty of paintBands ? paintOrder : []) {
    const x0 = Math.max(0, xOf(dynasty.from));
    const x1 = Math.min(width, xOf(dynasty.to));
    const bandW = x1 - x0;
    if (x1 <= 0 || x0 >= width || bandW < 2) continue;
    c.fillStyle = skin.footerBand(hues.get(dynasty.id) ?? 0);
    c.fillRect(x0, 0, bandW, AXIS_H);
    if (coveredAt((dynasty.from + dynasty.to) / 2, dynasty, dynasties)) continue;
    c.fillStyle = C.ribbonText;
    if (bandW > 110) {
      c.font = `bold 12px ${FONT_SANS}`;
      c.fillText(`${dynasty.name} ${fmtYear(dynasty.from)}—${fmtYear(dynasty.to)}`, (x0 + x1) / 2, 15);
    } else if (bandW > 40) {
      c.font = `bold 12px ${FONT_SANS}`;
      c.fillText(dynasty.name, (x0 + x1) / 2, 15);
    }
  }

  const [d0, d1] = state.domain;
  c.lineWidth = 1;

  const step = axisStep(c);
  c.fillStyle = state.skin === 'voyage' ? C.axisText : C.ink2;
  c.strokeStyle = state.skin === 'voyage' ? C.axisText : C.ink2;
  c.font = `12px ${FONT_SANS}`;
  c.textAlign = 'center';
  c.beginPath();
  for (let year = Math.ceil(d0 / step) * step; year <= d1; year += step) {
    const x = Math.round(xOf(year)) + 0.5;
    for (let subdivision = 0; subdivision < 5; subdivision += 1) {
      const minorYear = year + (subdivision * step) / 5;
      if (minorYear > d1) continue;
      const minorX = Math.round(xOf(minorYear)) + 0.5;
      const major = subdivision === 0;
      c.moveTo(minorX, AXIS_H - (major ? 25 : 19));
      c.lineTo(minorX, AXIS_H - 12);
    }
    if (state.selected?.kind === 'event' && state.selected.id) {
      const selectedEvent = state.library.eventById.get(state.selected.id);
      if (selectedEvent && Math.abs(xOf(selectedEvent.year) - x) < 28) {
        // 选中年份牌占同一位置时隐藏普通标签，避免两行数字重叠。
      } else {
        c.fillText(fmtYear(year), x, AXIS_H - 3);
      }
    } else {
      c.fillText(fmtYear(year), x, AXIS_H - 3);
    }
  }
  c.stroke();

  // 02 基准：选中事件的年份用金色年份牌标记，并在画布内贯穿金色虚线。
  if (state.selected?.kind === 'event') {
    const selectedEvent = state.library.eventById.get(state.selected.id);
    if (selectedEvent) {
      const x = Math.round(xOf(selectedEvent.year));
      const label = fmtYear(selectedEvent.year);
      c.font = `bold 12px ${FONT_SANS}`;
      const badgeW = c.measureText(label).width + 18;
      c.fillStyle = '#cf9b53';
      c.beginPath();
      roundRect(c, x - badgeW / 2, 3, badgeW, 20, 10);
      c.fill();
      c.fillStyle = '#261a14';
      c.fillText(label, x, 17);
    }
  }

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

  if (largeLayoutActive()) {
    const dividerX = plotPadding() - 12;
    c.fillStyle = state.skin === 'voyage' ? C.axisText : C.ink2;
    c.font = `600 14px ${FONT_SERIF}`;
    c.textAlign = 'left';
    c.fillText('年份', PAD_X, 30);
    c.strokeStyle = C.line;
    c.beginPath();
    c.moveTo(dividerX + 0.5, 0);
    c.lineTo(dividerX + 0.5, hdrH());
    c.stroke();
  }

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
        c.fillStyle = C.labelInBar;
        c.font = `12px ${FONT_SANS}`;
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
      c.font = `12px ${FONT_SANS}`;
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
  c.font = `12px ${FONT_SANS}`;
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
