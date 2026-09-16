import type { Accuracy, Lane, Relation, RelationType, TimelineEvent, View } from '../src/types';

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
  people: Map<string, RegistryPerson>;
  topics: TopicDraft[];
}

export interface LintMessage {
  level: 'error' | 'warning';
  path: string;
  message: string;
}
