/* Prueba rápida de las tres apps en un móvil simulado: abre cada pantalla, busca errores de
   JavaScript y comprueba el aviso de actualización.  Uso: node tools/smoke.js */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch (e) { /* siguiente */ } }
if (!chromium) { console.error('Falta Playwright (npm i -D playwright)'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const APPS = {
  estudio: { tabs: '.tabbar [data-act="go"]' },
  focus: { tabs: '.tabbar [data-act="go"]' },
  gym: { tabs: '.nav [data-act="tab"]' }
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  let fails = 0;
  for (const [app, cfg] of Object.entries(APPS)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());
    await page.goto(`${base}/${app}/`);
    await page.waitForTimeout(600);
    const tabs = page.locator(cfg.tabs);
    const n = await tabs.count();
    for (let i = 0; i < n; i++) { await tabs.nth(i).click({ force: true }); await page.waitForTimeout(250); }
    // Aviso de actualización: simula que se publica una versión nueva
    await page.waitForTimeout(1300);
    const cur = JSON.parse(fs.readFileSync(path.join(ROOT, app, 'version.json'), 'utf8'));
    await page.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...cur, version: cur.version + '-test', notes: ['Prueba'] }) }));
    await page.evaluate(() => window.APPUPDATE && window.APPUPDATE.check(false));
    await page.waitForTimeout(400);
    const banner = await page.locator('#upd-banner').count();
    await page.unroute('**/version.json*');
    const ok = !errors.length && n > 0 && banner === 1;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} ${app}: ${n} pantallas, versión ${cur.version}, aviso de actualización ${banner ? 'OK' : 'NO aparece'}${errors.length ? '\n   errores: ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
})();
