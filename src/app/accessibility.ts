import { topicPeopleForView } from './layout';
import { chipMatchEvent, personDim, visibleEvents } from './render';
import { state, type Selection } from './runtime';
import { TYPE_NAMES } from './skins';
import { fmtYear } from './util';

function yearLabel(year: number | undefined): string {
  return year === undefined ? '年份不详' : fmtYear(year);
}

export function visibleEntitySelections(): Array<Selection & { label: string; meta: string }> {
  if (state.line === 'people') {
    const people =
      state.groups.people && state.topic
        ? topicPeopleForView(state.topic, state.viewId)
            .filter(
              (person) =>
                !state.hiddenLanes.has(`lane:${person.lane}`) &&
                !personDim(person) &&
                person.birth !== undefined &&
                person.birth <= state.domain[1] &&
                (person.death ?? person.birth) >= state.domain[0],
            )
            .map((person) => ({
              kind: 'person' as const,
              id: person.id,
              label: person.display || person.name,
              meta: `${yearLabel(person.birth)}—${yearLabel(person.death)}${person.birthAccuracy === 'approx' || person.deathAccuracy === 'approx' ? ' · 含约略年份' : ''}`,
            }))
        : [];
    const events = visibleEvents()
      .filter((event) => {
        const war = event.type === 'military' || event.type === 'rebellion';
        return (war ? state.groups.war : state.groups.history) && chipMatchEvent(event);
      })
      .filter((event) => event.year <= state.domain[1] && (event.endYear ?? event.year) >= state.domain[0])
      .map((event) => ({
        kind: 'event' as const,
        id: event.id,
        label: event.display || event.name,
        meta: `${TYPE_NAMES[event.type]} · ${yearLabel(event.year)}${event.endYear ? `—${yearLabel(event.endYear)}` : ''}`,
      }));
    return [...people, ...events];
  }
  return visibleEvents()
    .filter(
      (event) =>
        chipMatchEvent(event) && event.year <= state.domain[1] && (event.endYear ?? event.year) >= state.domain[0],
    )
    .map((event) => ({
      kind: 'event',
      id: event.id,
      label: event.display || event.name,
      meta: `${TYPE_NAMES[event.type]} · ${yearLabel(event.year)}${event.endYear ? `—${yearLabel(event.endYear)}` : ''}`,
    }));
}

let entitySyncTimer = 0;
let lastEntitySignature = '';

/** 连续缩放和平移时合并列表更新，避免每个指针帧销毁整批按钮。 */
export function syncAccessibleEntities(): void {
  window.clearTimeout(entitySyncTimer);
  entitySyncTimer = window.setTimeout(renderAccessibleEntities, 80);
}

function renderAccessibleEntities(): void {
  const list = document.querySelector<HTMLElement>('#timeline-entity-list');
  if (!list) return;
  const entities = visibleEntitySelections();
  const signature = JSON.stringify([
    entities.map((entity) => [entity.kind, entity.id, entity.label, entity.meta]),
    state.selected?.kind,
    state.selected?.id,
  ]);
  if (signature === lastEntitySignature) return;
  lastEntitySignature = signature;

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focused =
    active && list.contains(active) ? active.closest<HTMLButtonElement>('button[data-kind][data-id]') : null;
  const focusedKind = focused?.dataset.kind;
  const focusedId = focused?.dataset.id;
  const fragment = document.createDocumentFragment();
  if (entities.length === 0) {
    const item = document.createElement('li');
    item.textContent = '没有符合当前条件的实体。';
    fragment.append(item);
  }
  for (const entity of entities) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.kind = entity.kind;
    button.dataset.id = entity.id;
    button.setAttribute(
      'aria-pressed',
      String(state.selected?.kind === entity.kind && state.selected.id === entity.id),
    );
    const name = document.createElement('span');
    name.textContent = entity.label;
    const meta = document.createElement('small');
    meta.textContent = entity.meta;
    button.append(name, meta);
    item.append(button);
    fragment.append(item);
  }
  list.replaceChildren(fragment);
  if (focusedKind && focusedId) {
    const equivalent = [...list.querySelectorAll<HTMLButtonElement>('button[data-kind][data-id]')].find(
      (button) => button.dataset.kind === focusedKind && button.dataset.id === focusedId,
    );
    equivalent?.focus({ preventScroll: true });
  }
}
