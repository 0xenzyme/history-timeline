/**
 * 正式版前端：把 design 原型（巡航 / 深空双皮肤）落到站点。
 * 一条时间轴引擎跑三种内容线：人物（按泳道）、军事、历史事件（按类型分行）。
 */

import type { DynastyTerm, EventRecord, Person, Topic } from '../types';
import { parseHash, writeHash, writeLineHash, decodeHash, type HistoryMode } from '../routing';
import { renderEventCard, renderPersonCard, type CardContext } from './cards';
import { exportBasename, exportView } from './exporter';
import {
  AXIS_H,
  BAR_H,
  LANE_TITLE_H,
  PAD_X,
  ROW_GAP,
  STRIP_H,
  barTop,
  buildEventLayout,
  buildPeopleLayout,
  layoutHeight,
  type LaneLayout,
  type LayoutItem,
} from './layout';
import {
  createLibrary,
  findTopicEntry,
  loadTopicData,
  topicForDynasty,
  type Library,
} from './model';
import {
  EVENT_COLORS,
  SKINS,
  TYPE_NAMES,
  invalidatePalette,
  isSkinId,
  paletteFor,
  skinColor,
  type Palette,
  type SkinId,
} from './skins';
import { FONT_SANS, clamp, esc, fmtYear, personFrom, personTo, pickStep, roundRect } from './util';

type LineId = 'people' | 'military' | 'history';
type ChipId = 'all' | 'military' | 'political' | 'cultural' | 'female';
type Selection = { kind: 'person' | 'event'; id: string };

const RIBBON_H = 76;
const STORAGE = {
  skin: 'ht-skin',
  line: 'ht-line',
  strip: 'ht-strip',
  lanes: 'ht-hidden-lanes',
  topic: 'ht-topic',
};
const DEFAULT_TOPIC = 'han';

interface AppState {
  library: Library;
  skin: SkinId;
  line: LineId;
  topicId: string;
  topic: Topic | null;
  /** 当前章节 id。地址栏写的是它，缩放不算换章节，所以只有切专题和点章节会改。 */
  viewId: string | null;
  domain: [number, number];
  scrollY: number;
  chip: ChipId;
  selected: Selection | null;
  hiddenLanes: Set<string>;
  stripOpen: boolean;
}

let state: AppState;
let layouts: LaneLayout[] = [];
let contentH = 0;
let W = 0;
let H = 0;
let loadingTopic = false;

const dom = {
  stage: document.getElementById('stage') as HTMLElement,
  canvas: document.getElementById('chart') as HTMLCanvasElement,
  stars: document.getElementById('stars') as HTMLCanvasElement,
  nebula: document.getElementById('nebula') as HTMLElement,
  ribbon: document.getElementById('ribbon-canvas') as HTMLCanvasElement,
  card: document.getElementById('card') as HTMLElement,
  cardBody: document.getElementById('card-body') as HTMLElement,
  hint: document.getElementById('hint') as HTMLElement,
  chips: document.getElementById('chips') as HTMLElement,
  lanePanel: document.getElementById('lane-panel') as HTMLElement,
  laneList: document.getElementById('lane-list') as HTMLElement,
  laneChapters: document.getElementById('lane-chapters') as HTMLElement,
  stripToggle: document.getElementById('strip-toggle') as HTMLButtonElement,
  search: document.getElementById('search') as HTMLInputElement,
  searchResults: document.getElementById('search-results') as HTMLElement,
  topicSelect: document.getElementById('topic-select') as HTMLSelectElement,
  status: document.getElementById('status') as HTMLElement,
  exportMenu: document.getElementById('export-menu') as HTMLElement,
  topbar: document.getElementById('topbar') as HTMLElement,
};

const ctx = dom.canvas.getContext('2d') as CanvasRenderingContext2D;
const sctx = dom.stars.getContext('2d') as CanvasRenderingContext2D;
const rctx = dom.ribbon.getContext('2d') as CanvasRenderingContext2D;
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

// ---------- 启动 ----------

export async function boot(): Promise<void> {
  const bootEl = document.getElementById('boot');
  try {
    const library = await createLibrary();
    bootEl?.remove();
    state = {
      library,
      skin: isSkinId(localStorage.getItem(STORAGE.skin)) ? (localStorage.getItem(STORAGE.skin) as SkinId) : 'voyage',
      line: initialLine(),
      topicId: initialTopic(library),
      topic: null,
      viewId: null,
      domain: [0, 0],
      scrollY: 0,
      chip: 'all',
      selected: null,
      hiddenLanes: readHiddenLanes(),
      stripOpen: localStorage.getItem(STORAGE.strip) === '1',
    };
    buildTopicSelect();
    wireEvents();
    applySkin(state.skin, false);
    initial = location.hash.replace('#', '').trim().length > 0
      ? parseHash(location.hash, library.catalog)
      : null;
    await applyRoute(initial);
    resize();
    requestAnimationFrame(loop);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootEl?.remove();
    const el = document.getElementById('boot-error');
    if (el) {
      el.hidden = false;
      el.textContent = `载入失败：${message}`;
    }
    console.error(error);
  }
}

/** 启动时只解析一次地址，之后由交互驱动。 */
let initial: ReturnType<typeof parseHash> | null = null;

function initialLine(): LineId {
  const saved = localStorage.getItem(STORAGE.line);
  if (saved === 'military' || saved === 'history' || saved === 'people') return saved;
  return 'people';
}

function initialTopic(library: Library): string {
  const saved = localStorage.getItem(STORAGE.topic);
  if (saved && library.topics.some((topic) => topic.id === saved)) return saved;
  const fallback = library.topics.find((topic) => topic.id === DEFAULT_TOPIC);
  return fallback?.id ?? library.topics[0].id;
}

function readHiddenLanes(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.lanes) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

// ---------- 坐标 ----------

/**
 * 人物线的可达跨度：专题声明的范围，并覆盖每条人物条形的实际端点。
 * 专题数据一次载入后不再变，所以按专题 id 缓存。
 */
let peopleSpanCache: { topicId: string; span: [number, number] } | null = null;

function peopleSpan(topic: Topic): [number, number] {
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
const fullSpan = (): [number, number] => {
  const line = state.line;
  if (line === 'people') return state.topic ? peopleSpan(state.topic) : state.library.lines.history.range;
  return state.library.lines[line].range;
};

function xOf(year: number): number {
  const [d0, d1] = state.domain;
  if (d1 === d0) return PAD_X;
  return PAD_X + ((year - d0) / (d1 - d0)) * (W - PAD_X * 2);
}

function yearAt(px: number): number {
  const [d0, d1] = state.domain;
  return d0 + ((px - PAD_X) / (W - PAD_X * 2)) * (d1 - d0);
}

function hdrH(): number {
  return AXIS_H + (state.line === 'people' && state.stripOpen ? STRIP_H : 0);
}

function maxScroll(): number {
  return Math.max(0, contentH - (H - hdrH()));
}

// ---------- 布局 ----------

function visibleEvents(): EventRecord[] {
  if (state.line === 'people') return state.library.events;
  return state.library.lines[state.line].events;
}

function rebuildLayout(): void {
  const build = (pitch: number): LaneLayout[] => {
    if (state.line === 'people') {
      return state.topic ? buildPeopleLayout(state.topic, hiddenLaneIds(), pitch) : [];
    }
    return buildEventLayout(visibleEvents(), state.line, hiddenLaneIds(), pitch);
  };
  const basePitch = BAR_H + ROW_GAP;
  layouts = build(basePitch);
  // 内容不足一屏时拉开行距，避免大片留白；行距最多放大到 4 倍。
  const available = H - hdrH();
  if (available > 0) {
    const filled = layoutHeight(layouts);
    if (filled > 0 && filled < available) {
      const factor = clamp(available / filled, 1, 4);
      if (factor > 1.04) layouts = build(basePitch * factor);
    }
  }
  contentH = layoutHeight(layouts);
  state.scrollY = clamp(state.scrollY, 0, maxScroll());
}

/** 勾选状态按内容线分区存放，这里取出当前线要隐藏的原始 id。 */
function hiddenLaneIds(): Set<string> {
  const prefix = state.line === 'people' ? 'lane:' : 'type:';
  const ids = new Set<string>();
  for (const key of state.hiddenLanes) {
    if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
  }
  return ids;
}

function lineLabel(): string {
  if (state.line === 'people') return state.topic?.meta.title ?? '人物';
  return state.library.lines[state.line].title;
}

// ---------- 绘制 ----------

function skinPalette(): Palette {
  return paletteFor(state.skin);
}

function draw(): void {
  renderScene(ctx, W, H);
  renderRibbon(rctx, 0, 0, dom.ribbon.clientWidth, dom.ribbon.clientHeight);
  updateNebula();
}

function renderScene(c: CanvasRenderingContext2D, width: number, height: number): void {
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
  const fits = (a0: number, a1: number): boolean =>
    !occupied.some(([b0, b1]) => a0 < b1 && a1 > b0);
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

function entryRect(item: LayoutItem): { key: string; x0: number; x1: number; label: string; canInside: boolean } {
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

function labelPlacements(c: CanvasRenderingContext2D, lane: LaneLayout): Map<string, Placement> {
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

const markerRadius = (event: EventRecord): number => 4 + (event.importance || 1) * 1.2;

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
    drawLabel(c, event.display || event.name, placement === 'inside' ? 'right' : placement, x - radius, x + radius, yTop, dim);
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
  const paintOrder = [...dynasties].sort((a, b) => (b.to - b.from) - (a.to - a.from));
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
  return all.some((item) => item.id !== self.id
    && (item.to - item.from) < span
    && year >= item.from && year <= item.to);
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

function renderRibbon(c: CanvasRenderingContext2D, x0: number, y0: number, width: number, height: number): void {
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
  const paintOrder = [...dynasties].sort((a, b) => (b.to - b.from) - (a.to - a.from));
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

function ribbonXAt(clientX: number): number {
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

function drawStars(time: number): void {
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
  dom.nebula.style.background = `radial-gradient(120% 90% at 50% 115%, hsla(${hue}, 58%, 26%, 0.6), transparent 62%),`
    + `radial-gradient(80% 60% at 18% -10%, hsla(${(hue + 60) % 360}, 50%, 18%, 0.5), transparent 60%)`;
}

// ---------- 筛选 ----------

function chipMatchEvent(event: EventRecord): boolean {
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

function personDim(person: Person): boolean {
  if (state.chip === 'female') return person.gender !== 'female';
  return false;
}

// ---------- 命中测试 ----------

function hitTest(px: number, py: number): Selection | null {
  if (state.line === 'people' && state.stripOpen && py > AXIS_H + 4 && py < hdrH()) {
    let best: EventRecord | null = null;
    let bestDistance = 14;
    for (const event of state.library.events) {
      // 绘制按 chipMatchEvent 过滤，命中测试必须用同一口径，否则筛选掉的事件点不中却仍能命中。
      if (!chipMatchEvent(event)) continue;
      const x = xOf(event.year);
      const x1 = event.kind === 'span' && event.endYear !== undefined ? xOf(event.endYear) : x;
      const inside = event.kind === 'span' && event.endYear !== undefined
        ? px >= x - 2 && px <= x1 + 2
        : Math.abs(px - x) < 9;
      if (!inside) continue;
      const distance = Math.abs(px - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = event;
      }
    }
    return best ? { kind: 'event', id: best.id } : null;
  }
  if (py < hdrH()) return null;
  const contentY = py - hdrH() + state.scrollY;
  for (const lane of layouts) {
    if (contentY < lane.y || contentY > lane.y + lane.height) continue;
    const placements = labelPlacements(ctx, lane);
    for (const item of lane.items) {
      const yTop = barTop(lane, item.row);
      if (contentY < yTop - 1 || contentY > yTop + BAR_H + 1) continue;
      const rect = entryRect(item);
      ctx.font = `11px ${FONT_SANS}`;
      const labelWidth = ctx.measureText(rect.label).width;
      const placement = placements.get(item.id) ?? 'none';
      let x0 = rect.x0 - 2;
      let x1 = rect.x1 + 2;
      if (placement === 'right') x1 += 5 + labelWidth + 2;
      else if (placement === 'left') x0 -= 5 + labelWidth + 2;
      if (px >= x0 && px <= x1) return { kind: item.kind, id: item.id };
    }
  }
  return null;
}

// ---------- 详情卡 ----------

function cardContext(): CardContext {
  return {
    library: state.library,
    skin: state.skin,
    palette: skinPalette(),
    topic: state.topic,
  };
}

function showCard(selection: Selection): void {
  const context = cardContext();
  if (selection.kind === 'person') {
    dom.cardBody.innerHTML = renderPersonCard(context, selection.id);
  } else {
    const event = state.library.eventById.get(selection.id);
    if (!event) return;
    dom.cardBody.innerHTML = renderEventCard(context, event);
  }
  // 卡片与选中态必须同时成立：setTopic / setLine 会清掉 selected，这里重新对齐。
  state.selected = selection;
  dom.card.classList.add('show');
}

function hideCard(): void {
  dom.card.classList.remove('show');
  dom.cardBody.innerHTML = '';
  state.selected = null;
  announce('已关闭详情');
  draw();
}

function announce(text: string): void {
  dom.status.textContent = text;
}

// ---------- 选择 ----------

async function selectAndReveal(selection: Selection, sync = true, keepDomain = false): Promise<void> {
  state.selected = selection;
  if (selection.kind === 'person') {
    const record = state.library.personById.get(selection.id);
    // 人就在当前专题里时不切走：personById 是「首见即存」，跨专题人物会总跳到发布顺序最靠前的那个专题。
    const inCurrentTopic = state.line === 'people' && Boolean(state.topic?.people.some((item) => item.id === selection.id));
    if (!inCurrentTopic && record && record.topicId !== state.topicId) {
      await setTopic(record.topicId, false);
    }
    if (state.line !== 'people') setLine('people', false);
    const person = state.topic?.people.find((item) => item.id === selection.id);
    if (person) {
      if (!keepDomain) {
        centerDomain((personFrom(person.birth, person.death) + personTo(person.birth, person.death)) / 2, 180);
      }
      scrollTo('person', person.id);
    }
    announce(`人物：${record?.display ?? selection.id}`);
    if (sync) writeTopicHash('replace');
  } else {
    const event = state.library.eventById.get(selection.id);
    if (event) {
      if (!keepDomain) centerDomain(event.year, 180);
      if (state.line !== 'people') scrollTo('event', event.id);
      announce(`事件：${event.display || event.name}`);
      if (sync && state.line !== 'people') {
        writeLineHash(state.line, 'event', event.id, 'push');
      }
    }
  }
  showCard(selection);
  draw();
}

function scrollTo(kind: 'person' | 'event', id: string): void {
  for (const lane of layouts) {
    for (const item of lane.items) {
      if (item.id !== id || item.kind !== kind) continue;
      state.scrollY = clamp(lane.y - 60, 0, maxScroll());
      return;
    }
  }
}

function centerDomain(center: number, span: number): void {
  const full = fullSpan();
  const half = span / 2;
  let d0 = center - half;
  let d1 = center + half;
  if (d0 < full[0]) {
    d1 += full[0] - d0;
    d0 = full[0];
  }
  if (d1 > full[1]) {
    d0 -= d1 - full[1];
    d1 = full[1];
  }
  state.domain = [Math.round(d0), Math.round(d1)];
}

// ---------- 内容线 / 专题 ----------

function setLine(line: LineId, sync = true): void {
  if (line === state.line) return;
  state.line = line;
  localStorage.setItem(STORAGE.line, line);
  state.chip = 'all';
  document.querySelectorAll<HTMLElement>('.chip').forEach((chip) => {
    chip.classList.toggle('on', chip.dataset.filter === 'all');
  });
  document.querySelectorAll<HTMLElement>('.line-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.line === line);
  });
  dom.topicSelect.hidden = line !== 'people';
  state.scrollY = 0;
  state.domain = defaultDomain();
  buildLanePanel();
  rebuildLayout();
  syncStripToggle();
  hideCardSilent();
  dom.searchResults.hidden = true;
  if (sync) syncHash('replace');
  draw();
}

function hideCardSilent(): void {
  dom.card.classList.remove('show');
  dom.cardBody.innerHTML = '';
  state.selected = null;
}

async function setTopic(topicId: string, sync = true): Promise<void> {
  if (topicId === state.topicId && state.topic) {
    dom.topicSelect.value = topicId;
    return;
  }
  const entry = findTopicEntry(state.library, topicId);
  if (!entry) return;
  state.topicId = topicId;
  localStorage.setItem(STORAGE.topic, topicId);
  dom.topicSelect.value = topicId;
  loadingTopic = true;
  const topic = await loadTopicData(state.library, topicId);
  loadingTopic = false;
  if (!topic) return;
  state.topic = topic;
  state.viewId = topic.views[0]?.id ?? null;
  state.domain = state.line === 'people' ? peopleSpan(topic) : defaultDomain();
  state.scrollY = 0;
  hideCardSilent();
  buildLanePanel();
  rebuildLayout();
  syncStripToggle();
  if (sync) writeTopicHash('push');
  draw();
}

function defaultDomain(): [number, number] {
  return fullSpan();
}

/** 首屏和专题载入后必须有一个有效视窗，否则所有条都会挤在左边。 */
function ensureDomain(): void {
  if (!(state.domain[1] > state.domain[0])) state.domain = defaultDomain();
}

function buildTopicSelect(): void {
  dom.topicSelect.innerHTML = state.library.topics
    .map((entry) => `<option value="${esc(entry.id)}">${esc(entry.title)}</option>`)
    .join('');
  dom.topicSelect.value = state.topicId;
  dom.topicSelect.hidden = state.line !== 'people';
}

function buildLanePanel(): void {
  const laneDefs: { id: string; name: string; color: string; count: number }[] = [];
  if (state.line === 'people' && state.topic) {
    for (const lane of state.topic.lanes) {
      laneDefs.push({
        id: lane.id,
        name: lane.name,
        color: lane.color,
        count: state.topic.people.filter((person) => person.lane === lane.id).length,
      });
    }
  } else if (state.line !== 'people') {
    const events = visibleEvents();
    for (const lane of buildEventLayout(events, state.line, new Set(), BAR_H + ROW_GAP)) {
      laneDefs.push({ id: lane.id, name: lane.name, color: lane.color, count: lane.items.length });
    }
  }

  dom.laneList.innerHTML = laneDefs.map((lane) => `
    <label class="lane-row">
      <input type="checkbox" data-lane="${esc(lane.id)}" ${state.hiddenLanes.has(laneKey(lane.id)) ? '' : 'checked'} />
      <span class="lane-swatch" style="background:${esc(skinColor(state.skin, lane.color))}"></span>
      <span>${esc(lane.name)}</span>
      <span class="lane-count">${lane.count}</span>
    </label>
  `).join('');

  const views = state.line === 'people' ? state.topic?.views ?? [] : [];
  dom.laneChapters.innerHTML = views.length === 0
    ? ''
    : `<div class="lane-panel-head"><span>章节</span></div>`
      + views.map((view) => `<button type="button" class="lane-chapter" data-view="${esc(view.id)}">${esc(view.name)}</button>`).join('');
}

/** 泳道勾选按当前内容线隔离，避免人物泳道 id 与事件类型 id 互相影响。 */
const laneKey = (id: string): string => (state.line === 'people' ? `lane:${id}` : `type:${id}`);

function toggleLane(id: string, show: boolean): void {
  const key = laneKey(id);
  if (show) state.hiddenLanes.delete(key);
  else state.hiddenLanes.add(key);
  localStorage.setItem(STORAGE.lanes, JSON.stringify([...state.hiddenLanes]));
  rebuildLayout();
  draw();
}

function setAllLanes(show: boolean): void {
  const keys = [...dom.laneList.querySelectorAll<HTMLInputElement>('input[data-lane]')]
    .map((input) => laneKey(input.dataset.lane ?? ''));
  for (const key of keys) {
    if (show) state.hiddenLanes.delete(key);
    else state.hiddenLanes.add(key);
  }
  localStorage.setItem(STORAGE.lanes, JSON.stringify([...state.hiddenLanes]));
  buildLanePanel();
  rebuildLayout();
  draw();
}

// ---------- 皮肤 ----------

function applySkin(skin: SkinId, redraw = true): void {
  state.skin = skin;
  localStorage.setItem(STORAGE.skin, skin);
  document.body.classList.toggle('skin-voyage', skin === 'voyage');
  document.body.classList.toggle('skin-deepspace', skin === 'deepspace');
  document.getElementById('skin-voyage')?.classList.toggle('on', skin === 'voyage');
  document.getElementById('skin-deepspace')?.classList.toggle('on', skin === 'deepspace');
  // 画布配色读的是 body 上的变量，class 换完才能取，取不到就当场报错。
  invalidatePalette();
  paletteFor(skin);
  nebulaIndex = -1;
  if (redraw) {
    buildLanePanel();
    draw();
  }
}

function syncStripToggle(): void {
  const inPeople = state.line === 'people';
  dom.stripToggle.style.display = inPeople ? 'block' : 'none';
  dom.stripToggle.textContent = state.stripOpen ? '事件条 ▴' : '事件条 ▾';
  dom.stripToggle.setAttribute('aria-expanded', String(inPeople && state.stripOpen));
  document.body.classList.toggle('strip-open', inPeople && state.stripOpen);
  resizeChart();
}

// ---------- 搜索 ----------

interface SearchHit {
  kind: 'person' | 'event';
  id: string;
  title: string;
  meta: string;
}

function aliasIndex(): Map<string, string> {
  if (aliasCache) return aliasCache;
  const map = new Map<string, string>();
  for (const event of state.library.events) {
    for (const alias of event.aliases ?? []) map.set(alias, event.id);
  }
  aliasCache = map;
  return map;
}

let aliasCache: Map<string, string> | null = null;

function runSearch(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const hits: SearchHit[] = [];
  const aliasEventId = aliasIndex().get(query.trim());

  for (const record of state.library.search ?? []) {
    if (record.kind === 'event') continue;
    const fields = [record.name, record.display, ...(record.tags ?? [])];
    if (!fields.some((field) => field && field.toLowerCase().includes(needle))) continue;
    hits.push({
      kind: 'person',
      id: record.id,
      title: record.display || record.name,
      meta: record.topicTitle,
    });
    if (hits.length >= 8) break;
  }

  const eventHits: SearchHit[] = [];
  for (const event of state.library.events) {
    if (eventHits.length >= 8) break;
    const matched = event.id === aliasEventId
      || [event.name, event.display, ...(event.aliases ?? [])]
        .some((field) => field && field.toLowerCase().includes(needle));
    if (!matched) continue;
    eventHits.push({
      kind: 'event',
      id: event.id,
      title: event.display || event.name,
      meta: `${TYPE_NAMES[event.type]} · ${fmtYear(event.year)}`,
    });
  }
  return [...hits, ...eventHits];
}

function renderSearchResults(query: string): void {
  const hits = runSearch(query);
  if (hits.length === 0) {
    dom.searchResults.hidden = query.trim().length === 0;
    dom.searchResults.innerHTML = query.trim().length === 0
      ? ''
      : `<div class="search-empty">没有匹配「${esc(query.trim())}」的条目</div>`;
    return;
  }
  dom.searchResults.innerHTML = hits.map((hit) => `
    <button type="button" class="search-hit" data-kind="${hit.kind}" data-id="${esc(hit.id)}">
      <span class="search-hit-title">${esc(hit.title)}</span>
      <span class="search-hit-meta">${esc(hit.meta)}</span>
    </button>
  `).join('');
  dom.searchResults.hidden = false;
}

// ---------- 地址 ----------

function writeTopicHash(mode: HistoryMode): void {
  if (state.line !== 'people') return;
  const topic = state.topic;
  if (!topic) return;
  const viewId = topic.views.find((view) => view.id === state.viewId)?.id ?? topic.views[0]?.id ?? 'overview';
  writeHash(topic.meta.id, viewId, mode);
}

/** 地址跟着内容线与专题走：人物线写 #专题/章节，事件线写 #线。 */
function syncHash(mode: HistoryMode): void {
  if (state.line === 'people') {
    writeTopicHash(mode);
    return;
  }
  const next = `#${state.line}`;
  const current = decodeHash(location.hash);
  if (current === next || location.hash === next) return;
  if (mode === 'push') history.pushState(null, '', next);
  else history.replaceState(null, '', next);
}

async function applyRoute(route: ReturnType<typeof parseHash> | null): Promise<void> {
  state.topic = await loadTopicData(state.library, state.topicId);
  if (!state.topic) return;
  state.viewId = state.topic.views[0]?.id ?? null;
  ensureDomain();

  if (!route) {
    rebuildLayout();
    return;
  }
  if (route.axis === 'time' && route.lineId) {
    hideCardSilent();
    setLine(route.lineId as LineId, false);
    rebuildLayout();
    if (route.eventId) {
      const event = state.library.eventById.get(route.eventId);
      if (event) await selectAndReveal({ kind: 'event', id: event.id }, false);
      else flashHint(`没有找到事件「${route.eventId}」`);
    } else if (route.segmentId) {
      flashHint('世纪分段已由底部朝代带取代');
    }
    return;
  }
  if (state.line !== 'people') setLine('people', false);
  if (route.unknownTopic) {
    flashHint(`地址里的专题「${route.unknownTopic}」不在目录里`);
  }
  if (route.topicId && route.topicId !== state.topicId) await setTopic(route.topicId, false);
  rebuildLayout();
  if (route.viewId) {
    const view = state.topic?.views.find((item) => item.id === route.viewId);
    if (view) {
      state.viewId = view.id;
      state.domain = [view.from, view.to];
      const focus = view.focus ?? view.people?.[0];
      if (focus) await selectAndReveal({ kind: 'person', id: focus }, false, true);
      else {
        rebuildLayout();
        draw();
      }
      announce(`章节：${view.name}`);
      return;
    }
    if (route.canonicalize) flashHint(`专题「${route.topicId}」没有章节「${route.viewId}」`);
  }
  draw();
}

// ---------- 交互 ----------

let drag: { x: number; y: number; domain: [number, number]; scrollY: number; moved: boolean; lastX: number; lastT: number } | null = null;
let inertia = 0;
let dragging = false;

function wireEvents(): void {
  document.querySelectorAll<HTMLElement>('.line-btn').forEach((button) => {
    button.addEventListener('click', () => void setLine(button.dataset.line as LineId));
  });
  document.getElementById('skin-voyage')?.addEventListener('click', () => applySkin('voyage'));
  document.getElementById('skin-deepspace')?.addEventListener('click', () => applySkin('deepspace'));
  document.getElementById('btn-reset')?.addEventListener('click', () => void resetView());
  document.getElementById('btn-export')?.addEventListener('click', (event) => {
    event.stopPropagation();
    dom.exportMenu.hidden = !dom.exportMenu.hidden;
  });
  dom.exportMenu.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-export]');
    if (!target) return;
    dom.exportMenu.hidden = true;
    void runExport(target.dataset.export === 'svg' ? 'svg' : 'png');
  });
  document.getElementById('btn-lanes')?.addEventListener('click', (event) => {
    event.stopPropagation();
    dom.lanePanel.classList.toggle('open');
  });
  document.getElementById('lanes-all')?.addEventListener('click', () => setAllLanes(true));
  document.getElementById('lanes-none')?.addEventListener('click', () => setAllLanes(false));
  dom.laneList.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.lane) toggleLane(input.dataset.lane, input.checked);
  });
  dom.laneChapters.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (!target || !state.topic) return;
    const view = state.topic.views.find((item) => item.id === target.dataset.view);
    if (!view) return;
    dom.lanePanel.classList.remove('open');
    state.viewId = view.id;
    state.domain = [view.from, view.to];
    const focus = view.focus ?? view.people?.[0];
    if (focus) void selectAndReveal({ kind: 'person', id: focus });
    else {
      rebuildLayout();
      draw();
    }
    announce(`章节：${view.name}`);
  });
  document.getElementById('card-close')?.addEventListener('click', hideCard);
  dom.cardBody.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action="locate"]');
    if (action?.dataset.kind && action.dataset.id) {
      void selectAndReveal({ kind: action.dataset.kind as 'person' | 'event', id: action.dataset.id });
      return;
    }
    const link = (event.target as HTMLElement).closest<HTMLElement>('.card-link');
    if (!link?.dataset.kind || !link.dataset.id) return;
    void selectAndReveal({ kind: link.dataset.kind as 'person' | 'event', id: link.dataset.id });
  });
  dom.stripToggle.addEventListener('click', () => {
    state.stripOpen = !state.stripOpen;
    localStorage.setItem(STORAGE.strip, state.stripOpen ? '1' : '0');
    syncStripToggle();
    // 事件条高度算在 hdrH() 里，rebuildLayout 按它分配行距；不重建就沿用旧行距。
    rebuildLayout();
    draw();
  });
  dom.topicSelect.addEventListener('change', () => void setTopic(dom.topicSelect.value));
  dom.chips.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!chip?.dataset.filter) return;
    state.chip = chip.dataset.filter as ChipId;
    document.querySelectorAll<HTMLElement>('.chip').forEach((item) => item.classList.toggle('on', item === chip));
    draw();
  });
  dom.search.addEventListener('input', () => renderSearchResults(dom.search.value));
  dom.search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dom.searchResults.hidden = true;
      dom.search.blur();
      return;
    }
    if (event.key !== 'Enter') return;
    const hits = runSearch(dom.search.value);
    if (hits.length > 0) {
      dom.searchResults.hidden = true;
      void selectAndReveal({ kind: hits[0].kind, id: hits[0].id });
    } else {
      flashHint(`没有找到「${dom.search.value.trim()}」`);
    }
  });
  dom.searchResults.addEventListener('click', (event) => {
    const hit = (event.target as HTMLElement).closest<HTMLElement>('.search-hit');
    if (!hit?.dataset.kind || !hit.dataset.id) return;
    dom.searchResults.hidden = true;
    void selectAndReveal({ kind: hit.dataset.kind as 'person' | 'event', id: hit.dataset.id });
  });
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement;
    if (dom.lanePanel.classList.contains('open')
      && !target.closest('#lane-panel') && !target.closest('#btn-lanes')) {
      dom.lanePanel.classList.remove('open');
    }
    if (!dom.exportMenu.hidden && !target.closest('#export-menu') && !target.closest('#btn-export')) {
      dom.exportMenu.hidden = true;
    }
    if (!target.closest('.search') && !target.closest('.search-results')) {
      dom.searchResults.hidden = true;
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dom.lanePanel.classList.remove('open');
      dom.exportMenu.hidden = true;
      if (dom.card.classList.contains('show')) hideCard();
    }
    if ((event.key === '+' || event.key === '=') && !isTyping()) zoomBy(0.75);
    if (event.key === '-' && !isTyping()) zoomBy(1.333);
    if (event.key === 'ArrowLeft' && !isTyping()) panByFraction(-0.1);
    if (event.key === 'ArrowRight' && !isTyping()) panByFraction(0.1);
  });
  canvasPointer();
  ribbonPointer();
  window.addEventListener('resize', () => resize());
  // 应用自己写地址用 history API，不会触发 hashchange；这里只处理外部改动。
  window.addEventListener('hashchange', () => {
    void applyRoute(parseHash(location.hash, state.library.catalog));
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      resize();
    }).observe(dom.topbar);
  }
}

function isTyping(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
}

function canvasPointer(): void {
  dom.canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    inertia = 0;
    drag = {
      x: event.clientX,
      y: event.clientY,
      domain: [state.domain[0], state.domain[1]],
      scrollY: state.scrollY,
      moved: false,
      lastX: event.clientX,
      lastT: performance.now(),
    };
    dom.canvas.setPointerCapture(event.pointerId);
  });
  dom.canvas.addEventListener('pointermove', (event) => {
    if (!drag) {
      hover(event);
      return;
    }
    if (SKINS[state.skin].inertia) {
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      inertia = inertia * 0.7 + ((event.clientX - drag.lastX) / dt) * 0.3;
      drag.lastT = now;
      drag.lastX = event.clientX;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const yearsPerPx = (drag.domain[1] - drag.domain[0]) / (W - PAD_X * 2);
    const shift = dx * yearsPerPx;
    const span = drag.domain[1] - drag.domain[0];
    const full = fullSpan();
    let d0 = drag.domain[0] - shift;
    let d1 = drag.domain[1] - shift;
    if (d0 < full[0]) {
      d0 = full[0];
      d1 = d0 + span;
    }
    if (d1 > full[1]) {
      d1 = full[1];
      d0 = d1 - span;
    }
    state.domain = [d0, d1];
    state.scrollY = clamp(drag.scrollY - dy, 0, maxScroll());
    draw();
  });
  dom.canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    const moved = drag?.moved ?? false;
    drag = null;
    if (moved) {
      return;
    }
    inertia = 0;
    const rect = dom.canvas.getBoundingClientRect();
    const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (hit) void selectAndReveal(hit);
    else hideCard();
  });
  dom.canvas.addEventListener('pointerleave', () => {
    document.getElementById('tooltip')?.setAttribute('hidden', '');
  });
  dom.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (event.shiftKey) {
      state.scrollY = clamp(state.scrollY + event.deltaY, 0, maxScroll());
      draw();
      return;
    }
    const rect = dom.canvas.getBoundingClientRect();
    zoomAt(event.clientX - rect.left, Math.exp(event.deltaY * 0.0012));
  }, { passive: false });
}

function ribbonPointer(): void {
  let mode: 'pan' | 'left' | 'right' | null = null;
  let start = { x: 0, domain: [0, 0] as [number, number] };
  const edge = (clientX: number): 'pan' | 'left' | 'right' | null => {
    const rect = dom.ribbon.getBoundingClientRect();
    const [g0, g1] = fullSpan();
    const toPx = (year: number): number => rect.left + ((year - g0) / (g1 - g0)) * rect.width;
    const x0 = toPx(state.domain[0]);
    const x1 = toPx(state.domain[1]);
    if (Math.abs(clientX - x0) <= 6) return 'left';
    if (Math.abs(clientX - x1) <= 6) return 'right';
    if (clientX > x0 && clientX < x1) return 'pan';
    return null;
  };
  dom.ribbon.addEventListener('pointerdown', (event) => {
    mode = edge(event.clientX);
    start = { x: event.clientX, domain: [state.domain[0], state.domain[1]] };
    dom.ribbon.setPointerCapture(event.pointerId);
  });
  dom.ribbon.addEventListener('pointermove', (event) => {
    dom.ribbon.style.cursor = mode === 'left' || mode === 'right' ? 'ew-resize' : 'pointer';
    if (!mode) return;
    const rect = dom.ribbon.getBoundingClientRect();
    const yearsPerPx = (fullSpan()[1] - fullSpan()[0]) / Math.max(1, rect.width);
    const delta = (event.clientX - start.x) * yearsPerPx;
    if (mode === 'pan') {
      const span = start.domain[1] - start.domain[0];
      let d0 = start.domain[0] + delta;
      let d1 = start.domain[1] + delta;
      if (d0 < fullSpan()[0]) {
        d0 = fullSpan()[0];
        d1 = d0 + span;
      }
      if (d1 > fullSpan()[1]) {
        d1 = fullSpan()[1];
        d0 = d1 - span;
      }
      state.domain = [Math.round(d0), Math.round(d1)];
    } else if (mode === 'left') {
      state.domain = [Math.round(clamp(start.domain[0] + delta, fullSpan()[0], start.domain[1] - 10)), start.domain[1]];
    } else {
      state.domain = [start.domain[0], Math.round(clamp(start.domain[1] + delta, start.domain[0] + 10, fullSpan()[1]))];
    }
    draw();
  });
  dom.ribbon.addEventListener('pointerup', (event) => {
    const wasMode = mode;
    mode = null;
    if (wasMode) {
      return;
    }
    const year = ribbonXAt(event.clientX);
    centerDomain(year, state.domain[1] - state.domain[0]);
    const dynasty = state.library.dynasties.find((item) => year >= item.from && year <= item.to);
    const target = dynasty ? topicForDynasty(state.library, dynasty.id) : null;
    if (target && target.id !== state.topicId) void setTopic(target.id);
    draw();
  });
  dom.ribbon.addEventListener('pointerleave', () => {
    if (!mode) dom.ribbon.style.cursor = 'pointer';
  });
}

function zoomAt(px: number, factor: number): void {
  const full = fullSpan();
  const anchor = yearAt(px);
  const [d0, d1] = state.domain;
  const span = clamp((d1 - d0) * factor, 4, full[1] - full[0]);
  const ratio = (anchor - d0) / (d1 - d0);
  let nd0 = anchor - span * ratio;
  let nd1 = anchor + span * (1 - ratio);
  if (nd0 < full[0]) {
    nd1 += full[0] - nd0;
    nd0 = full[0];
  }
  if (nd1 > full[1]) {
    nd0 -= nd1 - full[1];
    nd1 = full[1];
  }
  state.domain = [Math.round(nd0), Math.round(nd1)];
  draw();
}

function zoomBy(factor: number): void {
  if (state.line === 'people' && !state.topic) return;
  zoomAt(W / 2, factor);
}

function panByFraction(fraction: number): void {
  const span = state.domain[1] - state.domain[0];
  const shift = span * fraction;
  const full = fullSpan();
  let d0 = state.domain[0] + shift;
  let d1 = state.domain[1] + shift;
  if (d0 < full[0]) {
    d0 = full[0];
    d1 = d0 + span;
  }
  if (d1 > full[1]) {
    d1 = full[1];
    d0 = d1 - span;
  }
  state.domain = [Math.round(d0), Math.round(d1)];
  draw();
}

async function resetView(): Promise<void> {
  state.chip = 'all';
  document.querySelectorAll<HTMLElement>('.chip').forEach((chip) => chip.classList.toggle('on', chip.dataset.filter === 'all'));
  state.hiddenLanes = new Set();
  localStorage.setItem(STORAGE.lanes, '[]');
  if (state.line !== 'people') await setLine('people', false);
  state.domain = defaultDomain();
  state.scrollY = 0;
  hideCardSilent();
  buildLanePanel();
  rebuildLayout();
  syncHash('replace');
  draw();
  flashHint('已复位到本专题全览');
}

// ---------- 悬浮提示 ----------

function hover(event: PointerEvent): void {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  const rect = dom.canvas.getBoundingClientRect();
  const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
  dom.canvas.style.cursor = hit ? 'pointer' : 'grab';
  if (!hit) {
    tooltip.hidden = true;
    return;
  }
  const text = hit.kind === 'person'
    ? personTooltip(hit.id)
    : eventTooltip(hit.id);
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function personTooltip(id: string): string {
  const person = state.topic?.people.find((item) => item.id === id);
  const record = state.library.personById.get(id);
  const label = person?.display ?? record?.display ?? id;
  const birth = person?.birth ?? record?.birth;
  const death = person?.death ?? record?.death;
  return `${label}　${birth != null ? fmtYear(birth) : '生年不详'} — ${death != null ? fmtYear(death) : '卒年不详'}`;
}

function eventTooltip(id: string): string {
  const event = state.library.eventById.get(id);
  if (!event) return id;
  const range = event.endYear && event.endYear !== event.year
    ? `${fmtYear(event.year)} — ${fmtYear(event.endYear)}`
    : fmtYear(event.year);
  return `${event.display || event.name}　${range}`;
}

let hintTimer = 0;
const DEFAULT_HINT = '滚轮缩放 · 拖动平移 · 点击人物或事件 · 底部朝代带可跳转';

function flashHint(text: string): void {
  dom.hint.textContent = text;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    dom.hint.textContent = DEFAULT_HINT;
  }, 2600);
}

// ---------- 导出 ----------

async function runExport(format: 'png' | 'svg'): Promise<void> {
  const width = W;
  const height = H + RIBBON_H;
  const render = (c: CanvasRenderingContext2D, w: number, h: number): void => {
    renderScene(c, w, h - RIBBON_H);
    renderRibbon(c, 0, h - RIBBON_H, w, RIBBON_H);
  };
  await exportView({
    render,
    width,
    height,
    paper: skinPalette().paper,
    basename: exportBasename(['历史时间轴', lineLabel(), `${fmtYear(Math.round(state.domain[0]))}—${fmtYear(Math.round(state.domain[1]))}`]),
    format,
  });
  flashHint(`${format.toUpperCase()} 已导出`);
}

// ---------- 循环与尺寸 ----------

function loop(time: number): void {
  if (SKINS[state.skin].inertia && !dragging && Math.abs(inertia) > 0.01 && W > 0) {
    const yearsPerPx = (state.domain[1] - state.domain[0]) / (W - PAD_X * 2);
    const shift = inertia * 16.7 * yearsPerPx;
    const span = state.domain[1] - state.domain[0];
    const full = fullSpan();
    let d0 = state.domain[0] - shift;
    let d1 = state.domain[1] - shift;
    if (d0 < full[0]) {
      d0 = full[0];
      d1 = d0 + span;
      inertia = 0;
    }
    if (d1 > full[1]) {
      d1 = full[1];
      d0 = d1 - span;
      inertia = 0;
    }
    state.domain = [d0, d1];
    draw();
  }
  drawStars(time);
  requestAnimationFrame(loop);
}

function resizeChart(): void {
  W = dom.stage.clientWidth;
  H = dom.stage.clientHeight;
  dom.canvas.width = Math.round(W * DPR);
  dom.canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function resize(): void {
  // 顶栏高度决定 stage 的高度，必须先写变量再量尺寸。
  document.documentElement.style.setProperty('--topbar-h', `${dom.topbar.offsetHeight}px`);
  resizeChart();
  dom.stars.width = Math.round(window.innerWidth * DPR);
  dom.stars.height = Math.round(window.innerHeight * DPR);
  dom.stars.style.width = `${window.innerWidth}px`;
  dom.stars.style.height = `${window.innerHeight}px`;
  sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const ribbon = dom.ribbon.parentElement as HTMLElement;
  dom.ribbon.width = Math.round(ribbon.clientWidth * DPR);
  dom.ribbon.height = Math.round(ribbon.clientHeight * DPR);
  rctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ensureDomain();
  rebuildLayout();
  draw();
}
