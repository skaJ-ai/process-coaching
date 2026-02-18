const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..', '..');
const dist = path.resolve(__dirname, '..', 'dist');
const outDir = path.join(root, 'QA_ARTIFACTS', 'ux-desktop');
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
        if (pathname === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (pathname.startsWith('/api/')) {
          let payload = {};
          if (pathname === '/api/first-shape-welcome') {
            payload = {
              text: '테스트 안내 메시지',
              quickQueries: [],
            };
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(payload));
          return;
        }
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

(async () => {
  const results = [];
  const add = (id, status, detail) => results.push({ id, status, detail });

  let server;
  let browser;
  let context;
  try {
    server = await createServer(4180);
    const baseUrl = 'http://127.0.0.1:4180/flowchart/';

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    const errors = [];
    const failedRequests = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const loc = msg.location();
        const where = loc && loc.url ? ` @ ${loc.url}:${loc.lineNumber || 0}` : '';
        errors.push(`${msg.text()}${where}`);
      }
    });
    page.on('requestfailed', req => failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

    const t0 = Date.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const tSetup = Date.now() - t0;
    await page.screenshot({ path: path.join(outDir, 'desktop-01-setup.png'), fullPage: true });

    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    const t1 = Date.now();
    await page.getByRole('button', { name: '프로세스 드로잉 시작 →' }).click();
    await page.getByText('Process Coaching AI').waitFor({ timeout: 10000 });
    const tMain = Date.now() - t1;
    await page.screenshot({ path: path.join(outDir, 'desktop-02-main.png'), fullPage: true });

    const pane = page.locator('.react-flow__pane');
    await pane.click({ button: 'right', position: { x: 750, y: 420 } });
    await page.locator('.context-menu-item', { hasText: '프로세스' }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'desktop-03-after-add.png'), fullPage: true });

    const input = page.getByPlaceholder('질문하거나 아이디어를 요청하세요...');
    await input.click();
    await page.keyboard.type('데스크톱 UX 키보드 입력 점검');
    const inputVal = await input.inputValue();
    const keyboardOk = inputVal.includes('키보드 입력 점검');

    const layout = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        bodyOverflowX: document.body.scrollWidth > window.innerWidth,
        docOverflowX: de.scrollWidth > window.innerWidth,
      };
    });

    add('DESKTOP-PERF-SETUP', tSetup < 2500 ? 'PASS' : 'WARN', `${tSetup}ms`);
    add('DESKTOP-PERF-MAIN', tMain < 2500 ? 'PASS' : 'WARN', `${tMain}ms`);
    add('DESKTOP-KEYBOARD', keyboardOk ? 'PASS' : 'FAIL', keyboardOk ? '키보드 입력 반영 확인' : '키보드 입력 반영 실패');
    add('DESKTOP-LAYOUT-X', (layout.bodyOverflowX || layout.docOverflowX) ? 'FAIL' : 'PASS', JSON.stringify(layout));

    // 네트워크/사내망 영향 항목은 INFO로만 기록
    add('ENV-NETWORK-NONBLOCK', 'INFO', failedRequests.length ? failedRequests.slice(0, 5).join(' || ') : '요청 실패 없음');
    add('ENV-CONSOLE-NONBLOCK', 'INFO', errors.length ? errors.slice(0, 5).join(' || ') : 'console error 없음');

    const lines = [
      '# QA UX Report (Desktop Only)',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Base URL: ${baseUrl}`,
      `Screenshots: ${path.relative(root, outDir)}`,
      '',
      'Exclude Rules: LLM/사내망/외부리소스 이슈 제외, 모바일 제외',
      '',
      '| Check | Status | Detail |',
      '|---|---|---|',
      ...results.map(r => `| ${r.id} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`),
    ];
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));

    const hardFail = results.some(r => r.status === 'FAIL');
    if (hardFail) process.exitCode = 1;
  } finally {
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}
    if (server) await new Promise(r => server.close(r));
  }
})();
