import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(300);
await page.evaluate(() => { const a = window.__app; a.settings.coach = false; a.gameScreen({ mode: 'two', moves: ['e2e4', 'd7d5'] }); });
await page.waitForTimeout(300);
const tap = async (s) => { const [x, y] = await page.evaluate((q) => window.__app.sqXY(q), s); await page.touchscreen.tap(x, y); await page.waitForTimeout(120); };
await tap('e4'); await tap('d5');
for (let i = 0; i < 8; i++) { await page.waitForTimeout(500); await page.screenshot({ path: `shots/h${i}.png`, clip: { x: 0, y: 80, width: 390, height: 400 } }); }
console.log('Fehler:', errs.slice(0, 5));
await browser.close();
