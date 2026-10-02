import type { Accuracy, Gender, Lane, Relation, RelationType, TimelineEvent, View } from '../src/types';

export interface SourceRef {
  work: string;
  part?: string;
  note?: string;
  /** 出处类型：典籍 / 现代考证 / 外部数据库（只作候选）。省略按 classic 处理 */
  kind?: 'classic' | 'modern' | 'database';
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
  people: Map<string, RegistryPerson>;
  /** 人物 id → 相对仓库根的源文件。存量 JSON 与新 Markdown 各一条。 */
  personPaths: Map<string, string>;
  topics: TopicDraft[];
  /** 键是专题 id */
  candidates: Map<string, CandidateEntry[]>;
}

export interface LintMessage {
  level: 'error' | 'warning';
  path: string;
  message: string;
}
