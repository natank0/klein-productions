/* בדיקת האתר החי: צילומי מסך, השוואת HTML לקומיט, סמלים, קישורי Waze/Google Maps ויעדם בפועל. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BASE = 'https://natank0.github.io/klein-productions/';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const report = [];
const log = (k, v) => { report.push({ k, v }); console.log(k, JSON.stringify(v)); };

(async () => {
  const b = await chromium.launch();
  /* 1. ה-HTML החי זהה לקובץ בריפו */
  const live = await (await fetch(BASE + '?cb=' + Date.now(), { cache: 'no-store' })).text();
  const repo = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  log('live index.html identical to main', live === repo);
  for (const a of ['assets/css/site.css', 'assets/js/site.js', 'assets/img/brands/waze-icon-24.png', 'assets/img/brands/waze-icon-48.png', 'assets/img/brands/google-maps-icon-24.png', 'assets/img/brands/google-maps-icon-48.png', '404.html', 'sitemap.xml', 'robots.txt']) {
    const r = await fetch(BASE + a, { cache: 'no-store' });
    const live = Buffer.from(await r.arrayBuffer());
    log('asset ' + a, { status: r.status, sameAsRepo: live.equals(fs.readFileSync(path.join(__dirname, '..', a))) });
  }
  log('beit-shemesh status', (await fetch(BASE + 'beit-shemesh/')).status);

  /* 2. צילומי מסך ברוחבים */
  const plan = [[1440, 900], [1280, 800], [1024, 768], [820, 1180], [768, 1024], [414, 896], [390, 844], [375, 812], [360, 800], [320, 640], [844, 390]];
  const sections = { hero: null, weddings: '#weddings', events: '#more-events', services: '#services', location: '#areas', faq: '#faq', form: '#order', footer: '.footer' };
  for (const [w, h] of plan) {
    const mobile = w < 800 && h > w;
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
    const p = await c.newPage(); const errs = []; const ext = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && (m.location().url || '').startsWith('https://natank0.github.io/')) errs.push(m.text()); });
    p.on('request', r => { if (!r.url().startsWith('https://natank0.github.io/')) ext.push(r.url()); });
    await p.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'networkidle' });
    const m = await p.evaluate(() => {
      const icons = [...document.querySelectorAll('.navigation-link img')].map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), filter: getComputedStyle(i).filter }));
      const map = document.querySelector('.location-map iframe').getBoundingClientRect();
      const dark = [...document.querySelectorAll('header, section, footer, .action-bar')].map(e => getComputedStyle(e).backgroundColor).filter(c => { const v = (c.match(/[\d.]+/g) || []).map(Number); if (v.length < 3 || v[3] === 0) return false; return (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) < 160; });
      return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: document.querySelector('h1').textContent.trim(), icons, map: [Math.round(map.width), Math.round(map.height)], darkSurfaces: dark, flagship: document.body.textContent.includes('תחום הדגל'), oldHalls: /radar|hallMedia/.test(document.documentElement.outerHTML) };
    });
    const extMain = ext.filter(u => !/google\.com|gstatic\.com|googleapis\.com|ggpht\.com|googleusercontent\.com/.test(u));
    log(`${w}x${h}`, { ...m, errs, extNonGoogle: extMain });
    for (const [name, sel] of Object.entries(sections)) {
      await p.evaluate(s => { const e = s ? document.querySelector(s) : null; window.scrollTo(0, e ? e.getBoundingClientRect().top + scrollY - 90 : 0); }, sel);
      await p.waitForTimeout(name === 'location' ? 5000 : 250);
      await p.screenshot({ path: `${OUT}/${w}x${h}-${name}.png` });
    }
    if ([1440, 390, 320].includes(w)) await p.screenshot({ path: `${OUT}/${w}x${h}-FULL.png`, fullPage: true });
    await c.close();
  }

  /* 2ב. מפת Google: מה המסגרת מציגה בפועל */
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'he-IL', deviceScaleFactor: 2 });
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelector('.location-map').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(7000);
    const frame = p.frames().find(f => f.url().includes('google.com/maps'));
    let text = '';
    try { text = frame ? (await frame.evaluate(() => document.body.innerText)).slice(0, 400) : ''; } catch (e) { text = 'ERR ' + e.message; }
    log(`google map frame ${w}`, { url: frame ? frame.url().slice(0, 160) : null, hasAddress: /כהנמן 64/.test(text), text: text.replace(/\s+/g, ' ').slice(0, 220) });
    await (await p.$('.location-map')).screenshot({ path: `${OUT}/map-only-${w}.png` });
    await c.close();
  }

  /* 3. תפריט מובייל ומקלדת */
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.click('#menuToggle'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/390-menu-open.png` });
    const open = await p.evaluate(() => document.getElementById('menuToggle').getAttribute('aria-expanded'));
    await p.keyboard.press('Escape');
    const closed = await p.evaluate(() => ({ exp: document.getElementById('menuToggle').getAttribute('aria-expanded'), focus: document.activeElement.id }));
    log('mobile menu open/escape', { open, closed });
    /* טופס: חתונה, עיר אחרת, שליחה מיורטת */
    const urls = []; await p.exposeFunction('__cap', u => urls.push(u));
    await p.evaluate(() => { window.open = u => { window.__cap(u); return {}; }; });
    await p.click('#weddings a[data-event]');
    await p.fill('#name', 'בדיקה'); await p.fill('#phone', '050-1234567'); await p.check('#dateUnknown');
    await p.click('.form-options summary'); await p.selectOption('#city', 'אחר'); await p.fill('#cityOther', 'אלעד-בדיקה');
    await p.screenshot({ path: `${OUT}/390-form-filled.png`, fullPage: false });
    await p.click('.form-submit');
    const msg = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    log('form → whatsapp (intercepted, not sent)', { url: (urls[0] || '').slice(0, 40), msg, status: await p.textContent('#formStatus') });
    await p.evaluate(() => document.getElementById('formStatus').scrollIntoView({ block: 'center' }));
    await p.screenshot({ path: `${OUT}/390-form-status.png` });
    await c.close();
  }

  /* 4. בלי JavaScript */
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const p = await c.newPage(); await p.goto(BASE);
    const r = await p.evaluate(() => ({ nav: [...document.querySelectorAll('#siteNav a')].filter(a => a.offsetParent).length, maps: [...document.querySelectorAll('.navigation-link')].filter(a => a.offsetParent).length, addr: document.querySelector('.address-card strong').textContent }));
    log('no-js', r);
    await p.evaluate(() => document.getElementById('areas').scrollIntoView()); await p.screenshot({ path: `${OUT}/390-nojs-location.png` });
    await c.close();
  }

  /* 5. יעד הקישורים בפועל (דסקטופ ומובייל אנדרואיד) */
  for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 800 }, locale: 'he-IL' }], ['android', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'he-IL', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }]]) {
    const c = await b.newContext(opts);
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    const hrefs = await p.$$eval('.navigation-link', a => a.map(x => ({ app: x.dataset.app, href: x.href })));
    for (const { app, href } of hrefs) {
      const t = await c.newPage();
      try { await t.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 }); await t.waitForTimeout(6000); } catch (e) { log(`${label} ${app} nav error`, e.message); }
      log(`${label} ${app} final URL`, { start: href, final: t.url(), title: await t.title().catch(() => '') });
      await t.screenshot({ path: `${OUT}/target-${label}-${app}.png` });
      await t.close();
    }
    await c.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); fs.writeFileSync(path.join(OUT, 'crash.txt'), String(e.stack || e)); process.exit(1); });
