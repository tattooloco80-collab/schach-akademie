import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate(() => window.__app.lessonScreen('g-matt'));
await page.waitForTimeout(800);
for (let i = 0; i < 3; i++) { await page.evaluate(() => document.querySelector('[data-a=next]').click()); await page.waitForTimeout(6000); }
console.log(await page.evaluate(() => document.querySelector('.askbox') && document.querySelector('.askbox').style.display));
const tap = async (s) => { const [x, y] = await page.evaluate((q) => window.__app.sqXY(q), s); console.log(s, x, y); await page.touchscreen.tap(x, y); await page.waitForTimeout(400); };
await tap('d8'); await page.screenshot({ path: '/tmp/l1.png' }); await tap('h4'); await page.waitForTimeout(5000);
console.log(await page.evaluate(() => document.querySelector('.note') && document.querySelector('.note').innerText), errs);
await page.screenshot({ path: '/tmp/l2.png' }); await browser.close();
