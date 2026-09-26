import type { Catalog } from './types';

export interface Route {
  topicId: string;
  viewId: string | null;
  /** 地址里的专题不在目录里，原样保留，不改写成别的专题。 */
  unknownTopic: string | null;
  /** 文档里保留的旧链接，例如 #wudi。 */
  canonicalize: boolean;
}

const LEGACY_VIEWS: Record<string, { topicId: string; viewId: string }> = {
  wudi: { topicId: 'han', viewId: 'wudi' },
};

export function parseHash(hash: string, catalog: Catalog): Route {
  const first = catalog.topics[0];
  const empty = { topicId: first.id, viewId: null, unknownTopic: null, canonicalize: false };
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!raw) return empty;

  const known = (id: string) => catalog.topics.some((item) => item.id === id);
  const parts = raw.split('/').filter((part) => part.length > 0);
  if (parts.length >= 2) {
    if (!known(parts[0])) {
      return { topicId: first.id, viewId: null, unknownTopic: parts[0], canonicalize: false };
    }
    return { topicId: parts[0], viewId: parts[1], unknownTopic: null, canonicalize: false };
  }

  const token = parts[0];
  const legacy = LEGACY_VIEWS[token];
  if (legacy && known(legacy.topicId)) {
    return { topicId: legacy.topicId, viewId: legacy.viewId, unknownTopic: null, canonicalize: true };
  }
  if (known(token)) {
    return { topicId: token, viewId: null, unknownTopic: null, canonicalize: true };
  }
  return { topicId: first.id, viewId: token, unknownTopic: null, canonicalize: false };
}

export function formatHash(topicId: string, viewId: string): string {
  return `#${topicId}/${viewId}`;
}

export type HistoryMode = 'push' | 'replace' | 'skip';

export function writeHash(topicId: string, viewId: string, mode: HistoryMode): void {
  if (mode === 'skip') return;
  const next = formatHash(topicId, viewId);
  const current = decodeURIComponent(location.hash);
  if (current === next || location.hash === next) return;
  if (mode === 'push') history.pushState(null, '', next);
  else history.replaceState(null, '', next);
}

export function topicDataUrl(file: string): string {
  return `./data/${file}`;
}
