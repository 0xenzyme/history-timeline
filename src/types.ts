export type Accuracy = 'exact' | 'approx' | 'disputed' | 'unknown';

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

export interface CatalogEntry {
  id: string;
  title: string;
  subtitle: string;
  file: string;
}

export interface Catalog {
  topics: CatalogEntry[];
}
