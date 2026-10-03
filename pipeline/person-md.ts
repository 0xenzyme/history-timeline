import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

import { EVENT_DIR, EVENT_INDEX_NAME, EVENT_TEMPLATE_NAME } from './event-md';
import type { LintMessage, RegistryPerson, SourceRef } from './types';

/** 文首字段的规定顺序。people:format 按这个顺序重写，people:check 拒绝漂移。 */
export const PERSON_MD_KEYS = [
  'id',
  'name',
  'display',
  'profile',
  'gender',
  'polity',
  'categories',
  'primary',
  'birth',
  'birthAccuracy',
  'birthNote',
  'death',
  'deathAccuracy',
  'deathNote',
  'title',
  'tags',
  'aliases',
  'sources',
] as const;

const SOURCE_KEYS = ['work', 'part', 'note', 'kind'] as const;
const SOURCE_KINDS = new Set(['classic', 'modern', 'database']);
const GENDERS = new Set(['female', 'male', 'unknown']);
export const PERSON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PersonMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonMarkdownError';
  }
}

/** 简表骨架。没有年份，不能直接上轴。 */
export const BRIEF_TEMPLATE: RegistryPerson = {
  id: 'example-person',
  name: '待填',
  display: '待填',
  birthAccuracy: 'unknown',
  deathAccuracy: 'unknown',
  polity: ['han'],
  gender: 'male',
  profile: 'brief',
  sources: [{ work: '待填', part: '待填', kind: 'classic' }],
};

/** 详表骨架。正文是 bio。没有年份，不能直接上轴。 */
export const FULL_TEMPLATE: RegistryPerson = {
  id: 'example-person',
  name: '待填',
  display: '待填',
  birthAccuracy: 'unknown',
  deathAccuracy: 'unknown',
  categories: ['general'],
  polity: ['han'],
  gender: 'male',
  profile: 'full',
  title: '待填',
  tags: ['待填'],
  aliases: ['待填'],
  sources: [{ work: '待填', part: '待填', kind: 'classic' }],
  bio: '待填。两三句：身份、和轴上其他人的关系、为什么出现。',
};

export function formatPersonMarkdown(person: RegistryPerson): string {
  const data: Record<string, unknown> = {};
  for (const key of PERSON_MD_KEYS) {
    const value = person[key];
    if (value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'sources') {
      data.sources = person.sources.map(formatSource);
      continue;
    }
    data[key] = value;
  }
  const front = stringify(data, { lineWidth: 0 }).trimEnd();
  const bio = person.bio?.trim();
  if (bio) return `---\n${front}\n---\n\n${bio}\n`;
  return `---\n${front}\n---\n`;
}

function formatSource(source: SourceRef): SourceRef {
  const next: SourceRef = { work: source.work };
  if (source.part) next.part = source.part;
  if (source.note) next.note = source.note;
  if (source.kind) next.kind = source.kind;
  return next;
}

export interface PersonMarkdownFile {
  /** 相对仓库根目录，例如 content/qin/ying-zheng.md */
  path: string;
  person?: RegistryPerson;
  messages: LintMessage[];
}

export interface TopicIndexContext {
  id: string;
  title: string;
  /** 专题 topic.json 里的收录顺序 */
  people: string[];
}

export interface TopicIndexRow {
  id: string;
  name: string;
  display: string;
  profile: 'brief' | 'full';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** 解析一个人的 Markdown。bio 只认正文，不认文首里的 bio。 */
export function parsePersonMarkdown(text: string, path: string): PersonMarkdownFile {
  const messages: LintMessage[] = [];
  const normalized = normalizeNewlines(text);
  const matched = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!matched) {
    messages.push({ level: 'error', path, message: '缺少文首：文件要以 --- 开始，并以 --- 结束文首' });
    return { path, messages };
  }
  const [, front, body] = matched;
  let parsed: unknown;
  try {
    parsed = parse(front);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    messages.push({ level: 'error', path, message: `文首无法解析：${detail}` });
    return { path, messages };
  }
  if (!isRecord(parsed)) {
    messages.push({ level: 'error', path, message: '文首必须是字段表' });
    return { path, messages };
  }

  const record = parsed;
  for (const key of Object.keys(record)) {
    if (key === 'bio') {
      messages.push({ level: 'error', path, message: 'bio 写在正文，不要写进文首' });
      continue;
    }
    if (!PERSON_MD_KEYS.includes(key as (typeof PERSON_MD_KEYS)[number])) {
      messages.push({ level: 'error', path, message: `字段 ${key} 不在人物模板中` });
    }
  }

  const person = record as unknown as RegistryPerson;
  const bio = body.trim();
  if (bio) person.bio = bio;
  if (record.profile !== 'brief' && record.profile !== 'full') {
    messages.push({ level: 'error', path, message: 'profile 必须是 brief 或 full' });
  }
  if (!GENDERS.has(String(record.gender))) {
    messages.push({ level: 'error', path, message: 'gender 必须是 female、male 或 unknown' });
  }
  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    messages.push({ level: 'error', path, message: '缺少 sources' });
  } else {
    for (const source of record.sources) {
      if (!isRecord(source)) {
        messages.push({ level: 'error', path, message: '出处必须是字段表' });
        continue;
      }
      if (typeof source.work !== 'string' || source.work.trim() === '') {
        messages.push({ level: 'error', path, message: '出处缺少 work' });
      }
      if (!SOURCE_KINDS.has(String(source.kind))) {
        messages.push({ level: 'error', path, message: '出处必须写 kind：classic、modern 或 database' });
      }
      for (const key of Object.keys(source)) {
        if (!SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number])) {
          messages.push({ level: 'error', path, message: `出处字段 ${key} 不在模板中` });
        }
      }
    }
  }

  const filename = path.split('/').pop()?.replace(/\.md$/, '');
  if (filename && !filename.startsWith('_')) {
    if (typeof person.id !== 'string' || !PERSON_ID_PATTERN.test(person.id)) {
      messages.push({ level: 'error', path, message: `id 不合法：${String(person.id || '(空)')}` });
    } else if (person.id !== filename) {
      messages.push({ level: 'error', path, message: `id ${person.id} 与文件名不一致` });
    }
  }

  if (messages.length === 0) {
    const formatted = formatPersonMarkdown(person);
    if (formatted !== normalized) {
      messages.push({ level: 'error', path, message: '格式与模板不一致，运行 npm run people:format' });
    }
  }
  return { path, person, messages };
}

function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** 朝代索引。people:format 重写 content/<topic>.md，people:check 拒绝漂移。 */
export function formatTopicIndex(topicId: string, title: string, rows: TopicIndexRow[]): string {
  const lines = [
    `# ${title}`,
    '',
    `本文件是 \`content/${topicId}/\` 的人物索引。一人一个文件，文件名即 id。顺序跟 \`pipeline/topics/${topicId}/topic.json\` 的收录一致；还没写进专题的人排在表末。`,
    '',
    '| id | 姓名 | 显示名 | profile |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| [${row.id}](${topicId}/${row.id}.md) | ${tableCell(row.name)} | ${tableCell(row.display)} | ${row.profile} |`),
    '',
  ];
  return lines.join('\n');
}

export function topicIndexRows(peopleOrder: string[], files: PersonMarkdownFile[]): TopicIndexRow[] | undefined {
  const published = publishedPersonMarkdown(files);
  if (published.some((file) => !file.person || file.messages.some((message) => message.level === 'error'))) {
    return undefined;
  }
  const byId = new Map(published.map((file) => [file.person!.id, file.person!]));
  const rows: TopicIndexRow[] = [];
  for (const id of peopleOrder) {
    const person = byId.get(id);
    if (!person || (person.profile !== 'brief' && person.profile !== 'full')) continue;
    rows.push({ id: person.id, name: person.name, display: person.display, profile: person.profile });
    byId.delete(id);
  }
  for (const person of [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    if (person.profile !== 'brief' && person.profile !== 'full') continue;
    rows.push({ id: person.id, name: person.name, display: person.display, profile: person.profile });
  }
  return rows;
}

function readTemplateFiles(contentRoot: string): PersonMarkdownFile[] {
  const files: PersonMarkdownFile[] = [];
  for (const [name, template] of [
    ['_template.md', BRIEF_TEMPLATE],
    ['_template-full.md', FULL_TEMPLATE],
  ] as const) {
    const path = `content/${name}`;
    const full = join(contentRoot, name);
    if (!existsSync(full)) {
      files.push({ path, messages: [{ level: 'error', path, message: '缺少模板文件' }] });
      continue;
    }
    const parsed = parsePersonMarkdown(readFileSync(full, 'utf8'), path);
    const expected = formatPersonMarkdown(template);
    const actual = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected) {
      parsed.messages.push({ level: 'error', path, message: '模板与 pipeline/person-md.ts 不一致' });
    }
    files.push(parsed);
  }
  return files;
}

function readDynastyPeople(contentRoot: string, topicId: string): PersonMarkdownFile[] {
  const directory = join(contentRoot, topicId);
  return readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const path = `content/${topicId}/${name}`;
      if (name.startsWith('_')) {
        return {
          path,
          messages: [{ level: 'error', path, message: '模板放在 content/ 根目录，不要放进朝代目录' }],
        };
      }
      return parsePersonMarkdown(readFileSync(join(directory, name), 'utf8'), path);
    });
}

/** 读取 content/ 下的模板、各朝代人物，并核对 content/<topic>.md 索引。 */
export function readContentMarkdown(contentRoot: string, topics: TopicIndexContext[]): PersonMarkdownFile[] {
  let entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }> = [];
  try {
    entries = readdirSync(contentRoot, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return [{
      path: 'content',
      messages: [{ level: 'error', path: 'content', message: '目录不存在' }],
    }];
  }

  const topicIds = new Set(topics.map((topic) => topic.id));
  const files = readTemplateFiles(contentRoot);
  const rootMarkdown = new Set(['README.md', '_template.md', '_template-full.md', EVENT_INDEX_NAME, EVENT_TEMPLATE_NAME]);

  for (const entry of entries) {
    if (entry.isDirectory) {
      // 事件实体库与人物目录并列，不是专题目录
      if (entry.name === EVENT_DIR) continue;
      if (!topicIds.has(entry.name)) {
        const path = `content/${entry.name}`;
        files.push({ path, messages: [{ level: 'error', path, message: '目录名必须是专题 id' }] });
      }
      continue;
    }
    if (!entry.isFile || !entry.name.endsWith('.md') || rootMarkdown.has(entry.name)) continue;
    const topicId = entry.name.slice(0, -'.md'.length);
    if (!topicIds.has(topicId)) {
      const path = `content/${entry.name}`;
      files.push({ path, messages: [{ level: 'error', path, message: '索引文件名必须是专题 id' }] });
    }
  }

  for (const topic of topics) {
    const directory = join(contentRoot, topic.id);
    const indexPath = `content/${topic.id}.md`;
    const hasDirectory = existsSync(directory);
    const hasIndex = existsSync(join(contentRoot, `${topic.id}.md`));
    if (!hasDirectory) {
      if (hasIndex) {
        files.push({ path: indexPath, messages: [{ level: 'error', path: indexPath, message: '有索引但没有人物目录' }] });
      }
      continue;
    }

    const people = readDynastyPeople(contentRoot, topic.id);
    files.push(...people);
    const rows = topicIndexRows(topic.people, people);
    if (!rows) {
      files.push({ path: indexPath, messages: [{ level: 'error', path: indexPath, message: '人物文件未通过，索引暂不核对' }] });
      continue;
    }
    const expected = formatTopicIndex(topic.id, topic.title, rows);
    if (!hasIndex) {
      files.push({ path: indexPath, messages: [{ level: 'error', path: indexPath, message: '缺少索引，运行 npm run people:format' }] });
      continue;
    }
    const actual = readFileSync(join(contentRoot, `${topic.id}.md`), 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected) {
      files.push({ path: indexPath, messages: [{ level: 'error', path: indexPath, message: '索引与人物文件不一致，运行 npm run people:format' }] });
    }
  }
  return files;
}

/** 找到已发布的人物 Markdown。没有则返回 undefined。 */
export function findPersonMarkdown(contentRoot: string, id: string): string | undefined {
  if (!existsSync(contentRoot)) return undefined;
  for (const entry of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === EVENT_DIR) continue;
    if (existsSync(join(contentRoot, entry.name, `${id}.md`))) return `content/${entry.name}/${id}.md`;
  }
  return undefined;
}

export function publishedPersonMarkdown(files: PersonMarkdownFile[]): PersonMarkdownFile[] {
  return files.filter((file) => !file.path.split('/').pop()?.startsWith('_'));
}

export interface CoercePersonMarkdown {
  formatted?: string;
  error?: string;
  /** 文首里被去掉的未知字段。bio 不算在这里。 */
  dropped: string[];
  /** 文首里的 bio 已移到正文。 */
  movedBio: boolean;
}

/** 放宽解析，供 people:format 把文首收成规定顺序。解析失败时不返回 formatted。 */
export function coercePersonMarkdown(text: string): CoercePersonMarkdown {
  const normalized = normalizeNewlines(text);
  const matched = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!matched) return { error: '缺少文首：文件要以 --- 开始，并以 --- 结束文首', dropped: [], movedBio: false };
  let parsed: unknown;
  try {
    parsed = parse(matched[1]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `文首无法解析：${detail}`, dropped: [], movedBio: false };
  }
  if (!isRecord(parsed)) return { error: '文首必须是字段表', dropped: [], movedBio: false };

  const dropped: string[] = [];
  const record: Record<string, unknown> = {};
  let frontBio = '';
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'bio') {
      if (typeof value !== 'string') {
        return { error: '文首 bio 必须是字符串', dropped, movedBio: false };
      }
      frontBio = value.trim();
      continue;
    }
    if (!PERSON_MD_KEYS.includes(key as (typeof PERSON_MD_KEYS)[number])) {
      dropped.push(key);
      continue;
    }
    record[key] = value;
  }

  const person = record as unknown as RegistryPerson;
  if (person.sources !== undefined && !Array.isArray(person.sources)) {
    return { error: 'sources 必须是列表', dropped, movedBio: false };
  }
  if (Array.isArray(person.sources)) {
    const sources: SourceRef[] = [];
    for (const source of person.sources) {
      if (!isRecord(source) || typeof source.work !== 'string') {
        return { error: '出处必须有 work', dropped, movedBio: false };
      }
      const unknown = Object.keys(source).find((key) => !SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number]));
      if (unknown) return { error: `出处字段 ${unknown} 不在模板中`, dropped, movedBio: false };
      if (source.kind !== undefined && !SOURCE_KINDS.has(String(source.kind))) {
        return { error: '出处 kind 必须是 classic、modern 或 database', dropped, movedBio: false };
      }
      sources.push(formatSource(source as unknown as SourceRef));
    }
    person.sources = sources;
  }
  const body = matched[2].trim();
  if (frontBio && body) {
    return { error: '文首 bio 与正文同时存在，无法安全合并；请删除其中一份', dropped, movedBio: false };
  }
  const bio = body || frontBio;
  if (bio) person.bio = bio;
  return {
    formatted: formatPersonMarkdown(person),
    dropped,
    movedBio: Boolean(frontBio) && !body,
  };
}
