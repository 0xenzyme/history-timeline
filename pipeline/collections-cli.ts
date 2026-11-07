import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COLLECTION_DIR,
  COLLECTION_ID_PATTERN,
  COLLECTION_INDEX_NAME,
  COLLECTION_TEMPLATE,
  coerceCollectionMarkdown,
  collectionIndexRows,
  formatCollectionIndex,
  formatCollectionMarkdown,
  parseCollectionMarkdown,
  publishedCollectionMarkdown,
  readCollectionMarkdown,
} from './collection-md';
import { lintCollections } from './lint';
import { loadPipeline } from './load';
import type { LintMessage } from './types';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(pipelineRoot, '..', 'content');
const collectionDir = join(contentRoot, COLLECTION_DIR);

function usage(): void {
  console.error('用法：npm run collections:check；npm run collections:format；npm run collections:new -- <id>');
  process.exit(1);
}

function report(messages: LintMessage[]): void {
  for (const message of messages.filter((item) => item.level === 'warning')) {
    console.warn(`warning ${message.path}: ${message.message}`);
  }
  const errors = messages.filter((item) => item.level === 'error');
  if (errors.length > 0) {
    console.error(errors.map((item) => `error ${item.path}: ${item.message}`).join('\n'));
    process.exit(1);
  }
}

function commandCheck(): void {
  const files = readCollectionMarkdown(contentRoot);
  report(files.flatMap((file) => file.messages));
  const data = loadPipeline(pipelineRoot);
  report(lintCollections(data));
  console.log(`collections check passed：模板 1，索引 1，已发布 ${publishedCollectionMarkdown(files).length} 个`);
}

function rewriteIndex(): boolean {
  const files = readdirSync(collectionDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort()
    .map((name) =>
      parseCollectionMarkdown(readFileSync(join(collectionDir, name), 'utf8'), `content/${COLLECTION_DIR}/${name}`),
    );
  const rows = collectionIndexRows(files);
  if (!rows) return false;
  const next = formatCollectionIndex(rows);
  const indexFull = join(contentRoot, COLLECTION_INDEX_NAME);
  if (existsSync(indexFull) && readFileSync(indexFull, 'utf8').replace(/\r\n/g, '\n') === next) return false;
  writeFileSync(indexFull, next);
  console.log(`已整理 content/${COLLECTION_INDEX_NAME}`);
  return true;
}

function commandFormat(): void {
  if (!existsSync(collectionDir)) {
    console.error('没有 content/collections/，先运行 collections:new');
    process.exit(1);
  }
  const plans = readdirSync(collectionDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort()
    .map((name) => {
      const full = join(collectionDir, name);
      const original = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
      const result = coerceCollectionMarkdown(original);
      if (result.error || !result.formatted) {
        console.error(`content/${COLLECTION_DIR}/${name}: ${result.error ?? '无法整理'}`);
        process.exit(1);
      }
      return { full, original, formatted: result.formatted, name };
    });
  let changed = 0;
  for (const plan of plans) {
    if (plan.original === plan.formatted) continue;
    writeFileSync(plan.full, plan.formatted);
    changed += 1;
    console.log(`已整理 content/${COLLECTION_DIR}/${plan.name}`);
  }
  if (rewriteIndex()) changed += 1;
  console.log(changed === 0 ? 'Collection Markdown 已是规定格式' : `整理了 ${changed} 个文件`);
}

function commandNew(id: string | undefined): void {
  if (!id || !COLLECTION_ID_PATTERN.test(id)) {
    console.error('id 必须是小写 kebab-case');
    process.exit(1);
  }
  const target = join(collectionDir, `${id}.md`);
  if (existsSync(target)) {
    console.error(`Collection ${id} 已存在，不新建`);
    process.exit(1);
  }
  mkdirSync(collectionDir, { recursive: true });
  writeFileSync(
    target,
    formatCollectionMarkdown({
      ...COLLECTION_TEMPLATE,
      id,
      members: COLLECTION_TEMPLATE.members.map((member) => ({ ...member })),
      sources: COLLECTION_TEMPLATE.sources.map((source) => ({ ...source })),
    }),
  );
  if (!existsSync(join(contentRoot, COLLECTION_INDEX_NAME))) {
    writeFileSync(join(contentRoot, COLLECTION_INDEX_NAME), formatCollectionIndex([]));
  }
  console.log(`已写 content/${COLLECTION_DIR}/${id}.md`);
  console.log('这是 draft 骨架。核实策展说明、成员和出处后才能改为 published。');
}

export function runCollectionsCommand(argv: string[]): void {
  const command = argv[0];
  if (command === 'check') commandCheck();
  else if (command === 'format') commandFormat();
  else if (command === 'new') commandNew(argv[1]);
  else usage();
}
