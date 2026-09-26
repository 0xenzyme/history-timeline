import { validateCatalog, validateTopic } from './contract';
import type { Catalog, CatalogEntry, SearchRecord, Topic } from './types';

export async function loadCatalog(url: string): Promise<Catalog> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载专题目录失败：${res.status} ${res.statusText} — ${url}`);
  }
  const catalog = (await res.json()) as Catalog;
  const problems = validateCatalog(catalog);
  if (problems.length > 0) {
    console.error('[目录校验]', problems);
    throw new Error(`专题目录校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return catalog;
}

export function findCatalogEntry(catalog: Catalog, id: string): CatalogEntry {
  return catalog.topics.find((item) => item.id === id) ?? catalog.topics[0];
}

export async function loadTopic(url: string, expectedId?: string): Promise<Topic> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载专题数据失败：${res.status} ${res.statusText} — ${url}`);
  }
  const topic = (await res.json()) as Topic;
  const problems = validateTopic(topic, expectedId);
  if (problems.length > 0) {
    console.error('[数据校验]', problems);
    throw new Error(`数据校验未通过（${problems.length} 项）：\n${problems.join('\n')}`);
  }
  return topic;
}

export async function loadSearchIndex(url: string): Promise<SearchRecord[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载人物索引失败：${res.status} ${res.statusText} — ${url}`);
  }
  return (await res.json()) as SearchRecord[];
}
