import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/lessons.js';
const l = LESSONS.find((x) => x.track === 'fallen' && x.moves.length >= 6 && !x.fen);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate((id) => { const A = window.__app; A.repeatScreen([A.LESSONS.find((x) => x.id === id)], 0, 'all'); }, l.id);
console.log(l.id, l.moves.join(' '));
const tap = async (s) => { const [x, y] = await page.evaluate((q) => window.__app.sqXY(q), s); await page.touchscreen.tap(x, y); await page.waitForTimeout(500); };
const c = new Chess(); const side = await page.evaluate(() => document.querySelector('.chip').textContent.includes('Weiß') ? 'w' : 'b'); console.log(side);
await page.waitForTimeout(1500);
for (let i = 0; i < l.moves.length; i++) {
  const m = c.move(l.moves[i]);
  if (m.color === side) {
    if (i === 2) { await tap('a2'); await tap('a3'); console.log('wrong:', await page.evaluate(() => document.querySelector('.fb').textContent)); }
    await page.waitForFunction(() => !window.__board.b3._tw.length, null, { timeout: 30000 }); await page.waitForTimeout(400);
    await tap(m.from); await tap(m.to);
  }
  await page.waitForFunction(() => !window.__board.b3._tw.length, null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(900);
}
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => document.querySelector('.done').innerText + '|' + JSON.stringify(JSON.parse(localStorage.getItem('progress') || localStorage.getItem('schach:progress') || '{}').rep || Object.keys(localStorage))), errs);
await page.screenshot({ path: '/tmp/rep.png' });
await browser.close();
