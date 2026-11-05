export const CONTRACT_VERSION = 1;

export type Accuracy = 'exact' | 'approx' | 'disputed' | 'unknown';

export type Gender = 'female' | 'male' | 'unknown';

export interface Lane {
  id: string;
  name: string;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  display: string;
  lane: string;
  birth?: number;
  birthAccuracy: Accuracy;
  death?: number;
  deathAccuracy: Accuracy;
  birthNote?: string;
  deathNote?: string;
  title?: string;
  bio?: string;
  tags?: string[];
  /** 受控分类，取自 vocab/categories.json。多值无序，一人兼具几重身份就写几个（褚遂良 = official + calligraphy） */
  categories?: string[];
  /** 主分类，用于跨专题展示与配色；缺省时按词表 rank 取最高者 */
  primary?: string;
  /** 政权归属，取自 vocab/polities.json */
  polity?: string[];
  gender?: Gender;
  /** 同一泳道内生年相同时的排序优先级，越小越靠前 */
  order?: number;
}

/** 出处。事件实体把出处带到前端，人物编译产物不带。 */
export interface SourceRef {
  work: string;
  part?: string;
  note?: string;
  /** 出处类型：典籍 / 现代考证 / 外部数据库（只作候选）。省略按 classic 处理 */
  kind?: 'classic' | 'modern' | 'database';
}

export type EventType = 'military' | 'political' | 'rebellion' | 'institutional' | 'diplomatic' | 'cultural';

/** 军事事件的规模。仅 type=military 时有值。 */
export type EventScale = 'war' | 'campaign' | 'battle' | 'engagement';

export type EventImportance = 1 | 2 | 3;

/** 事件可以被一个或两个目录引用；目录归属不改变事件事实分类。 */
export type EventCatalog = 'military' | 'history';

/** 主将。side 取 belligerents 中的政权 id，可省略。 */
export interface EventCommander {
  id: string;
  side?: string;
}

/** 朝代年份区间。只用于筛选与分段标签，不用于推导事件归属。区间可重叠。 */
export interface DynastyTerm {
  id: string;
  name: string;
  from: number;
  to: number;
}

/** 编译后的事件实体。kind 由 endYear 推导，不录入。 */
export interface EventRecord {
  id: string;
  name: string;
  display: string;
  kind: EventKind;
  type: EventType;
  catalogs?: EventCatalog[];
  scale?: EventScale;
  importance: EventImportance;
  year: number;
  yearAccuracy: Accuracy;
  yearNote?: string;
  endYear?: number;
  endYearAccuracy?: Accuracy;
  endYearNote?: string;
  place?: string;
  placeNow?: string;
  belligerents?: string[];
  polity?: string[];
  commanders?: EventCommander[];
  people?: string[];
  result?: string;
  parent?: string;
  aliases?: string[];
  tags?: string[];
  /** 年份落在哪些朝代区间内，仅筛选用 */
  dynasties?: string[];
  desc?: string;
  sources: SourceRef[];
}

/** 世纪分段。稀疏段会与相邻段合并，label 取首尾。 */
export interface CenturySegment {
  id: string;
  label: string;
  from: number;
  to: number;
  /** 段内事件 id，按 year 升序、同年报 importance 降序 */
  events: string[];
}

/** 军事目录 / 历史事件目录的编译视图。两者共用一套 EventRecord。 */
export interface EventLineView {
  contractVersion: number;
  id: 'military' | 'history';
  title: string;
  subtitle?: string;
  range: [number, number];
  segments: CenturySegment[];
  dynasties: DynastyTerm[];
  events: EventRecord[];
}

/** 顶层内容线。people 按朝代专题组织，另两条按时间组织。 */
export interface CatalogLine {
  id: 'people' | 'military' | 'history';
  title: string;
  subtitle?: string;
  axis: 'topic' | 'time';
  file?: string;
  range?: [number, number];
}

export interface RelationType {
  id: string;
  name: string;
  color: string;
  dash: string | null;
  directed: boolean;
}

export interface Relation {
  source: string;
  target: string;
  type: string;
  since?: number;
  note?: string;
}

export type EventKind = 'point' | 'span';

export interface TimelineEvent {
  id: string;
  name: string;
  kind: EventKind;
  year: number;
  endYear?: number;
  people?: string[];
  desc?: string;
}

export interface View {
  id: string;
  name: string;
  from: number;
  to: number;
  brief?: string;
  focus?: string;
  people?: string[];
  events?: string[];
}

export interface Topic {
  contractVersion: number;
  meta: {
    id: string;
    title: string;
    subtitle: string;
    range: [number, number];
  };
  lanes: Lane[];
  people: Person[];
  relationTypes: RelationType[];
  relations: Relation[];
  events: TimelineEvent[];
  views: View[];
}

export interface VocabTerm {
  id: string;
  name: string;
}

/** 受控分类词条，rank 用于在未显式指定 primary 时推导主分类，越大越优先 */
export interface CategoryTerm {
  id: string;
  name: string;
  rank: number;
}

export interface CatalogEntry {
  id: string;
  title: string;
  subtitle: string;
  file: string;
  region: string;
  eras: string[];
  themes: string[];
}

export interface Catalog {
  contractVersion: number;
  regions: VocabTerm[];
  eras: VocabTerm[];
  themes: VocabTerm[];
  categories: CategoryTerm[];
  topics: CatalogEntry[];
  /** 政权词表。事件卡要用它把 belligerents 的 id 翻成中文名。 */
  polities?: VocabTerm[];
  /** 三条内容线。人物按专题组织，军事与历史事件按时间组织。 */
  lines?: CatalogLine[];
}

export interface TopicFilters {
  region: string | null;
  era: string | null;
  theme: string | null;
  /** 事件线按朝代区间筛选。只用于两条时间线。 */
  dynasty: string | null;
}

/** 跨专题搜索用的瘦索引，由管线编译，不含简介。人物与事件共用，用 kind 区分。 */
export interface SearchRecord {
  id: string;
  name: string;
  display: string;
  title?: string;
  tags?: string[];
  categories?: string[];
  primary?: string;
  polity?: string[];
  gender?: Gender;
  birth?: number;
  death?: number;
  birthAccuracy?: Accuracy;
  deathAccuracy?: Accuracy;
  /** 人物省略此字段，即视为 person。事件行填 event。 */
  kind?: 'person' | 'event';
  year?: number;
  endYear?: number;
  yearAccuracy?: Accuracy;
  type?: EventType;
  catalogs?: EventCatalog[];
  importance?: EventImportance;
  topicId: string;
  topicTitle: string;
}
