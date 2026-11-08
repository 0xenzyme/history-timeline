import type { SearchRecord } from '../types';
import { pageBanner, type BannerImage } from './banner';
import { categoryName, collectionCategoryName, eventRecords, personName, type SiteLibrary } from './data';
import { collectionCard, eventDirectoryCard, eventDirectoryTable, personDirectoryCard } from './directory-cards';
import {
  directoryUrl,
  filterSummary,
  invalidNotice,
  pageRange,
  pagination,
  parseDirectoryQuery,
  searchScore,
  type DirectoryQuery,
} from './discovery-state';
import { escapeHtml } from './escape';

function peopleIndex(library: SiteLibrary, topicId?: string): SearchRecord[] {
  const people = library.people.filter((person) => person.kind !== 'event');
  if (!topicId) return [...new Map(people.map((person) => [person.id, person])).values()];
  return [
    ...new Map(
      people.filter((person) => person.topicId === topicId).map((person) => [`${person.topicId}/${person.id}`, person]),
    ).values(),
  ];
}

function uniquePeople(library: SiteLibrary): SearchRecord[] {
  return peopleIndex(library);
}

function personSearchFields(person: SearchRecord, library: SiteLibrary): string[] {
  return [
    ...(person.tags ?? []),
    person.title ?? '',
    ...(person.categories ?? []),
    ...(person.categories ?? []).map((id) => categoryName(library, id)),
  ];
}

function sortPeople(people: SearchRecord[], sort: string): SearchRecord[] {
  return people.sort((left, right) => {
    if (sort === 'birth-desc')
      return (
        (right.birth ?? Number.NEGATIVE_INFINITY) - (left.birth ?? Number.NEGATIVE_INFINITY) ||
        left.display.localeCompare(right.display, 'zh-CN') ||
        left.id.localeCompare(right.id)
      );
    if (sort === 'featured')
      return left.display.localeCompare(right.display, 'zh-CN') || left.id.localeCompare(right.id);
    return (
      (left.birth ?? Number.POSITIVE_INFINITY) - (right.birth ?? Number.POSITIVE_INFINITY) ||
      left.display.localeCompare(right.display, 'zh-CN') ||
      left.id.localeCompare(right.id)
    );
  });
}

function shell(kind: string, title: string, description: string, body: string, search = ''): string {
  const image: BannerImage = kind === 'people' ? 'people' : kind === 'events' ? 'events' : 'collections';
  return `<main class="lt-page lt-directory-page" id="main-content">${pageBanner({
    image,
    title,
    subtitle: description,
    breadcrumb: `<p class="lt-page-banner-breadcrumb"><a href="/" data-site-link>兰台</a> / ${escapeHtml(title)}</p>`,
    body: search,
  })}${body}</main>`;
}

function searchForm(kind: string, state: DirectoryQuery, placeholder: string): string {
  return `<form class="lt-directory-search" action="/${kind}" method="get" role="search" data-native-form><label for="directory-query">${kind === 'people' ? '搜索列传' : kind === 'events' ? '搜索纪事' : '搜索群像'}</label><div><input id="directory-query" name="q" type="search" value="${escapeHtml(state.q)}" placeholder="${placeholder}" />${Object.entries(
    state.values,
  )
    .filter(([key]) => key !== 'sort' && key !== 'view')
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${key}" value="${escapeHtml(Array.isArray(value) ? value.join(',') : value)}" />`,
    )
    .join(
      '',
    )}<input type="hidden" name="sort" value="${state.sort}" /><button type="submit" class="lt-button">检索</button></div></form>`;
}

function option(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function filterChoice(name: string, value: string, label: string, selected: boolean, multiple = false): string {
  return `<label class="lt-filter-choice"><input type="${multiple ? 'checkbox' : 'radio'}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''} /><span>${escapeHtml(label)}</span></label>`;
}

function singleChoiceList(
  name: string,
  allLabel: string,
  choices: Array<[string, string]>,
  selectedValue: string | undefined,
): string {
  return `<div class="lt-filter-options lt-filter-options-single">${filterChoice(name, '', allLabel, !selectedValue)}${choices
    .map(([value, label]) => filterChoice(name, value, label, selectedValue === value))
    .join('')}</div>`;
}

function filterFields(kind: string, state: DirectoryQuery, library: SiteLibrary): string {
  if (kind === 'people') {
    return `<fieldset><legend>所属时期</legend>${singleChoiceList(
      'dynasty',
      '全部时期',
      (library.catalog?.topics ?? []).map((topic) => [topic.id, topic.title]),
      state.values.dynasty as string | undefined,
    )}</fieldset><fieldset><legend>人物身份（同时满足）</legend><div class="lt-filter-checks">${(
      library.catalog?.categories ?? []
    )
      .map((category) => {
        const selected = Array.isArray(state.values.category) && state.values.category.includes(category.id);
        const count = peopleIndex(library, state.values.dynasty as string | undefined).filter(
          (person) =>
            (person.categories ?? []).includes(category.id) &&
            (!state.q ||
              searchScore(
                state.q,
                [person.name, person.display, ...(person.aliases ?? [])],
                personSearchFields(person, library),
              ) >= 0),
        ).length;
        return `<label><input type="checkbox" name="category" value="${category.id}" ${selected ? 'checked' : ''} />${escapeHtml(category.name)} <span>${count}</span></label>`;
      })
      .join('')}</div></fieldset>`;
  }
  if (kind === 'events') {
    const people = uniquePeople(library)
      .slice()
      .sort((a, b) => a.display.localeCompare(b.display, 'zh-CN'));
    const selectedTypes = Array.isArray(state.values.type)
      ? state.values.type
      : state.values.type
        ? [state.values.type]
        : [];
    const eventTypes: Array<[string, string]> = [
      ['military', '军事'],
      ['political', '政治'],
      ['rebellion', '民变'],
      ['institutional', '制度'],
      ['diplomatic', '盟约'],
      ['cultural', '文化'],
    ];
    return `<fieldset><legend>所属朝代</legend>${singleChoiceList(
      'dynasty',
      '全部朝代',
      library.eras.map((era) => [era.id, era.name]),
      state.values.dynasty as string | undefined,
    )}</fieldset><fieldset><legend>事件类型（可多选）</legend><div class="lt-filter-options lt-filter-options-multiple">${filterChoice('type', '', '全部类型', selectedTypes.length === 0, true)}${eventTypes
      .map(([id, name]) => filterChoice('type', id, name, selectedTypes.includes(id), true))
      .join(
        '',
      )}</div></fieldset><fieldset><legend>事件目录</legend><select name="catalog" aria-label="事件目录">${option('', '全部目录', !state.values.catalog)}${option('military', '军事', state.values.catalog === 'military')}${option('history', '历史事件', state.values.catalog === 'history')}</select></fieldset><fieldset><legend>相关人物</legend><select name="person" aria-label="相关人物">${option('', '全部人物', !state.values.person)}${people.map((person) => option(person.id, person.display || person.name, state.values.person === person.id)).join('')}</select></fieldset>`;
  }
  return '';
}

function filterTitle(kind: string): string {
  return kind === 'people' ? '人物筛选' : kind === 'events' ? '事件筛选' : '群像筛选';
}

function filterHeading(kind: string, dialog = false): string {
  return `<div class="lt-filter-heading"><h2${dialog ? ' id="filter-title"' : ''}>${filterTitle(kind)}</h2><div class="lt-filter-heading-actions"><a href="/${kind}" data-site-link>重置</a>${dialog ? '<button type="button" data-filter-close aria-label="关闭筛选">关闭</button>' : ''}</div></div>`;
}

function desktopFilter(kind: string, state: DirectoryQuery, library: SiteLibrary): string {
  if (kind === 'collections') return '';
  return `<aside class="lt-filter-desktop" aria-label="${filterTitle(kind)}"><form action="/${kind}" method="get" data-native-form>${filterHeading(kind)}${state.q ? `<input type="hidden" name="q" value="${escapeHtml(state.q)}" />` : ''}<input type="hidden" name="sort" value="${state.sort}" /><input type="hidden" name="view" value="${state.view}" />${filterFields(kind, state, library)}<button type="submit" class="lt-button">应用筛选</button></form></aside>`;
}

function collectionCategoryChips(state: DirectoryQuery, library: SiteLibrary): string {
  const selected = state.values.category as string | undefined;
  const choices: Array<[string, string]> = [
    ['', '全部系列'],
    ...(library.catalog?.collectionCategories ?? []).map((category): [string, string] => [category.id, category.name]),
  ];
  return `<nav class="lt-collection-chips" aria-label="主题分类">${choices
    .map(([value, label]) => {
      const current = value ? selected === value : !selected;
      return `<a href="${escapeHtml(directoryUrl('/collections', state, { category: value || undefined, page: 1 }))}" data-site-link ${current ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
    })
    .join('')}</nav>`;
}

function directoryControls(kind: string, state: DirectoryQuery, library: SiteLibrary, count: number): string {
  const sortOptions =
    kind === 'people'
      ? [
          ['birth', '生年从早到晚'],
          ['birth-desc', '生年从晚到早'],
          ['featured', '按名称阅读'],
        ]
      : kind === 'events'
        ? [
            ['year', '起始年从早到晚'],
            ['year-desc', '起始年从晚到早'],
            ['importance', '展示优先级'],
          ]
        : [
            ['featured', '编辑推荐'],
            ['name', '系列名称'],
          ];
  const filterDialog =
    kind === 'collections'
      ? ''
      : `<dialog class="lt-filter-dialog" data-filter-dialog aria-labelledby="filter-title"><form action="/${kind}" method="get" data-native-form>${filterHeading(kind, true)}${state.q ? `<input type="hidden" name="q" value="${escapeHtml(state.q)}" />` : ''}<input type="hidden" name="sort" value="${state.sort}" /><input type="hidden" name="view" value="${state.view}" />${filterFields(kind, state, library)}<div class="lt-filter-actions"><button class="lt-button" type="submit">查看 ${count} 条结果</button></div></form></dialog>`;
  return `<div class="lt-directory-toolbar"><p aria-live="polite"><strong>${count}</strong> 条结果${filterSummary(state) ? ` · ${filterSummary(state)}` : ''}</p>${kind === 'collections' ? '' : '<button type="button" class="lt-button lt-button-secondary lt-filter-open" data-filter-open aria-haspopup="dialog">筛选</button>'}<label>排序<select data-directory-param="sort">${sortOptions.map(([value, label]) => option(value, label, state.sort === value)).join('')}</select></label>${kind !== 'eras' ? `<label>视图<select data-directory-param="view">${option('grid', '卡片', state.view === 'grid')}${option('list', '列表', state.view === 'list')}</select></label>` : ''}<a href="/${kind}" data-site-link>重置</a></div>${filterDialog}`;
}

function emptyResults(kind: string, state: DirectoryQuery, count: number, perPage: number): string {
  if (count === 0)
    return `<section class="lt-empty-results"><h2>没有符合当前条件的结果</h2><p>可以清除关键词或调整筛选条件。</p><a class="lt-button" href="/${kind}" data-site-link>重置筛选</a></section>`;
  if (state.page > Math.ceil(count / perPage))
    return `<section class="lt-empty-results"><h2>这一页没有结果</h2><p>当前筛选共有 ${count} 条结果，请求的第 ${state.page} 页超出范围。</p><a class="lt-button" href="${directoryUrl(`/${kind}`, state, { page: 1 })}" data-site-link>回到第 1 页</a></section>`;
  return '';
}

export function peopleDirectory(library: SiteLibrary): string {
  const state = parseDirectoryQuery(
    location.search,
    {
      dynasty: { values: library.catalog?.topics.map((topic) => topic.id) ?? [] },
      category: { values: library.catalog?.categories.map((category) => category.id) ?? [], multiple: true },
      sort: { values: ['birth', 'birth-desc', 'featured'] },
      view: { values: ['grid', 'list'] },
    },
    { sort: 'birth', view: 'grid' },
  );
  const categories = Array.isArray(state.values.category) ? state.values.category : [];
  const people = sortPeople(
    peopleIndex(library, state.values.dynasty as string | undefined).filter((person) => {
      const topicMatch = !state.values.dynasty || person.topicId === state.values.dynasty;
      const categoryMatch = categories.every((category) => (person.categories ?? []).includes(category));
      const score = searchScore(
        state.q,
        [person.name, person.display, ...(person.aliases ?? [])],
        personSearchFields(person, library),
      );
      return topicMatch && categoryMatch && (!state.q || score >= 0);
    }),
    state.sort,
  );
  const perPage = 24;
  const { start, end } = pageRange(people.length, state, perPage);
  return shell(
    'people',
    '列传',
    '读一人生平，见一世风云。时期按专题编排，跨专题人物在对应专题中分别出现。',
    `${invalidNotice(state)}<div class="lt-directory-layout">${desktopFilter('people', state, library)}<div class="lt-directory-results">${directoryControls('people', state, library, people.length)}${
      people.slice(start, end).length
        ? `<div class="lt-person-directory ${state.view === 'list' ? 'lt-directory-list' : ''}">${people
            .slice(start, end)
            .map((person) => personDirectoryCard(person, library))
            .join('')}</div>`
        : emptyResults('people', state, people.length, perPage)
    }${pagination('/people', state, people.length, perPage)}</div></div>`,
    searchForm('people', state, '搜索姓名、别名、身份或标签……'),
  );
}

export function eventsDirectory(library: SiteLibrary): string {
  const eventTypes = ['military', 'political', 'rebellion', 'institutional', 'diplomatic', 'cultural'];
  const state = parseDirectoryQuery(
    location.search,
    {
      dynasty: { values: library.eras.map((era) => era.id) },
      type: { values: eventTypes, multiple: true },
      catalog: { values: ['military', 'history'] },
      person: { values: uniquePeople(library).map((person) => person.id) },
      sort: { values: ['year', 'year-desc', 'importance'] },
      view: { values: ['list', 'grid'] },
    },
    { sort: 'year', view: 'list' },
  );
  const selectedTypes = Array.isArray(state.values.type) ? state.values.type : [];
  const events = eventRecords(library)
    .filter((event) => {
      const people = [...(event.people ?? []), ...(event.commanders ?? []).map((commander) => commander.id)];
      const names = people.map((id) => personName(library, id));
      const score = searchScore(
        state.q,
        [event.name, event.display, ...(event.aliases ?? [])],
        [event.place ?? '', event.placeNow ?? '', ...names],
      );
      return (
        (!state.values.dynasty || event.dynasties?.includes(state.values.dynasty as string)) &&
        (selectedTypes.length === 0 || selectedTypes.includes(event.type)) &&
        (!state.values.catalog || event.catalogs?.includes(state.values.catalog as 'military' | 'history')) &&
        (!state.values.person || people.includes(state.values.person as string)) &&
        (!state.q || score >= 0)
      );
    })
    .sort((left, right) =>
      state.sort === 'year-desc'
        ? right.year - left.year || left.id.localeCompare(right.id)
        : state.sort === 'importance'
          ? right.importance - left.importance || left.year - right.year || left.id.localeCompare(right.id)
          : left.year - right.year || right.importance - left.importance || left.id.localeCompare(right.id),
    );
  const perPage = 20;
  const { start, end } = pageRange(events.length, state, perPage);
  return shell(
    'events',
    '纪事',
    '由一事入史，观时代变迁。军事和历史目录共用同一事件实体库，合并结果不重复。',
    `${invalidNotice(state)}<div class="lt-directory-layout">${desktopFilter('events', state, library)}<div class="lt-directory-results">${directoryControls('events', state, library, events.length)}${
      events.slice(start, end).length
        ? state.view === 'grid'
          ? `<div class="lt-event-directory lt-event-directory-grid">${events
              .slice(start, end)
              .map((event) => eventDirectoryCard(event, library, state.view))
              .join('')}</div>`
          : eventDirectoryTable(events.slice(start, end), library)
        : emptyResults('events', state, events.length, perPage)
    }${pagination('/events', state, events.length, perPage)}</div></div>`,
    searchForm('events', state, '搜索事件、地点或相关人物……'),
  );
}

export function collectionsDirectory(library: SiteLibrary): string {
  const state = parseDirectoryQuery(
    location.search,
    {
      category: { values: (library.catalog?.collectionCategories ?? []).map((category) => category.id) },
      sort: { values: ['featured', 'name'] },
      view: { values: ['grid', 'list'] },
    },
    { sort: 'featured', view: 'grid' },
  );
  const collections = library.collections
    .filter(
      (collection) =>
        (!state.values.category || collection.category === state.values.category) &&
        (!state.q ||
          searchScore(
            state.q,
            [collection.name, ...(collection.aliases ?? [])],
            [collection.summary, ...(collection.tags ?? [])],
          ) >= 0),
    )
    .sort((left, right) =>
      state.sort === 'name'
        ? left.name.localeCompare(right.name, 'zh-CN') || left.id.localeCompare(right.id)
        : (left.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (right.featuredOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.id.localeCompare(right.id),
    );
  const perPage = 12;
  const { start, end } = pageRange(collections.length, state, perPage);
  return shell(
    'collections',
    '群像',
    '看一群人物，知一时风流。按编辑主题阅读经过策展的人物系列。',
    `${invalidNotice(state)}${collectionCategoryChips(state, library)}<div class="lt-directory-layout lt-collection-directory-layout"><div class="lt-directory-results">${directoryControls('collections', state, library, collections.length)}${
      collections.slice(start, end).length
        ? `<div class="lt-collection-directory ${state.view === 'list' ? 'lt-directory-list' : ''}">${collections
            .slice(start, end)
            .map((collection) => collectionCard(collection, collectionCategoryName(library, collection.category)))
            .join('')}</div>`
        : emptyResults('collections', state, collections.length, perPage)
    }${pagination('/collections', state, collections.length, perPage)}<p class="lt-section-note">当前系列概览提供策展说明和成员入口；完整系列年表与关系视图在后续群像阅读中提供。</p></div></div>`,
    searchForm('collections', state, '搜索系列名称、说明或标签……'),
  );
}
