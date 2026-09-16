import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PipelineData, RegistryPerson, TopicDraft, VocabFile } from './types';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_'))
    .map((entry) => join(dir, entry.name))
    .sort();
}

export function loadPipeline(root: string): PipelineData {
  const order = readJson<string[]>(join(root, 'topics.json'));
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('pipeline/topics.json 必须是非空的专题 id 列表');
  }

  const regions = readJson<VocabFile[]>(join(root, 'vocab/regions.json'));
  const eras = readJson<VocabFile[]>(join(root, 'vocab/eras.json'));
  const themes = readJson<VocabFile[]>(join(root, 'vocab/themes.json'));

  const people = new Map<string, RegistryPerson>();
  for (const file of listJsonFiles(join(root, 'registry/people'))) {
    const person = readJson<RegistryPerson>(file);
    const expectedId = file.replace(/\\/g, '/').split('/').pop()?.replace(/\.json$/, '');
    if (!person.id) throw new Error(`${file} 缺少 id`);
    if (expectedId && person.id !== expectedId) {
      throw new Error(`${file} 的 id ${person.id} 与文件名不一致`);
    }
    if (people.has(person.id)) throw new Error(`人物 id 重复：${person.id}`);
    people.set(person.id, person);
  }

  const topics: TopicDraft[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const draft = readJson<TopicDraft>(join(root, 'topics', id, 'topic.json'));
    if (draft.meta.id !== id) {
      throw new Error(`专题 ${id} 的 meta.id 为 ${draft.meta.id}`);
    }
    if (seen.has(id)) throw new Error(`topics.json 中重复：${id}`);
    seen.add(id);
    topics.push(draft);
  }

  return { order, regions, eras, themes, people, topics };
}
