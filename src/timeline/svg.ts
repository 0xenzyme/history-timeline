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
