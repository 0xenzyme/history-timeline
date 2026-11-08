import { collectionPage } from './collection';
import { collectionsDirectory, eventsDirectory, peopleDirectory } from './directories';
import { eraPage, erasDirectory } from './eras';
import { escapeHtml } from './escape';
import { eventPage } from './event';
import { homePage } from './home';
import { loadSiteLibrary, retryCollection, retrySiteData, type SiteDataKey } from './data';
import { COLLECTION_VIEW_NAMES, type CollectionViewState } from './collection-views';
import type { CollectionView } from '../types';
import { renderSiteHeader, wireSiteMenu, type SiteSection } from './navigation';
import { wireHeaderTools } from './header-tools';
import { personPage } from './person';
import { mountPortraits } from './portrait';
import { searchPage, type SearchKind } from './search';
import { navigateToTimeline, openSiteUrl, wireEntityLinks, wireReturnLinks, wireSiteLinks } from './context';

let routeRevision = 0;
let collectionTabFocusRequest: string | undefined;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function sectionFor(path: string): SiteSection {
  if (path === '/') return 'home';
  if (path.startsWith('/people')) return 'people';
  if (path.startsWith('/collections')) return 'collections';
  if (path.startsWith('/events')) return 'events';
  if (path.startsWith('/eras')) return 'eras';
  if (path.startsWith('/search')) return 'search';
  return 'other';
}

function routeEntityId(path: string): string {
  try {
    return decodeURIComponent(path.split('/')[2]);
  } catch {
    return path.split('/')[2];
  }
}

function wirePageControls(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-collection-tabs]').forEach((tabs) => {
    tabs.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      const links = [...tabs.querySelectorAll<HTMLAnchorElement>('a[data-collection-tab]')];
      const current = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? links.length - 1
            : (current + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length;
      collectionTabFocusRequest = links[next]?.dataset.collectionTab;
      links[next]?.focus();
      links[next]?.click();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-collection-view-mode]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const graph = root.querySelector<HTMLElement>('.lt-relation-graph-container');
      if (graph) graph.hidden = button.dataset.collectionViewMode === 'list';
      root.querySelectorAll<HTMLButtonElement>('[data-collection-view-mode]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      root.querySelectorAll<HTMLButtonElement>('[data-collection-member-filter]').forEach((item) => {
        const url = new URL(item.dataset.collectionUrl!, location.href);
        url.searchParams.set('relation', button.dataset.collectionViewMode!);
        item.dataset.collectionUrl = `${url.pathname}${url.search}${url.hash}`;
      });
      const url = new URL(location.href);
      url.searchParams.set('relation', button.dataset.collectionViewMode!);
      if (history.state?.lantaiCollection) {
        history.replaceState(
          {
            ...history.state,
            lantaiCollection: {
              ...history.state.lantaiCollection,
              relationMode: button.dataset.collectionViewMode,
            },
          },
          '',
          location.href,
        );
      }
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-collection-member-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.collectionUrl) openSiteUrl(button.dataset.collectionUrl);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-filter-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = root.querySelector<HTMLDialogElement>('[data-filter-dialog]');
      dialog?.showModal();
      dialog?.querySelector<HTMLElement>('select, input, button')?.focus();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-filter-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      dialog?.close();
      root.querySelector<HTMLButtonElement>('[data-filter-open]')?.focus();
    });
  });
  root.querySelectorAll<HTMLDialogElement>('[data-filter-dialog]').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

export async function renderSiteRoute(): Promise<void> {
  const revision = ++routeRevision;
  const requestedTabFocus = collectionTabFocusRequest;
  collectionTabFocusRequest = undefined;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/timeline' || path === '/legacy.html' || (path === '/' && location.hash)) {
    if (document.querySelector('#app')?.hasChildNodes()) location.reload();
    else navigateToTimeline(location.href);
    return;
  }
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  if (/^\/(people|events)\/[^/]+$/.test(path) && !history.state?.lantaiDetail) {
    history.replaceState({ ...(history.state ?? {}), lantaiDetail: true }, '', location.href);
  }
  document.body.classList.remove('timeline-app');
  document.body.querySelectorAll<HTMLElement>(':scope > :not(#app):not(script)').forEach((element) => {
    if (
      element.id === 'main-content' ||
      element.id === 'timeline-accessible-entities' ||
      element.classList.contains('lt-skip-link') ||
      element.hasAttribute('data-timeline-only')
    ) {
      // 年表专属容器（含嵌套的 main、筛选栏与详情栏）整体移除，避免内容页出现第二个 main。
      element.remove();
    } else {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    }
  });
  const query = new URLSearchParams(location.search);
  const section = sectionFor(path);
  const requiredKeys: SiteDataKey[] =
    path === '/'
      ? ['catalog', 'collections', 'eras']
      : path === '/search'
        ? ['catalog', 'people', 'history', 'military', 'collections', 'eras']
        : path === '/people'
          ? ['catalog', 'people', 'collections']
          : path === '/events'
            ? ['people', 'history', 'military', 'eras']
            : path === '/collections'
              ? ['catalog', 'collections']
              : path === '/eras'
                ? ['eras']
                : path.startsWith('/eras/')
                  ? ['catalog', 'collections', 'eras']
                  : path.startsWith('/collections/')
                    ? ['catalog']
                    : ['catalog', 'people', 'history', 'military', 'collections'];
  root.innerHTML = `${renderSiteHeader({ section, query: query.get('q') ?? '' })}<div id="site-page" aria-busy="true"><main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">正在加载</h1><p>正在读取页面数据。</p><div class="lt-loading-rows" aria-hidden="true"><span></span><span></span><span></span></div></main></div>`;
  wireSiteMenu(root);
  wireHeaderTools(root);
  try {
    const library = await loadSiteLibrary(requiredKeys);
    if (revision !== routeRevision || path !== (location.pathname.replace(/\/+$/, '') || '/')) return;
    let content: string;
    if (path === '/') content = homePage(library);
    else if (/^\/people\/[^/]+$/.test(path)) content = await personPage(routeEntityId(path), library);
    else if (/^\/events\/[^/]+$/.test(path)) content = await eventPage(routeEntityId(path), library);
    else if (/^\/eras\/[^/]+$/.test(path)) content = await eraPage(routeEntityId(path), library);
    else if (/^\/collections\/[^/]+$/.test(path)) content = await collectionPage(routeEntityId(path), library);
    else if (path === '/search') {
      const requested = query.get('type');
      const type: SearchKind = ['person', 'event', 'collection', 'dynasty'].includes(requested ?? '')
        ? (requested as SearchKind)
        : 'all';
      content = searchPage(query.get('q') ?? '', type, library, requested !== null && requested !== type);
    } else if (path === '/people') content = peopleDirectory(library);
    else if (path === '/events') content = eventsDirectory(library);
    else if (path === '/collections') content = collectionsDirectory(library);
    else if (path === '/eras') content = erasDirectory(library);
    else
      content = `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">未找到该页面</h1><p>链接可能已失效。</p><a class="lt-button" href="/" data-site-link>返回首页</a></main>`;
    if (revision !== routeRevision || path !== (location.pathname.replace(/\/+$/, '') || '/')) return;
    const requiredDataFailure =
      (path === '/events' && library.events.length === 0) ||
      (path === '/collections' && library.failures.includes('collections')) ||
      ((path === '/eras' || path === '/events') && library.failures.includes('eras')) ||
      (path === '/events' && library.failures.length > 0);
    if (requiredDataFailure) throw new Error('目录核心数据暂时无法加载，请重试。');
    if (library.failures.length > 0 && !/^\/(eras|collections)\/[^/]+$/.test(path)) {
      content = `<aside class="lt-notice" role="status">部分关联数据暂时无法加载，当前可用内容仍可浏览。<button type="button" data-retry>重试</button></aside>${content}`;
    }
    content = content.replaceAll(
      /href="(\/timeline[^"]*)"/g,
      (_match, url: string) => `href="${url}" data-timeline-link`,
    );
    const focusedCollectionTab = requestedTabFocus;
    const page = document.querySelector<HTMLElement>('#site-page');
    if (page) {
      page.innerHTML = content;
      page.setAttribute('aria-busy', 'false');
    }
    document.title = `${document.querySelector('h1')?.textContent?.trim() ?? '兰台'} · 兰台`;
    const collectionTab = document.querySelector<HTMLElement>('[data-collection-tabs]');
    const viewFocus = Boolean(focusedCollectionTab);
    if (collectionTab && viewFocus) {
      collectionTab.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    } else if (location.hash) {
      let id = '';
      try {
        id = decodeURIComponent(location.hash.slice(1));
      } catch {}
      const target = id ? document.getElementById(id) : null;
      if (target instanceof HTMLElement) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.scrollIntoView();
      } else {
        document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus({ preventScroll: true });
      }
    } else {
      document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus({ preventScroll: true });
    }
    const source = (history.state?.lantaiSource ?? history.state?.lantaiRestore ?? null) as {
      url?: string;
      scrollY?: number;
    } | null;
    if (
      source?.url &&
      new URL(source.url).pathname === path &&
      new URL(source.url).search === location.search &&
      source.scrollY !== undefined
    ) {
      const scrollY = source.scrollY;
      requestAnimationFrame(() => {
        if (revision === routeRevision) window.scrollTo({ top: scrollY, behavior: 'instant' });
      });
    }
    wirePageControls(page ?? root);
    if (collectionTab) {
      const tab = collectionTab.querySelector<HTMLElement>('[aria-selected="true"]')?.dataset.collectionTab;
      collectionTab.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      });
      if (tab && Object.keys(COLLECTION_VIEW_NAMES).includes(tab)) {
        history.replaceState(
          {
            ...(history.state ?? {}),
            lantaiCollection: {
              tab: tab as CollectionView,
              member: query.get('member') ?? undefined,
              relationMode: query.get('relation') === 'list' ? 'list' : 'graph',
              invalid: [],
            } satisfies CollectionViewState,
          },
          '',
          location.href,
        );
      }
    }
    root.querySelectorAll<HTMLButtonElement>('[data-retry-collection]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.retryCollection) retryCollection(button.dataset.retryCollection);
        void renderSiteRoute();
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-collection-retry]').forEach((button) => {
      button.addEventListener('click', () => void renderSiteRoute());
    });
    root.querySelectorAll<HTMLElement>('[data-retry]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.retry;
        retrySiteData(
          key && ['catalog', 'people', 'history', 'military', 'collections', 'eras'].includes(key)
            ? (key as SiteDataKey)
            : undefined,
        );
        void renderSiteRoute();
      });
    });
    mountPortraits(root);
    root.querySelectorAll<HTMLImageElement>('[data-collection-cover]').forEach((image) => {
      image.addEventListener('error', () => {
        image.remove();
        const fallback = root.querySelector<HTMLElement>('[data-collection-cover-fallback]');
        if (fallback) fallback.hidden = false;
      });
    });
  } catch (error) {
    if (revision !== routeRevision) return;
    const page = document.querySelector<HTMLElement>('#site-page');
    if (page)
      page.innerHTML = `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">暂时无法加载页面</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p><button class="lt-button" type="button" data-retry>重试</button><a class="lt-button lt-button-secondary" href="/" data-site-link>返回首页</a></main>`;
    page?.setAttribute('aria-busy', 'false');
    document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
    document.querySelector<HTMLElement>('[data-retry]')?.addEventListener('click', () => {
      retrySiteData();
      void renderSiteRoute();
    });
  }
}

export function startSiteRouter(renderInitial = true): void {
  wireEntityLinks();
  wireReturnLinks();
  wireSiteLinks();
  window.addEventListener('popstate', () => void renderSiteRoute());
  document.addEventListener('click', (event) => {
    if (
      !(event instanceof MouseEvent) ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-timeline-link]');
    if (!link) return;
    event.preventDefault();
    navigateToTimeline(link.href);
  });
  if (renderInitial) void renderSiteRoute();
}

export function dispatchSiteRoute(): void {
  void renderSiteRoute();
}

export { openSiteUrl };
