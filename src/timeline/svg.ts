export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function attr(name: string, value: string | number): string {
  return `${name}="${typeof value === 'number' ? round(value) : esc(value)}"`;
}

export function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/** 把 #rrggbb 颜色按系数调暗，用于给同色形状加描边 */
export function shade(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.round(channel * factor),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
