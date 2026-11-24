import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const svg = fs.readFileSync('src/knight.svg', 'utf8');
for (const [n, sz] of [[1024, 1024], [512, 512], [192, 192], [180, 180]]) {
  const p = await b.newPage({ viewport: { width: sz, height: sz } });
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${sz}" height="${sz}" `)}</body>`);
  await p.screenshot({ path: `dist/icon-${n}.png`, omitBackground: false });
}
await b.close();
