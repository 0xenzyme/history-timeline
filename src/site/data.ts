import {
  loadCatalog,
  loadCollectionDetail,
  loadCollectionIndex,
  loadEventDetail,
  loadEraDetail,
  loadEraIndex,
  loadLine,
  loadPersonDetail,
  loadSearchIndex,
} from '../loader';
import type {
  Catalog,
  CollectionSummary,
  CollectionDetail,
  EraDetail,
  EraSummary,
  EventDetail,
  EventLineView,
  PersonDetail,
  SearchRecord,
} from '../types';

export interface SiteLibrary {
  catalog?: Catalog;
  people: SearchRecord[];
  events: EventLineView[];
  collections: CollectionSummary[];
  eras: EraSummary[];
  failures: string[];
}

export type SiteDataKey = 'catalog' | 'people' | 'history' | 'military' | 'collections' | 'eras';
export const SITE_DATA_ALL: SiteDataKey[] = ['catalog', 'people', 'history', 'military', 'collections', 'eras'];

let siteLibrary: Promise<SiteLibrary> | undefined;
let siteCatalog: Promise<Catalog> | undefined;
let sitePeople: Promise<SearchRecord[]> | undefined;
const siteEras = new Map<string, Promise<EraSummary[]>>();
const siteCollections = new Map<string, Promise<CollectionSummary[]>>();
const siteLines = new Map<string, Promise<EventLineView>>();
const collectionDetails = new Map<string, Promise<CollectionDetail>>();
const collectionPeople = new Map<string, Promise<PersonDetail>>();

function reset(): void {
  siteLibrary = undefined;
  siteCatalog = undefined;
  sitePeople = undefined;
  siteEras.clear();
  siteCollections.clear();
  siteLines.clear();
  collectionDetails.clear();
  collectionPeople.clear();
}

export function retrySiteData(key?: SiteDataKey): void {
  if (!key) {
    reset();
    return;
  }
  siteLibrary = undefined;
  if (key === 'catalog') siteCatalog = undefined;
  if (key === 'people') sitePeople = undefined;
  if (key === 'eras') siteEras.clear();
  if (key === 'collections') siteCollections.clear();
  if (key === 'history' || key === 'military') siteLines.delete(key);
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key);
  if (!promise) {
    promise = load().catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, promise);
  }
  return promise;
}

export function loadSiteLibrary(keys: SiteDataKey[] = SITE_DATA_ALL): Promise<SiteLibrary> {
  const signature = keys.slice().sort().join(',');
  if (!siteLibrary || siteLibrarySignature !== signature) {
    siteLibrarySignature = signature;
    siteLibrary = (async () => {
      const failures: string[] = [];
      const optional = async <T>(key: SiteDataKey, load: () => Promise<T>, fallback: T): Promise<T> => {
        if (!keys.includes(key)) return fallback;
        try {
          return await load();
        } catch (error) {
          console.warn(`[${key} 局部加载失败]`, error);
          failures.push(key);
          return fallback;
        }
      };
      const catalog = keys.includes('catalog')
        ? await (siteCatalog ??= loadCatalog('/data/index.json').catch((error) => {
            siteCatalog = undefined;
            throw error;
          }))
        : undefined;
      const [people, history, military, collections, eras] = await Promise.all([
        keys.includes('people')
          ? await (sitePeople ??= loadSearchIndex('/data/people.json').catch((error) => {
              sitePeople = undefined;
              throw error;
            }))
          : [],
        optional('history', () => cached(siteLines, 'history', () => loadLine('/data/history.json', 'history')), null),
        optional(
          'military',
          () => cached(siteLines, 'military', () => loadLine('/data/military.json', 'military')),
          null,
        ),
        optional(
          'collections',
          () => cached(siteCollections, 'published', () => loadCollectionIndex('/data/collections.json')),
          [],
        ),
        optional('eras', () => cached(siteEras, 'all', () => loadEraIndex('/data/eras.json')), []),
      ]);
      return {
        catalog,
        people,
        events: [history, military].filter((line): line is EventLineView => line !== null),
        collections,
        eras,
        failures,
      };
    })().catch((error) => {
      siteLibrary = undefined;
      throw error;
    });
  }
  return siteLibrary;
}

let siteLibrarySignature = '';

export function loadEra(id: string): Promise<EraDetail> {
  return loadEraDetail(`/data/eras/${encodeURIComponent(id)}.json`, id);
}

export function loadPerson(id: string): Promise<PersonDetail> {
  return loadPersonDetail(`/data/people/${encodeURIComponent(id)}.json`, id);
}

export function loadCollection(id: string): Promise<CollectionDetail> {
  return cached(collectionDetails, id, () =>
    loadCollectionDetail(`/data/collections/${encodeURIComponent(id)}.json`, id),
  );
}

export function retryCollection(id: string): void {
  collectionDetails.delete(id);
}

export async function loadCollectionPeople(ids: string[]): Promise<{ people: PersonDetail[]; failedIds: string[] }> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const person = await cached(collectionPeople, id, () => loadPerson(id));
        return { person };
      } catch (error) {
        console.warn(`[Collection 成员 ${id} 局部加载失败]`, error);
        return { failedId: id };
      }
    }),
  );
  return {
    people: results.flatMap((result) => ('person' in result && result.person ? [result.person] : [])),
    failedIds: results.flatMap((result) => ('failedId' in result && result.failedId ? [result.failedId] : [])),
  };
}

export function loadEvent(id: string): Promise<EventDetail> {
  return loadEventDetail(`/data/events/${encodeURIComponent(id)}.json`, id);
}

export function eventRecords(library: SiteLibrary) {
  const unique = new Map<string, EventLineView['events'][number]>();
  for (const line of library.events) for (const event of line.events) unique.set(event.id, event);
  return [...unique.values()].sort((a, b) => a.year - b.year || b.importance - a.importance);
}

export function polityName(library: SiteLibrary, id: string): string {
  return library.catalog?.polities?.find((term) => term.id === id)?.name ?? id;
}

export function categoryName(library: SiteLibrary, id: string): string {
  return library.catalog?.categories.find((term) => term.id === id)?.name ?? id;
}

export function collectionCategoryName(library: SiteLibrary, id: string): string {
  return library.catalog?.collectionCategories?.find((term) => term.id === id)?.name ?? id;
}

export function personName(library: SiteLibrary, id: string): string {
  const person = library.people.find((item) => item.id === id && item.kind !== 'event');
  return person?.display || person?.name || id;
}
