import { entityLink, lifeDates, sourceList } from './components';
import { collectionCategoryName, type SiteLibrary } from './data';
import { loadCollectionDetail } from '../loader';
import { escapeHtml } from './escape';

export async function collectionPage(id: string, library: SiteLibrary): Promise<string> {
  try {
    const collection = await loadCollectionDetail(`/data/collections/${encodeURIComponent(id)}.json`, id);
    const requested = new URLSearchParams(location.search).get('tab');
    const members = requested === 'members';
    const invalid = requested && !['overview', 'members'].includes(requested);
    if (invalid) history.replaceState(history.state, '', `/collections/${encodeURIComponent(id)}`);
    return `<main class="lt-page lt-collection-page" id="main-content"><div class="lt-return-row"><a class="lt-return" href="/collections" data-return-fallback="/collections">← 返回群像</a><nav aria-label="面包屑"><ol><li><a href="/collections" data-site-link>群像</a></li><li aria-current="page">${escapeHtml(collection.name)}</li></ol></nav></div>${invalid ? '<aside class="lt-notice" role="status">当前只提供系列概览和成员列表，已回到概览。</aside>' : ''}<header class="lt-collection-hero"><div><span class="lt-tag">${escapeHtml(collectionCategoryName(library, collection.category))}</span><h1 tabindex="-1">${escapeHtml(collection.name)}</h1><p>${escapeHtml(collection.summary)}</p><div class="lt-tags">${(collection.tags ?? []).map((tag) => `<span class="lt-tag">${escapeHtml(tag)}</span>`).join('')}</div></div><span class="lt-collection-mark" aria-hidden="true">${escapeHtml(collectionCategoryName(library, collection.category).slice(0, 1))}</span></header><nav class="lt-era-tabs" aria-label="系列概览"><a href="/collections/${encodeURIComponent(id)}" data-site-link ${!members ? 'aria-current="page"' : ''}>概览</a><a href="/collections/${encodeURIComponent(id)}?tab=members" data-site-link ${members ? 'aria-current="page"' : ''}>系列人物</a></nav>${
      members
        ? `<section class="lt-section"><h2>系列人物</h2><p class="lt-section-note">按编辑阅读顺序排列；成员顺序不表示连续师承或影响关系。</p><ol class="lt-collection-member-list">${collection.members
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((member) => {
              const person = collection.people.find((item) => item.id === member.id);
              return person
                ? `<li><span class="lt-data">${member.order}</span><div>${entityLink('person', person.id, person.display || person.name)}<span class="lt-data">${lifeDates(person)}</span>${member.role ? `<p>${escapeHtml(member.role)}</p>` : ''}</div></li>`
                : '';
            })
            .join('')}</ol></section>`
        : `<section class="lt-section"><h2>策展概览</h2><p class="lt-prose">${escapeHtml(collection.body ?? collection.summary)}</p>${collection.path?.length ? `<h3>阅读路径</h3><ol class="lt-collection-path">${collection.path.map((step) => `<li>${escapeHtml(step.label)}${step.person ? ` · ${entityLink('person', step.person, collection.people.find((person) => person.id === step.person)?.display ?? step.person)}` : ''}${step.event ? ` · ${entityLink('event', step.event, collection.eventRecords.find((event) => event.id === step.event)?.display ?? step.event)}` : ''}</li>`).join('')}</ol>` : ''}<p class="lt-section-note">完整系列年表、人物关系与相关纪事视图将在群像阅读阶段开放。</p></section>`
    }<section class="lt-section"><h2>策展出处</h2>${sourceList(collection.sources)}</section></main>`;
  } catch (error) {
    const notFound = error instanceof Error && error.message.includes('404');
    return `<main class="lt-page lt-state-page" id="main-content"><h1 tabindex="-1">${notFound ? '未找到该群像系列' : '暂时无法加载该群像系列'}</h1><p>${notFound ? '链接可能已失效。' : '数据请求未完成，请重试。'}</p><a class="lt-button" href="/collections" data-site-link>返回群像</a></main>`;
  }
}
