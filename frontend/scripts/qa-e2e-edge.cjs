const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const outPath = path.resolve(__dirname, '..', '..', 'QA_E2E_EDGE_REPORT.md');
const results = [];
const add = (id, status, detail) => results.push({ id, status, detail });

async function runStep(id, fn) {
  try {
    const detail = await fn();
    add(id, 'PASS', detail || 'ok');
  } catch (e) {
    add(id, 'FAIL', String(e));
  }
}

(async () => {
  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    context = await browser.newContext({ acceptDownloads: true });
    page = await context.newPage();

    const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5173/flowchart/';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.getByRole('button', { name: '프로세스 드로잉 시작 →' }).click();
    await page.getByText('Process Coaching AI').waitFor({ timeout: 10000 });

    let processNode;

    await runStep('S1', async () => {
      const pane = page.locator('.react-flow__pane');
      await pane.click({ button: 'right', position: { x: 420, y: 320 } });
      await page.locator('.context-menu-item', { hasText: '프로세스' }).first().click();
      await page.waitForTimeout(500);
      const c = await page.locator('.react-flow__node').count();
      if (c < 2) throw new Error(`nodeCount=${c}`);
      processNode = page.locator('.react-flow__node', { hasText: '새 태스크' }).first();
      return `nodeCount=${c}`;
    });

    await runStep('S2', async () => {
      await processNode.click({ button: 'right' });
      await page.locator('.context-menu-item', { hasText: '프로세스' }).first().click();
      await page.waitForTimeout(500);
      const nodeCount = await page.locator('.react-flow__node').count();
      const edgeCount = await page.locator('.react-flow__edge').count();
      if (nodeCount < 3 || edgeCount < 1) throw new Error(`nodeCount=${nodeCount}, edgeCount=${edgeCount}`);
      return `nodeCount=${nodeCount}, edgeCount=${edgeCount}`;
    });

    await runStep('S3', async () => {
      const edgePath = page.locator('.react-flow__edge-path').first();
      await edgePath.click({ button: 'right' });
      page.once('dialog', async d => { try { await d.accept('승인'); } catch {} });
      await page.locator('.context-menu-item', { hasText: '라벨 편집' }).click();
      await page.waitForTimeout(500);
      const hasLabel = (await page.getByText('승인').count()) > 0;
      if (!hasLabel) throw new Error('edge label not found');
      return 'edge label=승인';
    });

    await runStep('S4', async () => {
      await page.getByRole('button', { name: /역할 구분선/ }).click();
      const laneOn = await page.getByRole('button', { name: /역할 구분선 ON/ }).count();
      if (!laneOn) throw new Error('lane ON not reflected');
      return 'lane ON';
    });

    await runStep('S5', async () => {
      const handle = page.getByText('⋮⋮').first();
      const hb = await handle.boundingBox();
      if (!hb) throw new Error('divider handle not found');
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 120, { steps: 8 });
      await page.mouse.up();
      return 'divider drag executed';
    });

    await runStep('S6', async () => {
      await page.getByPlaceholder('질문하거나 아이디어를 요청하세요...').fill('테스트 질문입니다');
      await page.getByRole('button', { name: '전송' }).click();
      await page.waitForTimeout(1500);
      const ok = (await page.getByText('테스트 질문입니다').count()) > 0;
      if (!ok) throw new Error('user message not found');
      return 'chat sent';
    });

    await runStep('S7', async () => {
      await page.getByRole('button', { name: '🔍 플로우 분석' }).click();
      await page.waitForTimeout(1500);
      const ok = (await page.getByText('🔍 플로우 분석 요청').count()) > 0;
      if (!ok) throw new Error('review request message not found');
      return 'review requested';
    });

    await runStep('S8', async () => {
      await processNode.click({ button: 'right' });
      await page.locator('.context-menu-item', { hasText: 'L7 검증' }).click();
      await page.waitForTimeout(1800);
      const statusBadges = (await page.getByText('✓').count()) + (await page.getByText('💡').count()) + (await page.getByText('✏').count());
      if (statusBadges <= 0) throw new Error(`statusBadgeCount=${statusBadges}`);
      return `statusBadgeCount=${statusBadges}`;
    });

    await runStep('S9', async () => {
      const dl = page.waitForEvent('download', { timeout: 10000 });
      await page.getByRole('button', { name: '💾 중간저장' }).click();
      const download = await dl;
      const file = download.suggestedFilename();
      if (!file.endsWith('.json')) throw new Error(`download=${file}`);
      return `download=${file}`;
    });

    await runStep('S10', async () => {
      let dialogSeq = 0;
      const handler = async d => {
        try {
          dialogSeq += 1;
          if (dialogSeq === 1 && d.type() === 'prompt') await d.accept('pm2025');
          else await d.accept();
        } catch {}
      };
      page.on('dialog', handler);
      await page.keyboard.press('Control+Shift+A');
      await page.waitForTimeout(1200);
      page.off('dialog', handler);

      const pddBtnCount = await page.getByRole('button', { name: '📄 PDD' }).count();
      if (!pddBtnCount) throw new Error('PDD button not visible');
      await page.getByRole('button', { name: '📄 PDD' }).click();
      await page.getByText('프로세스 정의서를 자동 생성합니다.').waitFor({ timeout: 10000 });
      return 'PDD modal opened';
    });

  } catch (e) {
    add('RUN', 'FAIL', String(e));
  } finally {
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}

    const lines = [
      '# QA E2E Edge Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '| ID | Status | Detail |',
      '|---|---|---|',
      ...results.map(r => `| ${r.id} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`),
    ];
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));

    const failed = results.some(r => r.status === 'FAIL');
    if (failed) process.exit(1);
  }
})();
