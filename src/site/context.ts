import { dispatchSiteRoute } from './router';

export interface DetailSource {
  url: string;
  scrollY: number;
}

export function openSiteUrl(url: string, mode: 'push' | 'replace' = 'push'): void {
  const target = new URL(url, location.href);
  if (target.pathname === '/timeline' || target.pathname === '/timeline.html' || target.pathname === '/legacy.html') {
    navigateToTimeline(target.href);
    return;
  }
  const same =
    `${target.pathname}${target.search}${target.hash}` === `${location.pathname}${location.search}${location.hash}`;
  if (same && mode === 'push') return;
  const source = { url: location.href, scrollY: window.scrollY } satisfies DetailSource;
  history.replaceState({ ...(history.state ?? {}), lantaiSource: source }, '', location.href);
  history[mode === 'push' ? 'pushState' : 'replaceState'](
    { lantaiRestore: source, lantaiSource: source },
    '',
    target.href,
  );
  dispatchSiteRoute();
}

export function wireSiteLinks(root: ParentNode = document): void {
  root.addEventListener('click', (event) => {
    if (
      !(event instanceof MouseEvent) ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      'a[data-site-link], a[href^="/collections/"], a[data-era-id], a[href^="/people?"], a[href^="/events?"]',
    );
    if (!link) return;
    if (link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    openSiteUrl(link.href);
  });
  root.addEventListener('change', (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-directory-param]');
    if (!select) return;
    const query = new URLSearchParams(location.search);
    query.set(select.dataset.directoryParam!, select.value);
    query.delete('page');
    openSiteUrl(`${location.pathname}?${query.toString()}`);
  });
}

export function openEntity(kind: 'person' | 'event', id: string): void {
  const currentSource = { url: location.href, scrollY: window.scrollY } satisfies DetailSource;
  history.replaceState({ lantaiSource: currentSource }, '', location.href);
  const timelineSource =
    location.pathname === '/timeline' || location.pathname === '/' || location.pathname === '/legacy.html';
  if (!timelineSource && history.state?.lantaiDetail) {
    const source = { url: location.href, scrollY: window.scrollY } satisfies DetailSource;
    history.replaceState({ ...(history.state ?? {}), lantaiSource: source }, '', location.href);
    history.pushState(
      { lantaiDetail: true, lantaiPreviousDetail: source },
      '',
      `/${kind === 'person' ? 'people' : 'events'}/${encodeURIComponent(id)}`,
    );
    dispatchSiteRoute();
    return;
  }
  const state = {
    ...(history.state ?? {}),
    lantaiSource: { url: location.href, scrollY: window.scrollY } satisfies DetailSource,
  };
  if (timelineSource) sessionStorage.setItem('lantai-return-url', state.lantaiSource.url);
  else sessionStorage.removeItem('lantai-return-url');
  const sourceUrl = `${location.pathname}${location.search}${location.hash}`;
  history.replaceState(state, '', sourceUrl);
  history.pushState(
    { lantaiDetail: true },
    '',
    `/${kind === 'person' ? 'people' : 'events'}/${encodeURIComponent(id)}`,
  );
  history.replaceState({ ...(history.state ?? {}), lantaiSource: state.lantaiSource }, '', location.href);
  dispatchSiteRoute();
}

export function wireEntityLinks(root: ParentNode = document): void {
  root.addEventListener('click', (event) => {
    if (!(event instanceof MouseEvent)) return;
    if (document.body.classList.contains('timeline-app') && !document.querySelector('#app')?.hasChildNodes()) return;
    const target = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-entity-kind][data-entity-id]');
    if (
      !target ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const kind = target.dataset.entityKind;
    const id = target.dataset.entityId;
    if ((kind !== 'person' && kind !== 'event') || !id) return;
    event.preventDefault();
    openEntity(kind, id);
  });
}

export function returnToSource(fallbackUrl: string): void {
  if (history.state?.lantaiPreviousDetail) {
    history.back();
    return;
  }
  const source = (history.state?.lantaiSource ?? null) as DetailSource | null;
  const storedUrl = sessionStorage.getItem('lantai-return-url');
  if (
    source?.url &&
    !/\/(people|events)\//.test(new URL(source.url).pathname) &&
    new URL(source.url).pathname !== '/timeline'
  ) {
    history.back();
    return;
  }
  if (source?.url || (!source?.url && storedUrl)) {
    const sourceUrl = source?.url ?? storedUrl!;
    const path = new URL(sourceUrl).pathname;
    if (/\/(people|events)\//.test(path)) history.back();
    else if (path === '/timeline' || (path === '/' && new URL(sourceUrl).hash)) navigateToTimeline(sourceUrl);
    else {
      history.replaceState(
        { ...(history.state ?? {}), lantaiSource: source ?? { url: sourceUrl, scrollY: 0 } },
        '',
        location.href,
      );
      openSiteUrl(sourceUrl, 'replace');
    }
    return;
  }
  if (fallbackUrl.startsWith('/timeline')) navigateToTimeline(fallbackUrl);
  else openSiteUrl(fallbackUrl, 'replace');
}

export function directoryFallback(kind: 'person' | 'event'): string {
  return kind === 'person' ? '/people' : '/events';
}

export function navigateToTimeline(url: string): void {
  if (document.body.classList.contains('timeline-app') && !document.querySelector('#app')?.hasChildNodes()) {
    history.pushState({}, '', url);
    window.dispatchEvent(new CustomEvent('lantai:timeline'));
    return;
  }
  location.assign(url);
}

export function wireReturnLinks(root: ParentNode = document): void {
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      'button[data-return-fallback], a[data-return-fallback]',
    );
    if (!target) return;
    event.preventDefault();
    returnToSource(target.dataset.returnFallback ?? '/timeline');
  });
}
