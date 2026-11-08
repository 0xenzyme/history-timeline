import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';

const origin = process.env.M6_TEST_ORIGIN ?? 'http://127.0.0.1:5196';
const screenshotDir = join(process.cwd(), '.impeccable', 'review');
const axePath = process.env.M6_AXE_PATH;

async function ready(page: Page, selector = '#site-page[aria-busy="false"]'): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
}

async function noOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
}

function launchOptions(): { executablePath?: string; headless: boolean; args: string[] } {
  return {
    executablePath:
      process.env.CHROME_PATH ??
      (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
    args: ['--no-sandbox'],
  };
}

function previewServer(): ChildProcess | undefined {
  if (process.env.M6_TEST_ORIGIN) return undefined;
  return spawn(
    process.execPath,
    [
      join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '5196',
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`production preview 不可用：${origin}`);
}

test('M6 production 全站四视口、语义与自动化无障碍', { timeout: 180_000 }, async (context) => {
  mkdirSync(screenshotDir, { recursive: true });
  const server = previewServer();
  let browser: Browser | undefined;
  context.after(async () => {
    await browser?.close();
    server?.kill('SIGTERM');
  });
  await waitForServer();
  browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const errors: string[] = [];
  const failedResources: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('/media/people/'))
      failedResources.push(`${response.status()} ${response.url()}`);
  });
  const routes = [
    ['home', '/'],
    ['people', '/people?dynasty=tang&category=poetry&sort=birth&page=1&view=grid'],
    ['person', '/people/li-bai'],
    ['collections', '/collections'],
    ['collection', '/collections/rujia-chuancheng'],
    ['collection-timeline', '/collections/rujia-chuancheng?tab=timeline'],
    ['collection-relations', '/collections/rujia-chuancheng?tab=relations'],
    ['events', '/events?dynasty=tang&type=rebellion&sort=year&page=1'],
    ['event', '/events/anshi-zhiluan'],
    ['eras', '/eras'],
    ['era', '/eras/tang?tab=events'],
    ['search', '/search?q=%E6%9D%8E%E7%99%BD&type=all'],
  ] as const;
  const axeSource = axePath ? readFileSync(axePath, 'utf8') : undefined;
  const violations: Array<{ route: string; width: number; id: string; impact: string; nodes: string[] }> = [];
  const performanceRows: Array<{
    route: string;
    domContentLoadedMs: number;
    resources: number;
    transferBytes: number;
  }> = [];
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [name, route] of routes) {
      await page.goto(`${origin}${route}`);
      await ready(page, '#site-page[aria-busy="false"] main h1');
      assert.equal(await page.locator('main#main-content').count(), 1, `${name} 应有唯一 main`);
      assert.equal(await page.locator('h1').count(), 1, `${name} 应有唯一 h1`);
      assert.equal(await page.locator('main#main-content h1').count(), 1, `${name} h1 应在 main 内`);
      await noOverflow(page);
      if (width === 1440) {
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          return {
            domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
            resources: resources.length,
            transferBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
          };
        });
        performanceRows.push({ route: name, ...metrics });
      }
      if (
        axeSource &&
        (width === 1440 || (width === 390 && ['home', 'person', 'collection-relations', 'event'].includes(name)))
      ) {
        await page.addScriptTag({ content: axeSource });
        const result = await page.evaluate(async () => {
          const axe = (
            globalThis as typeof globalThis & {
              axe: {
                run: (options: unknown) => Promise<{
                  violations: Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }>;
                }>;
              };
            }
          ).axe;
          return axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
        });
        for (const violation of result.violations)
          violations.push({
            route: name,
            width,
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.flatMap((node) => node.target),
          });
      }
      if (['home', 'people', 'collection-relations', 'event', 'era'].includes(name))
        await page.screenshot({
          path: join(screenshotDir, `m6-${name}-${width}.png`),
          fullPage: name !== 'collection-relations',
        });
    }
    await page.goto(`${origin}/timeline?topic=tang&view=tianbao&person=li-bai&from=710&to=770`);
    await ready(page, '.timeline-app #card.show');
    await noOverflow(page);
    assert.equal(await page.locator('#timeline-accessible-entities').count(), 1);
    await page.screenshot({ path: join(screenshotDir, `m6-timeline-${width}.png`) });
  }
  console.log(
    JSON.stringify(
      {
        layer: 'production-preview',
        browser: await browser.version(),
        performanceRows,
        axe: axeSource ? violations : 'not configured',
        failedResources,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(violations, [], '自动化 WCAG 扫描不应有未处置违规');
  assert.deepEqual(failedResources, []);
  assert.deepEqual(errors, []);
});

test('M6 production 移动导航、键盘、缩放和快速导航', { timeout: 90_000 }, async (context) => {
  const server = previewServer();
  let browser: Browser | undefined;
  context.after(async () => {
    await browser?.close();
    server?.kill('SIGTERM');
  });
  await waitForServer();
  browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${origin}/`);
  await ready(page, '.lt-home');
  await page.locator('[data-site-menu]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#lt-site-menu').isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '首页');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '断代');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement?.hasAttribute('data-site-menu')),
    true,
    '菜单焦点不得进入背景',
  );
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '首页');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-site-menu')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#lt-site-menu').isHidden(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-site-menu')), true);
  await page.locator('[data-site-menu]').click();
  await page.locator('#lt-site-menu a[href="/people"]').click();
  await ready(page, '.lt-directory-page');
  assert.equal(new URL(page.url()).pathname, '/people');
  await page.locator('[data-filter-open]').click();
  assert.equal(
    await page.locator('[data-filter-dialog]').evaluate((dialog) => (dialog as HTMLDialogElement).open),
    true,
  );
  await page.locator('[data-filter-dialog] input[name="dynasty"][value="tang"]').check();
  await page.locator('[data-filter-dialog] button[type="submit"]').click();
  await ready(page, '.lt-directory-page');
  assert.match(page.url(), /dynasty=tang/);
  await page.locator('.lt-skip-link').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');

  for (const route of ['/people/li-bai', '/events/anshi-zhiluan', '/collections/rujia-chuancheng?tab=relations']) {
    await page.goto(`${origin}${route}`);
    await ready(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noOverflow(page);
    await page.evaluate(() => document.querySelector('style')?.remove());
  }
  const zoom = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await zoom.goto(`${origin}/people/li-bai`);
  await ready(zoom, '.lt-person-page');
  const client = await zoom.context().newCDPSession(zoom);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
  await zoom.getByRole('link', { name: '在年表中查看' }).focus();
  assert.equal(await zoom.evaluate(() => document.activeElement?.getAttribute('data-timeline-link') !== null), true);
  await zoom.keyboard.press('Enter');
  await ready(zoom, '.timeline-app #card.show');
  assert.match(zoom.url(), /person=li-bai/);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await zoom.close();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/people?q=%E6%9D%8E%E7%99%BD`);
  await ready(page, '.lt-person-directory');
  await page.route('**/data/people/li-bai.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.locator('a[data-entity-id="li-bai"]').first().click();
  await page.locator('.lt-main-nav a[href="/eras"]').click();
  await ready(page, '.lt-era-group');
  await page.waitForTimeout(800);
  assert.equal(new URL(page.url()).pathname, '/eras', '慢请求不得覆盖后续导航');
  assert.equal(await page.locator('h1').innerText(), '断代');
});

test('M6 production 深链、异常恢复、并行请求与兼容', { timeout: 100_000 }, async (context) => {
  const server = previewServer();
  let browser: Browser | undefined;
  context.after(async () => {
    await browser?.close();
    server?.kill('SIGTERM');
  });
  await waitForServer();
  browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  for (const route of [
    '/people?dynasty=invalid&page=999&sort=nope&view=bad',
    '/events?type=nope&catalog=nope&person=nope',
    '/collections/rujia-chuancheng?tab=nope&member=nope&relation=nope',
    '/eras/tang?tab=nope',
    '/search?q=%E6%9D%8E%E7%99%BD&type=nope',
  ]) {
    await page.goto(`${origin}${route}`);
    await ready(page, '#site-page[aria-busy="false"] main h1');
    assert.equal(await page.locator('.lt-state-page').count(), 0, route);
    assert.match(await page.locator('.lt-notice').innerText(), /无效|忽略|无法识别|恢复/);
  }
  await page.goto(`${origin}/not-a-route`);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('未找到该页面'));
  assert.match(await page.locator('h1').innerText(), /未找到该页面/);
  await page.goto(`${origin}/?path=/people/li-bai`);
  await ready(page, '.lt-person-page');
  assert.equal(new URL(page.url()).pathname, '/people/li-bai');
  await page.reload();
  await ready(page, '.lt-person-page');
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.timeline-app #card.show');
  assert.match(page.url(), /person=li-bai/);

  await page.route('**/data/index.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/people`);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('暂时无法加载'));
  assert.match(await page.locator('h1').innerText(), /暂时无法加载/);
  await page.unroute('**/data/index.json');
  await page.locator('[data-retry]').click();
  await ready(page, '.lt-person-directory');

  const parallelPage = await browser.newPage();
  await parallelPage.goto(`${origin}/search?q=%E5%94%90&type=all`);
  await ready(parallelPage, '.lt-search-tabs');
  const requestStarts = await parallelPage.evaluate(() =>
    (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((entry) => new URL(entry.name).pathname.startsWith('/data/'))
      .map((entry) => ({ path: new URL(entry.name).pathname, startTime: entry.startTime })),
  );
  assert.ok(requestStarts.length >= 6, JSON.stringify(requestStarts));
  const starts = requestStarts.map((request) => request.startTime);
  assert.ok(Math.max(...starts) - Math.min(...starts) < 150, JSON.stringify(requestStarts));
  await parallelPage.close();

  let failEra = true;
  await page.route('**/data/eras/tang.json', (route) =>
    failEra ? route.fulfill({ status: 500, body: 'failed' }) : route.continue(),
  );
  await page.goto(`${origin}/eras/tang`);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('暂时无法加载该朝代'));
  assert.match(await page.locator('h1').innerText(), /暂时无法加载该朝代/);
  failEra = false;
  await page.locator('[data-retry]').click();
  await ready(page, '.lt-era-page');
  await page.unroute('**/data/eras/tang.json');

  let failCollection = true;
  await page.route('**/data/collections/rujia-chuancheng.json', (route) =>
    failCollection ? route.fulfill({ status: 500, body: 'failed' }) : route.continue(),
  );
  await page.goto(`${origin}/collections/rujia-chuancheng`);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('暂时无法加载'));
  assert.match(await page.locator('h1').innerText(), /暂时无法加载/);
  failCollection = false;
  await page.locator('[data-retry-collection]').click();
  await ready(page, '.lt-collection-page');
  await page.unroute('**/data/collections/rujia-chuancheng.json');

  await page.goto(`${origin}/#history/event/anshi-zhiluan`);
  await ready(page, '.timeline-app #card.show');
  assert.match(await page.locator('#card-body').innerText(), /安史之乱/);
  await page.locator('[data-open-detail]').click();
  await ready(page, '.lt-event-page');
  await page.reload();
  await ready(page, '.lt-event-page');
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.timeline-app #card.show');
  assert.match(page.url(), /#history\/event\/anshi-zhiluan/);
  assert.match(await page.locator('#card-body').innerText(), /安史之乱/);
  assert.deepEqual(pageErrors, []);
});
