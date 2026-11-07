import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import type { CollectionDetail, EventDetail, Person, PersonDetail } from '../src/types';
import { event, person } from './fixtures';

const origin = process.env.M5_TEST_ORIGIN ?? 'http://127.0.0.1:5197';
const screenshotDir = join(process.cwd(), '.impeccable', 'review');
let sharedServer: ChildProcess | undefined;

before(async () => {
  if (process.env.M5_TEST_ORIGIN) return;
  sharedServer = spawn(
    process.execPath,
    [
      join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      '5197',
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`M5 测试服务器未就绪：${origin}`);
});

after(() => sharedServer?.kill('SIGTERM'));

async function ready(page: Page, selector = '#site-page[aria-busy="false"]'): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
}

async function noOverflow(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(size.page <= size.viewport, JSON.stringify(size));
}

function detail(id: string, card: Person, works?: PersonDetail['works']): PersonDetail {
  return {
    contractVersion: 1,
    id,
    name: card.name,
    display: card.display,
    birth: card.birth,
    birthAccuracy: card.birthAccuracy,
    death: card.death,
    deathAccuracy: card.deathAccuracy,
    profile: 'brief',
    topics: id === 'fixture-a' ? [{ id: 'chunqiu', title: '春秋', lane: '' }] : [],
    relations: [],
    events: [],
    collections: [],
    ...(works?.length ? { works } : {}),
    sources: [{ work: '隔离测试出处' }],
  };
}

function fixtureCollection(): { collection: CollectionDetail; people: Map<string, PersonDetail> } {
  const cards = [
    person({ id: 'fixture-a', display: '甲', birth: -500, death: -420 }),
    person({ id: 'fixture-b', display: '乙', birthAccuracy: 'unknown', death: -400, deathAccuracy: 'approx' }),
    person({ id: 'fixture-c', display: '丙', birth: -350, death: -300 }),
    person({ id: 'fixture-d', display: '丁', birth: -200, death: -100 }),
    person({ id: 'fixture-e', display: '戊', birthAccuracy: 'unknown', deathAccuracy: 'unknown' }),
  ];
  const people = new Map([
    [
      'fixture-a',
      detail('fixture-a', cards[0], [
        { id: 'work-a', title: '甲书', kind: 'book', sources: [{ work: '隔离测试出处' }] },
      ]),
    ],
    [
      'fixture-b',
      detail('fixture-b', cards[1], [
        {
          id: 'work-b',
          title: '乙篇',
          kind: 'prose',
          year: -390,
          yearAccuracy: 'approx',
          yearNote: '夹具约略年份',
          sources: [{ work: '隔离测试出处' }],
        },
      ]),
    ],
    ['fixture-c', detail('fixture-c', cards[2])],
    ['fixture-d', detail('fixture-d', cards[3])],
    ['fixture-e', detail('fixture-e', cards[4])],
  ]);
  const collection: CollectionDetail = {
    contractVersion: 1,
    id: 'm5-fixture',
    status: 'published',
    name: '隔离能力夹具',
    category: 'thought',
    summary: '仅用于请求拦截的界面测试，不属于正式历史内容。',
    body: '此实体仅存在于浏览器测试。',
    tags: ['测试'],
    members: [
      { id: 'fixture-c', order: 2, featured: true, role: '第二顺序' },
      { id: 'fixture-a', order: 1, role: '第一顺序' },
      { id: 'fixture-e', order: 5, role: '年份待考' },
      { id: 'fixture-b', order: 3 },
      { id: 'fixture-d', order: 4 },
    ],
    relations: [
      { source: 'fixture-a', target: 'fixture-b', type: 'mentor' },
      { source: 'fixture-c', target: 'fixture-d', type: 'peer' },
    ],
    events: ['fixture-event-b', 'fixture-event-a'],
    views: ['overview', 'members', 'timeline', 'relations', 'events', 'works'],
    defaultView: 'members',
    path: [
      { label: '阅读甲', person: 'fixture-a', view: 'works' },
      { label: '阅读事件', event: 'fixture-event-a', view: 'events' },
    ],
    sources: [{ work: '隔离测试出处' }],
    people: cards,
    resolvedRelations: [
      {
        source: 'fixture-a',
        target: 'fixture-b',
        type: 'mentor',
        directed: true,
        notes: ['甲至乙'],
        topicIds: ['fixture'],
      },
      {
        source: 'fixture-c',
        target: 'fixture-d',
        type: 'peer',
        directed: false,
        notes: ['丙与丁'],
        topicIds: ['fixture'],
      },
    ],
    eventRecords: [
      event({
        id: 'fixture-event-a',
        display: '较早夹具事件',
        year: -480,
        type: 'cultural',
        place: '甲地',
        desc: '夹具事件说明。',
      }),
      event({ id: 'fixture-event-b', display: '较晚夹具事件', year: 100, endYear: 102, type: 'political' }),
    ],
  };
  return { collection, people };
}

test('M5 Chrome 真实儒家传承、来源往返、键盘和响应式', { timeout: 120_000 }, async () => {
  mkdirSync(screenshotDir, { recursive: true });
  let browser: Browser | undefined;
  const errors: string[] = [];
  try {
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
    const real = '/collections/rujia-chuancheng';

    await page.goto(`${origin}/search?q=%E5%84%92%E5%AE%B6%E4%BC%A0%E6%89%BF&type=collection`);
    await ready(page, '.lt-search-group');
    await page.locator('a[href="/collections/rujia-chuancheng"]').first().click();
    await ready(page, '.lt-collection-page');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
    assert.deepEqual(await page.locator('[role="tab"]').allTextContents(), [
      '概览',
      '系列人物',
      '人物年表',
      '人物关系',
    ]);
    assert.equal(await page.locator('.lt-collection-member-list > li').count(), 3);
    assert.equal(await page.locator('.lt-collection-path > li').count(), 3);
    assert.match(await page.locator('#collection-sources').locator('..').innerText(), /史记|宋史/);
    await page.locator('.lt-path-view').first().click();
    await ready(page, '.lt-relation-list');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'collection-view');
    assert.match(page.url(), /tab=relations&member=kong-zi/);
    assert.equal(await page.locator('.lt-collection-relation-list > li').count(), 2);
    assert.equal(await page.locator('.lt-relation-node').count(), 5);
    assert.equal(await page.locator('.lt-relation-edge line[marker-end]').count(), 2);
    assert.match(await page.locator('.lt-collection-relation-list').innerText(), /孔子 → 颜回/);
    assert.match(await page.locator('.lt-collection-relation-list').innerText(), /孔子 → 曾子/);
    assert.doesNotMatch(await page.locator('.lt-collection-relation-list').innerText(), /孟子 → 朱熹/);
    await page.locator('[data-collection-view-mode="list"]').click();
    assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);
    assert.match(page.url(), /relation=list/);
    await page.locator('[data-collection-member-filter="yan-hui"]').click();
    await ready(page, '.lt-collection-relation-list');
    assert.match(page.url(), /member=yan-hui&relation=list/);
    assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);
    assert.equal(await page.locator('.lt-collection-relation-list > li').count(), 1);
    await page.reload();
    await ready(page, '.lt-relation-list');
    assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);

    await page.locator('[data-collection-tab="timeline"]').click();
    await ready(page, '.lt-member-timeline');
    const timelineHref = await page.locator('.lt-collection-view [data-timeline-link]').getAttribute('href');
    assert.match(timelineHref ?? '', /from=-604&to=1253/);
    assert.doesNotMatch(timelineHref ?? '', /-560|-90/);
    const chronology = await page.locator('.lt-collection-chronology').innerText();
    for (const name of ['孔子', '颜回', '曾子', '孟子', '朱熹']) assert.match(chronology, new RegExp(name));
    assert.match(chronology, /前 551（异说）/);
    assert.match(chronology, /约 前 372/);
    assert.match(chronology, /1130—1200/);
    await page.locator('.lt-collection-view [data-timeline-link]').click();
    await page.waitForSelector('.timeline-app #chart');
    assert.match(page.url(), /from=-604&to=1253/);
    await page.goBack();
    await ready(page, '.lt-member-timeline');
    const timelineScrollTarget = await page
      .locator('#collection-member-zhu-xi')
      .evaluate((node) => node.getBoundingClientRect().top + scrollY);
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), timelineScrollTarget);
    const savedTimelineScroll = await page.evaluate(() => scrollY);
    await page.locator('#collection-member-zhu-xi a[data-entity-kind="person"]').click();
    await ready(page, '.lt-person-page');
    assert.equal(new URL(page.url()).pathname, '/people/zhu-xi');
    await page.locator('[data-return-fallback]').click();
    await ready(page, '.lt-member-timeline');
    assert.match(page.url(), /tab=timeline/);
    await page.waitForFunction((top) => scrollY === top, savedTimelineScroll);

    await page.locator('[data-collection-tab="timeline"]').focus();
    await page.keyboard.press('ArrowRight');
    await ready(page, '.lt-relation-list');
    assert.match(page.url(), /tab=relations/);
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), '人物关系');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '人物关系');
    assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
    await page.keyboard.press('Home');
    await ready(page, '.lt-collection-path');
    assert.equal(new URL(page.url()).search, '');

    await page.locator('[data-collection-tab="members"]').click();
    await ready(page, '.lt-collection-member-list');
    await page.goBack();
    await ready(page, '.lt-collection-path');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
    await page.locator('[data-collection-tab="members"]').click();
    await ready(page, '.lt-collection-member-list');
    assert.equal(await page.locator('.lt-collection-member-list > li').count(), 5);
    assert.deepEqual(await page.locator('.lt-collection-member-list > li > .lt-data').allTextContents(), [
      '01',
      '02',
      '03',
      '04',
      '05',
    ]);
    await page.locator('[data-return-fallback]').click();
    await ready(page, '.lt-search-group');
    assert.match(page.url(), /type=collection/);
    assert.equal(new URL(page.url()).pathname, '/search');
    await page.goBack();
    await page.waitForFunction(() => location.pathname !== '/collections/rujia-chuancheng');
    assert.doesNotMatch(page.url(), /collections\/rujia-chuancheng/);

    await page.setViewportSize({ width: 390, height: 560 });
    await page.goto(`${origin}/eras/spring-autumn?tab=collections`);
    await ready(page, '.lt-collection-card');
    await page.evaluate(() => scrollTo({ top: 440, behavior: 'instant' }));
    const eraSourceScroll = await page.evaluate(() => scrollY);
    await page.locator('.lt-collection-card .lt-card-primary').click();
    await ready(page, '.lt-collection-page');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
    await page.locator('[data-collection-tab="members"]').click();
    await ready(page, '.lt-collection-member-list');
    await page.locator('[data-return-fallback]').click();
    await ready(page, '.lt-era-page');
    assert.match(page.url(), /eras\/spring-autumn\?tab=collections/);
    await page.waitForFunction((top) => scrollY === top, eraSourceScroll);
    await page.goBack();
    await page.waitForFunction(() => location.pathname !== '/collections/rujia-chuancheng');
    assert.doesNotMatch(page.url(), /collections\/rujia-chuancheng/);
    await page.goto(`${origin}/eras/spring-autumn?tab=collections`);
    await ready(page, '.lt-era-page');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}${real}?tab=invalid&member=invalid&relation=invalid`);
    await ready(page, '.lt-collection-page');
    assert.equal(new URL(page.url()).search, '');
    assert.match(await page.locator('.lt-notice').innerText(), /tab、member、relation/);
    await page.goto(`${origin}${real}#%E0%A4%A`);
    await ready(page, '.lt-collection-page');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
    await page.goto(`${origin}${real}?tab=relations&member=meng-zi`);
    await ready(page, '.lt-empty-results');
    await page.locator('[data-collection-view-mode="list"]').click();
    await page.locator('[data-collection-member-filter=""]').last().click();
    await ready(page, '.lt-collection-relation-list');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
    assert.match(page.url(), /relation=list/);
    assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);
    await page.goto(`${origin}/collections/not-a-collection`);
    await ready(page, '.lt-state-page');
    assert.match(await page.locator('h1').innerText(), /未找到该群像系列/);
    let failCore = true;
    await page.route(`**/data/collections/rujia-chuancheng.json`, (route) =>
      failCore ? route.fulfill({ status: 500, body: 'failed' }) : route.continue(),
    );
    await page.goto(`${origin}${real}`);
    await ready(page, '.lt-state-page');
    await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('暂时无法加载'));
    assert.match(await page.locator('h1').innerText(), /暂时无法加载/);
    failCore = false;
    await page.locator('[data-retry-collection]').click();
    await ready(page, '.lt-collection-page');
    await page.unroute(`**/data/collections/rujia-chuancheng.json`);

    await page.goto(`${origin}${real}?tab=timeline`);
    await ready(page, '.lt-member-timeline');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noOverflow(page);
    assert.equal(await page.locator('.lt-collection-view [data-timeline-link]').count(), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await page.evaluate(() => document.querySelector('style')?.remove());

    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [320, 568],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const [name, suffix] of [
        ['overview', ''],
        ['timeline', '?tab=timeline'],
        ['relations', '?tab=relations'],
      ] as const) {
        await page.goto(`${origin}${real}${suffix}`);
        await ready(page, '.lt-collection-page');
        await noOverflow(page);
        const selectedTab = await page.locator('[role="tab"][aria-selected="true"]').boundingBox();
        assert.ok(
          selectedTab && selectedTab.x >= 0 && selectedTab.x + selectedTab.width <= width,
          `${name} 当前 tab 应可见`,
        );
        if (width <= 767 && name === 'relations')
          assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);
        await page.screenshot({
          path: join(screenshotDir, `m5-real-${name}-${width}.png`),
          fullPage: name !== 'relations',
        });
      }
    }
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    touch.on('pageerror', (error) => errors.push(error.message));
    await touch.goto(`${origin}${real}?tab=relations`);
    await ready(touch, '.lt-relation-list');
    await touch.locator('[data-collection-view-mode="graph"]').tap();
    assert.equal(await touch.locator('.lt-relation-graph-container').isVisible(), true);
    const target = await touch.locator('[data-collection-view-mode="list"]').boundingBox();
    assert.ok(target && target.height >= 44);
    await touch.close();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${origin}${real}?tab=relations`);
    await ready(page, '.lt-relation-list');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noOverflow(page);
    assert.equal(await page.locator('.lt-relation-graph-container').isHidden(), true);
    await page.screenshot({ path: join(screenshotDir, 'm5-real-relations-320-zoom.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        result: 'passed',
        layer: 'real-content',
        browser: await browser.version(),
        viewports: [1440, 768, 390, 320],
      }),
    );
  } finally {
    await browser?.close();
  }
});

test('M5 Chrome 隔离 fixture 事件、作品、空状态与局部重试', { timeout: 75_000 }, async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const { collection, people } = fixtureCollection();
    let failWork = true;
    let failTimeline = true;
    await page.route('**/data/collections/m5-fixture.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(collection) }),
    );
    await page.route('**/data/people/fixture-*.json', (route) => {
      const id = route.request().url().split('/').pop()!.replace('.json', '');
      if ((id === 'fixture-b' && failWork) || (id === 'fixture-a' && failTimeline)) {
        return route.fulfill({ status: 500, body: 'fixture failure' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(people.get(id)) });
    });
    await page.route('**/data/events/fixture-event-a.json', (route) => {
      const detail: EventDetail = {
        ...collection.eventRecords[0],
        contractVersion: 1,
        children: [],
        components: [],
        personRecords: [],
        collections: [collection.id],
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail) });
    });
    await page.goto(`${origin}/collections/m5-fixture`);
    await ready(page, '.lt-collection-member-list');
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), '系列人物');
    assert.deepEqual(
      await page
        .locator('.lt-collection-member-list [data-member-id]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-member-id'))),
      ['fixture-a', 'fixture-c', 'fixture-b', 'fixture-d', 'fixture-e'],
    );
    await page.locator('[data-collection-tab="events"]').click();
    await ready(page, '.lt-collection-event-list');
    assert.equal(await page.locator('.lt-collection-event-list > li').count(), 2);
    assert.match(await page.locator('.lt-collection-event-list > li').first().innerText(), /较早夹具事件/);
    assert.match(await page.locator('.lt-collection-event-list > li').last().innerText(), /100—102/);
    await page.locator('a[data-entity-id="fixture-event-a"]').click();
    await ready(page, '.lt-event-page');
    assert.equal(await page.locator('h1').innerText(), '较早夹具事件');
    assert.match(await page.locator('.lt-event-page').innerText(), /夹具事件说明/);
    await page.locator('[data-return-fallback]').click();
    await ready(page, '.lt-collection-event-list');
    assert.match(page.url(), /tab=events/);
    await page.unroute('**/data/events/fixture-event-a.json');
    await page.locator('a[data-entity-id="fixture-event-a"]').click();
    await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('未找到该事件'));
    assert.match(await page.locator('h1').innerText(), /未找到该事件/);
    await page.goBack();
    await ready(page, '.lt-collection-event-list');
    assert.match(page.url(), /tab=events/);

    await page.goto(`${origin}/collections/m5-fixture?tab=timeline`);
    await ready(page, '.lt-member-timeline');
    assert.match(await page.locator('.lt-module-error').innerText(), /人物专题入口暂时无法加载/);
    assert.equal(await page.locator('.lt-collection-chronology > li').count(), 4);
    assert.match(await page.locator('.lt-undated-members').innerText(), /戊|生卒年不详/);
    assert.match(await page.locator('.lt-collection-chronology').innerText(), /约 前 400/);
    failTimeline = false;
    await page.locator('[data-collection-retry="timeline"]').click();
    await ready(page, '.lt-member-timeline');
    assert.match(
      (await page.locator('.lt-collection-view [data-timeline-link]').getAttribute('href')) ?? '',
      /topic=chunqiu/,
    );

    await page.goto(`${origin}/collections/m5-fixture?tab=relations`);
    await ready(page, '.lt-relation-list');
    assert.equal(await page.locator('.lt-relation-node').count(), 5);
    assert.equal(await page.locator('.lt-relation-edge').count(), 2);
    assert.match(await page.locator('.lt-relation-list').innerText(), /丙 与 丁/);
    await page.locator('[data-collection-member-filter="fixture-e"]').click();
    await ready(page, '.lt-empty-results');
    assert.match(await page.locator('.lt-empty-results').innerText(), /该成员没有系列内直接关系/);

    await page.goto(`${origin}/collections/m5-fixture?tab=works`);
    await ready(page, '.lt-collection-work-list');
    assert.match(await page.locator('.lt-module-error').innerText(), /未能读取：乙/);
    assert.match(await page.locator('.lt-collection-work-list').innerText(), /甲书/);
    assert.match(await page.locator('.lt-collection-work-list').innerText(), /创作年未记录/);
    failWork = false;
    await page.locator('[data-collection-retry="works"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.lt-collection-work-group').length === 2);
    assert.equal(await page.locator('.lt-module-error').count(), 0);
    assert.match(await page.locator('section[aria-labelledby="collection-works"]').innerText(), /乙篇/);
    assert.match(await page.locator('section[aria-labelledby="collection-works"]').innerText(), /约 前 390/);
    assert.equal(await page.locator('.lt-collection-work-group').count(), 2);

    await page.route('**/data/people/fixture-*.json', (route) => {
      const id = route.request().url().split('/').pop()!.replace('.json', '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(people.get(id)) });
    });
    await page.route('**/data/collections/m5-empty-fixture.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...collection,
          id: 'm5-empty-fixture',
          defaultView: 'works',
          members: [collection.members[2], collection.members[4]],
          people: [collection.people[2], collection.people[4]],
          eventRecords: [],
          resolvedRelations: [],
          views: ['overview', 'members', 'timeline', 'works'],
        }),
      }),
    );
    await page.goto(`${origin}/collections/m5-empty-fixture`);
    await page.waitForSelector('section[aria-labelledby="collection-works"] .lt-empty');
    assert.equal(await page.locator('[data-collection-tab="events"]').count(), 0);
    assert.equal(await page.locator('[data-collection-tab="relations"]').count(), 0);
    assert.match(await page.locator('section[aria-labelledby="collection-works"]').innerText(), /成员作品尚未整理/);
    await page.screenshot({ path: join(screenshotDir, 'm5-fixture-capabilities.png'), fullPage: true });
    console.log(JSON.stringify({ result: 'passed', layer: 'isolated-fixture', note: 'not real historical content' }));
  } finally {
    await browser.close();
  }
});
