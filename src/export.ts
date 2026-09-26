const PAPER = '#faf7f2';

const EXPORT_CSS = `
svg { background: ${PAPER}; }
.hit { fill: transparent; }
.bar { pointer-events: none; }
.bar-open { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.relation { fill: none; stroke-width: 1.5; stroke-linecap: round; }
.gridline { stroke: #ece5d9; stroke-width: 1; }
.gridline-major { stroke: #e2dbcf; }
.axis-tick, .axis-base { stroke: #cfc5b4; }
.axis-label { font-family: "PingFang SC","Microsoft YaHei","Songti SC",serif; font-size: 11px; fill: #8b8378; }
.axis-span { font-size: 10.5px; fill: #b0a693; }
.lane-bg { opacity: 0.055; }
.row-guide { stroke: #ece5d9; stroke-width: 1; }
.lane-sep { stroke: #ddd4c4; stroke-width: 1; }
.gutter-sep { stroke: #e2dbcf; }
.gutter-lane { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; font-family: "PingFang SC","Microsoft YaHei",sans-serif; }
.gutter-name { font-family: "Songti SC","SimSun","PingFang SC",serif; font-size: 12.5px; fill: #4a4238; }
.gutter-name.is-hot { fill: #16130f; font-weight: 700; }
.event-ribbon { fill: #f3ede2; opacity: 0.62; }
.event-band { fill: #c8a24a; opacity: 0.07; }
.event-line { stroke: #c0ac8c; stroke-width: 1; stroke-dasharray: 3 4; }
.event-pin { fill: #b39d78; }
.event-label { font-size: 11.5px; fill: #6b5f4d; font-family: "PingFang SC","Microsoft YaHei",sans-serif; }
.event-label-bg { fill: ${PAPER}; fill-opacity: 0.9; }
.graph-edge { fill: none; stroke-width: 1.7; stroke-linecap: round; }
.graph-disc { stroke: #fffdf9; stroke-width: 2.5; }
.graph-node.is-center .graph-disc { stroke-width: 3; }
.graph-label { font-family: "Songti SC","SimSun","PingFang SC",serif; font-size: 13px; fill: #2c2823; }
.graph-node.is-center .graph-label { font-size: 16px; font-weight: 700; }
.graph-sub { font-family: "PingFang SC","Microsoft YaHei",sans-serif; font-size: 11px; fill: #8b8378; }
.graph-empty { font-family: "PingFang SC","Microsoft YaHei",sans-serif; font-size: 13px; fill: #8b8378; }
`;

export function exportBasename(parts: string[]): string {
  return parts
    .map((part) => part.replace(/[\\/:*?"<>|]+/g, '').trim())
    .filter(Boolean)
    .join('-');
}

export async function downloadChart(
  svg: SVGSVGElement,
  basename: string,
  format: 'png' | 'svg',
  axis?: SVGSVGElement | null,
): Promise<void> {
  const markup = serializeChart(svg, axis);
  if (format === 'svg') {
    triggerDownload(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${basename}.svg`);
    return;
  }

  const width = Number(svg.getAttribute('width')) || svg.clientWidth || 1200;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight || 800;
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(image, 0, 0, width, height);
    const png = await canvasToBlob(canvas);
    triggerDownload(png, `${basename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function serializeChart(svg: SVGSVGElement, axis?: SVGSVGElement | null): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const width = svg.getAttribute('width') || String(svg.clientWidth || 1200);
  const height = svg.getAttribute('height') || String(svg.clientHeight || 800);
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EXPORT_CSS;
  clone.insertBefore(style, clone.firstChild);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', PAPER);
  clone.insertBefore(bg, style.nextSibling);

  if (axis && axis.childNodes.length > 0) {
    for (const node of [...axis.childNodes]) {
      clone.appendChild(node.cloneNode(true));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法把当前视图画成图片'));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('无法生成 PNG'));
    }, 'image/png');
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
