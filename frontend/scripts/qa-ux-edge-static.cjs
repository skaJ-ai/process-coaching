const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..', '..');
const dist = path.resolve(__dirname, '..', 'dist');
const outDir = path.join(root, 'QA_ARTIFACTS', 'ux');
const reportPath = path.join(root, 'QA_UX_REPORT.md');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function createServer(port = 4180) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/flowchart/';
        if (pathname.startsWith('/flowchart/')) pathname = pathname.slice('/flowchart'.length) || '/';
        if (pathname === '/') pathname = '/index.html';

        const filePath = path.normalize(path.join(dist, pathname));
        if (!filePath.startsWith(path.normalize(dist))) {
          res.writeHead(403); res.end('forbidden'); return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end('not found'); return; }
          res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
          res.end(data);
        });
      } catch {
        res.writeHead(500); res.end('server error');
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const results = [];
const add = (id, status, detail) => results.push({ id, status, detail });

async function runViewport(label, viewport, baseUrl) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const errors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('requestfailed', req => failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  try {
    const t0 = Date.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const tSetup = Date.now() - t0;
    await page.screenshot({ path: path.join(outDir, `${label}-01-setup.png`), fullPage: true });

    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    const t1 = Date.now();
    await page.getByRole('button', { name: '프로세스 드로잉 시작 →' }).click();
    await page.getByText('Process Coaching AI').waitFor({ timeout: 10000 });
    const tMain = Date.now() - t1;
    await page.screenshot({ path: path.join(outDir, `${label}-02-main.png`), fullPage: true });

    const pane = page.locator('.react-flow__pane');
    await pane.click({ button: 'right', position: { x: Math.max(120, Math.floor(viewport.width * 0.55)), y: Math.max(120, Math.floor(viewport.height * 0.55)) } });
    await page.locator('.context-menu-item', { hasText: '프로세스' }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, `${label}-03-after-add.png`), fullPage: true });

    const input = page.getByPlaceholder('질문하거나 아이디어를 요청하세요...');
    await input.click();
    await input.fill('UX 키보드 전송 테스트');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const chatSent = (await page.getByText('UX 키보드 전송 테스트').count()) > 0;

    const layout = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        bodyOverflowX: document.body.scrollWidth > window.innerWidth,
        bodyOverflowY: document.body.scrollHeight > window.innerHeight,
        docOverflowX: de.scrollWidth > window.innerWidth,
        docOverflowY: de.scrollHeight > window.innerHeight,
      };
    });

    add(`${label}-PERF-SETUP`, tSetup < 2500 ? 'PASS' : 'WARN', `${tSetup}ms`);
    add(`${label}-PERF-MAIN`, tMain < 2500 ? 'PASS' : 'WARN', `${tMain}ms`);
    add(`${label}-KEYBOARD`, chatSent ? 'PASS' : 'FAIL', chatSent ? 'Enter 전송 동작 확인' : 'Enter 전송 실패');
    add(`${label}-LAYOUT-X`, (layout.bodyOverflowX || layout.docOverflowX) ? 'FAIL' : 'PASS', JSON.stringify(layout));
    add(`${label}-LAYOUT-Y`, 'INFO', JSON.stringify(layout));
    add(`${label}-CONSOLE`, errors.length ? 'FAIL' : 'PASS', errors.length ? errors.slice(0, 3).join(' || ') : 'console error 없음');
    add(`${label}-PAGEERROR`, pageErrors.length ? 'FAIL' : 'PASS', pageErrors.length ? pageErrors.slice(0, 2).join(' || ') : 'pageerror 없음');
    add(`${label}-REQFAIL`, failedRequests.length ? 'WARN' : 'PASS', failedRequests.length ? failedRequests.slice(0, 5).join(' || ') : '요청 실패 없음');

  } catch (e) {
    add(`${label}-RUN`, 'FAIL', String(e));
  } finally {
    await context.close();
    await browser.close();
  }
}

(async () => {
  let server;
  try {
    server = await createServer(4180);
    const baseUrl = 'http://127.0.0.1:4180/flowchart/';

    await runViewport('desktop-1366x768', { width: 1366, height: 768 }, baseUrl);
    await runViewport('mobile-390x844', { width: 390, height: 844 }, baseUrl);

    const lines = [
      '# QA UX Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Base URL: ${baseUrl}`,
      `Screenshots: ${path.relative(root, outDir)}`,
      '',
      '| Check | Status | Detail |',
      '|---|---|---|',
      ...results.map(r => `| ${r.id} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`),
    ];

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));

    const hasFail = results.some(r => r.status === 'FAIL');
    if (hasFail) process.exitCode = 1;
  } finally {
    if (server) await new Promise(r => server.close(r));
  }
})();
