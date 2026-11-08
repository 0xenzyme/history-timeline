import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { assertNoHorizontalOverflow as assertNoOverflow } from './browser-overflow';

const origin = process.env.M3_TEST_ORIGIN ?? 'http://127.0.0.1:5190';
const screenshotDir = join(process.cwd(), '.impeccable', 'review');

async function ready(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
}

test('M3 Chrome 核心路径、四档视口、键盘、异常与旧年表回归', { timeout: 120_000 }, async (context) => {
  mkdirSync(screenshotDir, { recursive: true });
  const server: ChildProcess | undefined = process.env.M3_TEST_ORIGIN
    ? undefined
    : spawn(
        process.execPath,
        [
          join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'),
          '--host',
          '127.0.0.1',
          '--port',
          '5190',
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
  const executablePath =
    process.env.CHROME_PATH ??
    (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (process.env.M3_DEBUG) console.log(message.type(), message.text());
  });

  const tang =
    '/timeline?topic=tang&view=tianbao&person=li-bai&from=710&to=770&chip=female&hide=lane%3Ageneral&scroll=0';
  await page.goto(`${origin}${tang}`);
  await ready(page, '.timeline-app #card.show');
  assert.match(await page.locator('#card-body').innerText(), /李白/);
  await page.click('.chip[data-filter="female"]');
  assert.match(page.url(), /chip=female/);
  assert.match(page.url(), /hide=lane%3Ageneral|hide=lane:general/);
  await assertNoOverflow(page);
  await page.locator('#timeline-accessible-entities summary').click();
  await page.waitForSelector('#timeline-entity-list button[data-id="yang-yu-huan"]');
  const visibleButton = page.locator('#timeline-entity-list button[data-id="yang-yu-huan"]');
  await visibleButton.focus();
  await page.keyboard.press('Enter');
  await ready(page, '.timeline-app #card.show');
  await page.screenshot({ path: join(screenshotDir, 'm3-timeline-1440.png') });

  await page.click('.chip[data-filter="all"]');
  await page.locator('#timeline-entity-list button[data-id="li-bai"]').click();
  const sourceUrl = new URL(page.url());
  const sourceFrom = sourceUrl.searchParams.get('from');
  const sourceTo = sourceUrl.searchParams.get('to');
  await page.click('[data-open-detail]');
  await ready(page, '.lt-person-page');
  assert.equal(new URL(page.url()).pathname, '/people/li-bai');
  const personText = await page.locator('.lt-person-page').innerText();
  assert.match(personText, /701—762 年/);
  assert.match(personText, /约 742 年/);
  assert.match(personText, /尚无直接关联事件/);
  assert.doesNotMatch(personText, /安史之乱/);
  assert.doesNotMatch(personText, /蜀道难[\s\S]{0,50}创作于/);
  await page.locator('.lt-year-note summary').click();
  assert.match(await page.locator('.lt-year-note').innerText(), /天宝初/);
  await page.click('[data-return-fallback]');
  await ready(page, '.timeline-app #card.show');
  await page.waitForFunction(() => !document.body.dataset.timelineRestoring);
  await page.waitForFunction(
    ({ from, to }) =>
      new URLSearchParams(location.search).get('from') === from &&
      new URLSearchParams(location.search).get('to') === to,
    { from: sourceFrom, to: sourceTo },
  );
  assert.match(page.url(), /view=tianbao/);
  assert.match(page.url(), /person=li-bai/);

  await page.goto(
    `${origin}/timeline?topic=tang&view=tianbao&person=li-bai&from=710&to=770&hide=lane%3Ageneral&scroll=180`,
  );
  await ready(page, '.timeline-app #card.show');
  const oldTo = new URL(page.url()).searchParams.get('to');
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, -180);
  await page.waitForFunction((before) => new URLSearchParams(location.search).get('to') !== before, oldTo);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 80);
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('scroll') !== '180');
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(780, 500, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const interactionUrl = page.url();
  await page.click('[data-open-detail]');
  await ready(page, '.lt-person-page');
  await page.click('[data-return-fallback]');
  await ready(page, '.timeline-app #card.show');
  assert.equal(page.url(), interactionUrl);
  assert.match(page.url(), /hide=lane%3Ageneral|hide=lane:general/);

  await page.goto(`${origin}/events/anshi-zhiluan`);
  await ready(page, '.lt-event-page');
  const eventText = await page.locator('.lt-event-page').innerText();
  assert.match(eventText, /755—763 年/);
  assert.match(eventText, /民变/);
  assert.match(eventText, /组成事件/);
  assert.match(eventText, /香积寺/);
  assert.match(eventText, /睢阳保卫战/);
  assert.match(eventText, /阻遏叛军南下江淮/);
  assert.doesNotMatch(eventText, /下级军事行动/);
  await page.locator('[data-return-fallback]').click();
  await ready(page, '.timeline-app #card.show');
  assert.match(page.url(), /line=history/);
  assert.match(page.url(), /event=anshi-zhiluan/);
  assert.match(page.url(), /from=750/);
  assert.match(page.url(), /to=768/);

  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const kind of ['people/li-bai', 'events/anshi-zhiluan']) {
      await page.goto(`${origin}/${kind}`);
      await ready(page, '.lt-page h1');
      await assertNoOverflow(page);
      await page.screenshot({ path: join(screenshotDir, `m3-${kind.replace('/', '-')}-${width}.png`), fullPage: true });
    }
    await page.goto(`${origin}${tang}`);
    await ready(page, '.timeline-app #card.show');
    await assertNoOverflow(page);
    await page.screenshot({ path: join(screenshotDir, `m3-timeline-${width}.png`) });
  }

  await page.goto(`${origin}/people/not-a-person`);
  await page.waitForFunction(() => document.querySelector('.lt-state-page')?.textContent?.includes('未找到该人物'));
  assert.match(await page.locator('.lt-state-page').innerText(), /未找到该人物/);
  await page.goto(`${origin}/events/not-an-event`);
  await page.waitForFunction(() => document.querySelector('.lt-state-page')?.textContent?.includes('未找到该事件'));
  assert.match(await page.locator('.lt-state-page').innerText(), /未找到该事件/);
  await page.route('**/data/people/li-bai.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/people/li-bai`);
  await page.waitForFunction(() =>
    document.querySelector('.lt-state-page')?.textContent?.includes('暂时无法加载该人物'),
  );
  assert.match(await page.locator('.lt-state-page').innerText(), /暂时无法加载该人物/);
  assert.equal(await page.locator('[data-retry]').count(), 1);
  await page.unroute('**/data/people/li-bai.json');

  await page.route('**/data/history.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/people/li-bai`);
  await ready(page, '.lt-person-page');
  assert.match(await page.locator('.lt-person-page').innerText(), /绵州昌隆人/);
  assert.match(await page.locator('.lt-notice').innerText(), /部分关联数据暂时无法加载/);
  await page.unroute('**/data/history.json');
  await page.locator('.lt-notice [data-retry]').click();
  await ready(page, '.lt-person-page');
  assert.equal(await page.locator('.lt-notice').count(), 0);

  await page.route('**/data/history.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.route('**/data/military.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto(`${origin}/events/anshi-zhiluan`);
  await ready(page, '.lt-event-page');
  assert.match(await page.locator('.lt-event-page').innerText(), /755—763 年/);
  await page.unroute('**/data/history.json');
  await page.unroute('**/data/military.json');

  await page.goto(`${origin}/people/li-bai`);
  await ready(page, '.lt-person-page');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await assertNoOverflow(page);
  assert.equal(await page.getByRole('link', { name: '在年表中查看' }).count(), 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

  await page.route('**/data/collections.json', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.route('**/media/people/li-bai.webp', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto(`${origin}/people/li-bai`);
  await ready(page, '.lt-person-page');
  assert.match(await page.locator('.lt-person-page').innerText(), /绵州昌隆人/);
  assert.equal(await page.locator('.lt-person-monogram').innerText(), '李');
  await page.unroute('**/data/collections.json');
  await page.unroute('**/media/people/li-bai.webp');

  await page.goto(`${origin}/events/changban-zhizhan`);
  await ready(page, '.lt-event-page');
  assert.match(
    (await page.locator('[data-return-fallback]').getAttribute('data-return-fallback')) ?? '',
    /line=military/,
  );
  await page.click('[data-return-fallback]');
  await ready(page, '.timeline-app #card.show');
  assert.match(page.url(), /line=military/);
  assert.match(page.url(), /event=changban-zhizhan/);

  await page.click('[data-open-detail]');
  await ready(page, '.lt-event-page');
  await page.locator('a[data-entity-kind="person"]').first().click();
  await ready(page, '.lt-person-page');
  await page.click('[data-return-fallback]');
  await ready(page, '.lt-event-page');
  await page.click('[data-return-fallback]');
  await ready(page, '.timeline-app #card.show');
  assert.match(page.url(), /event=changban-zhizhan/);
  assert.match(page.url(), /line=military/);

  const deepSpace = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await deepSpace.goto(`${origin}/timeline?topic=tang&view=tianbao&person=li-bai&from=710&to=770`);
  await deepSpace.evaluate(() => localStorage.setItem('ht-skin', 'deepspace'));
  await deepSpace.reload();
  await ready(deepSpace, '.timeline-app #card.show');
  const deepSpaceTo = new URL(deepSpace.url()).searchParams.get('to');
  await deepSpace.mouse.move(700, 500);
  await deepSpace.mouse.wheel(0, -100);
  await deepSpace.waitForFunction((before) => new URLSearchParams(location.search).get('to') !== before, deepSpaceTo);
  await deepSpace.goto(`${origin}/timeline?topic=tang&view=tianbao&person=li-bai&from=650&to=830`);
  await ready(deepSpace, '.timeline-app #card.show');
  await deepSpace.mouse.move(650, 500);
  await deepSpace.mouse.down();
  await deepSpace.mouse.move(690, 500, { steps: 3 });
  await deepSpace.mouse.up();
  await deepSpace.waitForTimeout(1400);
  const inertialUrl = deepSpace.url();
  await deepSpace.mouse.move(700, 500);
  await deepSpace.mouse.wheel(0, 0);
  await deepSpace.waitForTimeout(100);
  assert.equal(deepSpace.url(), inertialUrl, '惯性停止后 URL 应保留最终视窗');
  await deepSpace.close();

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await touch.goto(`${origin}${tang}`);
  await ready(touch, '.timeline-app #card.show');
  const action = await touch.locator('[data-open-detail]').boundingBox();
  assert.ok(action && action.y >= 0 && action.y + action.height <= 844, '移动预览的详情主操作应可见');
  await touch.locator('#card-close').click();
  const beforeZoom = new URL(touch.url()).searchParams.get('to');
  const client = await touch.context().newCDPSession(touch);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 80, y: 400, id: 0 },
      { x: 160, y: 400, id: 1 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 45, y: 400, id: 0 },
      { x: 195, y: 400, id: 1 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.waitForTimeout(100);
  assert.notEqual(new URL(touch.url()).searchParams.get('to'), beforeZoom, '双指缩放应改变时间窗');
  assert.equal(await touch.locator('#card').getAttribute('class'), 'card lt-timeline-detail');
  await touch.close();

  const legacy = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  legacy.on('pageerror', (error) => errors.push(error.message));
  touch.on('pageerror', (error) => errors.push(error.message));
  await legacy.goto(`${origin}/#tang`);
  await ready(legacy, '.timeline-app #topic-select');
  assert.equal(await legacy.locator('.timeline-app #topic-select').inputValue(), 'tang');
  await legacy.fill('#search', '李太白');
  await legacy.press('#search', 'Enter');
  await ready(legacy, '#card.show');
  await legacy.click('#card-close');
  await legacy.locator('.lane-chapter').first().click();
  await legacy.click('#card-close');
  await legacy.goto(`${origin}/#military`);
  await legacy.fill('#search', '香积寺');
  await legacy.press('#search', 'Enter');
  await ready(legacy, '#card.show');
  await legacy.click('#card-close');
  await legacy.goto(`${origin}/#history`);
  await legacy.goto(`${origin}/#history/event/anshi-zhiluan`);
  await ready(legacy, '#card.show');
  assert.match(await legacy.locator('#card-body').innerText(), /安史之乱/);
  await legacy.click('#card-close');
  await legacy.goto(`${origin}/#tang`);
  await ready(legacy, '.timeline-app #topic-select');
  await legacy.fill('#search', '李太白');
  await legacy.press('#search', 'Enter');
  await ready(legacy, '#card.show');
  await legacy.click('[data-open-detail]');
  await ready(legacy, '.lt-person-page');
  await legacy.click('[data-return-fallback]');
  await ready(legacy, '.timeline-app #topic-select');
  assert.match(legacy.url(), /#tang\/overview/);
  assert.equal(await legacy.locator('#topic-select').inputValue(), 'tang');
  await legacy.click('#btn-reset');
  await legacy.mouse.move(700, 420);
  await legacy.mouse.wheel(0, -200);
  await legacy.mouse.down();
  await legacy.mouse.move(790, 420);
  await legacy.mouse.up();
  await legacy.click('[data-group="history"]');
  await legacy.click('[data-group="history"]');
  for (const format of ['svg', 'png'] as const) {
    const pending = legacy.waitForEvent('download');
    await legacy.click(`.lt-timeline-hero [data-export="${format}"]`);
    const download = await pending;
    const file = await download.path();
    assert.ok(file);
    const bytes = readFileSync(file!);
    assert.ok(bytes.length > 1000);
  }
  await page.route('**/data/people/an-lu-shan.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto(`${origin}/events/anshi-zhiluan`);
  await ready(page, '.lt-event-page');
  await page.locator('a[data-entity-id="an-lu-shan"]').click();
  await page.goBack();
  await ready(page, '.lt-event-page');
  assert.equal(await page.locator('h1').innerText(), '安史之乱');
  await page.unroute('**/data/people/an-lu-shan.json');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        browser: await browser.version(),
        viewports: [1440, 768, 390, 320],
        checks: [
          'route-state',
          'keyboard-selection',
          'person-sample',
          'event-composition',
          'direct-fallback',
          'four-viewports',
          'invalid-id',
          'core-failure',
          'partial-failure',
          'image-fallback',
          'touch-pinch',
          'mobile-detail-action',
          'text-zoom',
          'reduced-motion',
          'legacy-deep-link',
          'legacy-controls',
          'png-svg-export',
        ],
      },
      null,
      2,
    ),
  );
});
