import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Gender } from '../src/types';
import { loadPipeline } from './load';
import type { PipelineData, RegistryPerson } from './types';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));

interface LaneRule {
  categories?: string[];
  polity?: string[];
  confidence?: 'high' | 'medium';
}

interface Suggestion {
  categories: string[];
  polity: string[];
  gender?: Gender;
}

interface TodoEntry {
  missingCategories: string[];
  missingPolity: string[];
}

/**
 * 泳道推不出、但 tags 能表明身份的情形，作为第二身份追加。
 * hints 为关键词，tag 包含该关键词即命中（如 '名将' 命中 tags 中的 '名将'）。
 * 与 pipeline/vocab/categories.json 的 id 保持一致。
 */
const TAG_CATEGORY_RULES: Array<{ hints: string[]; category: string }> = [
  { hints: ['帝王'], category: 'monarch' },
  { hints: ['霸主', '霸王'], category: 'hegemon' },
  { hints: ['后妃', '太后', '皇后'], category: 'consort' },
  { hints: ['宗室'], category: 'royal-kin' },
  { hints: ['外戚'], category: 'consort-kin' },
  { hints: ['群雄', '军阀'], category: 'warlord' },
  { hints: ['民变', '流贼', '起义', '农民战争', '首义', '首事'], category: 'rebel' },
  { hints: ['权臣', '权相', '辅政', '托孤', '临朝'], category: 'regent' },
  { hints: ['名相', '丞相', '宰相'], category: 'chancellor' },
  { hints: ['名臣', '文臣', '儒臣'], category: 'official' },
  { hints: ['卿士'], category: 'qingshi' },
  { hints: ['谋士', '策略', '策士'], category: 'strategist' },
  { hints: ['纵横', '合纵', '连横', '使节', '和亲'], category: 'diplomat' },
  { hints: ['名将', '宿将', '大将'], category: 'general' },
  { hints: ['航海', '探险', '凿空西域'], category: 'explorer' },
  { hints: ['宦官'], category: 'eunuch' },
  { hints: ['士族'], category: 'gentry' },
  { hints: ['士人'], category: 'scholar-official' },
  { hints: ['隐逸'], category: 'hermit' },
  { hints: ['学者'], category: 'scholar' },
  { hints: ['开国'], category: 'founding' },
  { hints: ['末世', '亡国'], category: 'falling' },

  { hints: ['经学'], category: 'classics' },
  { hints: ['理学', '心学', '道学'], category: 'neo-confucian' },
  { hints: ['玄学', '清谈'], category: 'metaphysics' },
  { hints: ['儒学', '儒家', '孔门'], category: 'confucian' },
  { hints: ['法家', '法术势'], category: 'legalism' },
  { hints: ['黄老', '无为而治'], category: 'huanglao' },
  { hints: ['佛教', '佛学', '高僧', '僧', '禅宗'], category: 'buddhism' },
  { hints: ['道士', '道教'], category: 'daoism' },
  { hints: ['方术'], category: 'fangshu' },

  { hints: ['文学', '诗词', '书画', '诗人', '词人', '辞赋', '文论', '古文运动'], category: 'literature' },
  { hints: ['书法'], category: 'calligraphy' },
  { hints: ['绘画'], category: 'painting' },
  { hints: ['科学'], category: 'science' },
  { hints: ['历算', '天文'], category: 'astronomy' },
  { hints: ['医学', '医药'], category: 'medicine' },
  { hints: ['农学'], category: 'agronomy' },
  { hints: ['工艺', '工程', '营造', '水利', '技术', '将作', '纺织'], category: 'craft' },
  { hints: ['兵家'], category: 'military-theory' },
  { hints: ['史学', '太史', '史记'], category: 'historian' },
  { hints: ['戏曲', '杂剧'], category: 'drama' },
  { hints: ['小说'], category: 'novel' },
];

/**
 * tags 里的地名/政权名 → polity。
 * 与 categories 不同，这里用精确匹配（tag === 词），避免 '楚' 误吃 '楚国'、'汉' 误吃 '汉初' 之类的包含性误伤。
 * 只用于补当前没有 polity 的人；已有 polity 的一律保留原值（applySuggestion 也会跳过）。
 */
const TAG_POLITY_RULES: Array<{ tags: string[]; polity: string }> = [
  { tags: ['秦国', '秦朝', '秦'], polity: 'qin' },

  { tags: ['晋国'], polity: 'jin-guo' },
  { tags: ['韩国', '韩'], polity: 'han-guo' },
  { tags: ['曹国', '曹'], polity: 'cao-guo' },
  { tags: ['楚国', '楚'], polity: 'chu' },
  { tags: ['齐国', '齐'], polity: 'qi' },
  { tags: ['鲁'], polity: 'lu' },
  { tags: ['赵国', '赵'], polity: 'zhao' },
  { tags: ['燕国', '燕'], polity: 'yan' },
  { tags: ['韩国'], polity: 'han-guo' },
  { tags: ['魏国'], polity: 'wei-zhanguo' },
  { tags: ['卫'], polity: 'wei-guo' },
  { tags: ['陈'], polity: 'chen' },
  { tags: ['蔡'], polity: 'cai' },
  { tags: ['郑国', '郑'], polity: 'zheng' },
  { tags: ['越国', '越'], polity: 'yue' },
  { tags: ['宋国'], polity: 'song-guo' },
  { tags: ['中山'], polity: 'zhongshan' },

  { tags: ['楚汉'], polity: 'chu-han' },
  { tags: ['西汉', '东汉', '汉初', '汉'], polity: 'han' },
  { tags: ['新莽'], polity: 'xin' },
  { tags: ['曹魏'], polity: 'wei' },
  { tags: ['蜀汉', '蜀'], polity: 'shu' },
  { tags: ['孙吴', '吴国', '吴'], polity: 'wu' },
  { tags: ['西晋', '东晋', '晋'], polity: 'jin' },
  { tags: ['北朝', '北魏', '东魏', '西魏', '北齐', '北周'], polity: 'bei' },
  { tags: ['南朝', '刘宋', '南齐', '萧梁', '南陈'], polity: 'nan' },
  { tags: ['十六国', '前秦', '后赵', '后燕'], polity: 'shiliuguo' },

  { tags: ['隋'], polity: 'sui' },
  { tags: ['唐'], polity: 'tang' },
  { tags: ['辽金'], polity: 'liao-jin' },
  // 注意：裸 '宋' 不映射 —— 西周宋国诸侯（song-aigong 等）的 tags 只有 '宋'，
  // 与宋朝 '宋' 冲突，宁可留白进 todo.json，也不要标错朝代。
  { tags: ['北宋', '南宋'], polity: 'song' },
  { tags: ['元'], polity: 'yuan' },
  { tags: ['明'], polity: 'ming' },
  { tags: ['清'], polity: 'qing' },

  { tags: ['西域'], polity: 'xiyu' },
  { tags: ['吐蕃'], polity: 'tubo' },
  { tags: ['匈奴'], polity: 'xiongnu' },
  { tags: ['民变'], polity: 'minbian' },
];

const FEMALE_HINTS = ['皇后', '皇太后', '太后', '贵妃', '妃', '婕妤', '夫人', '公主', '郡主', '才人'];
const MALE_HINTS = ['皇帝', '帝', '皇', '王', '公', '侯', '将', '相', '太子', '世子', '公子', '君', '单于', '可汗'];

function readLaneMap(): Map<string, LaneRule> {
  const raw = readFileSync(join(pipelineRoot, 'taxonomy', 'lane-map.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, LaneRule>;
  const map = new Map<string, LaneRule>();
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('_')) continue;
    map.set(key, value);
  }
  return map;
}

/** 逐人手工裁决的最终分类，优先级高于泳道与 tags 推断；categories 覆盖式而非追加。 */
interface Override {
  categories?: string[];
  primary?: string;
}

function readOverrides(): Map<string, Override> {
  const dir = join(pipelineRoot, 'taxonomy', 'overrides');
  const map = new Map<string, Override>();
  if (!existsSync(dir)) return map;
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, Override>;
    for (const [id, value] of Object.entries(parsed)) {
      if (id.startsWith('_')) continue;
      if (map.has(id)) console.warn(`overrides: ${id} 在多个文件中出现，后者覆盖前者（${file}）`);
      map.set(id, value);
    }
  }
  return map;
}

function guessGender(person: RegistryPerson): Gender | undefined {
  const text = [person.title ?? '', person.display ?? '', ...(person.aliases ?? [])].join(' ');
  if (FEMALE_HINTS.some((hint) => text.includes(hint))) return 'female';
  if (MALE_HINTS.some((hint) => text.includes(hint))) return 'male';
  return undefined;
}

function tagCategories(person: RegistryPerson): string[] {
  const tags = person.tags ?? [];
  const found: string[] = [];
  for (const rule of TAG_CATEGORY_RULES) {
    if (tags.some((tag) => rule.hints.some((hint) => tag.includes(hint)))) found.push(rule.category);
  }
  return found;
}

function tagPolities(person: RegistryPerson): string[] {
  const tags = person.tags ?? [];
  const found: string[] = [];
  for (const rule of TAG_POLITY_RULES) {
    if (rule.tags.some((tag) => tags.includes(tag)) && !found.includes(rule.polity)) found.push(rule.polity);
  }
  return found;
}

function collectSuggestions(
  data: PipelineData,
  laneMap: Map<string, LaneRule>,
  overrides: Map<string, Override>,
  onlyTopic?: string,
): Map<string, Suggestion> {
  const suggestions = new Map<string, Suggestion>();
  for (const draft of data.topics) {
    if (onlyTopic && draft.meta.id !== onlyTopic) continue;
    for (const overlay of draft.people) {
      const person = data.people.get(overlay.id);
      if (!person) continue;
      const entry = suggestions.get(overlay.id) ?? { categories: [], polity: [] };
      const rule = laneMap.get(`${draft.meta.id}:${overlay.lane}`);
      for (const category of [...(rule?.categories ?? []), ...tagCategories(person)]) {
        if (!entry.categories.includes(category)) entry.categories.push(category);
      }
      for (const polity of [...(rule?.polity ?? []), ...tagPolities(person)]) {
        if (!entry.polity.includes(polity)) entry.polity.push(polity);
      }
      if (!entry.gender) entry.gender = guessGender(person);
      // overrides 是最终值，覆盖整份 categories，不做并集
      const override = overrides.get(overlay.id);
      if (override?.categories) entry.categories = [...override.categories];
      suggestions.set(overlay.id, entry);
    }
  }
  return suggestions;
}

/** 只插入原本缺失的字段，插在 sources 之前以保持字段语义顺序，避免大范围 diff；overrides 则是覆盖式。 */
function applySuggestion(person: RegistryPerson, suggestion: Suggestion, override?: Override): boolean {
  const file = join(pipelineRoot, 'registry', 'people', `${person.id}.json`);
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

  const updates: Array<[string, unknown]> = [];
  // primary 不自动写，留给编译层按词表 rank 推导；只有 overrides 显式给出才落盘
  if (suggestion.categories.length > 0 && parsed.categories === undefined) updates.push(['categories', suggestion.categories]);
  if (suggestion.polity.length > 0 && parsed.polity === undefined) updates.push(['polity', suggestion.polity]);
  if (suggestion.gender && parsed.gender === undefined) updates.push(['gender', suggestion.gender]);
  if (override?.categories && JSON.stringify(parsed.categories) !== JSON.stringify(override.categories)) {
    updates.push(['categories', override.categories]);
  }
  if (override?.primary && parsed.primary !== override.primary) updates.push(['primary', override.primary]);
  if (updates.length === 0) return false;

  const changes = new Map(updates);
  const next: Record<string, unknown> = {};
  let placed = false;
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'sources' && !placed) {
      for (const [updateKey, updateValue] of changes) {
        if (!(updateKey in parsed)) next[updateKey] = updateValue;
      }
      placed = true;
    }
    next[key] = changes.has(key) ? changes.get(key) : value;
  }
  if (!placed) {
    for (const [updateKey, updateValue] of changes) {
      if (!(updateKey in parsed)) next[updateKey] = updateValue;
    }
  }

  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return true;
}

function main(): void {
  const write = process.argv.includes('--write');
  const topicArg = process.argv.find((arg) => arg.startsWith('--topic='));
  const onlyTopic = topicArg?.slice('--topic='.length);

  const data = loadPipeline(pipelineRoot);
  const laneMap = readLaneMap();
  const overrides = readOverrides();
  const suggestions = collectSuggestions(data, laneMap, overrides, onlyTopic);

  const todo: Record<string, TodoEntry> = {};
  let written = 0;
  let categoryTotal = 0;
  let polityTotal = 0;
  let genderTotal = 0;

  for (const [id, suggestion] of suggestions) {
    const person = data.people.get(id);
    if (!person) continue;

    const override = overrides.get(id);
    const existingCategories = person.categories ?? [];
    const existingPolity = person.polity ?? [];
    const finalCategories = override?.categories ?? (existingCategories.length > 0 ? existingCategories : suggestion.categories);
    const finalPolity = existingPolity.length > 0 ? existingPolity : suggestion.polity;
    const finalGender = person.gender ?? suggestion.gender;

    if (finalCategories.length > 0) categoryTotal += 1;
    if (finalPolity.length > 0) polityTotal += 1;
    if (finalGender) genderTotal += 1;

    if (write) {
      if (applySuggestion(person, suggestion, override)) written += 1;
    }

    if (finalCategories.length === 0 || finalPolity.length === 0) {
      for (const draft of data.topics) {
        if (!draft.people.some((overlay) => overlay.id === id)) continue;
        const entry = todo[draft.meta.id] ?? { missingCategories: [], missingPolity: [] };
        if (finalCategories.length === 0 && !entry.missingCategories.includes(id)) entry.missingCategories.push(id);
        if (finalPolity.length === 0 && !entry.missingPolity.includes(id)) entry.missingPolity.push(id);
        todo[draft.meta.id] = entry;
      }
    }
  }

  const total = suggestions.size;
  const pct = (value: number): string => `${((value / total) * 100).toFixed(1)}%`;
  console.log(`推断范围：${onlyTopic ?? '全部专题'}，涉及人物 ${total} 位`);
  console.log(`categories 覆盖 ${categoryTotal} / ${total}（${pct(categoryTotal)}）`);
  console.log(`polity     覆盖 ${polityTotal} / ${total}（${pct(polityTotal)}）`);
  console.log(`gender     覆盖 ${genderTotal} / ${total}（${pct(genderTotal)}）`);

  const todoTopics = Object.keys(todo).sort();
  if (todoTopics.length > 0) {
    console.log('待人工补齐：');
    for (const topicId of todoTopics) {
      const entry = todo[topicId];
      console.log(`  ${topicId}: 缺 categories ${entry.missingCategories.length} 位，缺 polity ${entry.missingPolity.length} 位`);
    }
  }

  writeFileSync(join(pipelineRoot, 'taxonomy', 'todo.json'), `${JSON.stringify(todo, null, 2)}\n`);

  if (write) {
    console.log(`已写入 ${written} 个人物文件；待补清单见 pipeline/taxonomy/todo.json`);
  } else {
    console.log('dry-run：未改动任何文件，加 --write 落地，加 --topic=<id> 限定专题');
  }
}

main();
