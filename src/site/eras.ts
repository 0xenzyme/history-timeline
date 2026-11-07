import type { EraDetail } from '../types';
import { entityLink, eventDates, lifeDates, sourceList } from './components';
import { collectionCategoryName, loadEra, type SiteLibrary } from './data';
import { collectionCard, eraCard, personDirectoryCard, eventDirectoryCard } from './directory-cards';
import { invalidNotice, parseDirectoryQuery } from './discovery-state';
import { escapeHtml } from './escape';

const GROUPS: Record<string, string> = {
  'pre-qin': '先秦',
  'qin-han': '秦汉',
  'weijin-nanbei': '魏晋南北朝',
  'sui-tang-wudai': '隋唐五代',
  'song-liao-jin-yuan': '宋辽金元',
  'ming-qing': '明清',
  minguo: '民国',
};

export function erasDirectory(library: SiteLibrary): string {
  const state = parseDirectoryQuery(
    location.search,
    { sort: { values: ['year'] }, view: { values: ['grid'] } },
    { sort: 'year', view: 'grid' },
  );
  const groups = new Map<string, typeof library.eras>();
  for (const era of library.eras.filter(
    (era) =>
      !state.q ||
      [era.name, ...(era.aliases ?? [])].some((name) => name.toLocaleLowerCase().includes(state.q.toLocaleLowerCase())),
  )) {
    groups.set(era.group, [...(groups.get(era.group) ?? []), era]);
  }
  return `<main class="lt-page lt-directory-page" id="main-content"><header class="lt-directory-hero"><p><a href="/" data-site-link>兰台</a> / 断代</p><h1 tabindex="-1">断代</h1><p>按时期浏览朝代、关键人物和重要事件。朝代区间可以重叠，筛选不代表人物或事件的唯一归属。</p></header>${invalidNotice(state)}<form class="lt-directory-search" action="/eras" method="get" role="search" data-native-form><label for="era-query">搜索朝代</label><div><input id="era-query" name="q" type="search" value="${escapeHtml(state.q)}" placeholder="搜索朝代名称或别名……" /><button class="lt-button" type="submit">检索</button></div></form><div class="lt-directory-toolbar"><p aria-live="polite"><strong>${[...groups.values()].reduce((sum, eras) => sum + eras.length, 0)}</strong> 个时期</p><a class="lt-button" href="/timeline?line=history&from=-2070&to=1949" data-timeline-link>查看完整年表</a></div>${groups.size ? [...groups].map(([group, eras]) => `<section class="lt-era-group"><h2>${GROUPS[group] ?? group}</h2><div class="lt-era-directory">${eras.map(eraCard).join('')}</div></section>`).join('') : '<section class="lt-empty-results"><h2>没有符合当前条件的结果</h2><a href="/eras" data-site-link class="lt-button">重置搜索</a></section>'}</main>`;
}

function eraTimelineUrl(era: EraDetail): string {
  const topic = era.topics[0];
  const padding = Math.max(5, Math.round((era.to - era.from) * 0.03));
  return topic
    ? `/timeline?topic=${encodeURIComponent(topic)}&from=${era.from - padding}&to=${era.to + padding}`
    : `/timeline?line=history&from=${era.from - padding}&to=${era.to + padding}`;
}

const TABS = [
  ['overview', '概览'],
  ['timeline', '朝代年表'],
  ['people', '关键人物'],
  ['events', '重要事件'],
  ['collections', '相关群像'],
] as const;

function eraTab(era: EraDetail, tab: string, library: SiteLibrary): string {
  if (tab === 'timeline')
    return `<section class="lt-section"><h2>朝代年表</h2><p class="lt-section-note">精选事件按起始年排列；完整缩放、平移和人物生命线在年表中查看。</p><a class="lt-button" href="${eraTimelineUrl(era)}" data-timeline-link>查看完整年表</a><ol class="lt-era-timeline">${era.events.map((event) => `<li><span class="lt-data">${eventDates(event)}</span><div>${entityLink('event', event.id, event.display || event.name)}<p>${escapeHtml(event.desc?.split('\n')[0] ?? '')}</p></div></li>`).join('') || '<li>尚无区间内事件。</li>'}</ol></section>`;
  if (tab === 'people')
    return `<section class="lt-section"><h2>关键人物</h2><p class="lt-section-note">编辑推荐优先；无推荐时按对应专题顺序选取，不表示人物重要性排名。</p><div class="lt-person-directory">${era.people.map((person) => personDirectoryCard({ ...person, topicId: era.topics[0] ?? '', topicTitle: '' }, library)).join('') || '<p>尚无对应专题人物。</p>'}</div>${era.topics[0] ? `<a href="/people?dynasty=${encodeURIComponent(era.topics[0])}&sort=birth&view=grid" data-site-link>浏览本时期列传 →</a>` : ''}</section>`;
  if (tab === 'events')
    return `<section class="lt-section"><h2>重要事件</h2><p class="lt-section-note">编辑推荐优先；无推荐时按展示优先级与年份选取。朝代标签只表示区间相交。</p><div class="lt-event-directory">${era.events.map((event) => eventDirectoryCard(event, library, 'list')).join('') || '<p>尚无区间内事件。</p>'}</div><a href="/events?dynasty=${encodeURIComponent(era.id)}&sort=year&view=list" data-site-link>浏览本时期纪事 →</a></section>`;
  if (tab === 'collections')
    return `<section class="lt-section"><h2>相关群像</h2><p class="lt-section-note">只显示显式朝代引用，不按共同人物自动生成。</p><div class="lt-collection-directory">${era.collectionRecords.map((collection) => collectionCard(collection, collectionCategoryName(library, collection.category))).join('') || '<p>尚无直接相关系列。</p>'}</div></section>`;
  return `<div class="lt-era-overview"><section class="lt-section"><h2>朝代概览</h2><p class="lt-prose">${escapeHtml(era.body ?? '时代资料尚未整理。')}</p><dl class="lt-facts"><div><dt>起止</dt><dd>${era.from < 0 ? `前 ${-era.from}` : era.from}—${era.to < 0 ? `前 ${-era.to}` : era.to} 年</dd></div><div><dt>历时</dt><dd>约 ${era.to - era.from} 年</dd></div>${era.capitals?.length ? `<div><dt>都城</dt><dd>${era.capitals.map((capital) => `${escapeHtml(capital.name)}${capital.note ? `<small>${escapeHtml(capital.note)}</small>` : ''}`).join('')}</dd></div>` : ''}${era.founderRecords.length ? `<div><dt>建立者</dt><dd>${era.founderRecords.map((person) => `${entityLink('person', person.id, person.display || person.name)}<small>${lifeDates(person)}</small>`).join('')}</dd></div>` : ''}</dl>${era.note ? `<details class="lt-year-note"><summary>朝代区间说明</summary><p>${escapeHtml(era.note)}</p></details>` : ''}</section>${era.events.length ? `<section class="lt-section"><h2>朝代年表</h2><ol class="lt-era-timeline">${era.events.map((event) => `<li><span class="lt-data">${eventDates(event)}</span><div>${entityLink('event', event.id, event.display || event.name)}</div></li>`).join('')}</ol></section>` : ''}${era.sources.length ? `<section class="lt-section"><h2>资料出处</h2>${sourceList(era.sources)}</section>` : ''}</div><aside><section class="lt-section"><h2>关键人物</h2><div class="lt-era-people">${era.people.map((person) => `<article><span aria-hidden="true">${escapeHtml(person.display.slice(0, 1))}</span>${entityLink('person', person.id, person.display || person.name)}<small>${lifeDates(person)}</small></article>`).join('') || '<p>尚无对应专题人物。</p>'}</div></section><section class="lt-section"><h2>继续阅读</h2><div class="lt-actions"><a href="/events?dynasty=${encodeURIComponent(era.id)}&sort=year&view=list" data-site-link>本时期纪事</a>${era.topics[0] ? `<a href="/people?dynasty=${encodeURIComponent(era.topics[0])}&sort=birth&view=grid" data-site-link>本时期列传</a>` : ''}</div></section></aside>`;
}

export function renderEraDetail(era: EraDetail, library: SiteLibrary): string {
  const state = parseDirectoryQuery(
    location.search,
    { tab: { values: TABS.map(([id]) => id) } },
    { sort: 'year', view: 'grid' },
  );
  const requested = new URLSearchParams(location.search).get('tab');
  const tab = typeof state.values.tab === 'string' ? state.values.tab : 'overview';
  const availableTabs = TABS.filter(([id]) => id !== 'collections' || era.collections.length > 0);
  const active = availableTabs.some(([id]) => id === tab) ? tab : 'overview';
  const invalidTab = requested !== null && (requested !== tab || tab !== active);
  if (invalidTab) history.replaceState(history.state, '', `/eras/${encodeURIComponent(era.id)}`);
  return `<main class="lt-page lt-era-page" id="main-content"><div class="lt-return-row"><a class="lt-return" href="/eras" data-return-fallback="/eras">← 返回断代</a><nav aria-label="面包屑"><ol><li><a href="/eras" data-site-link>断代</a></li><li aria-current="page">${escapeHtml(era.name)}</li></ol></nav></div>${invalidNotice({ ...state, invalid: invalidTab ? ['tab'] : [] })}<header class="lt-era-hero"><div><h1 tabindex="-1">${escapeHtml(era.name)}</h1><p class="lt-life-dates">${era.from < 0 ? `前 ${-era.from}` : era.from}—${era.to < 0 ? `前 ${-era.to}` : era.to} 年 · 历时约 ${era.to - era.from} 年</p><p>${escapeHtml(era.summary ?? '时代资料尚未整理。')}</p><a class="lt-button" href="${eraTimelineUrl(era)}" data-timeline-link>查看本朝年表 →</a></div><span class="lt-era-monogram" aria-hidden="true">${escapeHtml(era.name.slice(0, 1))}</span></header><nav class="lt-era-tabs" aria-label="朝代内容">${availableTabs.map(([id, label]) => `<a href="/eras/${encodeURIComponent(era.id)}${id === 'overview' ? '' : `?tab=${id}`}" data-site-link ${active === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>${eraTab(era, active, library)}</main>`;
}

export async function eraPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    return renderEraDetail(await loadEra(id), library);
  } catch (error) {
    const notFound = error instanceof Error && error.message.includes('404');
    return `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">${notFound ? '未找到该朝代' : '暂时无法加载该朝代'}</h1><p>${notFound ? `「${escapeHtml(id)}」的链接可能已失效。` : '数据请求未完成，请重试。'}</p><div class="lt-actions">${notFound ? '' : '<button class="lt-button" type="button" data-retry>重试</button>'}<a class="lt-button lt-button-secondary" href="/eras" data-site-link>返回断代</a></div></main>`;
  }
}
