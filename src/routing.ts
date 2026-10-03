import type { Catalog } from './types';

export type LineId = 'military' | 'history';

export interface Route {
  /** topic = 人物专题（按朝代），time = 事件线（按世纪分段） */
  axis: 'topic' | 'time';
  topicId: string;
  viewId: string | null;
  lineId: LineId | null;
  segmentId: string | null;
  eventId: string | null;
  /** 地址里的专题不在目录里，原样保留，不改写成别的专题。 */
  unknownTopic: string | null;
  /** 文档里保留的旧链接，例如 #wudi。 */
  canonicalize: boolean;
}

const LEGACY_VIEWS: Record<string, { topicId: string; viewId: string }> = {
  wudi: { topicId: 'han', viewId: 'wudi' },
};

function timeLineIds(catalog: Catalog): Set<string> {
  return new Set((catalog.lines ?? []).filter((line) => line.axis === 'time').map((line) => line.id));
}

function emptyRoute(catalog: Catalog): Route {
  return {
    axis: 'topic',
    topicId: catalog.topics[0].id,
    viewId: null,
    lineId: null,
    segmentId: null,
    eventId: null,
    unknownTopic: null,
    canonicalize: false,
  };
}

export function parseHash(hash: string, catalog: Catalog): Route {
  const empty = emptyRoute(catalog);
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!raw) return empty;

  const parts = raw.split('/').filter((part) => part.length > 0);

  // 事件线走在前面：military / history 不是任何专题 id，不会和旧链接冲突
  if (timeLineIds(catalog).has(parts[0])) {
    return {
      axis: 'time',
      topicId: empty.topicId,
      viewId: null,
      lineId: parts[0] as LineId,
      segmentId: parts[1] ?? null,
      eventId: parts[2] ?? null,
      unknownTopic: null,
      canonicalize: false,
    };
  }

  const known = (id: string) => catalog.topics.some((item) => item.id === id);
  if (parts.length >= 2) {
    if (!known(parts[0])) {
      return { ...empty, topicId: empty.topicId, unknownTopic: parts[0], canonicalize: false };
    }
    return { ...empty, topicId: parts[0], viewId: parts[1], canonicalize: false };
  }

  const token = parts[0];
  const legacy = LEGACY_VIEWS[token];
  if (legacy && known(legacy.topicId)) {
    return { ...empty, topicId: legacy.topicId, viewId: legacy.viewId, canonicalize: true };
  }
  if (known(token)) {
    return { ...empty, topicId: token, canonicalize: true };
  }
  return { ...empty, viewId: token, canonicalize: false };
}

export function formatHash(topicId: string, viewId: string): string {
  return `#${topicId}/${viewId}`;
}

export function formatLineHash(lineId: LineId, segmentId: string, eventId?: string | null): string {
  return eventId ? `#${lineId}/${segmentId}/${eventId}` : `#${lineId}/${segmentId}`;
}

export type HistoryMode = 'push' | 'replace' | 'skip';

function commit(next: string, mode: HistoryMode): void {
  if (mode === 'skip') return;
  const current = decodeURIComponent(location.hash);
  if (current === next || location.hash === next) return;
  if (mode === 'push') history.pushState(null, '', next);
  else history.replaceState(null, '', next);
}

export function writeHash(topicId: string, viewId: string, mode: HistoryMode): void {
  commit(formatHash(topicId, viewId), mode);
}

export function writeLineHash(
  lineId: LineId,
  segmentId: string,
  eventId: string | null,
  mode: HistoryMode,
): void {
  commit(formatLineHash(lineId, segmentId, eventId), mode);
}

export function topicDataUrl(file: string): string {
  return `./data/${file}`;
}
