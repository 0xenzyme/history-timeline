import assert from 'node:assert/strict';
import type { Page } from 'playwright';

interface OverflowReport {
  scroll: number;
  viewport: number;
  offenders: string[];
}

/**
 * 断言页面没有横向溢出。失败时列出未被滚动容器裁剪的越界元素，
 * 便于在字体度量不同的 CI 环境中定位具体节点。
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const report = await page.evaluate<OverflowReport>(() => {
    const viewport = innerWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right <= viewport + 0.5) continue;
      let clipped = false;
      for (
        let parent = el.parentElement;
        parent && parent !== document.body && parent !== document.documentElement;
        parent = parent.parentElement
      ) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      const className = (el.getAttribute('class') ?? '').trim().replace(/\s+/g, '.');
      offenders.push(
        `${el.tagName.toLowerCase()}${className ? `.${className}` : ''} right=${Math.round(rect.right * 10) / 10} width=${Math.round(rect.width * 10) / 10} text=${(el.textContent ?? '').trim().slice(0, 24)}`,
      );
      if (offenders.length === 3) break;
    }
    return { scroll: document.documentElement.scrollWidth, viewport, offenders };
  });
  assert.ok(report.scroll <= report.viewport, `页面不应横向溢出：${JSON.stringify(report)}`);
}
