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
}

export interface TopicFilters {
  region: string | null;
  era: string | null;
  theme: string | null;
}

/** 跨专题搜索用的瘦索引，由管线编译，不含简介。 */
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
  birthAccuracy: Accuracy;
  deathAccuracy: Accuracy;
  topicId: string;
  topicTitle: string;
}
