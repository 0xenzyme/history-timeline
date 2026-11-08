import { escapeHtml } from './escape';
import { renderHeaderTools } from './header-tools';
import { icon, type IconId } from './icons';

export type SiteSection = 'home' | 'timeline' | 'people' | 'collections' | 'events' | 'eras' | 'search' | 'other';

export interface NavigationContext {
  section: SiteSection;
  query?: string;
  mobile?: boolean;
}

const NAV_ITEMS: Array<readonly [SiteSection, string, string, IconId]> = [
  ['home', '/', '首页', 'home'],
  ['timeline', '/timeline', '年表', 'timeline'],
  ['people', '/people', '列传', 'people'],
  ['collections', '/collections', '群像', 'collections'],
  ['events', '/events', '纪事', 'events'],
  ['eras', '/eras', '断代', 'eras'],
];

export function renderSiteHeader({ section, query = '', mobile = false }: NavigationContext): string {
  return `
    <a class="lt-skip-link" href="#main-content">跳到主内容</a>
    <header class="lt-site-header">
      <a class="lt-brand" href="/" data-site-link aria-label="兰台首页"><span class="lt-brand-seal" aria-hidden="true">蘭</span><span>兰台 <small>Lantai</small></span></a>
      <span class="lt-brand-tagline">纵横千年，人物相望</span>
      <nav class="lt-main-nav" aria-label="主导航">
        ${NAV_ITEMS.map(
          ([id, href, label, iconId]) =>
            `<a href="${href}" ${id === 'timeline' ? 'data-timeline-link' : 'data-site-link'} ${section === id ? 'aria-current="page"' : ''}>${icon(iconId)}<span>${label}</span></a>`,
        ).join('\n        ')}
      </nav>
      <form class="lt-global-search" action="/search" method="get" role="search">
        <label for="lt-global-query">全站搜索</label>
        <div class="lt-global-search-box">
          <button class="lt-global-search-submit" type="submit" aria-label="搜索">${icon('search')}</button>
          <input id="lt-global-query" name="q" type="search" value="${escapeHtml(query)}" placeholder="搜索人物、事件、群像、朝代……" required />
          <input type="hidden" name="type" value="all" />
        </div>
      </form>
      <button class="lt-menu-toggle" type="button" data-site-menu aria-expanded="false" aria-controls="lt-site-menu">${mobile ? '菜单' : '栏目'}</button>
      ${renderHeaderTools()}
    </header>
    <nav class="lt-site-menu" id="lt-site-menu" aria-label="全部栏目" hidden>
      ${NAV_ITEMS.map(
        ([id, href, label]) =>
          `<a href="${href}" ${href === '/timeline' ? 'data-timeline-link' : 'data-site-link'} ${section === id ? 'aria-current="page"' : ''}>${label}</a>`,
      ).join('')}
      <button type="button" data-help-open aria-haspopup="dialog">操作说明</button>
      <button type="button" data-settings-open aria-haspopup="dialog">设置</button>
    </nav>
  `;
}

export function wireSiteMenu(root: ParentNode = document): void {
  const menu = root.querySelector<HTMLElement>('#lt-site-menu');
  const toggles = root.querySelectorAll<HTMLButtonElement>('[data-site-menu]');
  if (!menu) return;
  for (const button of toggles) {
    button.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      toggles.forEach((item) => item.setAttribute('aria-expanded', String(open)));
      if (open)
        (menu.querySelector<HTMLElement>('a[aria-current="page"]') ?? menu.querySelector<HTMLElement>('a'))?.focus();
      else button.focus();
    });
  }
  root.addEventListener('keydown', (event) => {
    if (menu !== root.querySelector('#lt-site-menu') || menu.hidden) return;
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === 'Tab') {
      const links = [...menu.querySelectorAll<HTMLAnchorElement>('a[href]')];
      const first = toggles[0];
      const last = links.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    menu.hidden = true;
    toggles.forEach((item) => item.setAttribute('aria-expanded', 'false'));
    toggles[0]?.focus();
  });
}
