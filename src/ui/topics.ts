import { filterTopics, filtersActive } from '../contract';
import type { Catalog, CenturySegment, EventLineView, Topic, TopicFilters, VocabTerm } from '../types';
import { esc } from '../timeline/svg';

export type NavTarget =
  | { kind: 'topic'; topic: Topic }
  | { kind: 'line'; line: EventLineView; segment: CenturySegment };

type FacetKey = 'region' | 'era' | 'theme' | 'dynasty';

function facetRow(
  label: string,
  ariaLabel: string,
  facet: FacetKey,
  terms: VocabTerm[],
  selected: string | null,
): string {
  const allPressed = selected === null;
  const chips = [
    `<button type="button" class="facet-chip${allPressed ? ' is-active' : ''}" data-facet="${facet}" data-value="" aria-pressed="${allPressed}">全部</button>`,
    ...terms.map((term) => {
      const pressed = selected === term.id;
      return `<button type="button" class="facet-chip${pressed ? ' is-active' : ''}" data-facet="${facet}" data-value="${esc(term.id)}" aria-pressed="${pressed}">${esc(term.name)}</button>`;
    }),
  ];
  return `
    <div class="facet" role="group" aria-label="${esc(ariaLabel)}">
      <span class="facet-label">${esc(label)}</span>
      <div class="facet-chips">${chips.join('')}</div>
    </div>
  `;
}

export function renderTopics(
  catalog: Catalog,
  target: NavTarget,
  open: boolean,
  filters: TopicFilters,
): string {
  const title = target.kind === 'topic' ? target.topic.meta.title : target.line.title;
  const subtitle = target.kind === 'topic' ? target.topic.meta.subtitle : (target.line.subtitle ?? '');

  let body: string;
  if (target.kind === 'topic') {
    const matches = filterTopics(catalog, filters);
    const items =
      matches.length > 0
        ? matches
            .map((item) => {
              const selected = item.id === target.topic.meta.id;
              return `<button type="button" class="topic-option${selected ? ' is-active' : ''}" aria-pressed="${selected}" data-topic="${esc(item.id)}">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.subtitle)}</span>
      </button>`;
            })
            .join('')
        : `<p class="topic-empty">没有同时符合这些条件的专题。</p>
         <button type="button" class="topic-empty-action" data-clear-filters="1">清除筛选</button>`;
    const facets = `
      <div class="topic-facets">
        ${facetRow('地区', '按国家或地区筛选', 'region', catalog.regions, filters.region)}
        ${facetRow('朝代', '按朝代或时段筛选', 'era', catalog.eras, filters.era)}
        ${facetRow('主题', '按主题筛选', 'theme', catalog.themes, filters.theme)}
      </div>
    `;
    const filteredHint =
      filtersActive(filters) && matches.length > 0
        ? `<p class="topic-filter-count">${matches.length} 个专题</p>`
        : '';
    body = `${facets}${filteredHint}<div class="topic-list" aria-label="专题">${items}</div>`;
  } else {
    const dynasties = target.line.dynasties.map((item) => ({ id: item.id, name: item.name }));
    const facets = `
      <div class="topic-facets">
        ${facetRow('朝代', '按朝代区间筛选，可重叠', 'dynasty', dynasties, filters.dynasty)}
      </div>
    `;
    body = `${facets}<p class="topic-filter-count">按世纪分段浏览，朝代只作筛选</p>`;
  }

  return `
    <button type="button" class="topic-toggle" data-topic-menu="1" aria-expanded="${open}" aria-haspopup="true" aria-label="选择内容线">
      <span class="topic-title">${esc(title)}</span>
      <span class="topic-caret" aria-hidden="true">▾</span>
    </button>
    <p class="topic-subtitle">${esc(subtitle)}</p>
    <div class="topic-menu"${open ? '' : ' hidden'}>
      ${body}
    </div>
  `;
}
