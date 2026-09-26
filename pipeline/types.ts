import type { Accuracy, Gender, Lane, Relation, RelationType, TimelineEvent, View } from '../src/types';

export interface SourceRef {
  work: string;
  part?: string;
  note?: string;
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
  sources: SourceRef[];
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
  topics: TopicDraft[];
}

export interface LintMessage {
  level: 'error' | 'warning';
  path: string;
  message: string;
}
