import type { Catalog } from './types';

export interface Route {
  topicId: string;
  viewId: string | null;
}

export function parseHash(hash: string, catalog: Catalog): Route {
  const first = catalog.topics[0];
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!raw) return { topicId: first.id, viewId: null };

  const parts = raw.split('/').filter((part) => part.length > 0);
  if (parts.length >= 2) {
    const topicId = catalog.topics.some((item) => item.id === parts[0]) ? parts[0] : first.id;
    return { topicId, viewId: parts[1] };
  }

  const token = parts[0];
  if (catalog.topics.some((item) => item.id === token)) {
    return { topicId: token, viewId: null };
  }
  return { topicId: first.id, viewId: token };
}

export function formatHash(topicId: string, viewId: string): string {
  return `#${topicId}/${viewId}`;
}

export function writeHash(topicId: string, viewId: string): void {
  const next = formatHash(topicId, viewId);
  if (location.hash !== next) {
    history.replaceState(null, '', next);
  }
}

export function topicDataUrl(file: string): string {
  return `./data/${file}`;
}
