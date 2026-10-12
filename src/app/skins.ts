import type { EventScale, EventType, SourceRef } from '../types';

export type SkinId = 'voyage' | 'deepspace';

/** 画布不读 CSS 变量，每种皮肤在这里重复一份绘图配色。 */
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
  labelInBar: string;
  ribbonBg: string;
  ribbonText: string;
  density: string;
  tooltipBg: string;
  eventAlpha: number;
  eventAlphaDim: number;
}

export interface Skin {
  glow: boolean;
  inertia: boolean;
  stars: boolean;
  brighten: boolean;
  palette: Palette;
  ribbonBand: (hue: number) => string;
  footerBand: (hue: number) => string;
}

export const SKINS: Record<SkinId, Skin> = {
  voyage: {
    glow: false,
    inertia: false,
    stars: false,
    brighten: false,
    palette: {
      paper: '#f8f5ee',
      ink: '#29241c',
      ink2: '#57503f',
      muted: '#8d8271',
      line: '#ddd5c4',
      hair: '#e9e3d5',
      accent: '#a83a2a',
      laneLabel: '#6b6353',
      headerBg: '#f8f5ee',
      labelInBar: '#ffffff',
      ribbonBg: '#f0ebdf',
      ribbonText: 'rgba(41,36,28,0.75)',
      density: 'rgba(41,36,28,0.22)',
      tooltipBg: '#ffffff',
      eventAlpha: 0.1,
      eventAlphaDim: 0.03,
    },
    ribbonBand: (hue) => `hsl(${hue}, 26%, 76%)`,
    footerBand: (hue) => `hsl(${hue}, 48%, 70%)`,
  },
  deepspace: {
    glow: true,
    inertia: true,
    stars: true,
    brighten: true,
    palette: {
      paper: '#070b16',
      ink: '#e8e2d4',
      ink2: '#b8b09c',
      muted: '#7d8296',
      line: 'rgba(255,255,255,0.14)',
      hair: 'rgba(255,255,255,0.05)',
      accent: '#e0a458',
      laneLabel: '#7d8296',
      headerBg: 'rgba(7,11,22,0.88)',
      labelInBar: 'rgba(7,11,22,0.85)',
      ribbonBg: '#090d18',
      ribbonText: 'rgba(232,226,212,0.85)',
      density: 'rgba(224,164,88,0.4)',
      tooltipBg: 'rgba(13,19,34,0.95)',
      eventAlpha: 0.16,
      eventAlphaDim: 0.04,
    },
    ribbonBand: (hue) => `hsl(${hue}, 42%, 30%)`,
    footerBand: (hue) => `hsl(${hue}, 52%, 40%)`,
  },
};

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
