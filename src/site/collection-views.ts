import type { CollectionDetail, CollectionMember, CollectionView, Person, PersonDetail } from '../types';

export const COLLECTION_VIEW_NAMES: Record<CollectionView, string> = {
  overview: '概览',
  members: '系列人物',
  timeline: '人物年表',
  relations: '人物关系',
  events: '相关纪事',
  works: '成员作品',
};

export const RELATION_TYPE_NAMES: Record<string, string> = {
  mentor: '师承',
  peer: '同辈',
  rival: '对手',
  kin: '亲属',
  'ruler-subject': '君臣',
};

export interface CollectionViewState {
  tab: CollectionView;
  member?: string;
  relationMode: 'graph' | 'list';
  invalid: string[];
}

export interface CollectionWorksResult {
  people: PersonDetail[];
  failedIds: string[];
}

export interface CollectionMemberRecord extends CollectionMember {
  person: Person;
}

export function availableCollectionViews(collection: CollectionDetail): CollectionView[] {
  return collection.views.filter(
    (view) =>
      ['overview', 'members', 'timeline'].includes(view) ||
      (view === 'relations' && collection.resolvedRelations.length > 0) ||
      (view === 'events' && collection.eventRecords.length > 0) ||
      (view === 'works' && collection.members.length > 0),
  );
}

export function collectionUrl(
  collection: Pick<CollectionDetail, 'id' | 'defaultView'>,
  state: { tab?: CollectionView; member?: string; relationMode?: 'graph' | 'list' },
): string {
  const query = new URLSearchParams();
  if (state.tab && state.tab !== collection.defaultView) query.set('tab', state.tab);
  if (state.member) query.set('member', state.member);
  if (state.tab === 'relations' && state.relationMode) query.set('relation', state.relationMode);
  const suffix = query.toString();
  return `/collections/${encodeURIComponent(collection.id)}${suffix ? `?${suffix}` : ''}`;
}

export function resolveCollectionView(
  collection: CollectionDetail,
  search: string,
  defaultRelationMode: 'graph' | 'list' = 'graph',
): CollectionViewState {
  const query = new URLSearchParams(search);
  const views = availableCollectionViews(collection);
  const requested = query.get('tab');
  const tab = views.includes(requested as CollectionView)
    ? (requested as CollectionView)
    : views.includes(collection.defaultView)
      ? collection.defaultView
      : 'overview';
  const member = query.get('member');
  const relationMode = query.get('relation');
  return {
    tab,
    member: member && collection.members.some((item) => item.id === member) ? member : undefined,
    relationMode: relationMode === 'list' || relationMode === 'graph' ? relationMode : defaultRelationMode,
    invalid: [
      ...(requested !== null && requested !== tab ? ['tab'] : []),
      ...(member !== null && !collection.members.some((item) => item.id === member) ? ['member'] : []),
      ...(relationMode !== null && !['graph', 'list'].includes(relationMode) ? ['relation'] : []),
    ],
  };
}

export function orderedCollectionMembers(collection: CollectionDetail): CollectionMemberRecord[] {
  const people = new Map(collection.people.map((person) => [person.id, person]));
  return collection.members
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((member) => {
      const person = people.get(member.id);
      return person ? [{ ...member, person }] : [];
    });
}

export function featuredCollectionMembers(collection: CollectionDetail): CollectionMemberRecord[] {
  const members = orderedCollectionMembers(collection);
  const featured = members.filter((member) => member.featured);
  return (featured.length ? featured : members.slice(0, 3)).sort((left, right) => left.order - right.order);
}

export interface CollectionTimelineBounds {
  from: number;
  to: number;
}

export function collectionTimelineBounds(collection: CollectionDetail): CollectionTimelineBounds | null {
  const years = collection.people.flatMap((person) =>
    [person.birth, person.death].filter((year) => year !== undefined),
  );
  if (!years.length) return null;
  const from = Math.min(...years);
  const to = Math.max(...years);
  const padding = Math.max(8, Math.round((to - from) * 0.03));
  return { from: from - padding, to: to + padding };
}

export function collectionTimelineUrl(collection: CollectionDetail, topicId?: string): string | null {
  const bounds = collectionTimelineBounds(collection);
  if (!bounds) return null;
  const selected = collection.people.find((person) => person.birth !== undefined || person.death !== undefined);
  return `/timeline?${topicId ? `topic=${encodeURIComponent(topicId)}` : 'line=history'}${selected ? `&person=${encodeURIComponent(selected.id)}` : ''}&from=${bounds.from}&to=${bounds.to}`;
}

export function timelineMembers(collection: CollectionDetail): {
  dated: CollectionMemberRecord[];
  undated: CollectionMemberRecord[];
} {
  const members = orderedCollectionMembers(collection);
  return {
    dated: members
      .filter(({ person }) => person.birth !== undefined || person.death !== undefined)
      .sort(
        (left, right) =>
          (left.person.birth ?? left.person.death!) - (right.person.birth ?? right.person.death!) ||
          left.order - right.order,
      ),
    undated: members.filter(({ person }) => person.birth === undefined && person.death === undefined),
  };
}
