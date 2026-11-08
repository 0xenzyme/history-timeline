/**
 * 人物肖像加载：monogram 占位符上覆盖 /media/people/<id>-<size>.webp。
 * 加载失败移除 img，保留 monogram；装饰图 alt 为空（紧邻同名标题）。
 */
export function mountPortraits(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-person-image]').forEach((placeholder) => {
    if (placeholder.dataset.portraitMounted) return;
    placeholder.dataset.portraitMounted = '1';
    const image = new Image();
    image.alt = '';
    image.className = 'lt-person-portrait';
    image.addEventListener('error', () => image.remove());
    const size = placeholder.dataset.personImageSize === '800' ? '800' : '400';
    image.src = `/media/people/${placeholder.dataset.personImage}-${size}.webp`;
    placeholder.append(image);
  });
}
