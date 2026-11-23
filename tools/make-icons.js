// יוצר את אייקוני האפליקציה (PNG) מהלוגו. מריצים פעם אחת כשמשנים את הלוגו: node tools/make-icons.js
const fs = require('fs'), path = require('path');
const { chromium } = require('@playwright/test');
const sys = '/opt/pw-browsers/chromium';
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#00d4ff"/></linearGradient></defs>
<rect width="100" height="100" rx="${pad ? 0 : 22}" fill="url(#g)"/>
<g transform="translate(${pad ? 26 : 20} ${pad ? 26 : 20}) scale(${pad ? 2 : 2.5})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="3"/><path d="M7 18c1-2.5 2.8-3.5 5-3.5s4 1 5 3.5"/></g></svg>`;
(async () => {
  const br = await chromium.launch({ executablePath: fs.existsSync(sys) ? sys : undefined });
  const out = path.join(__dirname, '..', 'site', 'icons');
  for (const [name, size, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
    const pg = await br.newPage({ viewport: { width: size, height: size } });
    await pg.setContent(`<body style="margin:0;background:transparent">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await pg.screenshot({ path: path.join(out, name), omitBackground: true });
    await pg.close();
  }
  fs.writeFileSync(path.join(out, 'icon.svg'), svg(false));
  await br.close();
})();
