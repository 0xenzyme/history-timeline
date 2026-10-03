import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lintRegistryPerson } from './lint';
import {
  BRIEF_TEMPLATE,
  PERSON_ID_PATTERN,
  coercePersonMarkdown,
  findPersonMarkdown,
  formatPersonMarkdown,
  formatTopicIndex,
  parsePersonMarkdown,
  publishedPersonMarkdown,
  readContentMarkdown,
  topicIndexRows,
  type TopicIndexContext,
} from './person-md';
import type { LintMessage } from './types';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pipelineRoot, '..');
const contentRoot = join(repoRoot, 'content');

function usage(): void {
  console.error(`用法：
  npm run people:check
  npm run people:format
  npm run people:new -- <topic> <id>`);
  process.exit(1);
}

function topicContexts(): TopicIndexContext[] {
  const order = JSON.parse(readFileSync(join(pipelineRoot, 'topics.json'), 'utf8')) as string[];
  return order.map((id) => {
    const topic = JSON.parse(readFileSync(join(pipelineRoot, 'topics', id, 'topic.json'), 'utf8')) as {
      meta: { title: string };
      people: Array<{ id: string }>;
    };
    return { id, title: topic.meta.title, people: topic.people.map((person) => person.id) };
  });
}

function vocabIds(name: string): Set<string> {
  const rows = JSON.parse(readFileSync(join(pipelineRoot, 'vocab', name), 'utf8')) as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

function commandCheck(): void {
  const topics = topicContexts();
  const files = readContentMarkdown(contentRoot, topics);
  const messages: LintMessage[] = files.flatMap((file) => file.messages);
  const jsonIds = new Set(
    readdirSync(join(pipelineRoot, 'registry', 'people'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length)),
  );
  const categoryIds = vocabIds('categories.json');
  const polityIds = vocabIds('polities.json');

  for (const file of publishedPersonMarkdown(files)) {
    if (!file.person) continue;
    if (jsonIds.has(file.person.id)) {
      messages.push({
        level: 'error',
        path: file.path,
        message: `与 pipeline/registry/people/${file.person.id}.json 重复`,
      });
    }
    messages.push(...lintRegistryPerson(file.person, categoryIds, polityIds, file.path));
  }

  const warnings = messages.filter((item) => item.level === 'warning');
  const errors = messages.filter((item) => item.level === 'error');
  for (const item of warnings) console.warn(`warning ${item.path}: ${item.message}`);
  if (errors.length > 0) {
    console.error(errors.map((item) => `error ${item.path}: ${item.message}`).join('\n'));
    process.exit(1);
  }
  const published = publishedPersonMarkdown(files).length;
  const indexes = topics.filter((topic) => existsSync(join(contentRoot, topic.id))).length;
  console.log(`people check passed：模板 2，索引 ${indexes}，待编译人物 ${published}`);
}

function rewriteTopicIndex(topic: TopicIndexContext): boolean {
  const directory = join(contentRoot, topic.id);
  if (!existsSync(directory)) return false;
  const names = readdirSync(directory).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort();
  const files = names.map((name) => parsePersonMarkdown(
    readFileSync(join(directory, name), 'utf8'),
    `content/${topic.id}/${name}`,
  ));
  const rows = topicIndexRows(topic.people, files);
  if (!rows) return false;
  const next = formatTopicIndex(topic.id, topic.title, rows);
  const indexPath = join(contentRoot, `${topic.id}.md`);
  const current = existsSync(indexPath) ? readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current === next) return false;
  writeFileSync(indexPath, next);
  console.log(`已整理 content/${topic.id}.md`);
  return true;
}

function commandFormat(): void {
  const topics = topicContexts();
  let changed = 0;
  const plans: Array<{ path: string; full: string; original: string; formatted: string; result: ReturnType<typeof coercePersonMarkdown> }> = [];
  let failed = false;
  for (const topic of topics) {
    const directory = join(contentRoot, topic.id);
    if (!existsSync(directory)) continue;
    const names = readdirSync(directory).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort();
    for (const name of names) {
      const path = `content/${topic.id}/${name}`;
      const full = join(directory, name);
      const original = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
      const result = coercePersonMarkdown(original);
      if (result.error || !result.formatted) {
        console.error(`${path}: ${result.error ?? '无法整理'}`);
        process.exitCode = 1;
        failed = true;
        continue;
      }
      plans.push({ path, full, original, formatted: result.formatted, result });
    }
  }
  if (failed) process.exit(process.exitCode ?? 1);

  for (const plan of plans) {
    if (plan.result.dropped.length > 0) console.warn(`${plan.path}: 去掉文首字段 ${plan.result.dropped.join('、')}`);
    if (plan.result.movedBio) console.warn(`${plan.path}: bio 已从文首移到正文`);
    if (plan.formatted === plan.original) continue;
    writeFileSync(plan.full, plan.formatted);
    changed += 1;
    console.log(`已整理 ${plan.path}`);
  }
  for (const topic of topics) {
    if (rewriteTopicIndex(topic)) changed += 1;
  }
  console.log(changed === 0 ? '人物 Markdown 已是规定格式' : `整理了 ${changed} 个文件`);
}

function commandNew(topicId: string | undefined, id: string | undefined): void {
  const topics = topicContexts();
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) {
    console.error('第一个参数是专题 id，例如 qin');
    process.exit(1);
  }
  if (!id || !PERSON_ID_PATTERN.test(id)) {
    console.error('id 必须是小写 kebab-case，例如 ying-zheng');
    process.exit(1);
  }
  const markdown = join(contentRoot, topic.id, `${id}.md`);
  const json = join(pipelineRoot, 'registry', 'people', `${id}.json`);
  const existing = findPersonMarkdown(contentRoot, id);
  if (existsSync(markdown) || existsSync(json) || existing) {
    console.error(`人物 ${id} 已存在，不新建${existing ? `：${existing}` : ''}`);
    process.exit(1);
  }
  mkdirSync(join(contentRoot, topic.id), { recursive: true });
  const person = {
    ...BRIEF_TEMPLATE,
    id,
    sources: BRIEF_TEMPLATE.sources.map((source) => ({ ...source })),
  };
  writeFileSync(markdown, formatPersonMarkdown(person));
  rewriteTopicIndex(topic);
  console.log(`已写 content/${topic.id}/${id}.md`);
  console.log('这是简表骨架。改 name、display、gender、polity 和出处，并补上至少一个年份。模板里的占位不能编译上轴。');
}

const command = process.argv[2];
if (command === 'check') commandCheck();
else if (command === 'format') commandFormat();
else if (command === 'new') commandNew(process.argv[3], process.argv[4]);
else usage();
