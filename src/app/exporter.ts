/**
 * 导出当前视图。
 * PNG 走离屏 canvas 重绘，得到 2 倍像素密度。
 * SVG 用矢量上下文（svg-context.ts）重跑同一套绘制指令，输出真实矢量文档。
 */

import { renderToSvgMarkup } from './svg-context';

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
  if (options.format === 'svg') {
    const markup = renderToSvgMarkup(options.render, options.width, options.height, options.paper);
    download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${options.basename}.svg`);
    return;
  }

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
