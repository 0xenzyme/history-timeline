/**
 * 全站统一线性图标集：24 viewBox、20px 显示、stroke-width 1.75、currentColor。
 * 装饰图标由调用方加 aria-hidden；无文字按钮必须自带可访问名称。
 */
export type IconId =
  | 'home'
  | 'timeline'
  | 'people'
  | 'collections'
  | 'events'
  | 'eras'
  | 'search'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'book'
  | 'calendar'
  | 'help'
  | 'settings';

const PATHS: Record<IconId, string> = {
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-7h6v7"/>',
  timeline:
    '<path d="M3 12h21"/><circle cx="7" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><path d="M7 4v3M7 17v3M16 4v3M16 17v3"/>',
  people: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-4.2 3-6.5 7-6.5s7 2.3 7 6.5"/>',
  collections:
    '<circle cx="8" cy="9" r="2.8"/><circle cx="16" cy="9" r="2.8"/><path d="M2.5 20c.4-3.4 2.5-5 5.5-5s5.1 1.6 5.5 5M13.6 15.6c.7-.4 1.5-.6 2.4-.6 3 0 5.1 1.6 5.5 5"/>',
  events:
    '<path d="M12 5C9.4 3.4 5.6 3.2 3 4v15c2.6-.8 6.4-.6 9 1 2.6-1.6 6.4-1.8 9-1V4c-2.6-.8-6.4-.6-9 1Z"/><path d="M12 5v15"/>',
  eras: '<path d="M3 21h21"/><path d="M5 21V12h14v9"/><path d="M3 12 12 4l9 8"/><path d="M9 21v-5M15 21v-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.8-4.8"/>',
  'arrow-right': '<path d="M4 12h16"/><path d="m13 5 7 7-7 7"/>',
  'arrow-up-right': '<path d="M6 18 18 6"/><path d="M7 6h11v11"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z"/><path d="M5 4v16"/><path d="M9 8h6M9 12h6"/>',
  calendar:
    '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/><path d="M8 15h2M14 15h2M8 18h2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.3-.9 1-.9 1.7"/><path d="M12 16.5v.5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};

export function icon(id: IconId, className = ''): string {
  return `<svg class="lt-icon${className ? ` ${className}` : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[id]}</svg>`;
}
