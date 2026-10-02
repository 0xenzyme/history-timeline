import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PersonMarkdownError, publishedPersonMarkdown, readContentMarkdown } from './person-md';
import type { CandidateFile, CategoryFile, PipelineData, RegistryPerson, TopicDraft, VocabFile } from './types';

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
  const categories = readJson<CategoryFile[]>(join(root, 'vocab/categories.json'));
  const polities = readJson<VocabFile[]>(join(root, 'vocab/polities.json'));

  const people = new Map<string, RegistryPerson>();
  const personPaths = new Map<string, string>();
  for (const file of listJsonFiles(join(root, 'registry/people'))) {
    const person = readJson<RegistryPerson>(file);
    const expectedId = file.replace(/\\/g, '/').split('/').pop()?.replace(/\.json$/, '');
    if (!person.id) throw new Error(`${file} 缺少 id`);
    if (expectedId && person.id !== expectedId) {
      throw new Error(`${file} 的 id ${person.id} 与文件名不一致`);
    }
    if (people.has(person.id)) throw new Error(`人物 id 重复：${person.id}`);
    people.set(person.id, person);
    personPaths.set(person.id, `pipeline/registry/people/${person.id}.json`);
  }

  const topics: TopicDraft[] = [];
  const candidates = new Map<string, CandidateFile['people']>();
  const seen = new Set<string>();
  for (const id of order) {
    const draft = readJson<TopicDraft>(join(root, 'topics', id, 'topic.json'));
    if (draft.meta.id !== id) {
      throw new Error(`专题 ${id} 的 meta.id 为 ${draft.meta.id}`);
    }
    if (seen.has(id)) throw new Error(`topics.json 中重复：${id}`);
    seen.add(id);
    topics.push(draft);

    const candidatePath = join(root, 'topics', id, 'candidates.json');
    const ledger = readJson<CandidateFile>(candidatePath);
    if (!ledger || !Array.isArray(ledger.people)) {
      throw new Error(`${candidatePath} 必须包含 people 数组`);
    }
    candidates.set(id, ledger.people);
  }

  const markdownFiles = readContentMarkdown(
    join(root, '..', 'content'),
    topics.map((topic) => ({
      id: topic.meta.id,
      title: topic.meta.title,
      people: topic.people.map((person) => person.id),
    })),
  );
  const markdownErrors: string[] = [];
  for (const file of markdownFiles) {
    for (const message of file.messages) {
      if (message.level === 'error') markdownErrors.push(`${message.path}: ${message.message}`);
    }
  }
  const seenMarkdown = new Map<string, string>();
  for (const file of publishedPersonMarkdown(markdownFiles)) {
    const id = file.person?.id;
    if (!id) continue;
    const previous = seenMarkdown.get(id);
    if (previous) markdownErrors.push(`人物 ${id} 同时在 ${previous} 和 ${file.path}`);
    else seenMarkdown.set(id, file.path);
    if (people.has(id)) markdownErrors.push(`人物 ${id} 同时在 pipeline/registry/people/${id}.json 和 ${file.path}`);
  }
  if (markdownErrors.length > 0) throw new PersonMarkdownError(markdownErrors.join('\n'));
  for (const file of publishedPersonMarkdown(markdownFiles)) {
    if (!file.person) continue;
    people.set(file.person.id, file.person);
    personPaths.set(file.person.id, file.path);
  }

  return { order, regions, eras, themes, categories, polities, people, personPaths, topics, candidates };
}
