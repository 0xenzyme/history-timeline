import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPersonMarkdown } from './person-md';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const peopleDir = join(pipelineRoot, 'registry', 'people');
const vocabPath = join(pipelineRoot, 'vocab', 'categories.json');
const reviewPath = join(pipelineRoot, 'taxonomy', 'migrate-review.json');

interface CategoryFile {
  id: string;
  name: string;
  rank: number;
}

/** 旧 role → 受控 category，仅限语义一一对应的旧值。 */
const ROLE_MAP: Record<string, string> = {
  monarch: 'monarch',
  consort: 'consort',
  'royal-kin': 'royal-kin',
  outsider: 'outsider',
  rebel: 'rebel',
  eunuch: 'eunuch',
  general: 'general',
  official: 'official',
};

/**
 * 这四个旧 role 语义过宽（thinker 可能是玄学而非儒学，artisan 可能是历算/医药/地理而非工艺），
 * 一律不给默认 category：能由 tags 提取出精确类别词就采用，提取不出则留空并转人工复核。
 */
const LEGACY_ROLES = ['literati', 'thinker', 'artisan', 'cleric'];

/** tags 中的类别词 → category id。命中即从 tags 摘除。一 tag 可导出多个分类（书画）。 */
const TAG_MAP: Record<string, string[]> = {
  帝王: ['monarch'],
  周王: ['monarch'],
  异姓王: ['monarch'],
  霸主: ['hegemon'],
  宗室: ['royal-kin'],
  王室: ['royal-kin'],
  宗室名将: ['royal-kin'],
  后妃: ['consort'],
  外戚: ['consort-kin'],
  权臣: ['regent'],
  权相: ['regent'],
  名相: ['chancellor'],
  名臣: ['minister'],
  文臣: ['official'],
  卿士: ['qingshi'],
  谋士: ['strategist'],
  名将: ['general'],
  将: ['general'],
  云台将: ['general'],
  群雄: ['warlord'],
  士人: ['scholar-official'],
  士族: ['gentry'],
  学者: ['scholar'],
  诗人: ['poetry'],
  词人: ['poetry'],
  诗: ['poetry'],
  宦官: ['eunuch'],
  隐逸: ['hermit'],
  外族: ['outsider'],
  开国: ['founding'],
  末世: ['falling'],
  文学: ['literature'],
  辞赋: ['literature'],
  文论: ['literature'],
  史学: ['historian'],
  经学: ['classics'],
  理学: ['neo-confucian'],
  玄学: ['metaphysics'],
  儒学: ['confucian'],
  孔门: ['confucian'],
  法家: ['legalism'],
  黄老: ['huanglao'],
  佛教: ['buddhism'],
  禅宗: ['buddhism'],
  道教: ['daoism'],
  书法: ['calligraphy'],
  绘画: ['painting'],
  书画: ['calligraphy', 'painting'],
  科学: ['science'],
  地理: ['science'],
  历算: ['astronomy'],
  天文: ['astronomy'],
  医学: ['medicine'],
  医药: ['medicine'],
  农学: ['agronomy'],
  技术: ['craft'],
  工艺: ['craft'],
  工程: ['craft'],
  营造: ['craft'],
  方术: ['fangshu'],
  兵家: ['military-theory'],
  戏曲: ['drama'],
  小说: ['novel'],
};

interface Stats {
  files: number;
  withCategories: number;
  withoutCategories: number;
  categoryValues: number;
  fromRole: number;
  fromTags: number;
  tagWordsRemoved: number;
  tagsEmptied: number;
  withPrimary: number;
  review: number;
  legacyResolved: number;
  written: number;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? (value.filter((item): item is string => typeof item === 'string')) : [];
}

/** 字段插入在 sources 之前，与 registry 现有人物文件的键序保持一致。 */
function rebuild(
  parsed: Record<string, unknown>,
  categories: string[],
  primary: string | undefined,
  nextTags: string[],
  hadTags: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  let placed = false;

  const place = (): void => {
    if (placed) return;
    if (categories.length > 0) next.categories = categories;
    if (primary) next.primary = primary;
    placed = true;
  };

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'role') continue;
    if (key === 'tags') {
      if (nextTags.length > 0 || !hadTags) next.tags = nextTags;
      continue;
    }
    if (key === 'sources') place();
    next[key] = value;
  }
  place();
  return next;
}

function main(): void {
  const write = process.argv.includes('--write');

  const vocab = JSON.parse(readFileSync(vocabPath, 'utf8')) as CategoryFile[];
  const known = new Set(vocab.map((item) => item.id));
  const order = new Map(vocab.map((item, index) => [item.id, index]));
  /** 多值无序，但落盘按词表 rank 从高到低排列，保证 diff 稳定可读。 */
  const sortCategories = (ids: string[]): string[] =>
    [...new Set(ids)].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));

  const stats: Stats = {
    files: 0,
    withCategories: 0,
    withoutCategories: 0,
    categoryValues: 0,
    fromRole: 0,
    fromTags: 0,
    tagWordsRemoved: 0,
    tagsEmptied: 0,
    withPrimary: 0,
    review: 0,
    legacyResolved: 0,
    written: 0,
  };
  const review: Record<string, { legacyRole: string; tags: string[] }> = {};
  const unknownIds = new Set<string>();
  const files = readdirSync(peopleDir).filter((name) => name.endsWith('.json')).sort();

  // 先完整检查输入，再进入写入循环，避免坏记录出现在中途时留下半迁移目录。
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(peopleDir, file), 'utf8')) as Record<string, unknown>;
    for (const key of ['role', 'tags', 'categories']) {
      const value = parsed[key];
      if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
        throw new Error(`${file}: ${key} 必须是字符串数组`);
      }
    }
  }

  for (const file of files) {
    const path = join(peopleDir, file);
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    stats.files += 1;

    /** 迁移依赖 role，二次运行时 role 已删除，继续处理会抹掉已写入的 categories/primary。 */
    if (parsed.categories !== undefined || parsed.primary !== undefined) {
      if (readStrings(parsed.categories).length > 0) stats.withCategories += 1;
      else stats.withoutCategories += 1;
      continue;
    }

    const oldRole = readStrings(parsed.role);
    const tags = readStrings(parsed.tags);

    const roleCategories = oldRole.map((role) => ROLE_MAP[role]).filter((id): id is string => Boolean(id));
    const legacyRole = oldRole.find((role) => LEGACY_ROLES.includes(role));

    const tagCategories: string[] = [];
    const nextTags: string[] = [];
    for (const tag of tags) {
      const mapped = TAG_MAP[tag];
      if (mapped) {
        tagCategories.push(...mapped);
        stats.tagWordsRemoved += 1;
        continue;
      }
      nextTags.push(tag);
    }

    const categories = sortCategories([...roleCategories, ...tagCategories]);
    for (const id of categories) if (!known.has(id)) unknownIds.add(id);
    const primary = oldRole.length > 0 ? ROLE_MAP[oldRole[0]] : undefined;

    if (categories.length > 0) stats.withCategories += 1;
    else stats.withoutCategories += 1;
    stats.categoryValues += categories.length;
    stats.fromRole += roleCategories.length;
    stats.fromTags += sortCategories(tagCategories).length;
    if (primary) stats.withPrimary += 1;
    if (tags.length > 0 && nextTags.length === 0) stats.tagsEmptied += 1;

    if (legacyRole && tagCategories.length === 0) {
      review[String(parsed.id)] = { legacyRole, tags };
      stats.review += 1;
    } else if (legacyRole && tagCategories.length > 0) {
      stats.legacyResolved += 1;
    }

    if (write) {
      const markdown = findPersonMarkdown(join(pipelineRoot, '..', 'content'), String(parsed.id));
      if (markdown) {
        console.warn(`${String(parsed.id)} 在 ${markdown}，分类迁移不改 Markdown`);
        continue;
      }
      const next = rebuild(parsed, categories, primary, nextTags, 'tags' in parsed);
      writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
      stats.written += 1;
    }
  }

  /** 清单为空时不覆盖既有文件，避免二次运行把人工复核线索清掉。 */
  if (write && Object.keys(review).length > 0) writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

  console.log(`扫描 ${stats.files} 个人物文件（${write ? '写入模式' : 'dry-run'}）`);
  console.log(`获得 categories：${stats.withCategories} 人，仍无分类：${stats.withoutCategories} 人`);
  console.log(`category 值总数：${stats.categoryValues}（来自 role ${stats.fromRole}，来自 tags ${stats.fromTags}）`);
  console.log(`从 tags 摘除类别词：${stats.tagWordsRemoved} 词次；tags 被清空的文件：${stats.tagsEmptied}`);
  console.log(`写入 primary：${stats.withPrimary} 人`);
  console.log(`旧 role 为 literati/thinker/artisan/cleric 者：${stats.legacyResolved} 人由 tags 定类，${stats.review} 人无类别词、转人工复核 → pipeline/taxonomy/migrate-review.json`);
  if (unknownIds.size > 0) console.log(`警告：未在 vocab 中的 category：${[...unknownIds].join(', ')}`);
  if (write) console.log(`已写入 ${stats.written} 个文件`);
  else console.log('dry-run：人物文件未改动，加 --write 落地');
}

main();
