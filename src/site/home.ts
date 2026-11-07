import type { EraSummary } from '../types';
import { collectionCategoryName, type SiteLibrary } from './data';
import { collectionCard, eraCard } from './directory-cards';

export function homePage(library: SiteLibrary): string {
  const editorial = library.catalog?.editorial ?? { dynasties: [], collections: [] };
  const erasById = new Map(library.eras.map((era) => [era.id, era]));
  let recommendedEras = editorial.dynasties.flatMap((id) => {
    const era = erasById.get(id);
    return era ? [era] : [];
  });
  if (recommendedEras.length === 0) {
    recommendedEras = library.eras
      .filter((era): era is EraSummary & { summary: string } => Boolean(era.summary))
      .slice(0, 5);
  }
  const recommendedCollections = editorial.collections.flatMap((id) => {
    const collection = library.collections.find((item) => item.id === id);
    return collection ? [collection] : [];
  });
  const failed = (id: string) => library.failures.includes(id);
  return `<main id="main-content" class="lt-home">
    <section class="lt-home-hero" aria-labelledby="home-title"><div class="lt-home-hero-inner"><span class="lt-home-seal" aria-hidden="true">蘭</span><h1 id="home-title" tabindex="-1">兰台 <small>Lantai</small></h1><p class="lt-home-tagline">纵横千年，人物相望</p><p class="lt-home-intro">以时间为经，以人物为纬。看见历史的前后，也看见人物的彼此。</p><form class="lt-home-search" action="/search" method="get" role="search" data-native-form><label for="home-query">全站搜索</label><div><input id="home-query" type="search" name="q" placeholder="搜索人物、事件、群像、朝代……" required /><input type="hidden" name="type" value="all" /><button class="lt-button" type="submit">搜索</button></div></form><a class="lt-button lt-home-start" href="/timeline" data-timeline-link>开始探索 <span aria-hidden="true">→</span></a></div></section>
    <div class="lt-home-content"><nav class="lt-home-sections" aria-label="内容栏目">${[
      ['/timeline', '年表', '一轴观千年，万事有先后', true],
      ['/people', '列传', '读一人生平，见一世风云', false],
      ['/collections', '群像', '看一群人物，知一时风流', false],
      ['/events', '纪事', '由一事入史，观时代变迁', false],
    ]
      .map(
        ([href, title, description, timeline]) =>
          `<a href="${href}" ${timeline ? 'data-timeline-link' : 'data-site-link'}><h2>${title}</h2><p>${description}</p><span aria-hidden="true">↗</span></a>`,
      )
      .join('')}</nav>
      <section class="lt-home-recommendations" aria-labelledby="home-eras"><div class="lt-section-heading"><h2 id="home-eras">推荐朝代</h2><a href="/eras" data-site-link>浏览全部朝代 →</a></div>${failed('eras') ? '<div class="lt-notice">推荐朝代暂时无法加载。<button type="button" data-retry="eras">重试</button></div>' : recommendedEras.length ? `<div class="lt-era-recommendations">${recommendedEras.map(eraCard).join('')}</div>` : '<p>朝代资料尚未整理。</p>'}</section>
      ${recommendedCollections.length || failed('collections') ? `<section class="lt-home-recommendations" aria-labelledby="home-collections"><div class="lt-section-heading"><h2 id="home-collections">精选群像</h2><a href="/collections" data-site-link>探索全部群像 →</a></div>${failed('collections') ? '<div class="lt-notice">精选群像暂时无法加载。<button type="button" data-retry="collections">重试</button></div>' : `<div class="lt-collection-recommendations">${recommendedCollections.map((collection) => collectionCard(collection, collectionCategoryName(library, collection.category))).join('')}</div>`}</section>` : ''}
      <section class="lt-home-closing"><h2>历史不只有先后，还有关系。</h2><p>从一个名字、一件事情或一个时代，继续阅读相互连接的历史。</p><a class="lt-button" href="/timeline" data-timeline-link>进入年表</a></section>
    </div></main>`;
}
