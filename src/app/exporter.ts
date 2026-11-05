/**
 * 导出当前视图。
 * PNG 走离屏 canvas 重绘，得到 2 倍像素密度。
 * SVG 目前把同一张位图内嵌进 <svg><image>，保证「导出 SVG」这条路径可用；矢量重绘待做。
 */

export type CanvasRenderer = (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) => void;

export interface ExportOptions {
  render: CanvasRenderer;
  width: number;
  height: number;
  paper: string;
  basename: string;
  format: 'png' | 'svg';
  scale?: number;
}

export async function exportView(options: ExportOptions): Promise<void> {
  const scale = options.scale ?? 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(options.width * scale));
  canvas.height = Math.max(1, Math.round(options.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建导出画布');
  ctx.fillStyle = options.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  options.render(ctx, options.width, options.height, scale);

  if (options.format === 'svg') {
    const href = canvas.toDataURL('image/png');
    const markup =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">` +
      `<rect width="${options.width}" height="${options.height}" fill="${options.paper}"/>` +
      `<image width="${options.width}" height="${options.height}" href="${href}" xlink:href="${href}"/>` +
      `</svg>`;
    download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${options.basename}.svg`);
    return;
  }

  const blob = await toBlob(canvas);
  download(blob, `${options.basename}.png`);
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('无法生成 PNG'));
    }, 'image/png');
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBasename(parts: string[]): string {
  return parts
    .map((part) => part.replace(/[\\/:*?"<>|]+/g, '').trim())
    .filter(Boolean)
    .join('-');
}
