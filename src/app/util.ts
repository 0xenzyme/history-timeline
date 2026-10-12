/** 原型与站点共用的纯工具。 */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** 年份简写：-2070 → 前2070。 */
export function fmtYear(year: number): string {
  return year < 0 ? `前${-year}` : `${year}`;
}

export function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 年份刻度步长。输入期望的粗粒度跨度，返回 1/2/5 进制步长。 */
export function pickStep(raw: number): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  for (const step of steps) {
    if (step >= raw) return step;
  }
  return 1000;
}

export const FONT_SANS = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
export const FONT_SERIF = '"Songti SC","SimSun","Noto Serif CJK SC",Georgia,serif';

/** 圆角矩形路径。CanvasRenderingContext2D.roundRect 在旧浏览器缺失时补一条路径。 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 生年缺省时向前推 40 年，卒年缺省时向后推 40 年。与旧渲染器规则一致。 */
export function personFrom(birth: number | undefined, death: number | undefined): number {
  return birth != null ? birth : (death ?? 0) - 40;
}

export function personTo(birth: number | undefined, death: number | undefined): number {
  return death != null ? death : (birth ?? 0) + 40;
}
