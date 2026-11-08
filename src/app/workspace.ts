/**
 * 02 工作区 DOM 装配：朝代场景头、底部朝代导航条、缩放与分类控件、窄屏筛选抽屉。
 * 只操作 DOM 与 runtime 状态；导航流程通过 app hooks，绘制通过 render。
 */

import { zoomBy } from './interaction';
import { topicForDynasty } from './model';
import { draw, fullSpan } from './render';
import { getHooks, state } from './runtime';
import { esc, fmtYear } from './util';

/** 每次 draw 后由 app hooks 调用：场景头、朝代高亮与缩放读数跟随状态。 */
export function syncWorkspaceChrome(): void {
  syncTopicHead();
  syncDynastyHighlight();
  const zoom = document.getElementById('zoom-level');
  if (zoom) {
    const full = fullSpan();
    const span = state.domain[1] - state.domain[0];
    const fullWidth = full[1] - full[0];
    const pct = fullWidth > 0 && span > 0 ? Math.round((fullWidth / span) * 100) : 100;
    zoom.textContent = `${pct}%`;
  }
}

function syncTopicHead(): void {
  const head = document.getElementById('topic-head');
  if (!head) return;
  const topics = state.library.topics;
  const index = topics.findIndex((topic) => topic.id === state.topicId);
  const prevName = index > 0 ? topics[index - 1].title : '';
  const nextName = index >= 0 && index < topics.length - 1 ? topics[index + 1].title : '';
  if (state.line === 'people') {
    const title = state.topic?.meta.title ?? topics[index]?.title ?? '';
    const range = state.topic?.meta.range;
    head.innerHTML = `${prevName ? `<span class="lt-topic-side">${esc(prevName)}</span>` : ''}<span class="lt-topic-name">${esc(title)}</span>${nextName ? `<span class="lt-topic-side">${esc(nextName)}</span>` : ''}${range ? `<span class="lt-topic-range">${fmtYear(range[0])} — ${fmtYear(range[1])}</span>` : ''}`;
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
    filterPanel?.classList.toggle('open');
  });
  document.addEventListener('pointerdown', (event) => {
    if (!filterPanel?.classList.contains('open')) return;
    const target = event.target as HTMLElement;
    if (!target.closest('#lane-panel') && !target.closest('#btn-filter-toggle')) filterPanel.classList.remove('open');
  });
}
