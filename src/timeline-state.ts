export interface TimelineState {
  topic?: string;
  view?: string;
  line?: 'people' | 'military' | 'history';
  person?: string;
  event?: string;
  from?: number;
  to?: number;
  chip?: string;
  hidden?: string[];
  strip?: boolean;
  scroll?: number;
}

function validYear(value: string | null): number | undefined {
  if (value === null || !/^-?\d+$/.test(value)) return undefined;
  const year = Number(value);
  return year === 0 ? undefined : year;
}

export function parseTimelineState(search: string): TimelineState {
  const query = new URLSearchParams(search);
  const line = query.get('line');
  const state: TimelineState = {};
  if (query.get('topic')) state.topic = query.get('topic')!;
  if (query.get('view')) state.view = query.get('view')!;
  if (line === 'people' || line === 'military' || line === 'history') state.line = line;
  if (query.get('person')) state.person = query.get('person')!;
  if (query.get('event')) state.event = query.get('event')!;
  const from = validYear(query.get('from'));
  const to = validYear(query.get('to'));
  if (from !== undefined) state.from = from;
  if (to !== undefined) state.to = to;
  if (query.get('chip')) state.chip = query.get('chip')!;
  if (query.get('hide')) state.hidden = query.get('hide')!.split(',').filter(Boolean);
  if (query.get('strip') === '1') state.strip = true;
  const scroll = query.get('scroll');
  if (scroll !== null && /^\d+$/.test(scroll)) state.scroll = Number(scroll);
  return state;
}

export function writeTimelineState(state: TimelineState, mode: 'push' | 'replace' = 'replace'): void {
  if (location.pathname !== '/timeline' && location.pathname !== '/timeline.html') return;
  const query = new URLSearchParams();
  if (state.topic) query.set('topic', state.topic);
  if (state.view) query.set('view', state.view);
  if (state.line) query.set('line', state.line);
  if (state.person) query.set('person', state.person);
  if (state.event) query.set('event', state.event);
  if (state.from !== undefined) query.set('from', String(Math.round(state.from)));
  if (state.to !== undefined) query.set('to', String(Math.round(state.to)));
  if (state.chip && state.chip !== 'all') query.set('chip', state.chip);
  if (state.hidden?.length) query.set('hide', state.hidden.join(','));
  if (state.strip) query.set('strip', '1');
  if (state.scroll) query.set('scroll', String(Math.round(state.scroll)));
  const next = `/timeline?${query.toString()}`;
  if (`${location.pathname}${location.search}` === next) return;
  history[mode === 'push' ? 'pushState' : 'replaceState'](history.state, '', next);
}
