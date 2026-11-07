import { escapeHtml } from './escape';

export type SiteSection = 'home' | 'timeline' | 'people' | 'collections' | 'events' | 'eras' | 'search' | 'other';

export interface NavigationContext {
  section: SiteSection;
  query?: string;
  mobile?: boolean;
}

export function renderSiteHeader({ section, query = '', mobile = false }: NavigationContext): string {
  const nav = [
    ['home', '/', '首页'],
    ['timeline', '/timeline', '年表'],
    ['people', '/people', '列传'],
    ['collections', '/collections', '群像'],
    ['events', '/events', '纪事'],
    ['eras', '/eras', '断代'],
  ] as const;
  return `
    <a class="lt-skip-link" href="#main-content">跳到主内容</a>
    <header class="lt-site-header">
      <a class="lt-brand" href="/" data-site-link aria-label="兰台首页"><span class="lt-brand-seal" aria-hidden="true">蘭</span><span>兰台 <small>Lantai</small></span></a>
      <span class="lt-brand-tagline">纵横千年，人物相望</span>
      <nav class="lt-main-nav" aria-label="主导航">
        <a href="/" data-site-link ${section === 'home' ? 'aria-current="page"' : ''}>首页</a>
        <a href="/timeline" data-timeline-link ${section === 'timeline' ? 'aria-current="page"' : ''}>年表</a>
        <a href="/people" data-site-link ${section === 'people' ? 'aria-current="page"' : ''}>列传</a>
        <a href="/collections" data-site-link ${section === 'collections' ? 'aria-current="page"' : ''}>群像</a>
        <a href="/events" data-site-link ${section === 'events' ? 'aria-current="page"' : ''}>纪事</a>
        <a href="/eras" data-site-link ${section === 'eras' ? 'aria-current="page"' : ''}>断代</a>
      </nav>
      <form class="lt-global-search" action="/search" method="get" role="search">
        <label for="lt-global-query">全站搜索</label>
        <input id="lt-global-query" name="q" type="search" value="${escapeHtml(query)}" placeholder="搜索人物、事件、群像、朝代……" required />
        <input type="hidden" name="type" value="all" />
        <button type="submit">搜索</button>
      </form>
      <button class="lt-menu-toggle" type="button" data-site-menu aria-expanded="false" aria-controls="lt-site-menu">${mobile ? '菜单' : '栏目'}</button>
    </header>
    <nav class="lt-site-menu" id="lt-site-menu" aria-label="全部栏目" hidden>
      ${nav.map(([id, href, label]) => `<a href="${href}" ${href === '/timeline' ? 'data-timeline-link' : 'data-site-link'} ${section === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
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
      if (open) menu.querySelector<HTMLElement>('a')?.focus();
      else button.focus();
    });
  }
  root.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key !== 'Escape' || menu.hidden) return;
    menu.hidden = true;
    toggles.forEach((item) => item.setAttribute('aria-expanded', 'false'));
    toggles[0]?.focus();
  });
}
