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

/** 出处。人物详情、事件、作品、个人经历与 Collection 共用同一书目结构。 */
export interface SourceRef {
  work: string;
  part?: string;
  note?: string;
  /** 出处类型：典籍 / 现代考证 / 外部数据库（只作候选）。省略按 classic 处理 */
  kind?: 'classic' | 'modern' | 'database';
}

export type WorkKind = 'poetry' | 'prose' | 'calligraphy' | 'painting' | 'music' | 'book' | 'other';

export interface PersonWork {
  id: string;
  title: string;
  kind?: WorkKind;
  year?: number;
  yearAccuracy?: Accuracy;
  yearNote?: string;
  note?: string;
  sources: SourceRef[];
}

export interface PersonExperience {
  id: string;
  label: string;
  year?: number;
  yearAccuracy: Accuracy;
  yearNote?: string;
  endYear?: number;
  endYearAccuracy?: Accuracy;
  endYearNote?: string;
  place?: string;
  note: string;
  event?: string;
  sources: SourceRef[];
}

export interface EventPartRef {
  id: string;
  note: string;
  sources: SourceRef[];
}

export interface PersonEventRef {
  id: string;
  roles: Array<'person' | 'commander'>;
}

export interface PersonRelation extends Relation {
  directed: boolean;
  notes: string[];
  topicIds: string[];
}

export interface PersonDetail {
  contractVersion: number;
  id: string;
  name: string;
  display: string;
  birth?: number;
  birthAccuracy: Accuracy;
  death?: number;
  deathAccuracy: Accuracy;
  birthNote?: string;
  deathNote?: string;
  title?: string;
  bio?: string;
  profile: 'brief' | 'full';
  tags?: string[];
  aliases?: string[];
  categories?: string[];
  primary?: string;
  polity?: string[];
  gender?: Gender;
  topics: Array<{ id: string; title: string; lane: string }>;
  relations: PersonRelation[];
  events: PersonEventRef[];
  collections: string[];
  works?: PersonWork[];
  experiences?: PersonExperience[];
  sources: SourceRef[];
}

export type CollectionView = 'overview' | 'members' | 'timeline' | 'relations' | 'events' | 'works';

export interface CollectionMember {
  id: string;
  order: number;
  featured?: boolean;
  role?: string;
}

export interface CollectionRelationRef {
  source: string;
  target: string;
  type: string;
}

export interface CollectionStep {
  label: string;
  person?: string;
  event?: string;
  view?: CollectionView;
}

export interface RegistryCollection {
  id: string;
  status: 'draft' | 'published';
  name: string;
  aliases?: string[];
  category: string;
  summary: string;
  body?: string;
  tags?: string[];
  featuredOrder?: number;
  cover?: MediaRef;
  members: CollectionMember[];
  relations?: CollectionRelationRef[];
  events?: string[];
  dynasties?: string[];
  views: CollectionView[];
  defaultView: CollectionView;
  path?: CollectionStep[];
  sources: SourceRef[];
}

export interface MediaRef {
  src: string;
  alt: string;
  credit?: string;
  license?: string;
}

export type DynastyGroup =
  'pre-qin' | 'qin-han' | 'weijin-nanbei' | 'sui-tang-wudai' | 'song-liao-jin-yuan' | 'ming-qing' | 'minguo';

export interface DynastyProfile {
  id: string;
  aliases?: string[];
  summary?: string;
  body?: string;
  note?: string;
  capitals?: Array<{ name: string; note?: string }>;
  founders?: Array<{ id: string; note?: string }>;
  topics?: string[];
  group: DynastyGroup;
  featuredPeople?: string[];
  featuredEvents?: string[];
  collections?: string[];
  cover?: MediaRef;
  sources: SourceRef[];
}

export interface EraSummary extends DynastyTerm {
  contractVersion: number;
  aliases?: string[];
  summary?: string;
  group: DynastyGroup;
  personCount: number;
  eventCount: number;
}

export interface EraDetail extends EraSummary {
  body?: string;
  note?: string;
  capitals?: DynastyProfile['capitals'];
  founderRecords: Person[];
  topics: string[];
  people: Person[];
  events: EventRecord[];
  collections: string[];
  collectionRecords: CollectionSummary[];
  cover?: MediaRef;
  sources: SourceRef[];
}

export interface HomeEditorial {
  dynasties: string[];
  collections: string[];
}

export interface CollectionSummary {
  contractVersion: number;
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  summary: string;
  tags?: string[];
  featuredOrder?: number;
  cover?: MediaRef;
  memberCount: number;
  featuredMembers: Person[];
}

export interface CollectionDetail extends RegistryCollection {
  contractVersion: number;
  people: Person[];
  resolvedRelations: PersonRelation[];
  eventRecords: EventRecord[];
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
  partOf?: EventPartRef[];
  aliases?: string[];
  tags?: string[];
  /** 年份落在哪些朝代区间内，仅筛选用 */
  dynasties?: string[];
  desc?: string;
  sources: SourceRef[];
}

export interface EventComponent extends EventPartRef {
  event: EventRecord;
}

export interface EventDetail extends EventRecord {
  contractVersion: number;
  children: string[];
  components: EventComponent[];
  personRecords: Person[];
  collections: string[];
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
  collectionCategories?: VocabTerm[];
  editorial?: HomeEditorial;
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
  aliases?: string[];
  bio?: string;
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
