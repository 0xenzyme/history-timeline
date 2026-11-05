/**
 * 正式版前端：把 design 原型（巡航 / 深空双皮肤）落到站点。
 * 一条时间轴引擎跑三种内容线：人物（按泳道）、军事、历史事件（按类型分行）。
 *
 * 本文件只保留状态启动、路由与编排；绘制在 render.ts，交互在 interaction.ts，
 * DOM 视图装配在 view.ts，共享状态在 runtime.ts。
 */

import type { Library } from './model';
import type { Route } from '../routing';
import { parseHash, writeHash, writeLineHash, decodeHash, type HistoryMode } from '../routing';
import { exportBasename, exportView } from './exporter';
import { BAR_H, PAD_X, ROW_GAP, buildEventLayout, buildPeopleLayout, layoutHeight, type LaneLayout } from './layout';
import { createLibrary, findTopicEntry, loadTopicData } from './model';
import { SKINS, isSkinId, type SkinId } from './skins';
import { clamp, fmtYear, personFrom, personTo } from './util';
import {
  announce,
  applySkin,
  buildLanePanel,
  buildTopicSelect,
  flashHint,
  hideCard,
  hideCardSilent,
  renderSearchResults,
  runSearch,
  setAllLanes,
  showCard,
  syncStripToggle,
  toggleLane,
} from './view';
import { canvasPointer, centerDomain, keyboardEvents, ribbonPointer } from './interaction';
import {
  draw,
  drawStars,
  fullSpan,
  hdrH,
  maxScroll,
  peopleSpan,
  renderRibbon,
  renderScene,
  skinPalette,
  visibleEvents,
} from './render';
import {
  DEFAULT_TOPIC,
  DPR,
  H,
  STORAGE,
  W,
  dom,
  ctx,
  initial,
  layouts,
  motion,
  rctx,
  sctx,
  setContentH,
  setHooks,
  setInitial,
  setLayouts,
  setLoadingTopic,
  setState,
  setViewportSize,
  state,
  type ChipId,
  type LineId,
  type Selection,
} from './runtime';

const RIBBON_H = 76;

// ---------- 启动 ----------

export async function boot(): Promise<void> {
  const bootEl = document.getElementById('boot');
  try {
    const library = await createLibrary();
    bootEl?.remove();
    setState({
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
    });
    buildTopicSelect();
    wireEvents();
    applySkin(state.skin, false);
    setInitial(location.hash.replace('#', '').trim().length > 0 ? parseHash(location.hash, library.catalog) : null);
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

// ---------- 布局 ----------

function rebuildLayout(): void {
  const build = (pitch: number): LaneLayout[] => {
    if (state.line === 'people') {
      return state.topic ? buildPeopleLayout(state.topic, hiddenLaneIds(), pitch) : [];
    }
    return buildEventLayout(visibleEvents(), state.line, hiddenLaneIds(), pitch);
  };
  const basePitch = BAR_H + ROW_GAP;
  let next = build(basePitch);
  // 内容不足一屏时拉开行距，避免大片留白；行距最多放大到 4 倍。
  const available = H - hdrH();
  if (available > 0) {
    const filled = layoutHeight(next);
    if (filled > 0 && filled < available) {
      const factor = clamp(available / filled, 1, 4);
      if (factor > 1.04) next = build(basePitch * factor);
    }
  }
  const height = layoutHeight(next);
  setLayouts(next);
  setContentH(height);
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
  setLoadingTopic(true);
  const topic = await loadTopicData(state.library, topicId);
  setLoadingTopic(false);
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

// ---------- 选择 ----------

async function selectAndReveal(selection: Selection, sync = true, keepDomain = false): Promise<void> {
  state.selected = selection;
  if (selection.kind === 'person') {
    const record = state.library.personById.get(selection.id);
    // 人就在当前专题里时不切走：personById 是「首见即存」，跨专题人物会总跳到发布顺序最靠前的那个专题。
    const inCurrentTopic =
      state.line === 'people' && Boolean(state.topic?.people.some((item) => item.id === selection.id));
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

async function applyRoute(route: Route | null): Promise<void> {
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

// ---------- 交互绑定 ----------

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
    if (dom.lanePanel.classList.contains('open') && !target.closest('#lane-panel') && !target.closest('#btn-lanes')) {
      dom.lanePanel.classList.remove('open');
    }
    if (!dom.exportMenu.hidden && !target.closest('#export-menu') && !target.closest('#btn-export')) {
      dom.exportMenu.hidden = true;
    }
    if (!target.closest('.search') && !target.closest('.search-results')) {
      dom.searchResults.hidden = true;
    }
  });
  keyboardEvents();
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

// ---------- 复位 ----------

async function resetView(): Promise<void> {
  state.chip = 'all';
  document
    .querySelectorAll<HTMLElement>('.chip')
    .forEach((chip) => chip.classList.toggle('on', chip.dataset.filter === 'all'));
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
    basename: exportBasename([
      '历史时间轴',
      lineLabel(),
      `${fmtYear(Math.round(state.domain[0]))}—${fmtYear(Math.round(state.domain[1]))}`,
    ]),
    format,
  });
  flashHint(`${format.toUpperCase()} 已导出`);
}

// ---------- 循环与尺寸 ----------

function loop(time: number): void {
  if (SKINS[state.skin].inertia && !motion.dragging && Math.abs(motion.inertia) > 0.01 && W > 0) {
    const yearsPerPx = (state.domain[1] - state.domain[0]) / (W - PAD_X * 2);
    const shift = motion.inertia * 16.7 * yearsPerPx;
    const span = state.domain[1] - state.domain[0];
    const full = fullSpan();
    let d0 = state.domain[0] - shift;
    let d1 = state.domain[1] - shift;
    if (d0 < full[0]) {
      d0 = full[0];
      d1 = d0 + span;
      motion.inertia = 0;
    }
    if (d1 > full[1]) {
      d1 = full[1];
      d0 = d1 - span;
      motion.inertia = 0;
    }
    state.domain = [d0, d1];
    draw();
  }
  drawStars(time);
  requestAnimationFrame(loop);
}

function resizeChart(): void {
  const width = dom.stage.clientWidth;
  const height = dom.stage.clientHeight;
  setViewportSize(width, height);
  dom.canvas.width = Math.round(width * DPR);
  dom.canvas.height = Math.round(height * DPR);
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

setHooks({
  setLine,
  setTopic,
  selectAndReveal,
  rebuildLayout,
  resizeChart,
});
