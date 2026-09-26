import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const peopleDir = join(pipelineRoot, 'registry', 'people');
const vocabPath = join(pipelineRoot, 'vocab', 'categories.json');
const overridesDir = join(pipelineRoot, 'taxonomy', 'overrides');

/**
 * 这几位由 team-lead 直接手工标注，不进 overrides 流程：即便表里有同名条目也整条跳过，
 * 避免专题表把人工复核结果悄悄改回去。
 */
const PROTECTED_IDS = new Set(['wang-mang', 'tao-hongjing', 'ruan-ji']);

interface OverrideEntry {
  categories: string[];
  primary?: string;
}

interface CategoryFile {
  id: string;
  name: string;
  rank: number;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isEntry(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 覆盖式写入：categories/primary 统一插在 sources 之前，与既有文件键序一致。 */
function applyEntry(parsed: Record<string, unknown>, entry: OverrideEntry): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  let placed = false;

  const place = (): void => {
    if (placed) return;
    next.categories = entry.categories;
    if (entry.primary) next.primary = entry.primary;
    placed = true;
  };

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'categories' || key === 'primary') continue;
    if (key === 'sources') place();
    next[key] = value;
  }
  place();
  return next;
}

function main(): void {
  const write = process.argv.includes('--write');

  if (!existsSync(overridesDir)) {
    console.error(`overrides 目录不存在：${overridesDir}`);
    process.exitCode = 1;
    return;
  }

  const vocab = JSON.parse(readFileSync(vocabPath, 'utf8')) as CategoryFile[];
  const known = new Set(vocab.map((item) => item.id));

  const files = readdirSync(overridesDir).filter((name) => name.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('overrides 目录为空，无事可做');
    return;
  }

  const errors: string[] = [];
  const protectedHits: string[] = [];
  const targets = new Map<string, { entry: OverrideEntry; tables: string[] }>();

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(overridesDir, file), 'utf8')) as unknown;
    if (!isEntry(raw)) {
      errors.push(`${file}: 顶层不是对象`);
      continue;
    }
    for (const [id, value] of Object.entries(raw)) {
      /** `_` 开头是表内的说明性键，与 lane-map.json 的约定一致，不参与人物匹配。 */
      if (id.startsWith('_')) continue;
      if (PROTECTED_IDS.has(id)) {
        protectedHits.push(`${id}（${file}）`);
        continue;
      }
      if (!isEntry(value)) {
        errors.push(`${file}: ${id} 不是对象`);
        continue;
      }
      const categories = readStrings(value.categories);
      const primary = typeof value.primary === 'string' ? value.primary : undefined;

      if (categories.length === 0) errors.push(`${file}: ${id} 缺少 categories`);
      if (value.primary !== undefined && !primary) errors.push(`${file}: ${id} 的 primary 不是字符串`);
      for (const category of categories) {
        if (!known.has(category)) errors.push(`${file}: ${id} 的 category ${category} 不在词表内`);
      }
      if (primary && !categories.includes(primary)) {
        errors.push(`${file}: ${id} 的 primary ${primary} 不在 categories 中`);
      }
      if (!existsSync(join(peopleDir, `${id}.json`))) {
        errors.push(`${file}: 人物 ${id} 不存在`);
      }
      const previous = targets.get(id);
      if (previous) {
        /** 跨表重复按团队裁定：categories 取并集，primary 取文件名字母序在前的那张表。 */
        for (const category of categories) {
          if (!previous.entry.categories.includes(category)) previous.entry.categories.push(category);
        }
        previous.tables.push(file);
        continue;
      }
      targets.set(id, { entry: { categories: [...categories], primary }, tables: [file] });
    }
  }

  console.log(`套用 ${files.length} 张表：${files.join('、')}`);
  if (errors.length > 0) {
    console.log(`校验失败 ${errors.length} 项，已中止：${write ? '未写入任何文件' : 'dry-run'}`);
    for (const message of errors.slice(0, 40)) console.log(`  - ${message}`);
    if (errors.length > 40) console.log(`  ... 另有 ${errors.length - 40} 项`);
    process.exitCode = 1;
    return;
  }

  const droppedPrimary: string[] = [];
  for (const [id, target] of targets) {
    const path = join(peopleDir, `${id}.json`);
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    if (!target.entry.primary && parsed.primary !== undefined) droppedPrimary.push(id);
    if (write) writeFileSync(path, `${JSON.stringify(applyEntry(parsed, target.entry), null, 2)}\n`);
  }

  if (protectedHits.length > 0) {
    console.log(`手工标注保护，已整条跳过 ${protectedHits.length} 处：${protectedHits.join('、')}`);
  }

  const cross = [...targets.entries()].filter(([, target]) => target.tables.length > 1);
  if (cross.length > 0) {
    console.log(`跨表重复 ${cross.length} 人（categories 取并集，primary 取字母序在前的表）：`);
    for (const [id, target] of cross) {
      console.log(`  ${id} ← ${target.tables.join(' + ')} → [${target.entry.categories.join('/')}] primary=${target.entry.primary ?? '(未指定)'}`);
    }
  }
  console.log(`校验通过，覆盖 ${targets.size} 人`);
  if (droppedPrimary.length > 0) {
    console.log(`表中未给 primary、按覆盖语义移除原 primary 的 ${droppedPrimary.length} 人：${droppedPrimary.join('、')}`);
  }
  console.log(write ? `已写入 ${targets.size} 个文件` : 'dry-run：未改动任何文件，加 --write 落地');
}

main();
