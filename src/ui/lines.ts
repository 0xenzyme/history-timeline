import type { Catalog } from '../types';
import { esc } from '../timeline/svg';

/** 三条内容线的主 tab。人物按朝代专题，另两条按时间。 */
export function renderLineTabs(catalog: Catalog, activeId: string): string {
  const lines = catalog.lines ?? [];
  if (lines.length === 0) return '';
  return lines
    .map((line) => {
      const active = line.id === activeId;
      return `<button type="button" class="line-tab${active ? ' is-active' : ''}" data-line="${esc(line.id)}" aria-pressed="${active}">
        <span class="line-tab-title">${esc(line.title)}</span>
        <span class="line-tab-axis">${line.axis === 'time' ? '按时间' : '按朝代'}</span>
      </button>`;
    })
    .join('');
}
