/**
 * DOM 视图装配：详情卡、搜索、专题下拉、泳道面板、chip 状态、提示条与 tooltip。
 * 只负责写 DOM 与少量视图状态，跨模块的导航流程通过 runtime 的 hooks 回调。
 */

import { renderEventCard, renderPersonCard, type CardContext } from './cards';
import { BAR_H, ROW_GAP, buildEventLayout } from './layout';
import { TYPE_NAMES, invalidatePalette, paletteFor, skinColor, type SkinId } from './skins';
import { esc, fmtYear } from './util';
import { draw, resetNebula, skinPalette, visibleEvents } from './render';
import { dom, getHooks, state, STORAGE, type Selection } from './runtime';

// ---------- 详情卡 ----------

function cardContext(): CardContext {
  return {
    library: state.library,
    skin: state.skin,
    palette: skinPalette(),
    topic: state.topic,
  };
}

export function showCard(selection: Selection): void {
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

export function hideCard(): void {
  dom.card.classList.remove('show');
  dom.cardBody.innerHTML = '';
  state.selected = null;
  announce('已关闭详情');
  draw();
}

export function hideCardSilent(): void {
  dom.card.classList.remove('show');
  dom.cardBody.innerHTML = '';
  state.selected = null;
}

export function announce(text: string): void {
  dom.status.textContent = text;
}

// ---------- 专题下拉 / 泳道面板 ----------

export function buildTopicSelect(): void {
  dom.topicSelect.innerHTML = state.library.topics
    .map((entry) => `<option value="${esc(entry.id)}">${esc(entry.title)}</option>`)
    .join('');
  dom.topicSelect.value = state.topicId;
  dom.topicSelect.hidden = state.line !== 'people';
}

export function buildLanePanel(): void {
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

  dom.laneList.innerHTML = laneDefs
    .map(
      (lane) => `
    <label class="lane-row">
      <input type="checkbox" data-lane="${esc(lane.id)}" ${state.hiddenLanes.has(laneKey(lane.id)) ? '' : 'checked'} />
      <span class="lane-swatch" style="background:${esc(skinColor(state.skin, lane.color))}"></span>
      <span>${esc(lane.name)}</span>
      <span class="lane-count">${lane.count}</span>
    </label>
  `,
    )
    .join('');

  const views = state.line === 'people' ? (state.topic?.views ?? []) : [];
  dom.laneChapters.innerHTML =
    views.length === 0
      ? ''
      : `<div class="lane-panel-head"><span>章节</span></div>` +
        views
          .map(
            (view) =>
              `<button type="button" class="lane-chapter" data-view="${esc(view.id)}">${esc(view.name)}</button>`,
          )
          .join('');
}

/** 泳道勾选按当前内容线隔离，避免人物泳道 id 与事件类型 id 互相影响。 */
const laneKey = (id: string): string => (state.line === 'people' ? `lane:${id}` : `type:${id}`);

export function toggleLane(id: string, show: boolean): void {
  const key = laneKey(id);
  if (show) state.hiddenLanes.delete(key);
  else state.hiddenLanes.add(key);
  localStorage.setItem(STORAGE.lanes, JSON.stringify([...state.hiddenLanes]));
  getHooks().rebuildLayout();
  draw();
}

export function setAllLanes(show: boolean): void {
  const keys = [...dom.laneList.querySelectorAll<HTMLInputElement>('input[data-lane]')].map((input) =>
    laneKey(input.dataset.lane ?? ''),
  );
  for (const key of keys) {
    if (show) state.hiddenLanes.delete(key);
    else state.hiddenLanes.add(key);
  }
  localStorage.setItem(STORAGE.lanes, JSON.stringify([...state.hiddenLanes]));
  buildLanePanel();
  getHooks().rebuildLayout();
  draw();
}

// ---------- 皮肤 ----------

export function applySkin(skin: SkinId, redraw = true): void {
  state.skin = skin;
  localStorage.setItem(STORAGE.skin, skin);
  document.body.classList.toggle('skin-voyage', skin === 'voyage');
  document.body.classList.toggle('skin-deepspace', skin === 'deepspace');
  document.getElementById('skin-voyage')?.classList.toggle('on', skin === 'voyage');
  document.getElementById('skin-deepspace')?.classList.toggle('on', skin === 'deepspace');
  // 画布配色读的是 body 上的变量，class 换完才能取，取不到就当场报错。
  invalidatePalette();
  paletteFor(skin);
  resetNebula();
  if (redraw) {
    buildLanePanel();
    draw();
  }
}

export function syncStripToggle(): void {
  const inPeople = state.line === 'people';
  dom.stripToggle.style.display = inPeople ? 'block' : 'none';
  dom.stripToggle.textContent = state.stripOpen ? '事件条 ▴' : '事件条 ▾';
  dom.stripToggle.setAttribute('aria-expanded', String(inPeople && state.stripOpen));
  document.body.classList.toggle('strip-open', inPeople && state.stripOpen);
  getHooks().resizeChart();
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

export function runSearch(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const hits: SearchHit[] = [];
  const aliasEventId = aliasIndex().get(query.trim());

  for (const record of state.library.people) {
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
    const matched =
      event.id === aliasEventId ||
      [event.name, event.display, ...(event.aliases ?? [])].some(
        (field) => field && field.toLowerCase().includes(needle),
      );
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

export function renderSearchResults(query: string): void {
  const hits = runSearch(query);
  if (hits.length === 0) {
    dom.searchResults.hidden = query.trim().length === 0;
    dom.searchResults.innerHTML =
      query.trim().length === 0 ? '' : `<div class="search-empty">没有匹配「${esc(query.trim())}」的条目</div>`;
    return;
  }
  dom.searchResults.innerHTML = hits
    .map(
      (hit) => `
    <button type="button" class="search-hit" data-kind="${hit.kind}" data-id="${esc(hit.id)}">
      <span class="search-hit-title">${esc(hit.title)}</span>
      <span class="search-hit-meta">${esc(hit.meta)}</span>
    </button>
  `,
    )
    .join('');
  dom.searchResults.hidden = false;
}

// ---------- 悬浮提示 ----------

export function personTooltip(id: string): string {
  const person = state.topic?.people.find((item) => item.id === id);
  const record = state.library.personById.get(id);
  const label = person?.display ?? record?.display ?? id;
  const birth = person?.birth ?? record?.birth;
  const death = person?.death ?? record?.death;
  return `${label}　${birth != null ? fmtYear(birth) : '生年不详'} — ${death != null ? fmtYear(death) : '卒年不详'}`;
}

export function eventTooltip(id: string): string {
  const event = state.library.eventById.get(id);
  if (!event) return id;
  const range =
    event.endYear && event.endYear !== event.year
      ? `${fmtYear(event.year)} — ${fmtYear(event.endYear)}`
      : fmtYear(event.year);
  return `${event.display || event.name}　${range}`;
}

let hintTimer = 0;
const DEFAULT_HINT = '滚轮缩放 · 拖动平移 · 点击人物或事件 · 底部朝代带可跳转';

export function flashHint(text: string): void {
  dom.hint.textContent = text;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    dom.hint.textContent = DEFAULT_HINT;
  }, 2600);
}
