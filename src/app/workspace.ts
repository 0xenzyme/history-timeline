/**
 * 02 工作区 DOM 装配：朝代场景头、底部朝代导航条、缩放与分类控件、窄屏筛选抽屉。
 * 只操作 DOM 与 runtime 状态；导航流程通过 app hooks，绘制通过 render。
 */

import { zoomBy } from './interaction';
import { topicPeopleForView } from './layout';
import { topicForDynasty, topicRange } from './model';
import { draw, fullSpan, visibleEvents } from './render';
import { getHooks, state } from './runtime';
import { esc, fmtYear, personFrom, personTo } from './util';

/** 每次 draw 后由 app hooks 调用：场景头、朝代高亮与缩放读数跟随状态。 */
export function syncWorkspaceChrome(): void {
  syncFilterDrawer();
  syncTopicHead();
  syncDynastyHighlight();
  syncGroupCounts();
  const zoom = document.getElementById('zoom-level');
  if (zoom) {
    const full = fullSpan();
    const span = state.domain[1] - state.domain[0];
    const fullWidth = full[1] - full[0];
    const pct = fullWidth > 0 && span > 0 ? Math.round((fullWidth / span) * 100) : 100;
    zoom.textContent = `${pct}%`;
  }
}

function syncGroupCounts(): void {
  const [d0, d1] = state.domain;
  const people = state.topic
    ? topicPeopleForView(state.topic, state.viewId).filter(
        (person) =>
          !state.hiddenLanes.has(`lane:${person.lane}`) &&
          personTo(person.birth, person.death) >= d0 &&
          personFrom(person.birth, person.death) <= d1,
      ).length
    : 0;
  const events = visibleEvents().filter((event) => event.year <= d1 && (event.endYear ?? event.year) >= d0);
  const counts = {
    people,
    war: events.filter((event) => event.type === 'military' || event.type === 'rebellion').length,
    history: events.filter((event) => !['military', 'rebellion'].includes(event.type)).length,
  };
  for (const [key, count] of Object.entries(counts)) {
    const element = document.querySelector<HTMLElement>(`[data-group-count="${key}"]`);
    if (element) element.textContent = `（${count}）`;
  }
}

function syncTopicHead(): void {
  const head = document.getElementById('topic-head');
  if (!head) return;
  const topics = state.library.topics;
  const index = topics.findIndex((topic) => topic.id === state.topicId);
  const side = (entry: (typeof topics)[number] | undefined): string => {
    if (!entry) return '';
    const range = topicRange(state.library, entry);
    return `<span class="lt-topic-side"><span>${esc(entry.title)}</span>${range ? `<small>${fmtYear(range[0])} — ${fmtYear(range[1])}</small>` : ''}</span>`;
  };
  if (state.line === 'people') {
    const title = state.topic?.meta.title ?? topics[index]?.title ?? '';
    const range = state.topic?.meta.range;
    head.innerHTML = `${side(index > 0 ? topics[index - 1] : undefined)}<span class="lt-topic-name">${esc(title)}</span>${side(index >= 0 && index < topics.length - 1 ? topics[index + 1] : undefined)}${range ? `<span class="lt-topic-range">${fmtYear(range[0])} — ${fmtYear(range[1])}</span>` : ''}`;
  } else {
    const line = state.library.lines[state.line];
    head.innerHTML = `<span class="lt-topic-name">${esc(line.title)}</span><span class="lt-topic-range">${fmtYear(line.range[0])} — ${fmtYear(line.range[1])}</span>`;
  }
  const prev = document.getElementById('topic-prev') as HTMLButtonElement | null;
  const next = document.getElementById('topic-next') as HTMLButtonElement | null;
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index < 0 || index >= topics.length - 1;
}

let bandBuilt = false;

function buildDynastyBand(): void {
  const track = document.getElementById('dynasty-track');
  if (!track || bandBuilt) return;
  track.innerHTML = state.library.dynasties
    .map(
      (dynasty) =>
        `<button type="button" class="lt-dynasty-item" data-dynasty="${esc(dynasty.id)}"><span class="lt-dynasty-name">${esc(dynasty.name)}</span><span class="lt-dynasty-years">${fmtYear(dynasty.from)}—${fmtYear(dynasty.to)}</span></button>`,
    )
    .join('');
  bandBuilt = true;
}

function syncDynastyHighlight(): void {
  const track = document.getElementById('dynasty-track');
  if (!track) return;
  buildDynastyBand();
  let currentId = '';
  if (state.line === 'people') {
    const range = state.topic?.meta.range;
    if (range) {
      let best = 0;
      for (const dynasty of state.library.dynasties) {
        const overlap = Math.min(range[1], dynasty.to) - Math.max(range[0], dynasty.from);
        if (overlap > best) {
          best = overlap;
          currentId = dynasty.id;
        }
      }
    }
  } else {
    const center = (state.domain[0] + state.domain[1]) / 2;
    currentId = state.library.dynasties.find((dynasty) => center >= dynasty.from && center <= dynasty.to)?.id ?? '';
  }
  track.querySelectorAll<HTMLButtonElement>('[data-dynasty]').forEach((button) => {
    const current = button.dataset.dynasty === currentId;
    if (button.getAttribute('aria-current') !== String(current)) {
      button.setAttribute('aria-current', String(current));
      if (current) button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
}

function syncFilterDrawer(): void {
  const panel = document.getElementById('lane-panel');
  const toggle = document.getElementById('btn-filter-toggle');
  if (!panel || !toggle) return;
  const compact = window.innerWidth < 1200;
  const open = compact && panel.classList.contains('open');
  if (!compact) panel.classList.remove('open');
  panel.inert = compact && !open;
  if (compact) panel.setAttribute('aria-hidden', String(!open));
  else panel.removeAttribute('aria-hidden');
  toggle.setAttribute('aria-expanded', String(open));
}

function setFilterDrawer(open: boolean, restoreFocus = false): void {
  const panel = document.getElementById('lane-panel');
  const toggle = document.getElementById('btn-filter-toggle');
  if (!panel || !toggle) return;
  panel.classList.toggle('open', open);
  syncFilterDrawer();
  if (open) panel.querySelector<HTMLInputElement>('#search')?.focus();
  else if (restoreFocus) toggle.focus();
}

async function jumpToTopic(topicId: string): Promise<void> {
  if (state.line !== 'people') getHooks().setLine('people', false);
  await getHooks().setTopic(topicId);
}

function stepTopic(delta: number): void {
  const topics = state.library.topics;
  const index = topics.findIndex((topic) => topic.id === state.topicId);
  const next = topics[index + delta];
  if (next) void jumpToTopic(next.id);
}

export function wireWorkspace(onExport: (format: 'png' | 'svg') => void, onResetFilters: () => void): void {
  document.querySelectorAll<HTMLButtonElement>('.lt-timeline-hero [data-export]').forEach((button) => {
    button.addEventListener('click', () => onExport(button.dataset.export === 'svg' ? 'svg' : 'png'));
  });

  document.getElementById('zoom-in')?.addEventListener('click', () => {
    zoomBy(1 / 1.4);
    getHooks().syncTimelineUrl();
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    zoomBy(1.4);
    getHooks().syncTimelineUrl();
  });

  document.querySelectorAll<HTMLInputElement>('[data-group]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.group as 'people' | 'war' | 'history';
      state.groups[key] = input.checked;
      getHooks().rebuildLayout();
      getHooks().syncTimelineUrl();
      draw();
    });
  });

  document.getElementById('topic-prev')?.addEventListener('click', () => stepTopic(-1));
  document.getElementById('topic-next')?.addEventListener('click', () => stepTopic(1));

  const track = document.getElementById('dynasty-track');
  track?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-dynasty]');
    if (!button) return;
    const dynasty = state.library.dynasties.find((item) => item.id === button.dataset.dynasty);
    if (!dynasty) return;
    const entry = topicForDynasty(state.library, dynasty.id);
    void (async () => {
      if (state.line !== 'people') getHooks().setLine('people', false);
      if (entry) await getHooks().setTopic(entry.id, false);
      state.domain = [dynasty.from, dynasty.to];
      state.scrollY = 0;
      getHooks().rebuildLayout();
      getHooks().syncTimelineUrl('push');
      draw();
    })();
  });
  document.getElementById('dynasty-prev')?.addEventListener('click', () => {
    track?.scrollBy({ left: -400, behavior: 'smooth' });
  });
  document.getElementById('dynasty-next')?.addEventListener('click', () => {
    track?.scrollBy({ left: 400, behavior: 'smooth' });
  });

  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    state.groups = { people: true, war: true, history: true };
    document.querySelectorAll<HTMLInputElement>('[data-group]').forEach((input) => {
      input.checked = true;
    });
    onResetFilters();
  });

  const filterPanel = document.getElementById('lane-panel');
  document.getElementById('btn-filter-toggle')?.addEventListener('click', (event) => {
    event.stopPropagation();
    setFilterDrawer(!filterPanel?.classList.contains('open'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !filterPanel?.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setFilterDrawer(false, true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!filterPanel?.classList.contains('open')) return;
    const target = event.target as HTMLElement;
    if (!target.closest('#lane-panel') && !target.closest('#btn-filter-toggle')) setFilterDrawer(false);
  });
  syncFilterDrawer();
}
