import './styles.css';
import { select } from 'd3-selection';
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';

import { downloadChart, exportBasename } from './export';
import { formatLifespan, lifespanSpan } from './format';
import { findCatalogEntry, loadCatalog, loadSearchIndex, loadTopic } from './loader';
import { parseHash, topicDataUrl, writeHash, type HistoryMode } from './routing';
import type { Catalog, Person, SearchRecord, Topic, TopicFilters, View } from './types';
import { buildLayout, AXIS_H, type Layout } from './timeline/layout';
import { fromAxis, toAxis } from './timeline/years';
import { fitPersonDomain } from './timeline/geometry';
import { buildAdjacency, type RenderContext } from './timeline/context';
import { renderGrid, renderPinnedAxis } from './timeline/axis';
import { renderGutter, renderLanes } from './timeline/lanes';
import { renderBarDefs, renderBars, renderHitAreas } from './timeline/bars';
import { renderRelations } from './timeline/relations';
import {
  assignEventRows,
  renderEventBands,
  renderEventLabels,
  renderEventLines,
  renderEventRibbon,
} from './timeline/events';
import { entryView, findView, findViewForPerson, isIndexView, renderChapters } from './ui/chapters';
import { renderLegend } from './ui/legend';
import { renderCard } from './ui/card';
import { renderTopics } from './ui/topics';
import { buildSearchRows, renderSearchResults, searchPeople, type SearchRow } from './ui/search';
import { renderGraph, personRelationCount } from './ui/graph';
import { esc } from './timeline/svg';

const svg = document.getElementById('chart') as unknown as SVGSVGElement;
const stage = document.getElementById('stage') as HTMLElement;
const axisPinEl = document.getElementById('axis-pin') as HTMLElement;
const axisPinSvg = document.getElementById('axis-pin-svg') as unknown as SVGSVGElement;
const routeMissEl = document.getElementById('route-miss') as HTMLElement;
const cardEl = document.getElementById('card') as HTMLElement;
const chaptersEl = document.getElementById('chapters') as HTMLElement;
const legendEl = document.getElementById('legend') as HTMLElement;
const tooltipEl = document.getElementById('tooltip') as HTMLElement;
const briefEl = document.getElementById('brief') as HTMLElement;
const hintEl = document.getElementById('hint') as HTMLElement;
const topicSwitchEl = document.getElementById('topic-switch') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchResultsEl = document.getElementById('search-results') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const exportToggle = document.getElementById('export-toggle') as HTMLButtonElement;
const exportMenu = document.getElementById('export-menu') as HTMLElement;

type Mode = 'timeline' | 'graph';

interface RouteMiss {
  topicToken: string | null;
  viewToken: string | null;
}

interface AppState {
  topic: Topic;
  layout: Layout;
  viewId: string;
  domain: [number, number];
  focusId: string | null;
  hoverId: string | null;
  showAllRelations: boolean;
  adjacency: Map<string, Set<string>>;
  mode: Mode;
  routeMiss: RouteMiss | null;
}

const ui: {
  topicMenuOpen: boolean;
  exportMenuOpen: boolean;
  searchQuery: string;
  searchActiveIndex: number;
  filters: TopicFilters;
} = {
  topicMenuOpen: false,
  exportMenuOpen: false,
  searchQuery: '',
  searchActiveIndex: -1,
  filters: {
    region: null,
    era: null,
    theme: null,
  },
};

let catalog: Catalog | null = null;
let state: AppState | null = null;
let searchIndex: SearchRecord[] | null = null;
let searchIndexTask: Promise<SearchRecord[]> | null = null;
let suppressClick = false;
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
let applyingTransform = false;
let loadingTopic = false;
const pointer = { x: 0, y: 0 };

function currentView(): View {
  return findView(state!.topic, state!.viewId);
}

function personById(id: string | null): Person | null {
  if (!state || id === null) return null;
  return state.topic.people.find((person) => person.id === id) ?? null;
}

function announce(message: string): void {
  statusEl.textContent = '';
  window.requestAnimationFrame(() => {
    statusEl.textContent = message;
  });
}

function focusPersonControl(id: string): void {
  const control = [...svg.querySelectorAll<SVGElement>('[data-person]')].find(
    (element) =>
      element.getAttribute('data-person') === id &&
      (element.classList.contains('hit') || element.classList.contains('graph-node')),
  );
  control?.focus({ preventScroll: true });
}

function render(): void {
  if (!state) return;
  document.body.classList.toggle('is-graph', state.mode === 'graph');
  if (state.mode === 'graph') {
    renderGraphView();
    updateTooltip();
    return;
  }
  renderTimeline();
  updateTooltip();
}

function renderTimeline(): void {
  if (!state) return;
  const { topic, layout } = state;
  const view = currentView();
  const x = yearX(layout, state.domain);
  const zonePeople = new Set(view.people ?? topic.people.map((person) => person.id));
  const zoneEvents = new Set(view.events ?? topic.events.map((event) => event.id));
  const eventRows = assignEventRows({ topic, x, zoneEvents, layout });

  const ctx: RenderContext = {
    topic,
    layout,
    view,
    domain: state.domain,
    x,
    zonePeople,
    zoneEvents,
    focusId: state.focusId,
    hoverId: state.hoverId,
    showAllRelations: state.showAllRelations,
    eventRows,
    adjacency: state.adjacency,
  };

  const width = layout.plotRight - layout.plotLeft;
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', String(layout.width));
  svg.setAttribute('height', String(layout.height));
  svg.setAttribute('aria-label', '历史人物生卒时间轴');

  svg.innerHTML = [
    `<defs>${renderBarDefs(ctx)}<clipPath id="plot-clip"><rect x="${layout.plotLeft}" y="0" width="${width}" height="${layout.height}" /></clipPath></defs>`,
    `<g class="layer-ribbon">${renderEventRibbon(ctx)}</g>`,
    `<g class="layer-lanes" clip-path="url(#plot-clip)">${renderLanes(ctx)}</g>`,
    `<g class="layer-bands" clip-path="url(#plot-clip)">${renderEventBands(ctx)}</g>`,
    `<g class="layer-grid" clip-path="url(#plot-clip)">${renderGrid(ctx)}</g>`,
    `<g class="layer-relations" clip-path="url(#plot-clip)">${renderRelations(ctx)}</g>`,
    `<g class="layer-hits" clip-path="url(#plot-clip)">${renderHitAreas(ctx)}</g>`,
    `<g class="layer-bars" clip-path="url(#plot-clip)">${renderBars(ctx)}</g>`,
    `<g class="layer-event-lines" clip-path="url(#plot-clip)">${renderEventLines(ctx)}</g>`,
    `<g class="layer-event-labels">${renderEventLabels(ctx)}</g>`,
    `<g class="layer-gutter">${renderGutter(ctx)}</g>`,
  ].join('');
  paintAxisPin(ctx);
}

function renderGraphView(): void {
  if (!state || state.focusId === null) return;
  const width = Math.max(320, stage.clientWidth);
  const height = Math.max(360, stage.clientHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-label', '人物关系全景');
  svg.innerHTML = renderGraph(state.topic, state.focusId, width, height, state.hoverId);
}

function currentSearchRows(): SearchRow[] {
  if (!state) return [];
  return buildSearchRows(state.topic, ui.searchQuery, searchIndex).rows;
}

function renderSearchUI(): void {
  if (!state) {
    searchResultsEl.hidden = true;
    searchResultsEl.innerHTML = '';
    searchResultsEl.setAttribute('aria-label', '人物搜索结果');
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }
  const built = buildSearchRows(state.topic, ui.searchQuery, searchIndex);
  if (ui.searchActiveIndex >= built.rows.length) ui.searchActiveIndex = built.rows.length - 1;
  searchResultsEl.innerHTML = renderSearchResults(
    built.rows,
    ui.searchQuery,
    built.notice,
    built.pending,
    ui.searchActiveIndex,
  );
  const open = ui.searchQuery.trim().length > 0;
  searchResultsEl.hidden = !open;
  const countLabel = built.pending
    ? '正在查找其他专题'
    : built.rows.length > 0
      ? `人物搜索结果，共${built.rows.length}项`
      : built.notice ?? '人物搜索结果，无匹配项';
  searchResultsEl.setAttribute('aria-label', countLabel);
  searchInput.setAttribute('aria-expanded', String(open));
  if (open && built.rows.length > 0 && ui.searchActiveIndex >= 0) {
    searchInput.setAttribute('aria-activedescendant', `search-hit-${built.rows[ui.searchActiveIndex].key}`);
  } else {
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function renderChrome(): void {
  if (!state || !catalog) return;
  topicSwitchEl.innerHTML = renderTopics(catalog, state.topic, ui.topicMenuOpen, ui.filters);
  chaptersEl.innerHTML = renderChapters(state.topic, state.viewId);
  briefEl.textContent = currentView().brief ?? '';
  const coarse = window.matchMedia('(pointer: coarse)').matches || isNarrow();
  hintEl.textContent =
    state.mode === 'graph'
      ? coarse
        ? '点击人物切换中心'
        : '点击人物切换中心 · Esc 返回时间轴'
      : coarse
        ? '上下滑动看人名 · 左右拖动平移年份 · 双指缩放'
        : '滚轮上下翻人名 · 左右拖动平移年份 · Ctrl 或 ⌘ + 滚轮缩放';
  renderRouteMiss();

  const person = personById(state.focusId);
  cardEl.innerHTML = renderCard(state.topic, person);
  cardEl.hidden = person === null;
  if (person) cardEl.setAttribute('aria-label', `${person.display}人物详情`);

  document.getElementById('toggle-relations')?.setAttribute(
    'aria-pressed',
    String(state.showAllRelations),
  );
  exportToggle.setAttribute('aria-expanded', String(ui.exportMenuOpen));
  exportMenu.hidden = !ui.exportMenuOpen;
}

function updateTooltip(): void {
  if (!state) return;
  const person = personById(state.hoverId);
  if (!person) {
    tooltipEl.hidden = true;
    return;
  }
  const lane = state.topic.lanes.find((item) => item.id === person.lane);
  const span = lifespanSpan(person);
  tooltipEl.innerHTML = `
    <strong>${esc(person.display)}</strong>
    <span class="tt-name">${esc(person.name)}</span>
    <span class="tt-lane" style="color:${esc(lane?.color ?? '#666')}">${esc(lane?.name ?? '')}</span>
    <span class="tt-life">${esc(formatLifespan(person))}${span ? ` · ${esc(span)}` : ''}</span>
  `;
  tooltipEl.hidden = false;
  tooltipEl.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 16}px)`;
}

function yearX(layout: Layout, domain: [number, number]): (year: number) => number {
  const scale = layout.xTopic.copy().domain([toAxis(domain[0]), toAxis(domain[1])]);
  return (year: number) => scale(toAxis(year));
}

function applyDomainToZoom(): void {
  if (!state || !zoomBehavior) return;
  const { layout, domain } = state;
  const scale = layout.xTopic;
  const start = toAxis(domain[0]);
  const end = toAxis(domain[1]);
  const k = (layout.plotRight - layout.plotLeft) / Math.max(1e-6, scale(end) - scale(start));
  const tx = layout.plotLeft - k * scale(start);
  applyingTransform = true;
  select(svg).call(zoomBehavior.transform, zoomIdentity.translate(tx, 0).scale(k));
  applyingTransform = false;
}

function clearZoom(): void {
  select(svg).on('.zoom', null);
  zoomBehavior = null;
}

function initZoom(): void {
  if (!state) return;
  const { layout } = state;
  clearZoom();

  zoomBehavior = createZoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 60])
    .extent([
      [layout.plotLeft, 0],
      [layout.plotRight, layout.height],
    ])
    .translateExtent([
      [layout.plotLeft, 0],
      [layout.plotRight, layout.height],
    ])
    .filter((event: WheelEvent | MouseEvent | TouchEvent) => {
      if (state?.mode === 'graph') return false;
      if (event.type === 'wheel') {
        const wheel = event as WheelEvent;
        return wheel.ctrlKey || wheel.metaKey;
      }
      if (event.type === 'touchstart') return (event as TouchEvent).touches.length >= 2;
      return false;
    })
    .on('zoom', (event) => {
      if (applyingTransform || !state || state.mode === 'graph') return;
      const scale = event.transform.rescaleX(state.layout.xTopic);
      state.domain = [
        fromAxis(scale.invert(state.layout.plotLeft)),
        fromAxis(scale.invert(state.layout.plotRight)),
      ];
      render();
    });

  select(svg).call(zoomBehavior).on('dblclick.zoom', null);
  applyDomainToZoom();
}

function rebuildLayout(): void {
  if (!state) return;
  state.layout = buildLayout(
    state.topic,
    stage.clientWidth,
    currentView(),
    stage.clientHeight,
  );
}

interface ApplyViewOptions {
  focusId?: string | null;
  fitPerson?: boolean;
  history?: HistoryMode;
  keepMiss?: boolean;
}

function isNarrow(): boolean {
  return window.matchMedia('(max-width: 640px)').matches;
}

function initialFocus(view: View, options: ApplyViewOptions): string | null {
  if (options.focusId !== undefined) return options.focusId;
  if (isIndexView(view) || isNarrow()) return null;
  return view.focus ?? null;
}

function laneAtScroll(): string {
  if (!state || state.layout.lanes.length === 0) return '';
  const y = stage.scrollTop + state.layout.plotTop;
  const box = state.layout.lanes.find((lane) => y >= lane.top && y < lane.bottom);
  return (box ?? state.layout.lanes[0]).lane.name;
}

function paintAxisPin(ctx?: RenderContext): void {
  if (!state || state.mode === 'graph') {
    axisPinEl.hidden = true;
    return;
  }
  const layout = state.layout;
  const view = currentView();
  const x = yearX(layout, state.domain);
  const zonePeople = new Set(view.people ?? state.topic.people.map((person) => person.id));
  const zoneEvents = new Set(view.events ?? state.topic.events.map((event) => event.id));
  const pinCtx: RenderContext = ctx ?? {
    topic: state.topic,
    layout,
    view,
    domain: state.domain,
    x,
    zonePeople,
    zoneEvents,
    focusId: state.focusId,
    hoverId: state.hoverId,
    showAllRelations: state.showAllRelations,
    eventRows: new Map(),
    adjacency: state.adjacency,
  };
  axisPinEl.hidden = false;
  axisPinSvg.setAttribute('viewBox', `0 0 ${layout.width} ${AXIS_H}`);
  axisPinSvg.setAttribute('width', String(layout.width));
  axisPinSvg.setAttribute('height', String(AXIS_H));
  axisPinSvg.innerHTML = renderPinnedAxis(pinCtx, laneAtScroll());
}

function renderRouteMiss(): void {
  if (!state || !catalog) return;
  const miss = state.routeMiss;
  if (!miss || (!miss.topicToken && !miss.viewToken)) {
    routeMissEl.hidden = true;
    routeMissEl.innerHTML = '';
    return;
  }
  routeMissEl.hidden = false;
  if (miss.topicToken) {
    const home = catalog.topics[0];
    routeMissEl.innerHTML = `<p>没有「${esc(miss.topicToken)}」这个专题。</p><button type="button" data-go-topic="${esc(home.id)}">回到${esc(home.title)}</button>`;
    return;
  }
  const buttons = state.topic.views
    .map(
      (view) =>
        `<button type="button" data-chapter="${esc(view.id)}">${esc(view.name)}</button>`,
    )
    .join('');
  routeMissEl.innerHTML = `<p>${esc(state.topic.meta.title)}没有「${esc(miss.viewToken ?? '')}」这一章。</p><div class="route-miss-actions">${buttons}</div>`;
}

function scrollFocusIntoView(id: string | null): void {
  if (!id || !state) {
    stage.scrollTop = 0;
    return;
  }
  const row = state.layout.rows.get(id);
  if (!row) {
    stage.scrollTop = 0;
    return;
  }
  stage.scrollTop = Math.max(0, row.y - state.layout.plotTop - 24);
}

function panByPixels(dx: number): void {
  if (!state || dx === 0) return;
  const width = state.layout.plotRight - state.layout.plotLeft;
  const start0 = toAxis(state.domain[0]);
  const end0 = toAxis(state.domain[1]);
  const span = end0 - start0;
  const shift = (-dx / Math.max(1, width)) * span;
  const [min, max] = state.topic.meta.range;
  const minAxis = toAxis(min);
  const maxAxis = toAxis(max);
  let start = start0 + shift;
  let end = end0 + shift;
  if (start < minAxis) {
    end += minAxis - start;
    start = minAxis;
  }
  if (end > maxAxis) {
    start -= end - maxAxis;
    end = maxAxis;
  }
  start = Math.max(minAxis, start);
  end = Math.min(maxAxis, end);
  if (end <= start) return;
  state.domain = [fromAxis(start), fromAxis(end)];
  applyDomainToZoom();
  render();
}

function applyView(viewId: string, options: ApplyViewOptions = {}): void {
  if (!state) return;
  const view = findView(state.topic, viewId);
  state.mode = 'timeline';
  state.viewId = view.id;
  state.hoverId = null;
  state.showAllRelations = false;
  state.focusId = initialFocus(view, options);
  if (!options.keepMiss) state.routeMiss = null;
  rebuildLayout();
  if (options.fitPerson && state.focusId) {
    const person = personById(state.focusId);
    state.domain = person ? fitPersonDomain(person, state.topic.meta.range) : [view.from, view.to];
  } else {
    state.domain = [view.from, view.to];
  }
  writeHash(state.topic.meta.id, view.id, options.history ?? 'skip');
  initZoom();
  renderChrome();
  render();
  if (options.fitPerson) scrollFocusIntoView(state.focusId);
  else stage.scrollTop = 0;
  paintAxisPin();
  announce(`已进入章节：${view.name}`);
}

function relayout(): void {
  if (!state) return;
  const width = stage.clientWidth;
  if (width <= 0) return;
  if (
    state.mode === 'timeline' &&
    width === state.layout.width &&
    stage.clientHeight === state.layout.availHeight
  ) {
    return;
  }
  rebuildLayout();
  if (state.mode === 'timeline') initZoom();
  render();
}

function setFocus(id: string | null): void {
  if (!state) return;
  state.focusId = id;
  if (id === null && state.mode === 'graph') {
    returnToTimeline();
    return;
  }
  renderChrome();
  render();
  announce(id ? `已选择人物：${personById(id)?.display ?? id}` : '已取消人物选择');
  if (id) window.requestAnimationFrame(() => focusPersonControl(id));
}

function enterGraph(): void {
  if (!state || state.focusId === null) return;
  if (personRelationCount(state.topic, state.focusId) === 0) return;
  state.mode = 'graph';
  state.hoverId = null;
  clearZoom();
  renderChrome();
  render();
}

function returnToTimeline(): void {
  if (!state) return;
  state.mode = 'timeline';
  if (state.focusId) {
    const view = findViewForPerson(state.topic, state.focusId, currentView());
    if (view.id !== state.viewId) {
      applyView(view.id, { focusId: state.focusId, fitPerson: true, history: 'push' });
      return;
    }
  }
  initZoom();
  renderChrome();
  render();
  announce('已返回时间轴');
}

function revealPerson(id: string): void {
  if (!state) return;
  ui.searchQuery = '';
  ui.searchActiveIndex = -1;
  searchInput.value = '';
  searchInput.blur();
  renderSearchUI();
  const view = findViewForPerson(state.topic, id, currentView());
  applyView(view.id, { focusId: id, fitPerson: true, history: 'push' });
}

async function openRemotePerson(topicId: string, personId: string): Promise<void> {
  ui.searchQuery = '';
  ui.searchActiveIndex = -1;
  searchInput.value = '';
  renderSearchUI();
  if (!state || state.topic.meta.id !== topicId) {
    await mountTopic(topicId, null, 'skip');
  }
  revealPerson(personId);
}

function ensureSearchIndex(): Promise<SearchRecord[]> {
  if (searchIndex) return Promise.resolve(searchIndex);
  searchIndexTask ??= loadSearchIndex('./data/search.json').then((rows) => {
    searchIndex = rows;
    return rows;
  });
  return searchIndexTask;
}

function closeMenus(except?: 'topic' | 'export'): void {
  let dirty = false;
  if (except !== 'topic' && ui.topicMenuOpen) {
    ui.topicMenuOpen = false;
    dirty = true;
  }
  if (except !== 'export' && ui.exportMenuOpen) {
    ui.exportMenuOpen = false;
    dirty = true;
  }
  if (dirty) renderChrome();
}

async function switchTopic(topicId: string): Promise<void> {
  if (!catalog || loadingTopic) return;
  if (state?.topic.meta.id === topicId) {
    ui.topicMenuOpen = false;
    renderChrome();
    return;
  }
  ui.topicMenuOpen = false;
  ui.exportMenuOpen = false;
  ui.searchQuery = '';
  ui.searchActiveIndex = -1;
  searchInput.value = '';
  await mountTopic(topicId, null, 'push');
}

async function mountTopic(
  topicId: string,
  viewId: string | null,
  history: HistoryMode,
  unknownTopic: string | null = null,
): Promise<void> {
  if (!catalog) return;
  loadingTopic = true;
  try {
    const entry = findCatalogEntry(catalog, topicId);
    const topic = await loadTopic(topicDataUrl(entry.file), entry.id);
    document.title = `${topic.meta.title} · 历史人物时间轴`;
    legendEl.innerHTML = renderLegend(topic);
    const first = topic.views[0];
    state = {
      topic,
      layout: buildLayout(topic, stage.clientWidth, first, stage.clientHeight),
      viewId: first.id,
      domain: [first.from, first.to],
      focusId: null,
      hoverId: null,
      showAllRelations: false,
      adjacency: buildAdjacency(topic),
      mode: 'timeline',
      routeMiss: null,
    };
    const requested = viewId;
    const found = requested ? topic.views.some((view) => view.id === requested) : true;
    const missingView = requested && !found ? requested : null;
    if (missingView || unknownTopic) {
      state.routeMiss = { topicToken: unknownTopic, viewToken: missingView };
    }
    applyView(found && requested ? requested : entryView(topic).id, {
      history: missingView || unknownTopic ? 'skip' : history,
      keepMiss: Boolean(missingView || unknownTopic),
    });
    renderSearchUI();
  } finally {
    loadingTopic = false;
  }
}

async function onHashChange(): Promise<void> {
  if (!catalog || !state || loadingTopic) return;
  const route = parseHash(location.hash, catalog);
  const history: HistoryMode = route.canonicalize ? 'replace' : 'skip';
  if (route.unknownTopic || route.topicId !== state.topic.meta.id) {
    await mountTopic(route.topicId, route.viewId, history, route.unknownTopic);
    return;
  }
  const found = route.viewId ? state.topic.views.some((view) => view.id === route.viewId) : true;
  if (route.viewId && !found) {
    state.routeMiss = { topicToken: null, viewToken: route.viewId };
    applyView(entryView(state.topic).id, { history: 'skip', keepMiss: true });
    return;
  }
  const view = findView(state.topic, route.viewId);
  if (view.id !== state.viewId || state.mode === 'graph') applyView(view.id, { history });
  else if (route.canonicalize) writeHash(state.topic.meta.id, view.id, 'replace');
}

function exportBasenameNow(): string {
  if (!state) return '时间轴';
  if (state.mode === 'graph') {
    const person = personById(state.focusId);
    return exportBasename([state.topic.meta.title, person?.display ?? '关系', '关系']);
  }
  return exportBasename([state.topic.meta.title, currentView().name]);
}

async function handleExport(format: 'png' | 'svg'): Promise<void> {
  ui.exportMenuOpen = false;
  renderChrome();
  try {
    const axis = state?.mode === 'timeline' ? axisPinSvg : null;
    await downloadChart(svg, exportBasenameNow(), format, axis);
  } catch (error) {
    console.error(error);
    window.alert(format === 'png' ? '无法导出 PNG，请改用导出 SVG。' : '导出失败。');
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function wireEvents(): void {
  svg.addEventListener('focusin', (event) => {
    if (!state) return;
    const target = event.target as Element | null;
    const id = target?.closest('[data-person]')?.getAttribute('data-person') ?? null;
    if (!id || id === state.hoverId) return;
    state.hoverId = id;
    render();
    window.requestAnimationFrame(() => focusPersonControl(id));
  });

  svg.addEventListener('keydown', (event) => {
    if (!state || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = event.target as Element | null;
    const id = target?.closest('[data-person]')?.getAttribute('data-person') ?? null;
    if (!id) return;
    event.preventDefault();
    setFocus(state.focusId === id ? null : id);
  });

  svg.addEventListener('pointerover', (event) => {
    if (!state) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const target = event.target as Element | null;
    const id = target?.closest('[data-person]')?.getAttribute('data-person') ?? null;
    if (id !== state.hoverId) {
      state.hoverId = id;
      render();
    }
  });

  svg.addEventListener('pointerleave', () => {
    if (!state || state.hoverId === null) return;
    state.hoverId = null;
    render();
  });

  svg.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (state?.hoverId) updateTooltip();
  });

  svg.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!state) return;
    const target = event.target as Element | null;
    const id = target?.closest('[data-person]')?.getAttribute('data-person') ?? null;
    if (state.mode === 'graph') {
      if (id) setFocus(id);
      return;
    }
    setFocus(state.focusId === id ? null : id);
  });

  searchInput.addEventListener('input', () => {
    ui.searchQuery = searchInput.value;
    ui.searchActiveIndex = -1;
    renderSearchUI();
    const query = ui.searchQuery;
    if (!state || !query.trim() || searchPeople(state.topic, query).length > 0) return;
    void ensureSearchIndex().then(() => {
      if (ui.searchQuery === query) renderSearchUI();
    });
  });

  searchInput.addEventListener('focus', () => {
    renderSearchUI();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (!state) return;
    const hits = currentSearchRows();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      ui.searchActiveIndex =
        (ui.searchActiveIndex + delta + hits.length) % hits.length;
      renderSearchUI();
      return;
    }
    if (event.key === 'Escape') {
      ui.searchQuery = '';
      ui.searchActiveIndex = -1;
      searchInput.value = '';
      renderSearchUI();
      return;
    }
    if (event.key !== 'Enter') return;
    const selected = hits[ui.searchActiveIndex] ?? hits[0];
    if (!selected) {
      if (!ui.searchQuery.trim() || !state || searchPeople(state.topic, ui.searchQuery).length > 0) return;
      event.preventDefault();
      const query = ui.searchQuery;
      void ensureSearchIndex().then(() => {
        if (ui.searchQuery !== query) return;
        renderSearchUI();
        const next = currentSearchRows()[0];
        if (!next) return;
        if (next.topicId) void openRemotePerson(next.topicId, next.personId);
        else revealPerson(next.personId);
      });
      return;
    }
    event.preventDefault();
    if (selected.topicId) void openRemotePerson(selected.topicId, selected.personId);
    else revealPerson(selected.personId);
  });

  document.addEventListener('keydown', (event) => {
    if (!state) return;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (event.key !== 'Escape') return;
    if (ui.searchQuery.length > 0 || document.activeElement === searchInput) {
      ui.searchQuery = '';
      searchInput.value = '';
      searchInput.blur();
      renderSearchUI();
      return;
    }
    if (ui.topicMenuOpen || ui.exportMenuOpen) {
      closeMenus();
      return;
    }
    if (state.mode === 'graph') returnToTimeline();
  });

  document.addEventListener('click', (event) => {
    if (!state) return;
    const target = event.target as Element | null;
    if (!target) return;

    if (!target.closest('#search')) {
      searchResultsEl.hidden = true;
    }
    if (!target.closest('#topic-switch') && ui.topicMenuOpen) {
      ui.topicMenuOpen = false;
      renderChrome();
    }
    if (!target.closest('#export-wrap') && ui.exportMenuOpen) {
      ui.exportMenuOpen = false;
      renderChrome();
    }

    const chapter = target.closest('[data-chapter]')?.getAttribute('data-chapter');
    if (chapter) {
      applyView(chapter, { history: 'push' });
      return;
    }

    const goTopic = target.closest('[data-go-topic]')?.getAttribute('data-go-topic');
    if (goTopic) {
      if (state.topic.meta.id === goTopic) {
        state.routeMiss = null;
        applyView(entryView(state.topic).id, { history: 'push' });
      } else {
        void mountTopic(goTopic, null, 'push');
      }
      return;
    }

    if (target.closest('[data-topic-menu]')) {
      ui.topicMenuOpen = !ui.topicMenuOpen;
      ui.exportMenuOpen = false;
      renderChrome();
      return;
    }

    if (target.closest('[data-clear-filters]')) {
      ui.filters.region = null;
      ui.filters.era = null;
      ui.filters.theme = null;
      renderChrome();
      return;
    }

    const facet = target.closest('[data-facet]');
    if (facet) {
      const key = facet.getAttribute('data-facet');
      const value = facet.getAttribute('data-value') ?? '';
      if (key === 'region' || key === 'era' || key === 'theme') {
        ui.filters[key] = value.length === 0 || ui.filters[key] === value ? null : value;
        renderChrome();
      }
      return;
    }

    const topicId = target.closest('[data-topic]')?.getAttribute('data-topic');
    if (topicId) {
      void switchTopic(topicId);
      return;
    }

    const searchHit = target.closest('[data-search-hit]')?.getAttribute('data-search-hit');
    if (searchHit) {
      revealPerson(searchHit);
      return;
    }

    const searchJump = target.closest('[data-search-jump]')?.getAttribute('data-search-jump');
    if (searchJump) {
      const slash = searchJump.indexOf('/');
      if (slash > 0) void openRemotePerson(searchJump.slice(0, slash), searchJump.slice(slash + 1));
      return;
    }

    const goto = target.closest('[data-goto]')?.getAttribute('data-goto');
    if (goto) {
      if (state.mode === 'graph') setFocus(goto);
      else revealPerson(goto);
      return;
    }

    if (target.closest('[data-open-graph]')) {
      enterGraph();
      return;
    }

    if (target.closest('[data-close-card]')) {
      setFocus(null);
      return;
    }

    if (target.closest('#exit-graph')) {
      returnToTimeline();
      return;
    }

    if (target.closest('#reset-view')) {
      applyView(state.viewId, { history: 'skip' });
      return;
    }

    if (target.closest('#toggle-relations')) {
      state.showAllRelations = !state.showAllRelations;
      renderChrome();
      render();
      return;
    }

    if (target.closest('#export-toggle')) {
      ui.exportMenuOpen = !ui.exportMenuOpen;
      ui.topicMenuOpen = false;
      renderChrome();
      return;
    }

    const exportFormat = target.closest('[data-export]')?.getAttribute('data-export');
    if (exportFormat === 'png' || exportFormat === 'svg') {
      void handleExport(exportFormat);
      return;
    }

    if (!zoomBehavior || state.mode === 'graph') return;
    if (target.closest('#zoom-in')) {
      zoomBehavior.scaleBy(select(svg), 1.6);
      return;
    }
    if (target.closest('#zoom-out')) {
      zoomBehavior.scaleBy(select(svg), 1 / 1.6);
    }
  });

  new ResizeObserver(() => relayout()).observe(stage);
  stage.addEventListener('scroll', () => {
    if (state?.mode === 'timeline') paintAxisPin();
  }, { passive: true });
  window.addEventListener('hashchange', () => {
    void onHashChange();
  });
  wireDrag();
}

function wireDrag(): void {
  let drag: {
    pointerId: number;
    x: number;
    y: number;
    mode: 'pending' | 'pan' | 'scroll' | 'ignore';
  } | null = null;

  svg.addEventListener('pointerdown', (event) => {
    if (!state || state.mode === 'graph' || event.button !== 0) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: 'pending' };
  });

  svg.addEventListener('touchstart', (event) => {
    if (event.touches.length >= 2 && drag) drag.mode = 'ignore';
  }, { passive: true });

  svg.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId || !state) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.mode === 'pending') {
      if (Math.hypot(dx, dy) < 5) return;
      if (event.pointerType === 'touch' && Math.abs(dy) >= Math.abs(dx)) {
        drag.mode = 'ignore';
        return;
      }
      drag.mode = Math.abs(dx) > Math.abs(dy) ? 'pan' : 'scroll';
      svg.setPointerCapture(event.pointerId);
      suppressClick = true;
    }
    if (drag.mode === 'pan') panByPixels(dx);
    else if (drag.mode === 'scroll') stage.scrollTop -= dy;
    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  const endDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    drag = null;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
}

async function boot(): Promise<void> {
  catalog = await loadCatalog('./data/index.json');
  const route = parseHash(location.hash, catalog);
  const bare = !location.hash || location.hash === '#';
  const history: HistoryMode = route.unknownTopic ? 'skip' : bare || route.canonicalize ? 'replace' : 'skip';
  await mountTopic(route.topicId, route.viewId, history, route.unknownTopic);
  wireEvents();
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  stage.innerHTML = `<pre class="fatal">${esc(message)}</pre>`;
  announce(`加载失败：${message}`);
  console.error(error);
});
