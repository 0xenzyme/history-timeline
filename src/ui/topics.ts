import { filterTopics, filtersActive } from '../contract';
import type { Catalog, Topic, TopicFilters, VocabTerm } from '../types';
import { esc } from '../timeline/svg';

function facetRow(
  label: string,
  ariaLabel: string,
  facet: 'region' | 'era' | 'theme',
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
  topic: Topic,
  open: boolean,
  filters: TopicFilters,
): string {
  const matches = filterTopics(catalog, filters);
  const items =
    matches.length > 0
      ? matches
          .map((item) => {
            const selected = item.id === topic.meta.id;
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

  return `
    <button type="button" class="topic-toggle" data-topic-menu="1" aria-expanded="${open}" aria-haspopup="true" aria-label="选择专题">
      <span class="topic-title">${esc(topic.meta.title)}</span>
      <span class="topic-caret" aria-hidden="true">▾</span>
    </button>
    <p class="topic-subtitle">${esc(topic.meta.subtitle)}</p>
    <div class="topic-menu"${open ? '' : ' hidden'}>
      ${facets}
      ${filteredHint}
      <div class="topic-list" aria-label="专题">${items}</div>
    </div>
  `;
}
