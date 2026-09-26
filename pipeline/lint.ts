import type { Topic } from '../src/types';
import type { LintMessage, PipelineData, RegistryPerson } from './types';

const GENDERS = new Set(['female', 'male', 'unknown']);

function vocabSet(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

function lintPerson(person: RegistryPerson, categoryIds: Set<string>, polityIds: Set<string>): LintMessage[] {
  const messages: LintMessage[] = [];
  const path = `registry/people/${person.id}`;
  for (const category of person.categories ?? []) {
    if (!categoryIds.has(category)) {
      messages.push({ level: 'error', path, message: `category ${category} 不在词表中` });
    }
  }
  if (person.primary && person.categories && !person.categories.includes(person.primary)) {
    messages.push({ level: 'error', path, message: `primary ${person.primary} 不在 categories 中` });
  }
  for (const polity of person.polity ?? []) {
    if (!polityIds.has(polity)) {
      messages.push({ level: 'error', path, message: `polity ${polity} 不在词表中` });
    }
  }
  if (person.gender && !GENDERS.has(person.gender)) {
    messages.push({ level: 'error', path, message: `gender ${person.gender} 非法` });
  }
  if (!person.sources || person.sources.length === 0) {
    messages.push({ level: 'error', path, message: '缺少出处' });
  }
  if (person.birth === undefined && person.death === undefined) {
    messages.push({ level: 'error', path, message: '生卒年全为空' });
  }
  if (person.birth === undefined && person.birthAccuracy !== 'unknown') {
    messages.push({ level: 'error', path, message: '缺生年时 birthAccuracy 应为 unknown' });
  }
  if (person.death === undefined && person.deathAccuracy !== 'unknown') {
    messages.push({ level: 'error', path, message: '缺卒年时 deathAccuracy 应为 unknown' });
  }
  if (person.birth !== undefined && person.birthAccuracy === 'unknown') {
    messages.push({ level: 'error', path, message: 'birthAccuracy 为 unknown 时不应写入 birth' });
  }
  if (person.death !== undefined && person.deathAccuracy === 'unknown') {
    messages.push({ level: 'error', path, message: 'deathAccuracy 为 unknown 时不应写入 death' });
  }
  if (person.birthAccuracy === 'disputed' && !person.birthNote) {
    messages.push({ level: 'error', path, message: '生年异说必须写 birthNote' });
  }
  if (person.deathAccuracy === 'disputed' && !person.deathNote) {
    messages.push({ level: 'error', path, message: '卒年异说必须写 deathNote' });
  }
  if (!person.bio) {
    messages.push({ level: 'warning', path, message: '缺少 bio' });
  }
  return messages;
}

function connectedPeople(topic: Topic): Set<string> {
  const ids = new Set<string>();
  for (const rel of topic.relations) {
    ids.add(rel.source);
    ids.add(rel.target);
  }
  return ids;
}

export function lintPipeline(data: PipelineData, compiled: Topic[]): LintMessage[] {
  const messages: LintMessage[] = [];
  const regionIds = vocabSet(data.regions);
  const eraIds = vocabSet(data.eras);
  const themeIds = vocabSet(data.themes);
  const categoryIds = vocabSet(data.categories);
  const polityIds = vocabSet(data.polities);
  const usedPeople = new Set<string>();

  for (const person of data.people.values()) {
    messages.push(...lintPerson(person, categoryIds, polityIds));
  }

  for (const draft of data.topics) {
    const path = `topics/${draft.meta.id}`;
    if (!regionIds.has(draft.catalog.region)) {
      messages.push({ level: 'error', path, message: `region ${draft.catalog.region} 不在词表中` });
    }
    for (const era of draft.catalog.eras) {
      if (!eraIds.has(era)) {
        messages.push({ level: 'error', path, message: `era ${era} 不在词表中` });
      }
    }
    for (const theme of draft.catalog.themes) {
      if (!themeIds.has(theme)) {
        messages.push({ level: 'error', path, message: `theme ${theme} 不在词表中` });
      }
    }
    if (draft.catalog.eras.length === 0 || draft.catalog.themes.length === 0) {
      messages.push({ level: 'error', path, message: 'eras / themes 不能为空' });
    }

    const overlayIds = new Set<string>();
    for (const overlay of draft.people) {
      if (overlayIds.has(overlay.id)) {
        messages.push({ level: 'error', path, message: `人物重复收录：${overlay.id}` });
      }
      overlayIds.add(overlay.id);
      usedPeople.add(overlay.id);
      if (!data.people.has(overlay.id)) {
        messages.push({ level: 'error', path, message: `人物未登记：${overlay.id}` });
      }
    }

    for (const rel of draft.relations) {
      if (!rel.note?.trim()) {
        messages.push({
          level: 'error',
          path: `${path}/relations`,
          message: `${rel.source}→${rel.target} 缺少 note`,
        });
      }
    }

    for (const view of draft.views) {
      if (!view.brief?.trim()) {
        messages.push({ level: 'error', path: `${path}/views/${view.id}`, message: '章节缺少 brief' });
      }
      if (!view.focus) {
        messages.push({ level: 'error', path: `${path}/views/${view.id}`, message: '章节缺少 focus' });
      }
    }
  }

  for (const topic of compiled) {
    const linked = connectedPeople(topic);
    for (const person of topic.people) {
      if (!linked.has(person.id)) {
        messages.push({
          level: 'warning',
          path: `topics/${topic.meta.id}`,
          message: `${person.id} 没有关系，确认是否只为镜头收录`,
        });
      }
    }
  }

  for (const id of data.people.keys()) {
    if (!usedPeople.has(id)) {
      messages.push({ level: 'warning', path: `registry/people/${id}`, message: '已登记但未被任何专题收录' });
    }
  }

  return messages;
}
