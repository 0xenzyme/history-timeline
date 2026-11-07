import { chipMatchEvent, personDim, visibleEvents } from './render';
import { state, type Selection } from './runtime';
import { fmtYear } from './util';

function yearLabel(year: number | undefined): string {
  return year === undefined ? '年份不详' : fmtYear(year);
}

export function visibleEntitySelections(): Array<Selection & { label: string; meta: string }> {
  if (state.line === 'people') {
    return (state.topic?.people ?? [])
      .filter(
        (person) =>
          !personDim(person) &&
          person.birth !== undefined &&
          person.birth <= state.domain[1] &&
          (person.death ?? person.birth) >= state.domain[0],
      )
      .map((person) => ({
        kind: 'person',
        id: person.id,
        label: person.display || person.name,
        meta: `${yearLabel(person.birth)}—${yearLabel(person.death)}${person.birthAccuracy === 'approx' || person.deathAccuracy === 'approx' ? ' · 含约略年份' : ''}`,
      }));
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
      meta: `${yearLabel(event.year)}${event.endYear ? `—${yearLabel(event.endYear)}` : ''}`,
    }));
}

export function syncAccessibleEntities(): void {
  const list = document.querySelector<HTMLElement>('#timeline-entity-list');
  if (!list) return;
  list.replaceChildren();
  const entities = visibleEntitySelections();
  if (entities.length === 0) {
    const item = document.createElement('li');
    item.textContent = '没有符合当前条件的实体。';
    list.append(item);
    return;
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
    list.append(item);
  }
}
