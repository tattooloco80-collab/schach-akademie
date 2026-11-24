import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() !== 'log') errs.push(m.text().slice(0, 120)); });
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate(() => { const a = window.__app; a.settings.coach = false; a.gameScreen({ mode: 'bot', level: 2, human: 'w', moves: [] }); });
await page.waitForTimeout(500);
const tap = async (s) => { const [x, y] = await page.evaluate((q) => window.__app.sqXY(q), s); await page.touchscreen.tap(x, y); await page.waitForTimeout(150); };
const t0 = Date.now(); await tap('e2'); await tap('e4');
for (let i = 0; i < 12; i++) { await page.waitForTimeout(2000); console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', await page.textContent('.status'), '|', await page.textContent('.mlist')); }
console.log(errs.slice(0, 6)); await browser.close();
