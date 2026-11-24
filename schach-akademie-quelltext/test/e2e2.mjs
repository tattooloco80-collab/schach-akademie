import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file:///home/claude/chess/dist/index.html'); await page.waitForTimeout(400);
await page.evaluate(() => window.__app.lessonScreen('f-schaefer')); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/10-lesson.png', fullPage: true });
for (let i = 0; i < 6; i++) { await page.click('[data-a=next]'); await page.waitForTimeout(i === 5 ? 50 : 3500); }
await page.screenshot({ path: 'shots/10b-ask.png', fullPage: true });
await page.click('[data-a=sol]');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.screenshot({ path: `shots/11-mate-${i}.png`, clip: { x: 0, y: 55, width: 390, height: 400 } }); }
await page.waitForTimeout(3500); await page.screenshot({ path: 'shots/12-after.png', fullPage: true });
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
