// Browser test: node tools/browsertest.js [dist/wildlinge.html] [screenshot-dir]
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'dist/wildlinge.html');
const shots = process.argv[3] || null;
const fail = m => console.log('::error::' + String(m).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').slice(0, 1500));
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, bypassCSP: true });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + file);
  await page.waitForFunction(() => document.getElementById('clock').textContent.includes('Wildlings'), null, { timeout: 30000 });
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  await page.click('#welcomeOk');
  await page.waitForTimeout(4000);
  await shot('world');
  await page.fill('#speed', '20');
  await page.dispatchEvent('#speed', 'input');
  await page.waitForTimeout(6000);
  await page.click('#world', { position: { x: 800, y: 400 } });
  await page.waitForTimeout(1200);
  await shot('creature');
  await page.click('[data-tab=research]');
  await page.waitForTimeout(5000);
  await shot('research');
  await page.click('[data-tab=lab]');
  await page.click('#btnLab');
  await page.waitForFunction(() => document.getElementById('btnLabCsv') && !document.getElementById('btnLabCsv').disabled, null, { timeout: 120000 });
  await shot('lab');
  await page.selectOption('#langSel', 'de');
  await page.click('[data-tab=world]');
  await page.waitForTimeout(1500);
  await shot('world-de');
  const clock = await page.textContent('#clock');
  console.log('clock:', clock);
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  if (errors.length) { fail(errors.join('\n')); process.exit(1); }
}
main().catch(e => { fail(e && e.stack || e); process.exit(1); });
