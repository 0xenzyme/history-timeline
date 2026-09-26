import type { Topic, View } from '../types';
import { esc } from '../timeline/svg';

export function renderChapters(topic: Topic, activeId: string): string {
  return topic.views
    .map(
      (view) =>
        `<button type="button" class="chapter${view.id === activeId ? ' is-active' : ''}" data-chapter="${esc(view.id)}" aria-current="${view.id === activeId ? 'page' : 'false'}">${esc(view.name)}</button>`,
    )
    .join('');
}

/** 全览是索引。打开专题时落到后面第一则能读完的章节。 */
export function entryView(topic: Topic): View {
  return topic.views.find((view) => view.id !== 'overview') ?? topic.views[0];
}

export function isIndexView(view: View): boolean {
  return view.id === 'overview';
}

export function findView(topic: Topic, id: string | null | undefined): View {
  if (!id) return entryView(topic);
  return topic.views.find((v) => v.id === id) ?? entryView(topic);
}

export function viewHasPerson(view: View, personId: string): boolean {
  return view.people === undefined || view.people.includes(personId);
}

export function findViewForPerson(topic: Topic, personId: string, current: View): View {
  if (viewHasPerson(current, personId)) return current;
  const byFocus = topic.views.find((view) => view.focus === personId && viewHasPerson(view, personId));
  if (byFocus) return byFocus;
  const byList = topic.views.find((view) => view.people?.includes(personId) === true);
  if (byList) return byList;
  return topic.views.find((view) => view.people === undefined) ?? topic.views[0];
}
