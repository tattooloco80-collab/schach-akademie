import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate(() => { const a = window.__app; a.settings.coach = false; a.gameScreen({ mode: 'bot', level: 1, human: 'w', moves: ['e2e4','d7d5','e4d5','d8d5','b1c3','d5a5','g1f3','g8f6','f1c4','c8f5','c4f7','e8f7'] }); });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/shot.png' });
console.log(errs); await browser.close();
