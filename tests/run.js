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
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];
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
  const ld = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  check('JSON-LD: כתובת המחסן', ld.address && ld.address.streetAddress === 'כהנמן 64' && ld.address.addressLocality === 'בני ברק', ld.address);
  check('JSON-LD: טלפון', ld.telephone === '+972-52-767-5138', ld.telephone);
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('sitemap: כתובת אחת, הדף הראשי', (sitemap.match(/<loc>/g) || []).length === 1 && sitemap.includes('<loc>https://natank0.github.io/klein-productions/</loc>'));
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
  section('פריסה, רדאר ומשקל');
  for (const w of WIDTHS) {
    const mobile = w < 800;
    const c = await ctx({ viewport: { width: w, height: mobile ? 800 : 900 }, isMobile: mobile, hasTouch: mobile });
    const { p, errs, ext, csp } = await open(c);
    await p.evaluate(() => document.querySelector('.radar').scrollIntoView({ block: 'start' }));
    const m = await p.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && r.height > 0 && !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)') && !e.closest('noscript') && !e.closest('dialog'); };
      const small = [...document.querySelectorAll('a,button,select,input:not([type=checkbox]),summary,.check span')].filter(e => vis(e) && e.getBoundingClientRect().height < 44 && !e.classList.contains('skip-link')).map(e => (e.textContent || e.id).trim().slice(0, 14) + ':' + Math.round(e.getBoundingClientRect().height));
      const fig = document.querySelector('.radar').getBoundingClientRect();
      const boxes = [...document.querySelectorAll('.radar-label, .radar-home, .radar-north')].map(e => ({ n: e.textContent.trim().slice(0, 12), r: e.getBoundingClientRect() }));
      const dots = [...document.querySelectorAll('.radar-dot, .radar-center')].map(e => ({ n: e.closest('.radar-node') ? e.closest('.radar-node').getAttribute('data-hall') : 'center', r: e.getBoundingClientRect() }));
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].r, boxes[j].r)) overlaps.push(boxes[i].n + '×' + boxes[j].n);
      for (const b of boxes) for (const d of dots) if (hit(b.r, d.r) && !(b.n.startsWith('קליין') && d.n === 'center')) overlaps.push(b.n + '×' + d.n);
      const outside = boxes.filter(x => x.r.left < fig.left || x.r.right > fig.right || x.r.top < fig.top || x.r.bottom > fig.bottom).map(x => x.n);
      const placed = [...document.querySelectorAll('.radar-node')].filter(n => getComputedStyle(n).left === '0px' || getComputedStyle(n).top === '0px').map(n => n.getAttribute('data-hall'));
      const minFont = Math.min(...[...document.querySelectorAll('.radar-label')].map(e => parseFloat(getComputedStyle(e).fontSize)));
      return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, overlaps, outside, placed, minFont };
    });
    check(`${w}: אין גלילה אופקית`, m.ov === 0, m.ov);
    check(`${w}: אזורי מגע ≥ 44px`, m.small.length === 0, m.small);
    check(`${w}: רדאר בלי חפיפות`, m.overlaps.length === 0, m.overlaps);
    check(`${w}: רדאר בלי חריגה מהמסגרת`, m.outside.length === 0, m.outside);
    check(`${w}: לכל נקודה ברדאר יש מיקום ב-CSS`, m.placed.length === 0, m.placed);
    check(`${w}: גופן תוויות הרדאר ≥ 13px`, m.minFont >= 13, m.minFont);
    check(`${w}: בלי שגיאות קונסולה`, errs.length === 0, errs);
    check(`${w}: בלי הפרות CSP`, csp.length === 0, csp);
    check(`${w}: בלי בקשות חיצוניות`, ext.length === 0, ext);
    if (mobile) {
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
      const top = await p.evaluate(() => getComputedStyle(document.querySelector('.action-bar')).visibility);
      await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
      const mid = await p.evaluate(() => getComputedStyle(document.querySelector('.action-bar')).visibility);
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
      const foot = await p.evaluate(() => document.querySelector('.footer-bottom').getBoundingClientRect().bottom <= document.querySelector('.action-bar').getBoundingClientRect().top);
      check(`${w}: פס החיוג מוסתר בפתיחה, מופיע בגלילה, לא מכסה את הפוטר`, top === 'hidden' && mid === 'visible' && foot, { top, mid, foot });
    }
    await c.close();
  }
  {
    const c = await ctx({ viewport: { width: 390, height: 800 } });
    const p = await c.newPage(); let bytes = 0; const types = {};
    p.on('response', async r => { try { const b = (await r.body()).length; bytes += b; const t = r.request().resourceType(); types[t] = (types[t] || 0) + b; } catch (e) { /* redirect */ } });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
    check('משקל הדף (כולל תמונות שנטענו) ≤ 150KB', bytes <= 150 * 1024, Math.round(bytes / 1024) + 'KB ' + JSON.stringify(types));
    const halls = await p.evaluate(() => {
      const legend = [...document.querySelectorAll('.radar-legend li[data-hall]')].map(l => l.dataset.hall).sort();
      const labels = [...document.querySelectorAll('.radar-label [data-hall]')].map(l => l.dataset.hall).sort();
      const media = Object.keys(JSON.parse(document.getElementById('hallMedia').textContent)).sort();
      return { legend, labels, media };
    });
    check('אותם אולמות במקרא, ברדאר וב-#hallMedia', JSON.stringify(halls.legend) === JSON.stringify(halls.labels) && JSON.stringify(halls.legend) === JSON.stringify(halls.media), halls);
    await c.close();
  }

  /* ---------- 3. נגישות (axe) וניגודיות על רקע מדורג ---------- */
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
  {
    const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    for (const w of [390, 1440]) {
      const c = await ctx({ viewport: { width: w, height: 900 }, bypassCSP: true });
      const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
      const bad = [];
      for (const el of await p.$$('.radar-north, .radar-home > *, .radar-label [data-hall], .radar-legend-title, .legend-name, #radarNote')) {
        await el.scrollIntoViewIfNeeded();
        const info = await el.evaluate(e => { const s = getComputedStyle(e); return { color: s.color, fs: parseFloat(s.fontSize), fw: +s.fontWeight, t: e.textContent.trim().slice(0, 14) }; });
        const bb = await el.boundingBox();
        const tag = await p.addStyleTag({ content: '.radar *, .radar *::before, .radar *::after { color: transparent !important; }' });
        const buf = await p.screenshot({ clip: { x: bb.x + 3, y: bb.y + 3, width: Math.max(1, bb.width - 6), height: Math.max(1, bb.height - 6) } });
        await tag.evaluate(n => n.remove());
        const px = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return Array.from(x.getImageData(0, 0, cv.width, cv.height).data); }, buf.toString('base64'));
        let hi = -1, lo = 2; for (let i = 0; i < px.length; i += 4) { const l = lum(px[i], px[i + 1], px[i + 2]); hi = Math.max(hi, l); lo = Math.min(lo, l); }
        const t = info.color.match(/[\d.]+/g).map(Number); const tl = lum(t[0], t[1], t[2]);
        const worst = Math.min(ratio(tl, hi), ratio(tl, lo));
        const need = info.fs >= 24 || (info.fs >= 18.66 && info.fw >= 700) ? 3 : 4.5;
        if (worst < need) bad.push(info.t + ' ' + worst.toFixed(2));
      }
      check(`${w}: ניגודיות בתוך הרדאר (המקרה הגרוע, פיקסל אחר פיקסל) ≥ AA`, bad.length === 0, bad);
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
    await p.fill('#date', '2020-01-01'); urls.length = 0; await p.click('.form-submit');
    check('תאריך שעבר נדחה ולא נפתח וואטסאפ', (await p.textContent('#dateError')).includes('עבר') && urls.length === 0);
    const sat = nextSaturday(30);
    await p.fill('#date', sat.iso);
    await p.click('.form-options summary'); await p.fill('#notes', 'א'.repeat(450));
    urls.length = 0; await p.click('.form-submit');
    const msg = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    check('ההודעה נבנית ונשלחת למספר העסק בלבד', (urls[0] || '').startsWith('https://wa.me/' + WA + '?text='), urls[0]);
    check('יום שבת מוצג במילים בהודעה', msg.includes('תאריך: יום שבת, ' + sat.shown), (msg.match(/תאריך: .*/) || [''])[0]);
    check('הערות נחתכות ב-400 תווים', ((msg.match(/הערות: (א+)/) || ['', ''])[1].length) === 400);
    check('סוג האירוע בהודעה', msg.includes('סוג האירוע: פדיון הבן'));
    await p.click('.form-help summary'); await p.click('#copyInquiry'); await p.waitForTimeout(100);
    check('ההעתקה זהה להודעה', (await p.evaluate(() => navigator.clipboard.readText())) === msg);
    await c.close();
  }

  /* ---------- 5. מדיה לאולמות: תצוגה, נגישות וחסימת מקורות זרים ---------- */
  section('מדיה לאולמות');
  {
    const c = await ctx({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    const p = await c.newPage(); const ext = [];
    p.on('request', r => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) ext.push(r.url()); });
    /* מזריקים נתוני בדיקה ל-#hallMedia לפני שהסקריפט קורא אותם (עובד גם מול האתר החי) */
    await p.addInitScript(() => {
      const fix = () => {
        const el = document.getElementById('hallMedia');
        if (!el || !el.textContent.includes('"chen": []')) return false;
        el.textContent = el.textContent
          .replace('"chen": []', '"chen": [{"type":"image","src":"assets/img/og-image.jpg","alt":"בדיקה","width":1200,"height":630,"caption":"תמונת בדיקה"},{"type":"video","src":"assets/media/test.mp4","mime":"video/mp4","poster":"https://example.com/p.jpg"},{"type":"image","src":"https://example.com/x.jpg","alt":"זר"},{"type":"image","src":"javascript:alert(1)","alt":"js"},{"type":"image","src":"data:image/png;base64,AAAA","alt":"data"}]')
          .replace('"marom": []', '"marom": [{"type":"image","src":"https://example.com/only.jpg","alt":"זר בלבד"}]');
        return true;
      };
      const mo = new MutationObserver(() => { if (fix()) mo.disconnect(); });
      mo.observe(document, { childList: true, subtree: true, characterData: true });
    });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const buttons = await p.$$eval('.radar-legend button', b => b.map(x => x.getAttribute('aria-label')));
    check('רק אולם עם מדיה מקומית הופך לכפתור', buttons.length === 1 && buttons[0].startsWith('ארמונות חן'), buttons);
    await p.click('.radar-legend button');
    const d = await p.evaluate(() => ({ open: document.getElementById('hallDialog').open, title: document.getElementById('hallDialogTitle').textContent, imgs: [...document.querySelectorAll('#hallMediaList img')].map(i => i.getAttribute('src') ? new URL(i.src).pathname : ''), vids: document.querySelectorAll('#hallMediaList video').length, poster: (document.querySelector('#hallMediaList video') || {}).poster }));
    check('החלון נפתח עם שם האולם', d.open && d.title === 'ארמונות חן', d);
    check('כתובות זרות, javascript: ו-data: נחסמות', d.imgs.length === 1 && d.imgs[0].endsWith('/assets/img/og-image.jpg') && d.vids === 1 && !d.poster, d);
    await p.keyboard.press('Escape');
    const after = await p.evaluate(() => ({ open: document.getElementById('hallDialog').open, focus: document.activeElement.getAttribute('aria-label') || '' }));
    check('Esc סוגר והמיקוד חוזר לכפתור', !after.open && after.focus.startsWith('ארמונות חן'), after);
    check('אין פנייה לשרתים זרים', ext.length === 0, ext);
    await c.close();
  }

  /* ---------- 6. תנועה ---------- */
  section('תנועה');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'no-preference' });
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    const before = await p.evaluate(() => document.querySelector('.radar').classList.contains('is-playing'));
    await p.evaluate(() => document.querySelector('.radar').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForFunction(() => document.querySelector('.radar').classList.contains('is-playing'), null, { timeout: 4000 });
    const its = await p.evaluate(() => document.getAnimations().map(a => a.effect.getTiming().iterations));
    await p.waitForTimeout(3200);
    const running = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    check('פעימת הרדאר: מתחילה רק בכניסה, פעם אחת, ונעצרת', !before && its.length > 0 && Math.max(...its) === 1 && running === 0, { before, its, running });
    await c.close();
    const c2 = await ctx({ viewport: { width: 390, height: 800 } });
    const p2 = await c2.newPage(); await p2.goto(BASE, { waitUntil: 'networkidle' });
    await p2.evaluate(() => document.querySelector('.radar').scrollIntoView({ block: 'center', behavior: 'instant' })); await p2.waitForTimeout(500);
    check('בהפחתת תנועה אין אנימציה', (await p2.evaluate(() => document.getAnimations().length)) === 0);
    await c2.close();
  }

  /* ---------- 7. בלי JavaScript, ו-404 ---------- */
  section('בלי JavaScript ו-404');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false });
    const p = await c.newPage(); await p.goto(BASE);
    const r = await p.evaluate(() => ({ nav: !!document.querySelector('#siteNav a[href="#faq"]').offsetParent, bar: getComputedStyle(document.querySelector('.action-bar')).visibility, legend: document.querySelectorAll('.radar-legend li').length, labels: document.querySelectorAll('.radar-label [data-hall]').length, addr: document.querySelector('.address-card strong').textContent, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    check('בלי JS: ניווט, פס חיוג, רדאר ומקרא, כתובת, בלי גלילה אופקית', r.nav && r.bar === 'visible' && r.legend === r.labels && r.legend > 0 && r.addr === 'כהנמן 64, בני ברק' && r.ov === 0, r);
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
