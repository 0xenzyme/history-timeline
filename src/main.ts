import './styles.css';
import { select } from 'd3-selection';
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';

import { downloadChart, exportBasename } from './export';
import { formatLifespan, lifespanSpan } from './format';
import { findCatalogEntry, loadCatalog, loadTopic } from './loader';
import { parseHash, topicDataUrl, writeHash } from './routing';
import type { Catalog, Person, Topic, TopicFilters, View } from './types';
import { buildLayout, type Layout } from './timeline/layout';
import { fitPersonDomain } from './timeline/geometry';
import { buildAdjacency, type RenderContext } from './timeline/context';
import { renderAxisTicks, renderGrid } from './timeline/axis';
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
import { findView, findViewForPerson, renderChapters } from './ui/chapters';
import { renderLegend } from './ui/legend';
import { renderCard } from './ui/card';
import { renderTopics } from './ui/topics';
import { renderSearchResults, searchPeople } from './ui/search';
import { renderGraph, personRelationCount } from './ui/graph';
import { esc } from './timeline/svg';

const svg = document.getElementById('chart') as unknown as SVGSVGElement;
const stage = document.getElementById('stage') as HTMLElement;
const cardEl = document.getElementById('card') as HTMLElement;
const chaptersEl = document.getElementById('chapters') as HTMLElement;
const legendEl = document.getElementById('legend') as HTMLElement;
const tooltipEl = document.getElementById('tooltip') as HTMLElement;
const briefEl = document.getElementById('brief') as HTMLElement;
const hintEl = document.getElementById('hint') as HTMLElement;
const topicSwitchEl = document.getElementById('topic-switch') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchResultsEl = document.getElementById('search-results') as HTMLElement;
const exportToggle = document.getElementById('export-toggle') as HTMLButtonElement;
const exportMenu = document.getElementById('export-menu') as HTMLElement;

type Mode = 'timeline' | 'graph';

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
}

const ui: {
  topicMenuOpen: boolean;
  exportMenuOpen: boolean;
  searchQuery: string;
  filters: TopicFilters;
} = {
  topicMenuOpen: false,
  exportMenuOpen: false,
  searchQuery: '',
  filters: {
    region: null,
    era: null,
    theme: null,
  },
};

let catalog: Catalog | null = null;
let state: AppState | null = null;
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
  const x = layout.xTopic.copy().domain(state.domain);
  const zonePeople = new Set(view.people ?? topic.people.map((person) => person.id));
  const zoneEvents = new Set(view.events ?? topic.events.map((event) => event.id));
  const eventRows = assignEventRows({ topic, x, zoneEvents });

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
    `<g class="layer-axis">${renderAxisTicks(ctx)}</g>`,
    `<g class="layer-event-labels">${renderEventLabels(ctx)}</g>`,
    `<g class="layer-gutter">${renderGutter(ctx)}</g>`,
  ].join('');
}

function renderGraphView(): void {
  if (!state || state.focusId === null) return;
  const width = Math.max(480, stage.clientWidth);
  const height = Math.max(360, stage.clientHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-label', '人物关系全景');
  svg.innerHTML = renderGraph(state.topic, state.focusId, width, height, state.hoverId);
}

function renderSearchUI(): void {
  if (!state) {
    searchResultsEl.hidden = true;
    searchResultsEl.innerHTML = '';
    return;
  }
  const hits = searchPeople(state.topic, ui.searchQuery);
  searchResultsEl.innerHTML = renderSearchResults(hits, ui.searchQuery);
  searchResultsEl.hidden = ui.searchQuery.trim().length === 0;
}

function renderChrome(): void {
  if (!state || !catalog) return;
  topicSwitchEl.innerHTML = renderTopics(catalog, state.topic, ui.topicMenuOpen, ui.filters);
  chaptersEl.innerHTML = renderChapters(state.topic, state.viewId);
  briefEl.textContent = currentView().brief ?? '';
  hintEl.textContent =
    state.mode === 'graph'
      ? '点击人物切换中心 · Esc 返回时间轴'
      : '滚轮缩放 · 拖动平移 · 点击人物高亮一跳关系 · Shift / Alt + 滚轮上下滚动';

  const person = personById(state.focusId);
  cardEl.innerHTML = renderCard(state.topic, person);
  cardEl.hidden = person === null;

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

function applyDomainToZoom(): void {
  if (!state || !zoomBehavior) return;
  const { layout, domain } = state;
  const scale = layout.xTopic;
  const k = (layout.plotRight - layout.plotLeft) / Math.max(1e-6, scale(domain[1]) - scale(domain[0]));
  const tx = layout.plotLeft - k * scale(domain[0]);
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
        if (wheel.shiftKey || wheel.altKey) return false;
        return wheel.clientX - svg.getBoundingClientRect().left >= layout.plotLeft;
      }
      if (event instanceof MouseEvent) return !event.button;
      return true;
    })
    .on('zoom', (event) => {
      if (applyingTransform || !state || state.mode === 'graph') return;
      const scale = event.transform.rescaleX(state.layout.xTopic);
      state.domain = [
        scale.invert(state.layout.plotLeft),
        scale.invert(state.layout.plotRight),
      ];
      render();
    });

  select(svg).call(zoomBehavior).on('dblclick.zoom', null);
  applyDomainToZoom();
}

function rebuildLayout(): void {
  if (!state) return;
  state.layout = buildLayout(state.topic, stage.clientWidth, currentView());
}

interface ApplyViewOptions {
  focusId?: string | null;
  fitPerson?: boolean;
}

function applyView(viewId: string, options: ApplyViewOptions = {}): void {
  if (!state) return;
  const view = findView(state.topic, viewId);
  state.mode = 'timeline';
  state.viewId = view.id;
  state.hoverId = null;
  state.focusId = options.focusId !== undefined ? options.focusId : (view.focus ?? null);
  rebuildLayout();
  if (options.fitPerson && state.focusId) {
    const person = personById(state.focusId);
    state.domain = person ? fitPersonDomain(person, state.topic.meta.range) : [view.from, view.to];
  } else {
    state.domain = [view.from, view.to];
  }
  writeHash(state.topic.meta.id, view.id);
  initZoom();
  renderChrome();
  render();
}

function relayout(): void {
  if (!state) return;
  const width = stage.clientWidth;
  if (width <= 0) return;
  if (state.mode === 'timeline' && width === state.layout.width) return;
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
      applyView(view.id, { focusId: state.focusId, fitPerson: true });
      return;
    }
  }
  initZoom();
  renderChrome();
  render();
}

function revealPerson(id: string): void {
  if (!state) return;
  ui.searchQuery = '';
  searchInput.value = '';
  searchInput.blur();
  renderSearchUI();
  const view = findViewForPerson(state.topic, id, currentView());
  applyView(view.id, { focusId: id, fitPerson: true });
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
  searchInput.value = '';
  await mountTopic(topicId, null);
}

async function mountTopic(topicId: string, viewId: string | null): Promise<void> {
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
      layout: buildLayout(topic, stage.clientWidth, first),
      viewId: first.id,
      domain: [first.from, first.to],
      focusId: null,
      hoverId: null,
      showAllRelations: false,
      adjacency: buildAdjacency(topic),
      mode: 'timeline',
    };
    applyView(viewId ?? first.id);
    renderSearchUI();
  } finally {
    loadingTopic = false;
  }
}

async function onHashChange(): Promise<void> {
  if (!catalog || !state || loadingTopic) return;
  const route = parseHash(location.hash, catalog);
  if (route.topicId !== state.topic.meta.id) {
    await mountTopic(route.topicId, route.viewId);
    return;
  }
  const view = findView(state.topic, route.viewId);
  if (view.id !== state.viewId || state.mode === 'graph') applyView(view.id);
  else writeHash(state.topic.meta.id, view.id);
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
    await downloadChart(svg, exportBasenameNow(), format);
  } catch (error) {
    console.error(error);
    window.alert(format === 'png' ? '无法导出 PNG，请改用导出 SVG。' : '导出失败。');
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function wireEvents(): void {
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
    renderSearchUI();
  });

  searchInput.addEventListener('focus', () => {
    renderSearchUI();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (!state || event.key !== 'Enter') return;
    const first = searchPeople(state.topic, ui.searchQuery)[0];
    if (!first) return;
    event.preventDefault();
    revealPerson(first.id);
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
      applyView(chapter);
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
      applyView(state.viewId);
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
  window.addEventListener('hashchange', () => {
    void onHashChange();
  });
}

async function boot(): Promise<void> {
  catalog = await loadCatalog('./data/index.json');
  const route = parseHash(location.hash, catalog);
  await mountTopic(route.topicId, route.viewId);
  wireEvents();
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  stage.innerHTML = `<pre class="fatal">${esc(message)}</pre>`;
  console.error(error);
});
