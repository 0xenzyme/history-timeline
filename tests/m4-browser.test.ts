import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, type Browser } from 'playwright';

const origin = process.env.M4_TEST_ORIGIN ?? 'http://127.0.0.1:5194';
const screenshotDir = join(process.cwd(), '.impeccable', 'review');

async function ready(page: import('playwright').Page, selector = '#site-page[aria-busy="false"]'): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
}

async function noOverflow(page: import('playwright').Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
}

test('M4 Chrome 内容发现、返回、四档视口、异常与年表回归', { timeout: 150_000 }, async (context) => {
  mkdirSync(screenshotDir, { recursive: true });
  const server: ChildProcess | undefined = process.env.M4_TEST_ORIGIN
    ? undefined
    : spawn(
        process.execPath,
        [
          join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'),
          '--host',
          '127.0.0.1',
          '--port',
          '5194',
          '--strictPort',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
  let browser: Browser | undefined;
  const errors: string[] = [];
  context.after(async () => {
    await browser?.close();
    server?.kill('SIGTERM');
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${origin}/`);
  await ready(page, '.lt-home');
  assert.match(await page.locator('.lt-home-hero').innerText(), /纵横千年，人物相望/);
  assert.equal(await page.locator('.lt-era-recommendations .lt-era-card').count(), 5);
  assert.equal(await page.locator('main').count(), 1);
  await page.locator('#home-query').fill('儒家传承');
  await page.locator('.lt-home-search button').click();
  await ready(page, '.lt-search-group');
  assert.match(await page.locator('.lt-search-group').filter({ hasText: '群像' }).innerText(), /儒家传承/);
  await page.goto(`${origin}/search?q=%E5%94%90&type=dynasty`);
  await ready(page, '[data-era-id="tang"]');
  await page.locator('[data-era-id="tang"]').click();
  await ready(page, '.lt-era-page');
  assert.match(await page.locator('.lt-era-hero').innerText(), /618—907/);
  assert.match(await page.locator('.lt-era-overview').innerText(), /李渊/);
  await page.locator('.lt-era-tabs a').filter({ hasText: '重要事件' }).click();
  await ready(page, '.lt-era-page');
  assert.match(page.url(), /tab=events/);
  await page.locator('a[data-entity-id="anshi-zhiluan"]').first().click();
  await ready(page, '.lt-event-page');
  assert.match(await page.locator('.lt-event-page').innerText(), /民变/);
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.lt-era-page');
  assert.match(page.url(), /eras\/tang\?tab=events/);
  await page.locator('.lt-era-tabs a').filter({ hasText: '关键人物' }).click();
  await page.locator('a[data-entity-id="li-bai"]').first().click();
  await ready(page, '.lt-person-page');
  assert.match(await page.locator('.lt-person-page').innerText(), /与 杜甫|← 杜甫|→ 杜甫/);
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.lt-era-page');
  await page.locator('.lt-era-hero a[data-timeline-link]').click();
  await page.waitForSelector('.timeline-app');
  assert.match(page.url(), /topic=tang/);
  assert.match(page.url(), /from=609|from=610/);

  await page.goto(`${origin}/people?dynasty=tang&category=poetry&sort=birth&view=grid`);
  await ready(page, '.lt-person-card');
  assert.equal(await page.locator('.lt-person-card').count(), 10);
  await page.evaluate(() => scrollTo(0, 500));
  const sourceScroll = await page.evaluate(() => scrollY);
  await page
    .locator('.lt-person-card h3 a[data-entity-kind="person"]')
    .nth(4)
    .evaluate((link: HTMLAnchorElement) => link.click());
  await ready(page, '.lt-person-page');
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.lt-person-card');
  assert.match(page.url(), /category=poetry/);
  await page.waitForFunction((scroll) => scrollY === scroll, sourceScroll);
  await page.selectOption('[data-directory-param="sort"]', 'birth-desc');
  await ready(page, '.lt-person-card');
  assert.match(page.url(), /sort=birth-desc/);
  assert.doesNotMatch(page.url(), /page=/);

  await page.goto(`${origin}/people?dynasty=zhanguo&sort=birth&view=grid`);
  await ready(page, '.lt-person-card');
  assert.match(await page.locator('.lt-directory-toolbar').innerText(), /159 条结果/);
  await page.goto(`${origin}/people?q=%E8%AF%97%E8%AF%8D&sort=birth&view=grid`);
  await ready(page, '.lt-person-card');
  assert.ok((await page.locator('.lt-person-card').count()) > 0);
  await page.locator('.lt-person-card-monogram').first().click();
  await ready(page, '.lt-person-page');

  await page.goto(`${origin}/people?dynasty=invalid&page=999&sort=bad`);
  await ready(page, '.lt-directory-page');
  assert.match(await page.locator('.lt-notice').innerText(), /已忽略/);
  assert.match(await page.locator('.lt-empty-results').innerText(), /这一页没有结果/);
  await page.goto(`${origin}/events?dynasty=tang&type=rebellion&catalog=history&sort=year&view=list`);
  await ready(page, '.lt-event-directory-card');
  assert.equal(await page.locator('[data-entity-id="anshi-zhiluan"]').count(), 1);
  assert.match(await page.locator('.lt-event-directory-card').first().innerText(), /民变/);
  await page.goto(`${origin}/events?person=li-bai&sort=year&view=list`);
  await ready(page, '.lt-empty-results');
  assert.match(await page.locator('.lt-empty-results').innerText(), /没有符合当前条件的结果/);

  await page.goto(`${origin}/collections/rujia-chuancheng?tab=members`);
  await ready(page, '.lt-collection-member-list');
  assert.equal(await page.locator('.lt-collection-member-list li').count(), 5);
  assert.match(await page.locator('.lt-collection-member-list').innerText(), /朱熹/);
  assert.doesNotMatch(await page.locator('.lt-collection-member-list').innerText(), /连续师承谱系。孔子→/);
  await page.goto(`${origin}/search?q=%E5%84%92%E5%AE%B6%E4%BC%A0%E6%89%BF&type=collection`);
  await ready(page, '.lt-search-group');
  assert.equal(await page.locator('.lt-search-group').count(), 1);

  await page.goto(`${origin}/eras/tang?tab=events`);
  await ready(page, '.lt-era-page');
  assert.match(await page.locator('.lt-event-directory-card').first().innerText(), /朝代\s*唐/);
  assert.doesNotMatch(await page.locator('.lt-event-directory-card').first().innerText(), /朝代\s*tang/);
  await page.goto(`${origin}/eras?q=%E5%94%90`);
  await ready(page, '[data-era-id="tang"]');
  await page.locator('[data-era-id="tang"]').click();
  await ready(page, '.lt-era-page');
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.lt-directory-page');
  assert.match(page.url(), /eras\?q=/);
  assert.equal(await page.locator('.lt-era-card').count(), 1);
  await page.goto(`${origin}/collections?category=thought`);
  await ready(page, '.lt-collection-card');
  await page.locator('.lt-collection-card .lt-card-primary').click({ position: { x: 8, y: 8 } });
  await ready(page, '.lt-collection-page');
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.lt-collection-card');
  assert.match(page.url(), /category=thought/);
  await page.goto(`${origin}/collections/rujia-chuancheng?tab=timeline`);
  await ready(page, '.lt-collection-page');
  assert.doesNotMatch(page.url(), /tab=timeline/);
  await page.goto(`${origin}/eras/tang?tab=collections`);
  await ready(page, '.lt-era-page');
  assert.doesNotMatch(page.url(), /tab=collections/);

  await page.route('**/data/people.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/`);
  await ready(page, '.lt-home');
  assert.equal(await page.locator('.lt-home-search').count(), 1);
  await page.unroute('**/data/people.json');

  await page.route('**/data/eras.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/people?dynasty=tang&view=grid`);
  await ready(page, '.lt-person-card');
  assert.ok((await page.locator('.lt-person-card').count()) > 0);
  await page.unroute('**/data/eras.json');
  await page.route('**/data/eras.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/`);
  await ready(page, '.lt-home');
  assert.match(await page.locator('.lt-home-recommendations').first().innerText(), /暂时无法加载/);
  await page.locator('[data-retry="eras"]').click();
  await page.unroute('**/data/eras.json');
  await page.locator('[data-retry="eras"]').click();
  await ready(page, '.lt-era-recommendations .lt-era-card');
  await page.route('**/data/people.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/people`);
  await page.waitForFunction(() => document.querySelector('.lt-state-page')?.textContent?.includes('暂时无法加载页面'));
  assert.match(await page.locator('.lt-state-page').innerText(), /暂时无法加载页面/);
  await page.unroute('**/data/people.json');
  await page.locator('[data-retry]').click();
  await ready(page, '.lt-person-card');

  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of [
      ['home', '/'],
      ['people', '/people?dynasty=tang&view=grid'],
      ['events', '/events?dynasty=tang&view=list'],
      ['era', '/eras/tang'],
      ['collections', '/collections'],
    ] as const) {
      await page.goto(`${origin}${path}`);
      await ready(page);
      await noOverflow(page);
      await page.screenshot({
        path: join(screenshotDir, `m4-${name}-${width}.png`),
        fullPage: name === 'home' || name === 'era',
      });
    }
  }
  await page.goto(`${origin}/people?dynasty=tang&view=grid`);
  await ready(page, '.lt-filter-open');
  await page.locator('[data-filter-open]').click();
  assert.equal(
    await page.locator('[data-filter-dialog]').evaluate((dialog) => (dialog as HTMLDialogElement).open),
    true,
  );
  await page.keyboard.press('Escape');
  assert.equal(
    await page.locator('[data-filter-dialog]').evaluate((dialog) => (dialog as HTMLDialogElement).open),
    false,
  );
  assert.equal(await page.locator('[data-filter-open]').evaluate((button) => button === document.activeElement), true);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await noOverflow(page);
  assert.equal(await page.locator('[data-filter-open]').isVisible(), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

  await page.goto(`${origin}/#history/event/anshi-zhiluan`);
  await page.waitForSelector('.timeline-app #card.show');
  assert.match(await page.locator('#card-body').innerText(), /安史之乱/);
  assert.deepEqual(errors, []);
});
