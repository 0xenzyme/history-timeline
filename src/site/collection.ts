import {
  accuracyNote,
  entityLink,
  eventDates,
  eventType,
  expandableSources,
  lifeDates,
  sourceList,
} from './components';
import { collectionCategoryName, loadCollection, loadCollectionPeople, type SiteLibrary } from './data';
import { escapeHtml } from './escape';
import { formatYear } from './format';
import type { CollectionDetail, CollectionView, Person, PersonWork } from '../types';
import {
  availableCollectionViews,
  COLLECTION_VIEW_NAMES,
  collectionUrl,
  collectionTimelineUrl,
  collectionTimelineBounds,
  featuredCollectionMembers,
  orderedCollectionMembers,
  RELATION_TYPE_NAMES,
  resolveCollectionView,
  timelineMembers,
  type CollectionMemberRecord,
  type CollectionViewState,
  type CollectionWorksResult,
} from './collection-views';

const WORK_KIND_NAMES: Record<string, string> = {
  poetry: '诗歌',
  prose: '文章',
  calligraphy: '书法',
  painting: '绘画',
  music: '音乐',
  book: '著述',
  other: '其他',
};

function personName(collection: CollectionDetail, id: string): Person | undefined {
  return collection.people.find((person) => person.id === id);
}

function personLink(collection: CollectionDetail, id: string): string {
  const person = personName(collection, id);
  return entityLink('person', id, person?.display || person?.name || id);
}

function collectionLifeDates(person: Person): string {
  return person.birth === undefined && person.death === undefined ? '生卒年不详' : lifeDates(person);
}

function memberList(collection: CollectionDetail, members: CollectionMemberRecord[]): string {
  return `<ol class="lt-collection-member-list">${members
    .map(
      ({ person, order, role, featured }) =>
        `<li id="collection-member-${encodeURIComponent(person.id)}" data-member-id="${escapeHtml(person.id)}"><span class="lt-data">${String(order).padStart(2, '0')}</span><div><div class="lt-member-heading">${personLink(collection, person.id)}${featured ? '<span class="lt-tag">代表成员</span>' : ''}</div><span class="lt-data">${collectionLifeDates(person)}</span>${role ? `<p>${escapeHtml(role)}</p>` : ''}${person.title ? `<p class="lt-section-note">${escapeHtml(person.title)}</p>` : ''}${accuracyNote(person.birthAccuracy, person.birthNote, '生')}${accuracyNote(person.deathAccuracy, person.deathNote, '卒')}</div></li>`,
    )
    .join('')}</ol>`;
}

function pathSteps(collection: CollectionDetail, state: CollectionViewState): string {
  return `<ol class="lt-collection-path">${(collection.path ?? [])
    .map((step, index) => {
      const tab =
        step.view && availableCollectionViews(collection).includes(step.view) ? step.view : collection.defaultView;
      const target = step.person ?? step.event;
      return `<li><span class="lt-path-order" aria-hidden="true">${index + 1}</span><div><h3>${escapeHtml(step.label)}</h3>${step.person ? `<p>${personLink(collection, step.person)}</p>` : ''}${step.event ? `<p>${entityLink('event', step.event, collection.eventRecords.find((event) => event.id === step.event)?.display || step.event)}</p>` : ''}${target ? `<a class="lt-path-view" href="${collectionUrl(collection, { ...state, tab, member: tab === 'relations' ? target : undefined })}#${tab === 'relations' ? 'collection-view' : `collection-member-${encodeURIComponent(target)}`}" data-site-link>${tab === 'relations' ? `在人物关系中查看${personName(collection, target)?.display ?? target} →` : `在${COLLECTION_VIEW_NAMES[tab]}中查看 →`}</a>` : `<a class="lt-path-view" href="${collectionUrl(collection, { ...state, tab })}#collection-view" data-site-link>查看${COLLECTION_VIEW_NAMES[tab]} →</a>`}</div></li>`;
    })
    .join('')}</ol>`;
}

function overview(collection: CollectionDetail, state: CollectionViewState): string {
  return `<div class="lt-collection-layout"><div><section class="lt-section" aria-labelledby="collection-introduction"><h2 id="collection-introduction">系列简介</h2><p class="lt-prose">${escapeHtml(collection.body ?? collection.summary)}</p></section><section class="lt-section" aria-labelledby="collection-featured"><div class="lt-section-heading"><h2 id="collection-featured">代表人物</h2><a href="${collectionUrl(collection, { tab: 'members' })}" data-site-link>查看全部 ${collection.members.length} 位人物 →</a></div>${memberList(collection, featuredCollectionMembers(collection))}</section></div><aside>${collection.path?.length ? `<section class="lt-section" aria-labelledby="collection-path"><h2 id="collection-path">探索路径</h2><p class="lt-section-note">按编辑路径阅读；步骤顺序不表示人物之间的直接关系。</p>${pathSteps(collection, state)}</section>` : ''}<section class="lt-section" aria-labelledby="collection-sources"><h2 id="collection-sources">策展出处</h2><p class="lt-section-note">出处支撑本系列的策展说明与成员范围。</p>${sourceList(collection.sources)}</section></aside></div>`;
}

function timelineTicks(from: number, to: number): number[] {
  return Array.from({ length: 5 }, (_, index) => Math.round(from + ((to - from) * index) / 4));
}

function timelineChart(collection: CollectionDetail, members: CollectionMemberRecord[]): string {
  const bounds = collectionTimelineBounds(collection);
  if (!bounds) return '<p class="lt-empty">成员缺少可定位的年份。</p>';
  const position = (year: number) => ((year - bounds.from) / (bounds.to - bounds.from)) * 100;
  return `<figure class="lt-member-timeline" aria-labelledby="member-timeline-caption"><figcaption id="member-timeline-caption">以全体成员的实际生卒年为范围；线段长度不表示关系或影响程度。</figcaption><div class="lt-timeline-chart" aria-hidden="true"><div class="lt-timeline-axis">${timelineTicks(
    bounds.from,
    bounds.to,
  )
    .map((year) => `<span style="left:${position(year)}%">${formatYear(year, 'exact', false)}</span>`)
    .join('')}</div><ol>${members
    .map(({ person }) => {
      const start = person.birth ?? person.death!;
      const end = person.death ?? person.birth!;
      const left = position(start);
      const width = Math.max(position(end) - left, 0.35);
      const accuracy = [person.birthAccuracy, person.deathAccuracy].includes('disputed')
        ? 'disputed'
        : [person.birthAccuracy, person.deathAccuracy].includes('approx')
          ? 'approx'
          : 'exact';
      return `<li><span class="lt-timeline-name">${escapeHtml(person.display || person.name)}</span><div class="lt-timeline-track"><span class="lt-timeline-life" data-accuracy="${accuracy}" style="left:${left}%;width:${width}%"></span></div></li>`;
    })
    .join('')}</ol></div><ol class="lt-collection-chronology">${members
    .map(
      ({ person }) =>
        `<li id="collection-member-${encodeURIComponent(person.id)}" data-member-id="${escapeHtml(person.id)}"><div>${personLink(collection, person.id)}<span class="lt-data">${collectionLifeDates(person)}</span></div>${accuracyNote(person.birthAccuracy, person.birthNote, '生')}${accuracyNote(person.deathAccuracy, person.deathNote, '卒')}</li>`,
    )
    .join('')}</ol></figure>`;
}

function timeline(collection: CollectionDetail, timelineUrl: string | null, timelineFailed: boolean): string {
  const members = timelineMembers(collection);
  return `<section class="lt-section" aria-labelledby="collection-timeline"><div class="lt-section-heading"><h2 id="collection-timeline">人物年表</h2>${timelineUrl ? `<a class="lt-button" href="${timelineUrl}" data-timeline-link>在完整年表中查看 →</a>` : ''}</div><p class="lt-section-note">按生年排列；缺生年时使用已有卒年定位。约略、异说和不详保留原有精度。</p>${timelineFailed ? '<aside class="lt-module-error" role="status"><h3>人物专题入口暂时无法加载</h3><p>系列生命线仍可阅读；重试后可进入对应人物专题。</p><button class="lt-button" type="button" data-collection-retry="timeline">重试年表入口</button></aside>' : ''}${timelineChart(collection, members.dated)}${members.undated.length ? `<section class="lt-undated-members"><h3>年份待考</h3><p class="lt-section-note">以下成员没有可定位的生卒年，不绘制生命线。</p>${memberList(collection, members.undated)}</section>` : ''}</section>`;
}

function relationList(collection: CollectionDetail, state: CollectionViewState): string {
  const relations = state.member
    ? collection.resolvedRelations.filter(
        (relation) => relation.source === state.member || relation.target === state.member,
      )
    : collection.resolvedRelations;
  return relations.length
    ? `<ul class="lt-relation-list lt-collection-relation-list">${relations
        .map((relation) => {
          const direction = relation.directed
            ? `${personName(collection, relation.source)?.display ?? relation.source} → ${personName(collection, relation.target)?.display ?? relation.target}`
            : `${personName(collection, relation.source)?.display ?? relation.source} 与 ${personName(collection, relation.target)?.display ?? relation.target}`;
          return `<li data-relation-source="${escapeHtml(relation.source)}" data-relation-target="${escapeHtml(relation.target)}"><div class="lt-relation-endpoints">${personLink(collection, relation.source)}${relation.directed ? '<span aria-label="指向">→</span>' : '<span>与</span>'}${personLink(collection, relation.target)}</div><p><strong>${RELATION_TYPE_NAMES[relation.type] ?? escapeHtml(relation.type)}</strong> · ${escapeHtml(direction)}</p>${relation.since ? `<span class="lt-data">${formatYear(relation.since)}</span>` : ''}${relation.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}<small>来源专题：${relation.topicIds.map(escapeHtml).join('、')}</small></li>`;
        })
        .join('')}</ul>`
    : `<div class="lt-empty-results"><h3>该成员没有系列内直接关系</h3><p>仅显示系列显式收录的关系，不从成员顺序或共同时代推断。</p><button class="lt-button" type="button" data-collection-member-filter="" data-collection-url="${collectionUrl(collection, { ...state, member: undefined })}">查看全部关系</button></div>`;
}

interface RelationPosition {
  id: string;
  x: number;
  y: number;
}

function relationPositions(collection: CollectionDetail): RelationPosition[] {
  const remaining = new Set(collection.members.map((member) => member.id));
  const components: string[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value as string;
    const queue = [first];
    const component = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (component.has(id)) continue;
      component.add(id);
      remaining.delete(id);
      for (const relation of collection.resolvedRelations) {
        const other = relation.source === id ? relation.target : relation.target === id ? relation.source : undefined;
        if (other && remaining.has(other)) queue.push(other);
      }
    }
    components.push([...component]);
  }
  const positions: RelationPosition[] = [];
  components.forEach((component, componentIndex) => {
    const centerX = ((componentIndex + 1) / (components.length + 1)) * 800;
    component.forEach((id, index) => {
      const angle = component.length === 1 ? 0 : (index / component.length) * Math.PI * 2 - Math.PI / 2;
      const radius = component.length <= 2 ? 48 : Math.min(76, 36 * component.length);
      positions.push({
        id,
        x: Math.max(60, Math.min(740, centerX + (component.length === 1 ? 0 : Math.cos(angle) * radius))),
        y: 165 + (component.length === 1 ? 0 : Math.sin(angle) * radius),
      });
    });
  });
  return positions;
}

function relationGraph(collection: CollectionDetail, state: CollectionViewState): string {
  const positions = relationPositions(collection);
  const position = new Map(positions.map((item) => [item.id, item]));
  const edges = collection.resolvedRelations
    .map((relation) => {
      const sourcePosition = position.get(relation.source)!;
      const targetPosition = position.get(relation.target)!;
      const deltaX = targetPosition.x - sourcePosition.x;
      const deltaY = targetPosition.y - sourcePosition.y;
      const length = Math.hypot(deltaX, deltaY);
      const source = { x: sourcePosition.x + (deltaX / length) * 34, y: sourcePosition.y + (deltaY / length) * 34 };
      const target = { x: targetPosition.x - (deltaX / length) * 40, y: targetPosition.y - (deltaY / length) * 40 };
      const selected = state.member === relation.source || state.member === relation.target;
      return `<g class="lt-relation-edge${selected ? ' is-selected' : ''}" data-relation-source="${escapeHtml(relation.source)}" data-relation-target="${escapeHtml(relation.target)}"><line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"${relation.directed ? ' marker-end="url(#collection-relation-arrow)"' : ''}></line><title>${escapeHtml(RELATION_TYPE_NAMES[relation.type] ?? relation.type)}：${relation.notes.map(escapeHtml).join('；')}</title></g>`;
    })
    .join('');
  const nodes = positions
    .map(({ id, x, y }) => {
      const person = personName(collection, id)!;
      return `<g class="lt-relation-node${state.member === id ? ' is-selected' : ''}" data-member-id="${escapeHtml(id)}"><circle cx="${x}" cy="${y}" r="31"></circle><text x="${x}" y="${y + 6}" text-anchor="middle">${escapeHtml(person.display.slice(0, 1))}</text><text class="lt-relation-node-name" x="${x}" y="${y + 52}" text-anchor="middle">${escapeHtml(person.display)}</text></g>`;
    })
    .join('');
  return `<div class="lt-relation-graph"><svg viewBox="0 0 800 330" role="img" aria-labelledby="collection-relation-title collection-relation-description"><title id="collection-relation-title">系列内显式人物关系</title><desc id="collection-relation-description">图中只显示系列显式引用的一度关系。完整名称、方向、说明与来源见下方关系列表。</desc><defs><marker id="collection-relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>${edges}${nodes}</svg></div>`;
}

function relations(collection: CollectionDetail, state: CollectionViewState): string {
  const choices = orderedCollectionMembers(collection)
    .map(
      ({ id, person }) =>
        `<button type="button" data-collection-member-filter="${escapeHtml(id)}" data-collection-url="${collectionUrl(collection, { ...state, member: id })}#collection-view" aria-pressed="${state.member === id}"${state.member === id ? ' class="is-selected"' : ''}>${escapeHtml(person.display || person.name)}</button>`,
    )
    .join('');
  return `<section class="lt-section" aria-labelledby="collection-relations"><div class="lt-section-heading"><h2 id="collection-relations">人物关系</h2><div class="lt-segmented" aria-label="关系呈现方式"><button type="button" data-collection-view-mode="graph" aria-pressed="${state.relationMode === 'graph'}">关系图</button><button type="button" data-collection-view-mode="list" aria-pressed="${state.relationMode === 'list'}">关系列表</button></div></div><p class="lt-section-note">仅显示系列显式引用的一度关系。没有连线的成员仍可属于本系列，不表示存在未知师承。</p><div class="lt-relation-members" aria-label="按成员筛选关系"><button type="button" data-collection-member-filter="" data-collection-url="${collectionUrl(collection, { ...state, member: undefined })}#collection-view" aria-pressed="${!state.member}"${!state.member ? ' class="is-selected"' : ''}>全部成员</button>${choices}</div>${state.member ? `<p class="lt-relation-selection">当前成员：<strong>${escapeHtml(personName(collection, state.member)?.display ?? state.member)}</strong></p>` : ''}<div class="lt-relation-graph-container"${state.relationMode === 'list' ? ' hidden' : ''}>${relationGraph(collection, state)}</div>${relationList(collection, state)}</section>`;
}

function events(collection: CollectionDetail): string {
  return `<section class="lt-section" aria-labelledby="collection-events"><h2 id="collection-events">相关纪事</h2><p class="lt-section-note">只显示系列显式收录的事件，不从成员生卒年或共同朝代自动补充。</p><ol class="lt-collection-event-list">${collection.eventRecords
    .slice()
    .sort((left, right) => left.year - right.year || left.id.localeCompare(right.id))
    .map(
      (event) =>
        `<li id="collection-member-${encodeURIComponent(event.id)}"><div class="lt-event-heading">${entityLink('event', event.id, event.display || event.name)}${eventType(event)}</div><span class="lt-data">${eventDates(event)}</span>${event.place ? `<p class="lt-data">${escapeHtml(event.place)}</p>` : ''}${event.desc ? `<p>${escapeHtml(event.desc.split('\n')[0])}</p>` : ''}${accuracyNote(event.yearAccuracy, event.yearNote)}${expandableSources(event.sources)}</li>`,
    )
    .join('')}</ol></section>`;
}

function workItem(work: PersonWork): string {
  return `<article class="lt-collection-work"><div class="lt-work-heading"><h3>${escapeHtml(work.title)}</h3>${work.kind ? `<span class="lt-tag">${escapeHtml(WORK_KIND_NAMES[work.kind] ?? work.kind)}</span>` : ''}</div><p class="lt-data">${work.year === undefined ? '创作年未记录' : formatYear(work.year, work.yearAccuracy)}</p>${work.note ? `<p>${escapeHtml(work.note)}</p>` : ''}${accuracyNote(work.yearAccuracy, work.yearNote, '创作')}${expandableSources(work.sources)}</article>`;
}

function works(collection: CollectionDetail, result: CollectionWorksResult): string {
  const members = orderedCollectionMembers(collection);
  const loaded = new Map(result.people.map((person) => [person.id, person]));
  const failed = new Set(result.failedIds);
  const groups = members
    .filter(({ id }) => !failed.has(id))
    .map(({ id }) => {
      const detail = loaded.get(id);
      return detail?.works?.length
        ? `<section class="lt-collection-work-group" id="collection-member-${encodeURIComponent(id)}" aria-labelledby="collection-work-${escapeHtml(id)}"><h3 id="collection-work-${escapeHtml(id)}">${personLink(collection, id)}</h3><div class="lt-collection-work-list">${detail.works.map(workItem).join('')}</div></section>`
        : '';
    })
    .join('');
  const failures = result.failedIds.length
    ? `<div class="lt-module-error" role="status"><h3>部分人物作品暂时无法加载</h3><p>未能读取：${result.failedIds.map((id) => escapeHtml(personName(collection, id)?.display ?? id)).join('、')}。其他人物作品仍可浏览。</p><button class="lt-button" type="button" data-collection-retry="works">重试作品</button></div>`
    : '';
  return `<section class="lt-section" aria-labelledby="collection-works"><h2 id="collection-works">成员作品</h2><p class="lt-section-note">按成员编辑顺序聚合已整理作品；没有创作年时明确保留缺省。</p>${failures}${groups || (!result.failedIds.length ? '<p class="lt-empty">成员作品尚未整理。</p>' : '')}</section>`;
}

export function renderCollectionDetail(
  collection: CollectionDetail,
  library: SiteLibrary,
  state: CollectionViewState,
  timelineUrl: string | null,
  worksResult?: CollectionWorksResult,
  timelineFailed = false,
): string {
  const views = availableCollectionViews(collection);
  const content: Record<CollectionView, () => string> = {
    overview: () => overview(collection, state),
    members: () =>
      `<section class="lt-section" aria-labelledby="collection-members"><h2 id="collection-members">系列人物</h2><p class="lt-section-note">按编辑阅读顺序排列；成员顺序不表示连续师承或影响关系。</p>${memberList(collection, orderedCollectionMembers(collection))}</section>`,
    timeline: () => timeline(collection, timelineUrl, timelineFailed),
    relations: () => relations(collection, state),
    events: () => events(collection),
    works: () => works(collection, worksResult ?? { people: [], failedIds: [] }),
  };
  return `<main class="lt-page lt-collection-page" id="main-content"><div class="lt-return-row"><a class="lt-return" href="/collections" data-return-fallback="/collections">← 返回群像</a><nav aria-label="面包屑"><ol><li><a href="/collections" data-site-link>群像</a></li><li><a href="/collections?category=${encodeURIComponent(collection.category)}" data-site-link>${escapeHtml(collectionCategoryName(library, collection.category))}</a></li><li aria-current="page">${escapeHtml(collection.name)}</li></ol></nav></div>${state.invalid.length ? `<aside class="lt-notice" role="status">无法识别页内参数：${state.invalid.map(escapeHtml).join('、')}。已保留系列内容，并使用可用视图。</aside>` : ''}<header class="lt-collection-hero"><div><span class="lt-tag">${escapeHtml(collectionCategoryName(library, collection.category))}</span><h1 tabindex="-1">${escapeHtml(collection.name)}</h1><p>${escapeHtml(collection.summary)}</p><p class="lt-data">${collection.members.length} 位成员${collection.dynasties?.length ? ` · ${collection.dynasties.length} 个相关时期` : ''}</p><div class="lt-tags">${(collection.tags ?? []).map((tag) => `<span class="lt-tag">${escapeHtml(tag)}</span>`).join('')}</div></div><span class="lt-collection-mark" data-collection-cover-fallback aria-hidden="true"${collection.cover ? ' hidden' : ''}>${escapeHtml(collectionCategoryName(library, collection.category).slice(0, 1))}</span>${collection.cover ? `<img src="${escapeHtml(collection.cover.src)}" alt="${escapeHtml(collection.cover.alt)}" width="480" height="270" data-collection-cover />` : ''}</header><div class="lt-era-tabs lt-collection-tabs" role="tablist" aria-label="系列内容" data-collection-tabs>${views.map((view) => `<a id="collection-tab-${view}" role="tab" href="${collectionUrl(collection, { tab: view })}" data-site-link data-collection-tab="${view}" aria-controls="collection-view" aria-selected="${state.tab === view}" tabindex="${state.tab === view ? '0' : '-1'}">${COLLECTION_VIEW_NAMES[view]}</a>`).join('')}</div><div class="lt-collection-view" id="collection-view" role="tabpanel" aria-labelledby="collection-tab-${state.tab}" tabindex="-1">${content[state.tab]()}</div></main>`;
}

export async function collectionPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    const collection = await loadCollection(id);
    const defaultRelationMode = window.matchMedia('(max-width: 767px)').matches ? 'list' : 'graph';
    const state = resolveCollectionView(collection, location.search, defaultRelationMode);
    if (state.invalid.length) {
      history.replaceState(
        history.state,
        '',
        collectionUrl(collection, {
          tab: state.tab,
          member: state.member,
          relationMode: state.invalid.includes('relation') ? undefined : state.relationMode,
        }),
      );
    }
    const worksResult =
      state.tab === 'works' ? await loadCollectionPeople(collection.members.map((member) => member.id)) : undefined;
    let timelineUrl: string | null = null;
    let timelineFailed = false;
    if (state.tab === 'timeline') {
      const firstDated = timelineMembers(collection).dated[0];
      const result = firstDated ? await loadCollectionPeople([firstDated.id]) : { people: [], failedIds: [] };
      const topicId = result.people[0]?.topics[0]?.id;
      timelineUrl = topicId ? collectionTimelineUrl(collection, topicId) : null;
      timelineFailed = result.failedIds.length > 0;
    }
    return renderCollectionDetail(collection, library, state, timelineUrl, worksResult, timelineFailed);
  } catch (error) {
    const notFound = error instanceof Error && error.message.includes('404');
    return `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">${notFound ? '未找到该群像系列' : '暂时无法加载该群像系列'}</h1><p>${notFound ? `「${escapeHtml(id)}」的链接可能已失效。` : '系列数据请求未完成，请重试。'}</p><div class="lt-actions">${notFound ? '' : `<button class="lt-button" type="button" data-retry-collection="${escapeHtml(id)}">重试系列</button>`}<a class="lt-button lt-button-secondary" href="/collections" data-site-link>返回群像</a><a class="lt-button lt-button-secondary" href="/search" data-site-link>全站搜索</a></div></main>`;
  }
}
