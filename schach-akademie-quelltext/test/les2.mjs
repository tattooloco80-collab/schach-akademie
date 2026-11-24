import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate(() => window.__app.lessonScreen('g-matt'));
await page.waitForTimeout(800);
for (let i = 0; i < 3; i++) { await page.evaluate(() => document.querySelector('[data-a=next]').click()); await page.waitForFunction(() => !window.__board.b3._tw.length, null, {timeout: 30000}); await page.waitForTimeout(1500); }
const st = () => page.evaluate(() => { const b = window.__board; return { tw: b.b3._tw.length, en: b.enabled, sel: b.sel, tg: b.targets }; });
const tap = async (s) => { const [x, y] = await page.evaluate((q) => window.__app.sqXY(q), s); await page.touchscreen.tap(x, y); await page.waitForTimeout(400); };
console.log(JSON.stringify(await st()));
await tap('d8'); console.log(JSON.stringify(await st()));
await tap('h4'); console.log(JSON.stringify(await st())); await page.waitForTimeout(4000);
console.log(await page.evaluate(() => document.querySelector('.note').innerText + '|' + document.querySelector('.fb') ?.textContent), errs);
await browser.close();
