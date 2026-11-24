import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function mk(w, h) { const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto('file:///home/claude/chess/dist/index.html'); await p.waitForTimeout(300); return p; }
let page = await mk(390, 844);
await page.screenshot({ path: 'shots/20-home.png' });
await page.evaluate(() => { window.__app.settings.anim = 'off'; window.__app.learnHome('taktik'); }); await page.waitForTimeout(200);
await page.screenshot({ path: 'shots/21-learn.png', fullPage: true });
await page.evaluate(() => window.__app.lessonScreen('t-gabel')); await page.waitForTimeout(200);
const sq = async (s) => { const b = await page.locator(`.sq[data-sq=${s}]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const tap = async (s) => { const [x, y] = await sq(s); await page.touchscreen.tap(x, y); await page.waitForTimeout(120); };
await tap('e4'); await tap('g5'); await page.waitForTimeout(200); await page.screenshot({ path: 'shots/22-wrong.png', fullPage: true });
console.log('Feedback falsch:', await page.textContent('.fb'));
await tap('e4'); await tap('f6'); await page.waitForTimeout(600); await page.screenshot({ path: 'shots/23-right.png', fullPage: true });
console.log('Status nach richtig:', await page.textContent('.note .tl'));
await page.click('[data-a=next]'); await page.waitForTimeout(400); await page.click('[data-a=next]'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/24-done.png', fullPage: true });
// Tutor
await page.click('.tutor'); await page.waitForTimeout(200); await page.fill('.sheet input', 'Warum ist das eine Gabel?'); await page.click('.send'); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/25-tutor.png' });
await page.evaluate(() => document.querySelector('.sheet .x').click());
// Training
await page.evaluate(() => window.__app.trainHome()); await page.waitForTimeout(150);
await page.evaluate(() => window.__app.puzzleScreen('m1')); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/26-puzzle.png' });
await page.click('[data-a=sol]'); await page.waitForTimeout(500); console.log('Lösung:', await page.textContent('.fb'));
await page.evaluate(() => window.__app.settingsScreen && 0); 
// iPad quer
page = await mk(1180, 820);
await page.evaluate(() => { window.__app.settings.anim = 'off'; window.__app.gameScreen({ mode: 'bot', level: 3, human: 'w', moves: ['e2e4', 'e7e5', 'g1f3'] }); }); await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/30-ipad-game.png' });
await page.evaluate(() => window.__app.lessonScreen('o-spanisch')); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/31-ipad-lesson.png' });
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
