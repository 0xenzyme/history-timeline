import type {
  Accuracy,
  DynastyTerm,
  EventCommander,
  EventImportance,
  EventScale,
  EventType,
  Gender,
  Lane,
  Relation,
  RelationType,
  SourceRef,
  TimelineEvent,
  View,
} from '../src/types';

export type { DynastyTerm, SourceRef };

/** 事件登记。kind 由 endYear 推导，不录入；desc 只从 Markdown 正文来。 */
export interface RegistryEvent {
  id: string;
  name: string;
  /** 轴上短标签。name 过长时必填 */
  display?: string;
  type: EventType;
  /** 仅 type=military 时有值 */
  scale?: EventScale;
  importance: EventImportance;
  year: number;
  yearAccuracy: Accuracy;
  yearNote?: string;
  endYear?: number;
  endYearAccuracy?: Accuracy;
  place?: string;
  placeNow?: string;
  belligerents?: string[];
  polity?: string[];
  commanders?: EventCommander[];
  people?: string[];
  result?: string;
  /** 父事件 id，只允许两层：战争 → 其下战役 */
  parent?: string;
  aliases?: string[];
  tags?: string[];
  sources: SourceRef[];
  desc?: string;
}

export interface RegistryPerson {
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
  tags?: string[];
  aliases?: string[];
  /** 受控分类，取自 vocab/categories.json。多值无序，一人兼具几重身份就写几个 */
  categories?: string[];
  /** 主分类，用于跨专题展示与配色；缺省时按词表 rank 取最高者 */
  primary?: string;
  /** 政权归属，取自 vocab/polities.json，可多值（如伍子胥 = chu + wu-guo） */
  polity?: string[];
  gender?: Gender;
  /**
   * 简表 brief：只够上轴。详表 full：已写 bio，并应补关系。
   * 缺省时，有 bio 视为 full，否则视为 brief。
   */
  profile?: 'brief' | 'full';
  sources: SourceRef[];
}

/** 专题待收台账。只放还没进简表的人，以及明确不收的人。 */
export interface CandidateEntry {
  id: string;
  name: string;
  display?: string;
  /** 该专题 topic.json 里已有的泳道 id */
  seat: string;
  status: 'pending' | 'rejected';
  /** 待核年份依据。pending 必填 */
  anchor?: string;
  /** 不收的原因。rejected 必填 */
  reason?: string;
  sources?: SourceRef[];
}

export interface CandidateFile {
  people: CandidateEntry[];
}

export interface PersonOverlay {
  id: string;
  lane: string;
  display?: string;
  title?: string;
  bio?: string;
  tags?: string[];
  order?: number;
}

export interface VocabFile {
  id: string;
  name: string;
}

/** 受控分类词条，rank 用于在未显式指定 primary 时推导主分类，越大越优先 */
export interface CategoryFile {
  id: string;
  name: string;
  rank: number;
}

export interface TopicDraft {
  meta: {
    id: string;
    title: string;
    subtitle: string;
    range: [number, number];
  };
  catalog: {
    subtitle?: string;
    region: string;
    eras: string[];
    themes: string[];
  };
  lanes: Lane[];
  people: PersonOverlay[];
  relationTypes: RelationType[];
  relations: Relation[];
  events: TimelineEvent[];
  views: View[];
}

export interface PipelineData {
  order: string[];
  regions: VocabFile[];
  eras: VocabFile[];
  themes: VocabFile[];
  categories: CategoryFile[];
  polities: VocabFile[];
  /** 朝代年份区间表。只用于筛选与分段标签，不用于推导归属。 */
  dynasties: DynastyTerm[];
  people: Map<string, RegistryPerson>;
  /** 人物 id → 相对仓库根的源文件。存量 JSON 与新 Markdown 各一条。 */
  personPaths: Map<string, string>;
  /** 事件实体库。全局唯一 id，可被军事与历史事件两条目录引用。 */
  events: Map<string, RegistryEvent>;
  /** 事件 id → 相对仓库根的源文件。 */
  eventPaths: Map<string, string>;
  topics: TopicDraft[];
  /** 键是专题 id */
  candidates: Map<string, CandidateEntry[]>;
}

export interface LintMessage {
  level: 'error' | 'warning';
  path: string;
  message: string;
}
