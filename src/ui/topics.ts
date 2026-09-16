import type { Catalog, Topic } from '../types';
import { esc } from '../timeline/svg';

export function renderTopics(catalog: Catalog, topic: Topic, open: boolean): string {
  const items = catalog.topics
    .map((item) => {
      const selected = item.id === topic.meta.id;
      return `<button type="button" class="topic-option${selected ? ' is-active' : ''}" role="option" aria-selected="${selected}" data-topic="${esc(item.id)}">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.subtitle)}</span>
      </button>`;
    })
    .join('');

  return `
    <button type="button" class="topic-toggle" data-topic-menu="1" aria-expanded="${open}" aria-haspopup="listbox" aria-label="选择专题">
      <span class="topic-title">${esc(topic.meta.title)}</span>
      <span class="topic-caret" aria-hidden="true">▾</span>
    </button>
    <p class="topic-subtitle">${esc(topic.meta.subtitle)}</p>
    <div class="topic-menu" role="listbox" aria-label="专题"${open ? '' : ' hidden'}>${items}</div>
  `;
}
