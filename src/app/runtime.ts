/**
 * 运行时共享状态：app / render / interaction / view 四个模块共用同一份可变状态、
 * DOM 元素引用与 canvas context。状态只在这里定义一次，避免模块之间复制或循环导入。
 */

import type { Topic } from '../types';
import type { LaneLayout } from './layout';
import type { Library } from './model';
import type { Route } from '../routing';
import type { SkinId } from './skins';

export type LineId = 'people' | 'military' | 'history';
export type ChipId = 'all' | 'military' | 'political' | 'cultural' | 'female';
export type Selection = { kind: 'person' | 'event'; id: string };

export const STORAGE = {
  skin: 'ht-skin',
  line: 'ht-line',
  strip: 'ht-strip',
  lanes: 'ht-hidden-lanes',
  topic: 'ht-topic',
};
export const DEFAULT_TOPIC = 'han';

export interface AppState {
  library: Library;
  skin: SkinId;
  line: LineId;
  topicId: string;
  topic: Topic | null;
  /** 当前章节 id。地址栏写的是它，缩放不算换章节，所以只有切专题和点章节会改。 */
  viewId: string | null;
  domain: [number, number];
  scrollY: number;
  chip: ChipId;
  selected: Selection | null;
  hiddenLanes: Set<string>;
  stripOpen: boolean;
}

export let state: AppState;

export function setState(next: AppState): void {
  state = next;
}

export let layouts: LaneLayout[] = [];

export function setLayouts(next: LaneLayout[]): void {
  layouts = next;
}

export let contentH = 0;

export function setContentH(next: number): void {
  contentH = next;
}

export let W = 0;
export let H = 0;

export function setViewportSize(width: number, height: number): void {
  W = width;
  H = height;
}

export let loadingTopic = false;

export function setLoadingTopic(next: boolean): void {
  loadingTopic = next;
}

export let initial: Route | null = null;

export function setInitial(next: Route | null): void {
  initial = next;
}

export interface DragState {
  x: number;
  y: number;
  domain: [number, number];
  scrollY: number;
  moved: boolean;
  lastX: number;
  lastT: number;
}

/** 指针拖拽与惯性；只有 interaction 写这些字段，loop 读惯性并清零。 */
export const motion: { drag: DragState | null; inertia: number; dragging: boolean } = {
  drag: null,
  inertia: 0,
  dragging: false,
};

export const dom = {
  stage: document.getElementById('stage') as HTMLElement,
  canvas: document.getElementById('chart') as HTMLCanvasElement,
  stars: document.getElementById('stars') as HTMLCanvasElement,
  nebula: document.getElementById('nebula') as HTMLElement,
  ribbon: document.getElementById('ribbon-canvas') as HTMLCanvasElement,
  card: document.getElementById('card') as HTMLElement,
  cardBody: document.getElementById('card-body') as HTMLElement,
  hint: document.getElementById('hint') as HTMLElement,
  chips: document.getElementById('chips') as HTMLElement,
  lanePanel: document.getElementById('lane-panel') as HTMLElement,
  laneList: document.getElementById('lane-list') as HTMLElement,
  laneChapters: document.getElementById('lane-chapters') as HTMLElement,
  stripToggle: document.getElementById('strip-toggle') as HTMLButtonElement,
  search: document.getElementById('search') as HTMLInputElement,
  searchResults: document.getElementById('search-results') as HTMLElement,
  topicSelect: document.getElementById('topic-select') as HTMLSelectElement,
  status: document.getElementById('status') as HTMLElement,
  exportMenu: document.getElementById('export-menu') as HTMLElement,
  topbar: document.getElementById('topbar') as HTMLElement,
};

export const ctx = dom.canvas.getContext('2d') as CanvasRenderingContext2D;
export const sctx = dom.stars.getContext('2d') as CanvasRenderingContext2D;
export const rctx = dom.ribbon.getContext('2d') as CanvasRenderingContext2D;
export const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

/** 由 app.ts 提供的编排回调；render / interaction / view 通过它调用上层流程，避免循环导入。 */
export interface AppHooks {
  setLine(line: LineId, sync?: boolean): void;
  setTopic(topicId: string, sync?: boolean): Promise<void>;
  selectAndReveal(selection: Selection, sync?: boolean, keepDomain?: boolean): Promise<void>;
  rebuildLayout(): void;
  resizeChart(): void;
}

let hooks: AppHooks | null = null;

export function setHooks(next: AppHooks): void {
  hooks = next;
}

export function getHooks(): AppHooks {
  if (!hooks) throw new Error('app hooks 未初始化');
  return hooks;
}
