/**
 * 矢量 SVG 导出上下文。
 * 实现 render.ts 用到的 CanvasRenderingContext2D 子集，把绘制指令记录成 SVG 元素，
 * 让同一段渲染代码既画位图也画矢量。只支持渲染器实际使用的能力，不是通用转换层。
 */

import { esc } from './util';

/** 文本宽度测量。测试可注入桩实现；浏览器里默认用离屏 canvas。 */
export type TextMeasurer = (text: string, font: string) => number;

function defaultMeasurer(): TextMeasurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建文本测量画布');
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

const n = (value: number): string => String(Math.round(value * 100) / 100);

export class SvgGradient {
  readonly stops: { offset: number; color: string }[] = [];

  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number,
  ) {}

  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
}

interface StyleState {
  fillStyle: string | SvgGradient;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  lineDash: number[];
  tx: number;
  ty: number;
}

interface Group {
  /** 序列化为 <g ...attrs>children</g>；根组不输出 <g>。 */
  attrs: string[];
  children: (string | Group)[];
}

const DEFAULT_STYLE: StyleState = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  font: '10px sans-serif',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  lineDash: [],
  tx: 0,
  ty: 0,
};

export class SvgContext {
  fillStyle: string | SvgGradient = DEFAULT_STYLE.fillStyle;
  strokeStyle = DEFAULT_STYLE.strokeStyle;
  lineWidth = DEFAULT_STYLE.lineWidth;
  font = DEFAULT_STYLE.font;
  textAlign = DEFAULT_STYLE.textAlign;
  textBaseline = DEFAULT_STYLE.textBaseline;
  globalAlpha = DEFAULT_STYLE.globalAlpha;
  shadowColor = DEFAULT_STYLE.shadowColor;
  shadowBlur = DEFAULT_STYLE.shadowBlur;

  private readonly measure: TextMeasurer;
  private readonly defs: string[] = [];
  private readonly root: Group = { attrs: [], children: [] };
  private group: Group = this.root;
  private readonly saved: { style: StyleState; group: Group }[] = [];
  private path = '';
  private hasPoint = false;
  private lineDash: number[] = [];
  private tx = 0;
  private ty = 0;
  private idSeq = 0;
  private readonly filters = new Map<string, string>();
  private readonly gradients = new Map<SvgGradient, string>();

  constructor(measurer?: TextMeasurer) {
    this.measure = measurer ?? defaultMeasurer();
  }

  // ---------- 状态栈 ----------

  save(): void {
    this.saved.push({ style: this.snapshot(), group: this.group });
  }

  restore(): void {
    const entry = this.saved.pop();
    if (!entry) return;
    this.apply(entry.style);
    this.group = entry.group;
  }

  translate(x: number, y: number): void {
    this.tx += x;
    this.ty += y;
  }

  setTransform(): void {
    // 导出路径不使用绝对变换；PNG 导出里的 DPR 缩放对矢量无意义。
  }

  private snapshot(): StyleState {
    return {
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      globalAlpha: this.globalAlpha,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur,
      lineDash: [...this.lineDash],
      tx: this.tx,
      ty: this.ty,
    };
  }

  private apply(style: StyleState): void {
    this.fillStyle = style.fillStyle;
    this.strokeStyle = style.strokeStyle;
    this.lineWidth = style.lineWidth;
    this.font = style.font;
    this.textAlign = style.textAlign;
    this.textBaseline = style.textBaseline;
    this.globalAlpha = style.globalAlpha;
    this.shadowColor = style.shadowColor;
    this.shadowBlur = style.shadowBlur;
    this.lineDash = [...style.lineDash];
    this.tx = style.tx;
    this.ty = style.ty;
  }

  setLineDash(dash: number[]): void {
    this.lineDash = [...dash];
  }

  // ---------- 路径 ----------

  beginPath(): void {
    this.path = '';
    this.hasPoint = false;
  }

  closePath(): void {
    this.path += 'Z';
  }

  moveTo(x: number, y: number): void {
    this.path += `M${n(x)} ${n(y)}`;
    this.hasPoint = true;
  }

  lineTo(x: number, y: number): void {
    this.path += `${this.hasPoint ? 'L' : 'M'}${n(x)} ${n(y)}`;
    this.hasPoint = true;
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.path += `Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`;
    this.hasPoint = true;
  }

  arc(x: number, y: number, r: number, start: number, end: number, ccw = false): void {
    const sx = x + r * Math.cos(start);
    const sy = y + r * Math.sin(start);
    if (this.hasPoint) this.path += `L${n(sx)} ${n(sy)}`;
    else this.path += `M${n(sx)} ${n(sy)}`;
    let delta = ccw ? start - end : end - start;
    delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sweep = ccw ? 0 : 1;
    if (delta >= Math.PI * 2 - 1e-6) {
      const mx = x + r * Math.cos(start + Math.PI);
      const my = y + r * Math.sin(start + Math.PI);
      this.path += `A${n(r)} ${n(r)} 0 1 ${sweep} ${n(mx)} ${n(my)}`;
      this.path += `A${n(r)} ${n(r)} 0 1 ${sweep} ${n(sx)} ${n(sy)}`;
    } else {
      const large = delta > Math.PI ? 1 : 0;
      const ex = x + r * Math.cos(ccw ? start - delta : start + delta);
      const ey = y + r * Math.sin(ccw ? start - delta : start + delta);
      this.path += `A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(ex)} ${n(ey)}`;
    }
    this.hasPoint = true;
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.path += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
    this.hasPoint = false;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    if (radius === 0) {
      this.rect(x, y, w, h);
      return;
    }
    const rr = n(radius);
    this.path +=
      `M${n(x + radius)} ${n(y)}` +
      `H${n(x + w - radius)}A${rr} ${rr} 0 0 1 ${n(x + w)} ${n(y + radius)}` +
      `V${n(y + h - radius)}A${rr} ${rr} 0 0 1 ${n(x + w - radius)} ${n(y + h)}` +
      `H${n(x + radius)}A${rr} ${rr} 0 0 1 ${n(x)} ${n(y + h - radius)}` +
      `V${n(y + radius)}A${rr} ${rr} 0 0 1 ${n(x + radius)} ${n(y)}Z`;
    this.hasPoint = false;
  }

  clip(): void {
    const id = this.nextId('clip');
    this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${this.path}"/></clipPath>`);
    const child: Group = { attrs: [`clip-path="url(#${id})"`], children: [] };
    this.group.children.push(child);
    this.group = child;
  }

  // ---------- 绘制 ----------

  clearRect(): void {
    // 背景由导出入口统一铺，SVG 没有「擦除」概念。
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.emit(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${this.paintAttrs('fill')}/>`);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.emit(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none"${this.paintAttrs('stroke')}/>`,
    );
  }

  fill(): void {
    if (!this.path) return;
    this.emit(`<path d="${this.path}"${this.paintAttrs('fill')}/>`);
  }

  stroke(): void {
    if (!this.path) return;
    this.emit(`<path d="${this.path}" fill="none"${this.paintAttrs('stroke')}/>`);
  }

  fillText(text: string, x: number, y: number): void {
    if (text === '') return;
    const match = /^(?:(bold|italic)\s+)?(\d+(?:\.\d+)?)px\s+(.*)$/.exec(this.font.trim());
    const weight = match?.[1] === 'bold' ? ' font-weight="bold"' : '';
    const size = match?.[2] ?? '10';
    const family = match?.[3] ?? this.font;
    const anchor =
      this.textAlign === 'center' ? ' middle' : this.textAlign === 'right' || this.textAlign === 'end' ? ' end' : '';
    const baseline = this.textBaseline === 'middle' ? ' dominant-baseline="central"' : '';
    this.emit(
      `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-family="${esc(family)}"${weight}` +
        `${anchor ? ` text-anchor="${anchor.trim()}"` : ''}${baseline}${this.paintAttrs('fill')}>${esc(text)}</text>`,
    );
  }

  measureText(text: string): { width: number } {
    return { width: this.measure(text, this.font) };
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): SvgGradient {
    return new SvgGradient(x0, y0, x1, y1);
  }

  // ---------- 输出 ----------

  toMarkup(width: number, height: number): string {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" ` +
      `viewBox="0 0 ${n(width)} ${n(height)}">` +
      (this.defs.length > 0 ? `<defs>${this.defs.join('')}</defs>` : '') +
      this.serialize(this.root) +
      `</svg>`
    );
  }

  private serialize(group: Group): string {
    const inner = group.children.map((child) => (typeof child === 'string' ? child : this.serialize(child))).join('');
    if (group === this.root) return inner;
    return `<g${group.attrs.length > 0 ? ` ${group.attrs.join(' ')}` : ''}>${inner}</g>`;
  }

  private emit(markup: string): void {
    this.group.children.push(markup);
  }

  /** 元素公共属性：变换、透明度、辉光滤镜，以及 fill 或 stroke  Paint。 */
  private paintAttrs(mode: 'fill' | 'stroke'): string {
    let attrs = '';
    if (this.tx !== 0 || this.ty !== 0) attrs += ` transform="translate(${n(this.tx)},${n(this.ty)})"`;
    if (this.globalAlpha < 1) attrs += ` opacity="${n(this.globalAlpha)}"`;
    const filter = this.filterAttr();
    if (filter) attrs += ` filter="url(#${filter})"`;
    if (mode === 'fill') {
      attrs += ` fill="${this.fillRef()}"`;
    } else {
      attrs += ` stroke="${esc(this.strokeStyle)}" stroke-width="${n(this.lineWidth)}"`;
      if (this.lineDash.length > 0) attrs += ` stroke-dasharray="${this.lineDash.map(n).join(' ')}"`;
    }
    return attrs;
  }

  private fillRef(): string {
    if (this.fillStyle instanceof SvgGradient) return `url(#${this.gradientId(this.fillStyle)})`;
    return esc(this.fillStyle);
  }

  private gradientId(gradient: SvgGradient): string {
    const cached = this.gradients.get(gradient);
    if (cached) return cached;
    const id = this.nextId('grad');
    const stops = gradient.stops
      .map((stop) => `<stop offset="${n(stop.offset)}" stop-color="${esc(stop.color)}"/>`)
      .join('');
    this.defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
        `x1="${n(gradient.x0)}" y1="${n(gradient.y0)}" x2="${n(gradient.x1)}" y2="${n(gradient.y1)}">${stops}</linearGradient>`,
    );
    this.gradients.set(gradient, id);
    return id;
  }

  private filterAttr(): string | null {
    if (this.shadowBlur <= 0) return null;
    const key = `${this.shadowColor}|${this.shadowBlur}`;
    const cached = this.filters.get(key);
    if (cached) return cached;
    const id = this.nextId('glow');
    this.defs.push(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feDropShadow dx="0" dy="0" stdDeviation="${n(this.shadowBlur / 2)}" ` +
        `flood-color="${esc(this.shadowColor)}" flood-opacity="0.9"/></filter>`,
    );
    this.filters.set(key, id);
    return id;
  }

  private nextId(prefix: string): string {
    this.idSeq += 1;
    return `ht-${prefix}-${this.idSeq}`;
  }
}

/** 用矢量上下文重跑一遍渲染回调，返回完整的 SVG 文档。 */
export function renderToSvgMarkup(
  render: (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) => void,
  width: number,
  height: number,
  paper: string,
  measurer?: TextMeasurer,
): string {
  const svg = new SvgContext(measurer);
  svg.fillStyle = paper;
  svg.fillRect(0, 0, width, height);
  render(svg as unknown as CanvasRenderingContext2D, width, height, 1);
  return svg.toMarkup(width, height);
}
