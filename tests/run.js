/* בדיקות האתר: מריצים `npm test`. כל כלל של הפרויקט הוא בדיקה שנכשלת אם נשבר.
 * שרת סטטי מקומי מגיש את המאגר בנתיב /klein-productions/ (כמו GitHub Pages).
 * QA_BASE=https://natank0.github.io/klein-productions/ npm test מריץ את בדיקות הדפדפן מול האתר החי.
 * פתיחת וואטסאפ מיורטת תמיד: שום הודעה אמיתית לא נשלחת. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { HtmlValidate, FileSystemConfigLoader } = require('html-validate');

const ROOT = path.resolve(__dirname, '..');
const PREFIX = '/klein-productions/';
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WIDTHS = [320, 360, 390, 430, 768, 860, 900, 1024, 1440, 1920];
const PHONE = '0527675138';
const WA = '972527675138';

let failures = 0, passes = 0;
function check(name, ok, detail) {
  if (ok) { passes++; return; }
  failures++;
  console.log('✗ ' + name + (detail !== undefined ? ' → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function section(t) { console.log('\n— ' + t); }

/* ---------- שרת סטטי ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.md': 'text/plain; charset=utf-8' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = null;
      if (u.startsWith(PREFIX)) {
        const rel = u.slice(PREFIX.length) || 'index.html';
        const abs = path.join(ROOT, rel.endsWith('/') ? rel + 'index.html' : rel);
        if (abs.startsWith(ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile()) file = abs;
      }
      if (!file) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function nextSaturday(minDays) {
  const d = new Date(); d.setDate(d.getDate() + minDays);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return { iso, shown: iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) };
}

(async () => {
  const pages = ['index.html', '404.html'].map(f => ({ f, html: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
  const index = pages[0].html;

  /* ---------- 1. סטטי: תקינות HTML וכללי תוכן ---------- */
  section('HTML ותוכן');
  const hv = new HtmlValidate(new FileSystemConfigLoader());
  for (const { f } of pages) {
    const r = await hv.validateFile(path.join(ROOT, f));
    const msgs = r.results.flatMap(x => x.messages.map(m => `${m.line}:${m.column} ${m.ruleId} ${m.message}`));
    check(`html-validate ${f}`, r.valid, msgs.slice(0, 8).join(' | '));
  }
  const visibleText = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const { f, html } of pages) {
    check(`${f}: אין משאבים חיצוניים (סקריפט, גופן, iframe, תמונה)`, !/<script[^>]+src="https?:|<link[^>]+rel="stylesheet"[^>]+href="https?:|<iframe|<img[^>]+src="https?:|<video[^>]+src="https?:|@import/i.test(html));
    const text = visibleText(html);
    const banned = ['סניף', 'המובילים', 'המוביל ב', 'שנות ניסיון', 'שנות ותק', '₪', 'ש"ח', 'ש״ח', 'זמין בחג', 'פתוח בחג', 'בית שמש', 'נחמן'];
    const hits = banned.filter(w => text.includes(w));
    check(`${f}: אין טענות ונוסחים שלא אושרו`, hits.length === 0, hits);
    const streets = ['שלמה המלך', 'מלצר', 'רוזנהיים', 'בן יעקב', 'מחזיקי הדת', 'ז׳בוטינסקי', "ז'בוטינסקי", 'אהרונוביץ', 'עזרא 22'];
    const st = streets.filter(w => html.includes(w));
    check(`${f}: אין כתובות של אולמות`, st.length === 0, st);
    const tels = [...html.matchAll(/href="tel:([^"]+)"/g)].map(m => m[1]);
    check(`${f}: כל קישורי החיוג למספר אחד`, tels.every(t => t === PHONE), tels);
    const was = [...html.matchAll(/https:\/\/wa\.me\/(\d+)/g)].map(m => m[1]);
    check(`${f}: כל קישורי הוואטסאפ למספר אחד`, was.every(t => t === WA), was);
    const shownPhones = [...text.matchAll(/0\d{1,2}-?\d{7}/g)].map(m => m[0].replace('-', ''));
    check(`${f}: כל מספר טלפון גלוי הוא מספר העסק`, shownPhones.every(t => t === PHONE), shownPhones);
    check(`${f}: יש Content-Security-Policy`, /<meta http-equiv="Content-Security-Policy" content="[^"]*default-src 'none'/.test(html));
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
    check(`${f}: ה-CSP בלי unsafe-inline ובלי unsafe-eval`, !/unsafe-inline|unsafe-eval/.test(csp), csp);
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const missing = inline.filter(code => !csp.includes("'sha256-" + crypto.createHash('sha256').update(code).digest('base64') + "'"));
    check(`${f}: לכל סקריפט מוטבע יש hash תואם ב-CSP`, missing.length === 0, missing.map(c => c.slice(0, 40)));
    check(`${f}: אין style מוטבע (מאפיין או בלוק)`, !/\sstyle="|<style/.test(html));
    check(`${f}: קישורים לחלון חדש עם noopener`, [...html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)].every(m => /rel="[^"]*noopener/.test(m[0])));
  }
  for (const asset of ['assets/css/site.css', 'assets/js/site.js']) {
    const canonical = fs.readFileSync(path.join(ROOT, asset), 'utf8').replace(/\r\n/g, '\n');
    const v = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 8);
    for (const { f, html } of pages) {
      if (!html.includes(asset)) continue;
      check(`${f}: ${asset} עם ?v= תואם לתוכן (אחרת דפדפן עם מטמון ישן יקבל CSS/JS שלא מתאים; מריצים npm run stamp)`, html.includes(asset + '?v=' + v + '"'), (html.match(new RegExp(asset.replace(/[.]/g, '\\.') + '[^"]*')) || [''])[0] + ' ≠ ?v=' + v);
    }
  }
  const ld = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  check('JSON-LD: כתובת המחסן', ld.address && ld.address.streetAddress === 'כהנמן 64' && ld.address.addressLocality === 'בני ברק', ld.address);
  check('JSON-LD: טלפון', ld.telephone === '+972-52-767-5138', ld.telephone);
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('sitemap: כתובת אחת, הדף הראשי', (sitemap.match(/<loc>/g) || []).length === 1 && sitemap.includes('<loc>https://natank0.github.io/klein-productions/</loc>'));
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  check('robots: מאפשר סריקה ומפנה למפת האתר', /User-agent:\s*\*/.test(robots) && /Allow:\s*\//.test(robots) && robots.includes('Sitemap: https://natank0.github.io/klein-productions/sitemap.xml'));
  check('עמוד בית שמש לא קיים', !fs.existsSync(path.join(ROOT, 'beit-shemesh')));

  const srv = process.env.QA_BASE ? null : await serve();
  const BASE = process.env.QA_BASE || `http://127.0.0.1:${srv.address().port}${PREFIX}`;
  if (srv === null) console.log('\nבדיקות דפדפן מול ' + BASE);
  const ORIGIN = new URL(BASE).origin;
  const browser = await chromium.launch();
  const ctx = (o = {}) => browser.newContext({ reducedMotion: 'reduce', ...o });

  async function open(c, url = BASE) {
    const p = await c.newPage();
    const errs = [], ext = [], csp = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('request', r => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:')) ext.push(u); });
    await p.exposeFunction('__cspViolation', d => csp.push(d));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspViolation(e.violatedDirective + ' ' + e.blockedURI)));
    const res = await p.goto(url, { waitUntil: 'networkidle' });
    return { p, errs, ext, csp, res };
  }

  /* ---------- 2. פריסה ברוחבים ---------- */
  section('פריסה, מיקום ומשקל');
  for (const w of WIDTHS) {
    const compact = w <= 860;
    const mobile = w < 800;
    const c = await ctx({ viewport: { width: w, height: mobile ? 800 : 900 }, isMobile: mobile, hasTouch: mobile });
    const { p, errs, ext, csp } = await open(c);
    await p.evaluate(() => document.querySelector('.location-visual').scrollIntoView({ block: 'start' }));
    const m = await p.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && r.height > 0 && !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)') && !e.closest('noscript') && !e.closest('dialog'); };
      const small = [...document.querySelectorAll('a,button,select,input:not([type=checkbox]),summary,.check span')].filter(e => vis(e) && e.getBoundingClientRect().height < 44 && !e.classList.contains('skip-link')).map(e => (e.textContent || e.id).trim().slice(0, 14) + ':' + Math.round(e.getBoundingClientRect().height));
      const fig = document.querySelector('.location-visual').getBoundingClientRect();
      const pin = document.querySelector('.location-pin').getBoundingClientRect();
      return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, pinInside: pin.left >= fig.left && pin.right <= fig.right && pin.top >= fig.top && pin.bottom <= fig.bottom };
    });
    check(`${w}: אין גלילה אופקית`, m.ov === 0, m.ov);
    check(`${w}: אזורי מגע ≥ 44px`, m.small.length === 0, m.small);
    check(`${w}: סמן המחסן נמצא בתוך ההמחשה`, m.pinInside, m);
    check(`${w}: בלי שגיאות קונסולה`, errs.length === 0, errs);
    check(`${w}: בלי הפרות CSP`, csp.length === 0, csp);
    check(`${w}: בלי בקשות חיצוניות`, ext.length === 0, ext);
    if (compact) {
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
      const top = await p.evaluate(() => ({
        bar: getComputedStyle(document.querySelector('.action-bar')).visibility,
        direct: [...document.querySelectorAll('.hero-direct')].map(a => ({ href: a.getAttribute('href'), visible: !!a.offsetParent && a.getBoundingClientRect().height >= 44 }))
      }));
      await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
      const mid = await p.evaluate(() => getComputedStyle(document.querySelector('.action-bar')).visibility);
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
      const foot = await p.evaluate(() => document.querySelector('.footer-bottom').getBoundingClientRect().bottom <= document.querySelector('.action-bar').getBoundingClientRect().top);
      check(`${w}: חיוג ו-WhatsApp גלויים בפתיחה; הפס מופיע רק בגלילה ואינו מכסה את הפוטר`, top.bar === 'hidden' && top.direct.length === 2 && top.direct.every(x => x.visible) && top.direct.some(x => x.href.startsWith('tel:')) && top.direct.some(x => x.href.startsWith('https://wa.me/')) && mid === 'visible' && foot, { top, mid, foot });
    }
    await c.close();
  }
  {
    const c = await ctx({ viewport: { width: 390, height: 800 } });
    const p = await c.newPage(); let bytes = 0; const types = {};
    p.on('response', async r => { try { const b = (await r.body()).length; bytes += b; const t = r.request().resourceType(); types[t] = (types[t] || 0) + b; } catch (e) { /* redirect */ } });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
    check('משקל הדף (כולל תמונות שנטענו) ≤ 320KB', bytes <= 320 * 1024, Math.round(bytes / 1024) + 'KB ' + JSON.stringify(types));
    const location = await p.evaluate(() => ({
      pins: document.querySelectorAll('.location-pin').length,
      image: document.querySelector('.location-visual img')?.getAttribute('src'),
      address: document.querySelector('.location-pin span span')?.textContent.trim(),
      old: document.querySelectorAll('[data-hall], .radar, #hallDialog, #hallMedia').length,
      nav: [...document.querySelectorAll('.navigation-link')].map(a => a.href),
      icons: [...document.querySelectorAll('.navigation-link img')].map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 }))
    }));
    check('מודול מיקום יחיד, כתובת נכונה וללא רכיבי אולמות ישנים', location.pins === 1 && location.image === 'assets/img/city-schematic.jpg' && location.address === 'כהנמן 64, בני ברק' && location.old === 0, location);
    check('קישורי ניווט ואייקונים מקומיים תקינים', location.nav.some(u => u.startsWith('https://waze.com/ul')) && location.nav.some(u => u.startsWith('https://www.google.com/maps/')) && location.icons.length === 2 && location.icons.every(i => i.loaded && i.src.startsWith('assets/img/')), location);
    await c.close();
  }

  /* ---------- 3. נגישות (axe) ---------- */
  section('נגישות');
  for (const w of [390, 1440]) {
    for (const url of [BASE, BASE + '404.html']) {
      const c = await ctx({ viewport: { width: w, height: 900 }, bypassCSP: true });
      const p = await c.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map(x => x.id + ':' + x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(',')));
      check(`axe ${w} ${url.endsWith('404.html') ? '404' : 'index'}: אפס הפרות`, v.length === 0, v);
      await c.close();
    }
  }

  /* ---------- 4. טופס ההזמנה ---------- */
  section('טופס');
  {
    const c = await ctx({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    const { p } = await open(c);
    const urls = []; await p.exposeFunction('__cap', u => urls.push(u));
    await p.evaluate(() => { window.open = u => { window.__cap(u); return {}; }; });
    await p.click('#family .tag[data-event="פדיון הבן"]');
    const chip = await p.evaluate(() => ({ v: document.getElementById('eventType').value, ctx: document.getElementById('eventContext').textContent }));
    check('תג אירוע בוחר ערך מדויק', chip.v === 'פדיון הבן' && chip.ctx.startsWith('נבחר: פדיון הבן'), chip);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#holidays .entry-cta');
    const cross = await p.evaluate(() => ({ v: document.getElementById('eventType').value, ctx: document.getElementById('eventContext').textContent, first: document.getElementById('eventType').children[1].label }));
    check('כפתור קטגוריה שומר את הבחירה הקודמת ומקדם את הקבוצה', cross.v === 'פדיון הבן' && cross.ctx.startsWith('הבחירה הקודמת נשמרה') && cross.first === 'חגים ומועדים', cross);
    const st0 = await p.evaluate(() => ({ req: !document.getElementById('dateReq').hidden, hint: !document.getElementById('dateHint').hidden }));
    await p.check('#dateUnknown');
    const st1 = await p.evaluate(() => ({ req: !document.getElementById('dateReq').hidden, hint: !document.getElementById('dateHint').hidden, form: document.getElementById('formHint').textContent, disabled: document.getElementById('date').disabled }));
    await p.uncheck('#dateUnknown');
    check('"תאריך טרם נקבע" מסנכרן כוכבית, רמז ושדה', st0.req && !st0.hint && !st1.req && st1.hint && st1.disabled && !st1.form.includes('תאריך'), { st0, st1 });
    await p.click('.form-submit');
    check('שליחה ריקה: המיקוד עובר לשדה הראשון עם שגיאה', (await p.evaluate(() => document.activeElement.id)) === 'name' && urls.length === 0);
    await p.fill('#name', 'בדיקה דמה');
    const phones = { '050-1234567': true, '050 123 4567': true, '+972-50-123-4567': true, '03-1234567': true, '050123456a': false, 'abcdefghi': false, '12345': false };
    const wrong = [];
    for (const [ph, ok] of Object.entries(phones)) { await p.fill('#phone', ph); await p.click('.form-submit'); const accepted = (await p.textContent('#phoneError')) === ''; if (accepted !== ok) wrong.push(ph); }
    check('אימות טלפון (7 מקרים)', wrong.length === 0, wrong);
    await p.fill('#phone', '050-1234567');
    await p.click('.form-options summary');
    await p.selectOption('#city', 'אחר');
    const other0 = await p.evaluate(() => ({ hidden: document.getElementById('cityOther').hidden, labelHidden: document.getElementById('cityOtherLabel').hidden, required: document.getElementById('cityOther').required }));
    await p.check('#dateUnknown');
    await p.click('.form-submit');
    check('בחירת עיר אחרת חושפת שדה חובה וממקדת שגיאה', !other0.hidden && !other0.labelHidden && other0.required && (await p.evaluate(() => document.activeElement.id)) === 'cityOther');
    await p.fill('#cityOther', 'רחובות');
    await p.uncheck('#dateUnknown');
    await p.fill('#date', '2020-01-01'); urls.length = 0; await p.click('.form-submit');
    check('תאריך שעבר נדחה ולא נפתח וואטסאפ', (await p.textContent('#dateError')).includes('עבר') && urls.length === 0);
    const sat = nextSaturday(30);
    await p.fill('#date', sat.iso);
    await p.fill('#notes', 'א'.repeat(450));
    urls.length = 0; await p.click('.form-submit');
    const msg = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    check('ההודעה נבנית ונשלחת למספר העסק בלבד', (urls[0] || '').startsWith('https://wa.me/' + WA + '?text='), urls[0]);
    check('יום שבת מוצג במילים בהודעה', msg.includes('תאריך: יום שבת, ' + sat.shown), (msg.match(/תאריך: .*/) || [''])[0]);
    check('הערות נחתכות ב-400 תווים', ((msg.match(/הערות: (א+)/) || ['', ''])[1].length) === 400);
    check('סוג האירוע בהודעה', msg.includes('סוג האירוע: פדיון הבן'));
    check('עיר אחרת נכתבת בשם שהוזן', msg.includes('עיר: רחובות') && !msg.includes('עיר: אחר'));
    await p.click('.form-help summary'); await p.click('#copyInquiry'); await p.waitForTimeout(100);
    check('ההעתקה זהה להודעה', (await p.evaluate(() => navigator.clipboard.readText())) === msg);
    await c.close();
  }

  /* ---------- 5. מודול המיקום ---------- */
  section('מודול מיקום');
  {
    const c = await ctx({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    const p = await c.newPage(); const ext = [];
    p.on('request', r => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) ext.push(r.url()); });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => ({
      caption: document.getElementById('locationCaption').textContent.trim(),
      disclaimer: document.querySelector('.location-disclaimer').textContent.trim(),
      decorative: document.querySelector('.location-art').getAttribute('alt') === '' && document.querySelector('.location-art').getAttribute('aria-hidden') === 'true'
    }));
    check('המחשה סכמטית מסומנת כדקורטיבית ומוסברת בטקסט', d.decorative && d.caption.includes('כהנמן 64') && d.disclaimer.includes('אינה מפת רחובות'), d);
    check('אין פנייה לשרתים זרים', ext.length === 0, ext);
    await c.close();
  }

  /* ---------- 6. תנועה ---------- */
  section('תנועה');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'no-preference' });
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    const its = await p.evaluate(() => document.getAnimations().map(a => a.effect.getTiming().iterations));
    check('אין אנימציות אינסופיות', its.every(n => n !== Infinity), its);
    await c.close();
    const c2 = await ctx({ viewport: { width: 390, height: 800 } });
    const p2 = await c2.newPage(); await p2.goto(BASE, { waitUntil: 'networkidle' });
    await p2.evaluate(() => document.querySelector('.location-visual').scrollIntoView({ block: 'center', behavior: 'instant' })); await p2.waitForTimeout(500);
    check('בהפחתת תנועה אין אנימציה', (await p2.evaluate(() => document.getAnimations().length)) === 0);
    await c2.close();
  }

  /* ---------- 7. בלי JavaScript, ו-404 ---------- */
  section('בלי JavaScript ו-404');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false });
    const p = await c.newPage(); await p.goto(BASE);
    const r = await p.evaluate(() => ({ nav: !!document.querySelector('#siteNav a[href="#faq"]').offsetParent, bar: getComputedStyle(document.querySelector('.action-bar')).visibility, direct: [...document.querySelectorAll('.hero-direct')].filter(a => a.offsetParent && a.getBoundingClientRect().height >= 44).length, addr: document.querySelector('.address-card strong').textContent, pin: document.querySelector('.location-pin span span').textContent, links: document.querySelectorAll('.navigation-link').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    check('בלי JS: ניווט, שתי דרכי קשר ישירות, פס חיוג, כתובת וניווט, בלי גלילה אופקית', r.nav && r.direct === 2 && r.bar === 'visible' && r.addr === 'כהנמן 64, בני ברק' && r.pin === 'כהנמן 64, בני ברק' && r.links === 2 && r.ov === 0, r);
    await c.close();
    const c2 = await ctx({ viewport: { width: 390, height: 800 } });
    const o = await open(c2, BASE + 'beit-shemesh/');
    const errs404 = o.errs.filter(e => !/status of 404/.test(e));
    const styled = await o.p.evaluate(() => getComputedStyle(document.querySelector('.notfound')).paddingTop);
    check('/beit-shemesh/ מחזיר 404 עם עמוד מעוצב', o.res.status() === 404 && (await o.p.title()).includes('לא נמצא') && styled === '72px' && errs404.length === 0 && o.csp.length === 0, { status: o.res.status(), styled, errs: errs404, csp: o.csp });
    await c2.close();
  }

  await browser.close(); if (srv) srv.close();
  console.log(`\n${passes} עברו, ${failures} נכשלו`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
