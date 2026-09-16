import type { Topic, View } from '../types';
import { esc } from '../timeline/svg';

export function renderChapters(topic: Topic, activeId: string): string {
  return topic.views
    .map(
      (view) =>
        `<button type="button" class="chapter${view.id === activeId ? ' is-active' : ''}" data-chapter="${esc(view.id)}">${esc(view.name)}</button>`,
    )
    .join('');
}

export function findView(topic: Topic, id: string | null | undefined): View {
  if (!id) return topic.views[0];
  return topic.views.find((v) => v.id === id) ?? topic.views[0];
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
