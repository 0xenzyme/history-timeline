import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import type { Browser } from 'playwright';

type Page = import('playwright').Page;

function loadPlaywright(): typeof import('playwright') {
  const require = createRequire(import.meta.url);
  if (process.env.PLAYWRIGHT_MODULE) {
    return require(process.env.PLAYWRIGHT_MODULE) as typeof import('playwright');
  }
  try {
    return require('playwright') as typeof import('playwright');
  } catch {
    throw new Error('未找到 Playwright；可设 PLAYWRIGHT_MODULE 为现有安装路径');
  }
}

async function waitForCard(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('#card')?.classList.contains('show'));
}

async function exportFile(page: Page, format: 'png' | 'svg'): Promise<{ name: string; bytes: number; header: string }> {
  const pending = page.waitForEvent('download');
  await page.click(`.lt-timeline-hero [data-export="${format}"]`);
  const download = (await pending) as unknown as {
    suggestedFilename(): string;
    path(): Promise<string | null>;
  };
  const file = await download.path();
  assert.ok(file, `${format} 下载应有文件`);
  const data = readFileSync(file!);
  return {
    name: download.suggestedFilename(),
    bytes: data.length,
    header: format === 'png' ? data.subarray(0, 8).toString('hex') : data.subarray(0, 100).toString('utf8'),
  };
}

test('现有 Chrome 应用兼容：深链、切换、章节、搜索、面板、缩放与导出', { timeout: 120_000 }, async (context) => {
  const viteEntry = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const server: ChildProcess = spawn(
    process.execPath,
    [viteEntry, '--host', '127.0.0.1', '--port', '5189', '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let browser: Browser | undefined;
  const errors: string[] = [];
  const output: string[] = [];
  server.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  context.after(async () => {
    await browser?.close();
    server.kill('SIGTERM');
  });
  try {
    const origin = 'http://127.0.0.1:5189';
    const deadline = Date.now() + 15_000;
    for (;;) {
      try {
        const response = await fetch(origin);
        if (response.ok) break;
      } catch {
        // Vite may need a short startup interval.
      }
      if (Date.now() > deadline || server.exitCode !== null) throw new Error(`Vite 启动失败：${output.join('')}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const playwright = loadPlaywright();
    const systemChrome =
      process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined;
    const executablePath =
      process.env.CHROME_PATH ?? (systemChrome && existsSync(systemChrome) ? systemChrome : undefined);
    browser = await playwright.chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/#tang`);
    await page.waitForSelector('#boot', { state: 'hidden' });
    assert.equal(await page.locator('#topic-select').getAttribute('value'), null);
    assert.equal(
      await page.locator('#topic-select').evaluate((element) => (element as HTMLSelectElement).value),
      'tang',
    );

    await page.fill('#search', '李太白');
    await page.waitForSelector('.search-hit[data-id="li-bai"]');
    await page.press('#search', 'Enter');
    await waitForCard(page);
    assert.match((await page.locator('#card-body').textContent()) ?? '', /李白/);
    await page.click('#card-close');

    const chapter = page.locator('.lane-chapter').first();
    await chapter.click();
    await waitForCard(page);
    await page.click('#card-close');
    await page.click('#lanes-none');
    assert.equal(await page.locator('#lane-list input:checked').count(), 0);
    await page.click('#lanes-all');
    assert.ok((await page.locator('#lane-list input:checked').count()) > 0);

    await page.goto(`${origin}/#military`);
    await page.fill('#search', '香积寺');
    await page.press('#search', 'Enter');
    await waitForCard(page);
    assert.match((await page.locator('#card-body').textContent()) ?? '', /香积寺/);
    assert.match(page.url(), /#military\/event\/xiangjisi-zhizhan/);
    await page.click('#card-close');
    await page.goto(`${origin}/#history`);
    await page.goto(`${origin}/#history/event/anshi-zhiluan`);
    await waitForCard(page);
    assert.match((await page.locator('#card-body').textContent()) ?? '', /安史之乱/);
    await page.click('#card-close');

    await page.click('#btn-reset');
    await page.mouse.move(700, 420);
    await page.mouse.wheel(0, -200);
    await page.mouse.down();
    await page.mouse.move(790, 420);
    await page.mouse.up();
    await page.click('[data-group="history"]');
    await page.click('[data-group="history"]');

    const svg = await exportFile(page, 'svg');
    assert.ok(svg.bytes > 1000);
    assert.match(svg.header, /<svg/);
    const png = await exportFile(page, 'png');
    assert.ok(png.bytes > 1000);
    assert.equal(png.header, '89504e470d0a1a0a');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          result: 'passed',
          checks: [
            'topic deep link',
            'alias search',
            'person card',
            'chapter',
            'lane panel',
            'line switch',
            'event deep link',
            'event card',
            'zoom/pan',
            'event strip',
            'SVG export',
            'PNG export',
          ],
          svg: { name: svg.name, bytes: svg.bytes },
          png: { name: png.name, bytes: png.bytes },
          browser: await browser.version(),
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(output.join(''));
    throw error;
  }
});
