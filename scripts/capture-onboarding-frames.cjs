const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'frontend', 'node_modules', '@playwright', 'test'));

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'frontend', 'public', 'onboarding', '.frames');
const APP_URL = process.env.ONBOARDING_URL || 'http://127.0.0.1:5174/flowchart/';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function frame(page, dir, idx) {
  const file = path.join(dir, `frame-${String(idx).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
}

async function gotoCanvas(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('pm-v5-onboarding-dismissed', '1');
    localStorage.setItem('pm-v4-onboarding-dismissed', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('select');

  // Selects render progressively; choose first non-empty option in order.
  const s0 = page.locator('select').first();
  await s0.selectOption({ index: 1 });
  await page.waitForTimeout(200);

  await page.waitForFunction(() => document.querySelectorAll('select').length >= 2);
  const s1 = page.locator('select').nth(1);
  await s1.selectOption({ index: 1 });
  await page.waitForTimeout(200);

  await page.waitForFunction(() => document.querySelectorAll('select').length >= 3);
  const s2 = page.locator('select').nth(2);
  await s2.selectOption({ index: 1 });
  await page.waitForTimeout(200);

  const startBtn = page.locator('button.bg-gradient-to-r').first();
  await startBtn.waitFor({ state: 'visible' });
  await startBtn.click();
  await page.waitForSelector('.react-flow__pane');
  await page.waitForTimeout(400);
}

async function openPaneMenu(page, x, y) {
  await page.locator('.react-flow__pane').click({ button: 'right', position: { x, y } });
  await page.waitForSelector('.context-menu');
}

async function chooseContextItem(page, index) {
  await page.locator('.context-menu-item').nth(index).click();
  await page.waitForTimeout(350);
}

async function addProcess(page, x, y) {
  await openPaneMenu(page, x, y);
  await chooseContextItem(page, 0);
}

async function addDecision(page, x, y) {
  await openPaneMenu(page, x, y);
  await chooseContextItem(page, 1);
}

async function connectNodes(page, fromIndex, toIndex) {
  const nodes = page.locator('.react-flow__node');
  const fromBox = await nodes.nth(fromIndex).boundingBox();
  const toBox = await nodes.nth(toIndex).boundingBox();
  if (!fromBox || !toBox) throw new Error('Node bounding box not found');

  const sx = fromBox.x + fromBox.width + 6;
  const sy = fromBox.y + fromBox.height / 2;
  const tx = toBox.x - 6;
  const ty = toBox.y + toBox.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 12 });
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function captureAddNode(page, dir) {
  let i = 1;
  await gotoCanvas(page);
  await frame(page, dir, i++);
  await openPaneMenu(page, 620, 290);
  await frame(page, dir, i++);
  await chooseContextItem(page, 0);
  await frame(page, dir, i++);
  await frame(page, dir, i++);
}

async function captureConnect(page, dir) {
  let i = 1;
  await gotoCanvas(page);
  await addProcess(page, 520, 250);
  await addProcess(page, 780, 250);
  await frame(page, dir, i++);
  await connectNodes(page, 1, 2);
  await frame(page, dir, i++);
  await frame(page, dir, i++);
}

async function captureDecisionLabel(page, dir) {
  let i = 1;
  await gotoCanvas(page);
  await addDecision(page, 620, 260);
  await frame(page, dir, i++);
  await page.locator('.react-flow__node').nth(1).dblclick();
  await page.waitForTimeout(200);
  await frame(page, dir, i++);
  await frame(page, dir, i++);
}

async function captureSave(page, dir) {
  let i = 1;
  await gotoCanvas(page);
  await addProcess(page, 600, 260);
  await frame(page, dir, i++);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyS');
  await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  await frame(page, dir, i++);
  await frame(page, dir, i++);
}

async function main() {
  ensureDir(OUT_ROOT);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const jobs = [
    ['01-add-node', captureAddNode],
    ['02-connect-nodes', captureConnect],
    ['03-decision-label', captureDecisionLabel],
    ['04-save-flow', captureSave]
  ];

  for (const [name, fn] of jobs) {
    const dir = path.join(OUT_ROOT, name);
    ensureDir(dir);
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    await fn(page, dir);
    console.log(`CAPTURED ${name}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
