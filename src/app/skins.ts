import type { EventScale, EventType, SourceRef } from '../types';

export type SkinId = 'voyage' | 'deepspace';

/**
 * 画布配色。颜色值全部来自 src/styles.css 的自定义属性，这里只声明 token 名，
 * 运行时由 paletteFor() 读回，画布与外框不可能各画一份。
 */
export interface Palette {
  paper: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  hair: string;
  accent: string;
  laneLabel: string;
  headerBg: string;
  axisText: string;
  labelInBar: string;
  ribbonBg: string;
  ribbonText: string;
  density: string;
  viewportWash: string;
  eventAlpha: number;
  eventAlphaDim: number;
}

type ColorToken = Exclude<keyof Palette, 'eventAlpha' | 'eventAlphaDim'>;

/** token → styles.css 里的变量名。加 token 必须同时在两套皮肤里补变量。 */
const PALETTE_VARS: Record<ColorToken, string> = {
  paper: '--bg',
  ink: '--ink',
  ink2: '--ink-2',
  muted: '--muted',
  line: '--line',
  hair: '--hair',
  accent: '--accent',
  laneLabel: '--canvas-lane-label',
  headerBg: '--canvas-header-bg',
  axisText: '--canvas-axis-text',
  labelInBar: '--canvas-label-in-bar',
  ribbonBg: '--ribbon-bg',
  ribbonText: '--canvas-ribbon-text',
  density: '--canvas-density',
  viewportWash: '--canvas-viewport-wash',
};

export interface Skin {
  glow: boolean;
  inertia: boolean;
  stars: boolean;
  brighten: boolean;
  eventAlpha: number;
  eventAlphaDim: number;
  ribbonBand: (hue: number) => string;
  footerBand: (hue: number) => string;
}

export const SKINS: Record<SkinId, Skin> = {
  voyage: {
    glow: false,
    inertia: false,
    stars: false,
    brighten: false,
    eventAlpha: 0.1,
    eventAlphaDim: 0.03,
    ribbonBand: (hue) => `hsl(${hue}, 26%, 76%)`,
    footerBand: (hue) => `hsl(${hue}, 48%, 70%)`,
  },
  deepspace: {
    glow: true,
    inertia: true,
    stars: true,
    brighten: true,
    eventAlpha: 0.16,
    eventAlphaDim: 0.04,
    ribbonBand: (hue) => `hsl(${hue}, 42%, 30%)`,
    footerBand: (hue) => `hsl(${hue}, 52%, 40%)`,
  },
};

const paletteCache = new Map<SkinId, Palette>();

/** 丢弃缓存：切皮肤、开发期样式热更新后重新读变量。 */
export function invalidatePalette(): void {
  paletteCache.clear();
}

/**
 * 读取当前生效皮肤的画布配色。
 * 变量必须已经挂在 document.body 上，所以只能在 applySkin() 换完 class 之后调用；
 * 缺变量直接抛错，不能画出一片空白。
 */
export function paletteFor(skin: SkinId): Palette {
  const cached = paletteCache.get(skin);
  if (cached) return cached;
  if (!document.body.classList.contains(`skin-${skin}`)) {
    throw new Error(`读取 ${skin} 配色时 body 上没有 skin-${skin}，配色会和皮肤错位`);
  }
  const style = getComputedStyle(document.body);
  const colors = {} as Record<ColorToken, string>;
  const missing: string[] = [];
  for (const [token, name] of Object.entries(PALETTE_VARS) as Array<[ColorToken, string]>) {
    const value = style.getPropertyValue(name).trim();
    if (!value) missing.push(name);
    colors[token] = value;
  }
  if (missing.length > 0) {
    throw new Error(`styles.css 的 body.skin-${skin} 缺少变量：${missing.join('、')}`);
  }
  const next: Palette = {
    ...colors,
    eventAlpha: SKINS[skin].eventAlpha,
    eventAlphaDim: SKINS[skin].eventAlphaDim,
  };
  paletteCache.set(skin, next);
  return next;
}

export const EVENT_COLORS: Record<EventType, string> = {
  military: '#b0442f',
  political: '#33658a',
  rebellion: '#8f4a55',
  institutional: '#3f7d52',
  diplomatic: '#6b5b95',
  cultural: '#a8763a',
};

export const TYPE_NAMES: Record<EventType, string> = {
  military: '军事',
  political: '政治',
  rebellion: '民变',
  institutional: '制度',
  diplomatic: '盟约',
  cultural: '文化',
};

export const SCALE_NAMES: Record<EventScale, string> = {
  war: '战争',
  campaign: '战役',
  battle: '会战',
  engagement: '交锋',
};

export const SOURCE_KIND_NAMES: Record<NonNullable<SourceRef['kind']>, string> = {
  classic: '典籍',
  modern: '现代考证',
  database: '数据库',
};

/** 深色底上把颜色调亮。深空皮肤用它把宣纸配色搬到深底。 */
export function brighten(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const nextL = Math.min(0.74, l + 0.24);
  const nextS = Math.min(0.9, s + 0.1);
  return `hsl(${Math.round(h)}, ${Math.round(nextS * 100)}%, ${Math.round(nextL * 100)}%)`;
}

const colorCache = new Map<string, string>();

export function skinColor(skin: SkinId, hex: string): string {
  const key = `${skin}:${hex}`;
  const cached = colorCache.get(key);
  if (cached) return cached;
  const next = SKINS[skin].brighten ? brighten(hex) : hex;
  colorCache.set(key, next);
  return next;
}

export function isSkinId(value: string | null): value is SkinId {
  return value === 'voyage' || value === 'deepspace';
}
