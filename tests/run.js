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
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.md': 'text/plain; charset=utf-8' };
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
  check('מותג: סמל SVG תואם ונגיש בשני הדפים', fs.existsSync(path.join(ROOT, 'assets/img/klein-mark.svg')) && pages.every(x => x.html.includes('klein-mark.svg')));
  check('אין התחייבות לא מאומתת לחשבונית למוסד', !index.includes('חשבונית למוסד'));
  check('מחוץ לבני ברק: מוצגת הבהרת אזור שירות', index.includes('id="cityHint"') && index.includes('נבדוק אפשרות הגעה'));
  check('אירועים נוספים מוגדרים ככותרת סמנטית', /<h3 class="group-title" id="more-events">אירועים נוספים<\/h3>/.test(index));
  const hv = new HtmlValidate(new FileSystemConfigLoader());
  for (const { f } of pages) {
    const r = await hv.validateFile(path.join(ROOT, f));
    const msgs = r.results.flatMap(x => x.messages.map(m => `${m.line}:${m.column} ${m.ruleId} ${m.message}`));
    check(`html-validate ${f}`, r.valid, msgs.slice(0, 8).join(' | '));
  }
  const visibleText = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const { f, html } of pages) {
    check(`${f}: אין משאבים חיצוניים (סקריפט, גופן, תמונה); iframe רק של מפת Google`, !/<script[^>]+src="https?:|<link[^>]+rel="stylesheet"[^>]+href="https?:|<img[^>]+src="https?:|<video[^>]+src="https?:|@import/i.test(html) && [...html.matchAll(/<iframe[^>]*>/g)].every(m => /src="https:\/\/www\.google\.com\/maps\?q=/.test(m[0])));
    const text = visibleText(html);
    const banned = ['סניף', 'המובילים', 'המוביל ב', 'שנות ותק', '₪', 'ש"ח', 'ש״ח', 'זמין בחג', 'פתוח בחג', 'בית שמש', 'נחמן', 'זמינות מיידית', 'מענה מהיר', 'מענה מיידי', '24/7', 'גיבוי', 'במלאי', '15 שנה של', 'כלול בכל הזמנה', 'איש סאונד צמוד'];
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
  /* המחסן בבני ברק: פין אחד, בלי שמות אולמות בשום קובץ שנפרס */
  const HALLS = ['וגשל', 'גני הדקל', 'היכלי מלכות', 'רויאל', 'היכלי הפאר', 'ארמונות חן', 'דונולו', 'מרום', 'הדודאים', 'vagshal', 'malchut', 'royal', 'hapeer', 'donolo', 'marom', 'dudaim', 'hallMedia', 'hallDialog', 'data-hall', 'radar', 'אולמות שמחה'];
  for (const f of ['index.html', '404.html', 'README.md', 'assets/css/site.css', 'assets/js/site.js', 'sitemap.xml', 'robots.txt']) {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const found = HALLS.filter(w => body.includes(w));
    check(`${f}: אין שמות אולמות, רדאר או גלריית אולמות`, found.length === 0, found);
  }
  const MAP_SRC = 'https://www.google.com/maps?q=%D7%94%D7%A8%D7%91%20%D7%9B%D7%94%D7%A0%D7%9E%D7%9F%2064%2C%20%D7%91%D7%A0%D7%99%20%D7%91%D7%A8%D7%A7&amp;hl=iw&amp;z=16&amp;output=embed';
  const frames = [...index.matchAll(/<iframe([^>]*)>/g)].map(m => m[1]);
  check('המחסן: מפת Google אחת, לכתובת "הרב כהנמן 64, בני ברק", עם כותרת נגישה וטעינה עצלה', frames.length === 1 && frames[0].includes('src="' + MAP_SRC + '"') && /title="מפת Google: הרב כהנמן 64, בני ברק"/.test(frames[0]) && /loading="lazy"/.test(frames[0]), frames);
  check('CSP: frame-src מתיר רק את Google Maps', /frame-src https:\/\/www\.google\.com https:\/\/maps\.google\.com;/.test(index));
  check('אין כותרת "תחום הדגל"', !index.includes('תחום הדגל'));
  check('הטופס לפני השאלות הנפוצות, ובלי פרק "איך מזמינים" שחוזר על המובן', index.indexOf('id="order"') > 0 && index.indexOf('id="order"') < index.indexOf('id="faq"') && !index.includes('id="how"'));
  check('כתובת אחת בכל הקישורים: המפה, Waze, Google Maps ו-JSON-LD מחפשים "הרב כהנמן 64, בני ברק"', (() => { const qs = [...index.matchAll(/(?:maps\?q|ul\?q|query)=([^&"]+)/g)].map(m => m[1]); return qs.length >= 5 && qs.every(q => q === '%D7%94%D7%A8%D7%91%20%D7%9B%D7%94%D7%A0%D7%9E%D7%9F%2064%2C%20%D7%91%D7%A0%D7%99%20%D7%91%D7%A8%D7%A7'); })());
  check('main מקבל מיקוד מקישור הדילוג (tabindex=-1)', /<main id="main" tabindex="-1">/.test(index));
  check('אין מחלקת btn-dark מטעה (הכפתור זהב)', !/btn-dark/.test(index + pages[1].html + fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8')));
  check('וואטסאפ נכתב בעברית בטקסט הגלוי', !/>[^<]*WhatsApp[^<]*</.test(index.replace(/<title>[\s\S]*?<\/title>/, '')));
  check('משפט פרטיות ליד כפתור השליחה, בלי טענה שההודעה נשלחה', /class="form-privacy">הפרטים אינם נשמרים באתר\. ההודעה תישלח רק אם תלחצו על שליחה בוואטסאפ\.</.test(index));
  check('חתונות: ארבעה תחומים בלי ציר שלבים ממוספר (חופה, עזרת נשים, דרשות וברכות, רחבת השמחה)', (() => { const m = index.match(/<dl class="wedding-spec">([\s\S]*?)<\/dl>/); const st = m ? [...m[1].matchAll(/<dt>([^<]+)<\/dt>/g)].map(x => x[1]) : []; return st.join('|') === 'חופה|עזרת נשים|דרשות וברכות|רחבת השמחה' && !index.includes('wedding-flow'); })());
  check('פתיחה: שתי פעולות בלבד, טופס הצעת מחיר וחיוג עם המספר גלוי (וואטסאפ ישיר רק בפס, בטופס ובפוטר)', (() => { const m = index.match(/<div class="hero-actions">([\s\S]*?)<\/div>/); const b = m ? [...m[1].matchAll(/<a [^>]*href="([^"]+)"/g)].map(x => x[1]) : []; return b.length === 2 && b[0] === '#order' && b[1] === 'tel:0527675138' && m[1].includes('052-7675138'); })());
  check('כותרת: הקישור שמחוץ לתפריט מוביל לטופס, בלי כפילות של "חתונות"', index.includes('class="btn btn-primary btn-sm header-quote" href="#order"') && !index.includes('header-events'));
  check('הציוד גלוי ולא מקופל: קטלוג לפי שימוש עם כל היצרנים כטקסט, ארבע קבוצות ראשיות ושלוש נוספות, לפני מה שכלול בשירות', (() => { const cat = (index.match(/<div class="catalog" id="equipment">[\s\S]*?<div class="scope">/) || [''])[0]; const main = (cat.match(/<dl class="gear gear-main">([\s\S]*?)<\/dl>/) || ['', ''])[1]; const more = (cat.match(/<dl class="gear gear-more">([\s\S]*?)<\/dl>/) || ['', ''])[1]; const dts = x => [...x.matchAll(/<dt>([^<]+)<\/dt>/g)].map(m => m[1]); return dts(main).join('|') === 'רמקולים וסאבוופרים|מיקסרים|מיקרופונים|מוניטורים וחיבורים' && dts(more).join('|') === 'סטנדים|הקלטה והקרנה|תאורת במה' && ['RCF', 'QSC', 'Midas', 'Mackie', 'Yamaha', 'Behringer', 'Shure'].every(b => cat.includes('<bdi lang="en">' + b + '</bdi>')) && !/<details[^>]*id="equipment"/.test(index) && !/<img[^>]*(rcf|qsc|midas|shure|yamaha|mackie|behringer)/i.test(index); })());
  check('המחסן: הכתובת מוצגת כנקודת היציאה של הציוד', /class="address-card">[\s\S]*?<strong>כהנמן 64, בני ברק<\/strong><span>נקודת היציאה של הציוד/.test(index));
  check('שירות בשלוש קבוצות: הקמה, התאמות לפי האירוע, ושירותים נוספים בתיאום (איש סאונד שם, לא כלול)', (() => { const m = (index.match(/<div class="scope-cols">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/) || ['', ''])[1]; const h = [...m.matchAll(/<h4>([^<]+)<\/h4>/g)].map(x => x[1]); return h.join('|') === 'הגברה עם הקמה|התאמות לפי האירוע|שירותים נוספים בתיאום' && /שירותים נוספים בתיאום<\/h4>[\s\S]*?איש סאונד לאורך האירוע/.test(m) && !/הגברה עם הקמה<\/h4>[^]*?איש סאונד[^]*?התאמות לפי/.test(m); })());
  check('גופן: מקומי בלבד (woff2 מהאתר), שאר ה-url ב-CSS הם SVG מקומי, CSP עם font-src self, ורישיון OFL לצד הקבצים', (() => { const css = fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8'); const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1]); const fonts = urls.filter(u => /\.woff2$/.test(u)); const others = urls.filter(u => !/\.woff2$/.test(u)); return fonts.length >= 4 && fonts.every(u => /^\.\.\/fonts\/[\w-]+\.woff2$/.test(u) && fs.existsSync(path.join(ROOT, 'assets/css', u))) && others.every(u => /^\.\.\/img\/[\w-]+\.svg$/.test(u) && fs.existsSync(path.join(ROOT, 'assets/css', u))) && !/@font-face[^}]*\.svg/.test(css) && /font-display: swap/.test(css) && pages.every(({ html }) => /font-src 'self'/.test(html)) && fs.existsSync(path.join(ROOT, 'assets/fonts/OFL.txt')); })());
  check('פתיחה: שלוש עובדות – ותק, ציוד ומחסן (כתובת המחסן כקישור לפרק המחסן)', (() => { const m = (index.match(/<ul class="hero-proof">[\s\S]*?<\/ul>/) || [''])[0]; return m.split('<li>').length - 1 === 3 && m.includes('<strong>15 שנות ניסיון</strong>') && /RCF[\s\S]*QSC[\s\S]*Midas[\s\S]*Shure/.test(m) && /<a class="hero-area" href="#areas"><strong>מחסן בכהנמן 64, בני ברק<\/strong>/.test(m) && !/תקלה/.test(m) && !index.includes('hero-facts'); })());
  /* ותק: מספר אחד בלבד, 15, לפי הנחיית המשתמש (17.11.2026). כל מספר שנים אחר נכשל */
  check('ותק: רק "15 שנות ניסיון" (אושר), בלי מספר שנים אחר', (() => { const txt = index.replace(/<script(?! type="application\/ld\+json")[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '); const yrs = [...txt.matchAll(/(\d+)\s*(?:שנה|שנים|שנות)/g)].map(m => m[1]); return yrs.length >= 1 && yrs.every(y => y === '15'); })());
  check('סגירה אחרי השאלות: טופס, חיוג ווואטסאפ', (() => { const i = index.indexOf('id="closing-title"'); const blk = index.slice(i, index.indexOf('</section>', i)); return i > index.indexOf('id="faq"') && blk.includes('href="#order"') && blk.includes('href="tel:0527675138"') && blk.includes('https://wa.me/972527675138'); })());
  check('בפרק המחסן: משפט שמבהיר שהציוד מובא למקום האירוע בתיאום, בלי רשימת ערים', /class="location-benefit">[^<]*מובא למקום האירוע בהתאם לתיאום/.test(index) && !/class="location-benefit">[^<]*(פתח תקווה|רמת גן|אלעד)/.test(index));
  /* 17.11.2026: רקע הפתיחה נשאר בהיר; הפוטר הכחול יוצר עוגן ברור ואינו משתלט על התוכן הראשי. */
  check('רקעים לפי היררכיה: פתיחה בהירה, סיום בהיר ופוטר כחול עמוק', (() => { const css = fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8'); return /\.hero \{[^}]*background: #f7fbfe/.test(css) && /\.closing \{[^}]*background: var\(--surface\)/.test(css) && /\.footer \{[^}]*background: var\(--ink\)/.test(css); })());
  { const css = fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8');
    const hexes = [...css.matchAll(/#([0-9a-f]{6})\b/gi)].map(m => m[1]);
    check('מבטא אמבר מוגדר פעם אחת ומשמש במינון מדוד', /--accent: #b66a0a/.test(css) && /--accent-tint: #fff4df/.test(css) && (css.match(/var\(--accent\)/g) || []).length <= 6);
    check('צבע הפעולה שמור ללחיצים: כותרות לא בצבע הקישורים', !/(h2|h3|h4|\.group-title|\.section-title)[^{]*\{[^}]*color: var\(--signal\)/.test(css));
    check('יש גיליון הדפסה ומצב ניגודיות גבוהה', /@media print/.test(css) && /@media \(forced-colors: active\)/.test(css));
    check('רקעים לפי תפקיד: גל בפתיחה ובסיום, מוסתר בהדפסה ובניגודיות גבוהה', /class="hero wave-edge"/.test(index) && /closing wave-edge"/.test(index) && [480, 1024, 1600].every(w => fs.existsSync(path.join(ROOT, `assets/img/wave-meter-${w}.svg`))) && /@media print[\s\S]*\.wave-edge::after \{ display: none; \}/.test(css) && /forced-colors: active\) \{\s*\.wave-edge::after \{ display: none; \}/.test(css));
    check('במובייל ובטאבלט כפתורי הפתיחה בעמודה אחת ברוחב מלא', /max-width: 860px\)[\s\S]*?\.hero-actions \{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(css));
    check('פלטת מותג: כחול עמוק, כחול פעולה, משטח תכלת ואמבר', ['ink', 'signal', 'signal-hover', 'signal-tint', 'surface', 'accent', 'accent-tint'].every(n => new RegExp('--' + n + ': #[0-9a-f]{6}').test(css)) && !/#7b263b/i.test(css));
    check('מערכת מרווחים אחת: 8, 12, 16, 24, 32, 48, 72, 96', /--s-1: 8px; --s-2: 12px; --s-3: 16px; --s-4: 24px; --s-5: 32px; --s-6: 48px; --s-7: 72px; --s-8: 96px;/.test(css));
    { const results = [480, 1024, 1600].map(W => {
        const svg = fs.readFileSync(path.join(ROOT, `assets/img/wave-meter-${W}.svg`), 'utf8');
        const bars = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g)].map(m => m.slice(1).map(Number));
        const byX = new Map(bars.map(b => [b[0], b[3]])), c = W / 2 - 1;
        const exact = bars.length > 0 && bars.every(([x, y, w, h]) => w === 2 && (x - c) % 8 === 0 && h % 2 === 0 && y + h === 96 && x >= 0 && x + w <= W);
        const mirrored = bars.every(([x, , , h]) => byX.get(2 * c - x) === h);
        const shaped = byX.get(c) <= 16 && Math.max(...bars.map(b => b[3])) >= 64;
        return exact && mirrored && shaped;
      });
      check('גל הרקע מדויק בשלושת הרוחבים: פסים 2px בפסיעה 8px, ראש שטוח, גבהים זוגיים, מראה סימטרית, נמוך במרכז וגבוה בקצוות', results.every(Boolean), results);
      check('הגל עולה מקו בסיס בשני המקטעים, ואין קו כפול בין הסיום לפוטר', !/scaleY\(-1\)/.test(css) && /\.closing \{[^}]*border-bottom: 0/.test(css) && /padding-bottom: calc\(var\(--wave-h\) \+/.test(css));
    }
  }
  check('ארבעת סוגי האירועים הנוספים כרשימה, לכל אחד קישור הצעת מחיר ייחודי (קישור טקסט, לא כפתור רביעי באותו משקל)', (() => { const labels = [...index.matchAll(/class="link-cta entry-cta" href="#order" data-event-group="(\w+)">([^<]+)<\/a>/g)].map(m => m[1] + ':' + m[2]); return /<ul class="entries">/.test(index) && labels.length === 4 && new Set(labels).size === 4 && labels.map(l => l.split(':')[0]).join() === 'family,shul,institutions,holidays' && !/התאמות נפוצות/.test(index); })());
  const WAZE_URL = 'https://waze.com/ul?q=%D7%94%D7%A8%D7%91%20%D7%9B%D7%94%D7%A0%D7%9E%D7%9F%2064%2C%20%D7%91%D7%A0%D7%99%20%D7%91%D7%A8%D7%A7&amp;navigate=yes';
  const GMAPS_URL = 'https://www.google.com/maps/search/?api=1&amp;query=%D7%94%D7%A8%D7%91%20%D7%9B%D7%94%D7%A0%D7%9E%D7%9F%2064%2C%20%D7%91%D7%A0%D7%99%20%D7%91%D7%A8%D7%A7';
  const navLinks = [...index.matchAll(/<a class="navigation-link" data-app="([a-z-]+)" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ app: m[1], href: m[2], text: m[3].replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), svg: m[3].includes('<svg') }));
  check('קישורי ניווט: Waze ו-Google Maps לכתובת המחסן, עם טקסט גלוי', navLinks.length === 2 && navLinks.some(l => l.app === 'waze' && l.href === WAZE_URL && l.text === 'ניווט ב-Waze') && navLinks.some(l => l.app === 'google-maps' && l.href === GMAPS_URL && l.text === 'פתיחה ב-Google Maps'), navLinks);
  check('קישורי ניווט: בלי אייקון סיכה או חץ גנרי משותף', navLinks.every(l => !l.svg), navLinks);
  /* סמלי המותג הרשמיים: אם נוספו קבצים, הם מקומיים, מוצגים בקישור הנכון ולא צבועים מחדש */
  for (const app of ['waze', 'google-maps']) {
    const files = [`assets/img/brands/${app}-icon-24.png`, `assets/img/brands/${app}-icon-48.png`];
    const link = [...index.matchAll(/<a class="navigation-link" data-app="([a-z-]+)"[^>]*>([\s\S]*?)<\/a>/g)].find(m => m[1] === app);
    check(`סמל ${app}: קבצים מקומיים קיימים ומוצגים בקישור הנכון עם alt ריק`, files.every(f => fs.existsSync(path.join(ROOT, f))) && !!link && files.every(f => link[2].includes(f)) && /<img [^>]*alt=""/.test(link[2]), app);
  }
  check('CSS: אין filter על סמלי מותג', !/navigation-link[^{]*img[^{]*\{[^}]*filter/.test(fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8')));
  check('אין טענת "מרכז גאוגרפי" או זמני הגעה', !/מרכז גאוגרפי|מרכז גיאוגרפי|דקות נסיעה|דקות מהמחסן|ק״מ|ק"מ/.test(visibleText(index)));
  check('H1 קצר ומדויק: "הגברה לחתונות ולאירועים בבני ברק"', /<h1 id="hero-title">הגברה לחתונות ולאירועים בבני ברק<\/h1>/.test(index));
  check('ניווט: ארבעה קישורים ופעולה אחת, וכל עוגן קיים בדף', (() => { const nav = (index.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/) || ['', ''])[1]; const hrefs = [...nav.matchAll(/href="#([\w-]+)"/g)].map(m => m[1]); return hrefs.length === 5 && hrefs[4] === 'order' && hrefs.every(h => index.includes('id="' + h + '"')) && ['weddings', 'more-events', 'equipment'].every(h => index.includes('id="' + h + '"')); })());
  check('חתונות: לפני שאר הקטגוריות, עם קישור ייעודי ל"חתונה וחופה" והערת איש סאונד בתיאום', index.indexOf('id="weddings"') < index.indexOf('id="family"') && /<a class="btn btn-primary" href="#order" data-event="חתונה וחופה">/.test(index) && /class="wedding-note">אפשר לתאם איש סאונד לאורך האירוע\.</.test(index));
  check('שאלות נפוצות: השאלות המעשיות ראשונות', (() => { const q = [...index.matchAll(/<summary>([^<]+)<\/summary>/g)].map(m => m[1]).filter(t => !/לא חובה/.test(t)); return q.slice(0, 4).join('|') === 'מה משפיע על המחיר?|מה כולל שירות הגברה עם הקמה?|מה מתאמים לחופה ולעזרת הנשים?|מה צריך להעביר מהקלידן או מהזמר?'; })());
  check('title ו-og:title במיקוד חתונות', /<title>[^<]*חתונות[^<]*<\/title>/.test(index) && /og:title" content="[^"]*חתונות/.test(index));
  const ld = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  check('JSON-LD: כתובת המחסן', ld.address && ld.address.streetAddress === 'כהנמן 64' && ld.address.addressLocality === 'בני ברק', ld.address);
  check('JSON-LD: טלפון', ld.telephone === '+972-52-767-5138', ld.telephone);
  check('JSON-LD: בלי קואורדינטות שלא אומתו, שעות פתיחה, דירוגים או ביקורות', !('geo' in ld) && !('openingHours' in ld) && !('openingHoursSpecification' in ld) && !('aggregateRating' in ld) && !('review' in ld), Object.keys(ld));
  check('JSON-LD: אזור שירות רק בני ברק עד אישור', ld.areaServed === 'בני ברק', ld.areaServed);
  check('description: עובדות מאושרות בלבד', /<meta name="description" content="קליין הפקות: הגברה לחתונות, חופות, שמחות משפחתיות ואירועי בתי מדרש ומוסדות\. ציוד RCF, QSC, Midas ו-Shure\. מחסן בכהנמן 64, בני ברק\. לפרטים: 052-7675138\.">/.test(index));
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('sitemap: כתובת אחת, הדף הראשי', (sitemap.match(/<loc>/g) || []).length === 1 && sitemap.includes('<loc>https://natank0.github.io/klein-productions/</loc>'));
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  check('robots: מאפשר סריקה ומפנה למפת האתר', /User-agent:\s*\*/.test(robots) && /Allow:\s*\//.test(robots) && robots.includes('Sitemap: https://natank0.github.io/klein-productions/sitemap.xml'));
  check('עמוד בית שמש לא קיים', !fs.existsSync(path.join(ROOT, 'beit-shemesh')));

  const srv = process.env.QA_BASE ? null : await serve();
  const BASE = process.env.QA_BASE || `http://127.0.0.1:${srv.address().port}${PREFIX}`;
  if (srv === null) console.log('\nבדיקות דפדפן מול ' + BASE);
  const ORIGIN = new URL(BASE).origin;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = (o = {}) => browser.newContext({ reducedMotion: 'reduce', ...o });

  async function open(c, url = BASE) {
    const p = await c.newPage();
    const errs = [], ext = [], csp = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && (!m.location().url || m.location().url.startsWith(ORIGIN))) errs.push(m.text()); });
    p.on('request', r => { const u = r.url(); if (r.frame() === p.mainFrame() && !u.startsWith(ORIGIN) && !u.startsWith('data:')) ext.push(u); });
    await p.exposeFunction('__cspViolation', d => csp.push(d));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspViolation(e.violatedDirective + ' ' + e.blockedURI)));
    const res = await p.goto(url, { waitUntil: 'networkidle' });
    return { p, errs, ext, csp, res };
  }

  /* ---------- 2. פריסה ברוחבים ---------- */
  section('פריסה, מחסן ומשקל');
  for (const w of WIDTHS) {
    const compact = w <= 860;
    const mobile = w < 800;
    const c = await ctx({ viewport: { width: w, height: mobile ? 800 : 900 }, isMobile: mobile, hasTouch: mobile });
    const { p, errs, ext, csp } = await open(c);
    await p.evaluate(() => document.getElementById('areas').scrollIntoView({ block: 'start' }));
    const m = await p.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && r.height > 0 && !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)') && !e.closest('noscript'); };
      const small = [...document.querySelectorAll('a,button,select,input:not([type=checkbox]),summary,.check span')].filter(e => vis(e) && e.getBoundingClientRect().height < 44 && !e.classList.contains('skip-link')).map(e => (e.textContent || e.id).trim().slice(0, 14) + ':' + Math.round(e.getBoundingClientRect().height));
      const map = document.querySelector('.location-map iframe').getBoundingClientRect();
      const canvas = map;
      const navs = [...document.querySelectorAll('.navigation-link')].map(a => { const r = a.getBoundingClientRect(); const s = a.querySelector('span').getBoundingClientRect(); const i = a.querySelector('img'); return { icon: !!i && i.complete && i.naturalWidth > 0 && getComputedStyle(i).filter === 'none', h: Math.round(r.height), clipped: s.right > r.right + 1 || s.left < r.left - 1 || a.scrollWidth > a.clientWidth + 1 }; });
      const text = document.querySelector('.location-text').getBoundingClientRect();
      const addr = document.querySelector('.address-card strong'); const addrLines = Math.round(addr.getBoundingClientRect().height / parseFloat(getComputedStyle(addr).lineHeight));
      return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, mapOk: map.width >= 260 && map.height >= 260, navs, linksBeforeMap: mobileFirst(text, canvas), addrLines };
      function mobileFirst(t, cv) { return t.bottom <= cv.top + 1 || t.left >= cv.right - 1; }
    });
    check(`${w}: אין גלילה אופקית`, m.ov === 0, m.ov);
    check(`${w}: אזורי מגע ≥ 44px`, m.small.length === 0, m.small);
    check(`${w}: מפת Google בגודל קריא (≥ 260px)`, m.mapOk, m);
    check(`${w}: כפתורי Waze ו-Google Maps: סמל רשמי נטען בלי filter, גובה ≥ 48px, בלי חיתוך`, m.navs.length === 2 && m.navs.every(n => n.icon && n.h >= 48 && !n.clipped), m.navs);
    check(`${w}: כתובת וכפתורי ניווט לפני המפה או לצידה`, m.linksBeforeMap, m);
    check(`${w}: כתובת המחסן בשורה אחת`, m.addrLines === 1, m.addrLines);
    check(`${w}: בלי שגיאות קונסולה`, errs.length === 0, errs);
    check(`${w}: בלי הפרות CSP`, csp.length === 0, csp);
    check(`${w}: בלי בקשות חיצוניות מהדף (מלבד מסגרת המפה)`, ext.length === 0, ext);
    if (compact) {
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
      const top = await p.evaluate(() => ({
        bar: getComputedStyle(document.querySelector('.action-bar')).visibility,
        direct: [...document.querySelectorAll('.hero-actions .btn')].map(a => ({ href: a.getAttribute('href'), visible: !!a.offsetParent && a.getBoundingClientRect().height >= 44 }))
      }));
      await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
      const mid = await p.evaluate(() => { const bar = document.querySelector('.action-bar'); return getComputedStyle(bar).visibility === 'visible' && !!bar.querySelector('a[href^="https://wa.me/"]') ? 'visible' : 'hidden'; });
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
      const foot = await p.evaluate(() => document.querySelector('.footer-bottom').getBoundingClientRect().bottom <= document.querySelector('.action-bar').getBoundingClientRect().top);
      check(`${w}: בפתיחה שתי פעולות (טופס וחיוג, בלי וואטסאפ שעוקף את הטופס); פס חיוג ווואטסאפ מופיע רק בגלילה ואינו מכסה את הפוטר`, top.bar === 'hidden' && top.direct.length === 2 && top.direct.every(x => x.visible) && top.direct[0].href === '#order' && top.direct[1].href.startsWith('tel:') && mid === 'visible' && foot, { top, mid, foot });
    }
    await c.close();
  }
  {
    const c = await ctx({ viewport: { width: 390, height: 800 } });
    const p = await c.newPage(); let bytes = 0; const types = {};
    p.on('response', async r => { if (!r.url().startsWith(ORIGIN)) return; try { const b = (await r.body()).length; bytes += b; const t = r.request().resourceType(); types[t] = (types[t] || 0) + b; } catch (e) { /* redirect */ } });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
    check('משקל הדף מהאתר (בלי מפת Google) ≤ 150KB', bytes <= 150 * 1024, Math.round(bytes / 1024) + 'KB ' + JSON.stringify(types));
    const dom = await p.evaluate(() => ({ maps: document.querySelectorAll('iframe').length, dialogs: document.querySelectorAll('dialog').length, addr: document.querySelector('.address-card strong').textContent }));
    check('DOM: מפה אחת, בלי חלונות גלריה, כתובת נכונה', dom.maps === 1 && dom.dialogs === 0 && dom.addr === 'כהנמן 64, בני ברק', dom);
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
    /* ניגודיות על משטחי המותג (מסך פתיחה מדורג, תווית הפין על המפה): המקרה הגרוע פיקסל אחר פיקסל */
    const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    for (const w of [390, 1440]) {
      const c = await ctx({ viewport: { width: w, height: 900 }, bypassCSP: true });
      const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
      const bad = [];
      for (const el of await p.$$('.hero h1, .hero-lead, .hero-proof strong, .hero-proof span, .footer-name, .footer a, .event-wide-head h3, .event-wide-head p, .event-wide-body h4, .group-title, .location-benefit, .scope-col h4, .scope-note, .gear-brands, .footer p')) {
        await el.scrollIntoViewIfNeeded();
        const info = await el.evaluate(e => { const s = getComputedStyle(e); return { color: s.color, fs: parseFloat(s.fontSize), fw: +s.fontWeight, t: e.textContent.trim().slice(0, 14) }; });
        const bb = await el.boundingBox();
        const tag = await p.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; } .hero h1::before, .group-title::before, .group-title::after { visibility: hidden !important; }' });
        const buf = await p.screenshot({ clip: { x: bb.x + 2, y: bb.y + 2, width: Math.max(1, bb.width - 4), height: Math.max(1, bb.height - 4) } });
        await tag.evaluate(n => n.remove());
        const px = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return Array.from(x.getImageData(0, 0, cv.width, cv.height).data); }, buf.toString('base64'));
        let hi = -1, lo = 2; for (let i = 0; i < px.length; i += 4) { const l = lum(px[i], px[i + 1], px[i + 2]); hi = Math.max(hi, l); lo = Math.min(lo, l); }
        const t = info.color.match(/[\d.]+/g).map(Number); const tl = lum(t[0], t[1], t[2]);
        const worst = Math.min(ratio(tl, hi), ratio(tl, lo));
        const need = info.fs >= 24 || (info.fs >= 18.66 && info.fw >= 700) ? 3 : 4.5;
        if (worst < need) bad.push(info.t + ' ' + worst.toFixed(2));
      }
      check(`${w}: ניגודיות על משטחי המותג (המקרה הגרוע, פיקסל אחר פיקסל) ≥ AA`, bad.length === 0, bad);
      await c.close();
    }
  }

  {
    const c = await ctx({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    const { p } = await open(c);
    await p.click('#menuToggle');
    const opened = await p.evaluate(() => document.getElementById('siteNav').classList.contains('is-open'));
    check('תפריט נייד: כפתורי הפתיחה מוסתרים בזמן שהתפריט פתוח', await p.evaluate(() => getComputedStyle(document.querySelector('.hero-actions')).visibility === 'hidden'));
    await p.mouse.click(200, 700);
    const closed = await p.evaluate(() => !document.getElementById('siteNav').classList.contains('is-open') && document.getElementById('menuToggle').getAttribute('aria-expanded') === 'false');
    check('תפריט המובייל נסגר בלחיצה מחוץ לו', opened && closed, { opened, closed });
    await c.close();
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
    check('כפתור קטגוריה שומר את הבחירה הקודמת ומקדם את הקבוצה', cross.v === 'פדיון הבן' && cross.ctx.startsWith('הבחירה הקודמת נשמרה') && cross.first === 'מועדים ואירועי קהילה', cross);
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
    const echo = await p.evaluate(() => { const h = document.getElementById('dateHint'); return { shown: !h.hidden, text: h.textContent }; });
    check('מתחת לתאריך מוצג התאריך כפי שיופיע בהודעה (יום בשבוע ו-DD/MM/YYYY)', echo.shown && echo.text === 'בהודעה יופיע: יום שבת, ' + sat.shown, echo);
    const fold = await p.evaluate(() => { const d = document.getElementById('formMore'); const inside = ['venue', 'time', 'notes'].every(id => d.contains(document.getElementById(id))) && [...document.querySelectorAll('input[name="access"], input[name="needs"]')].every(i => d.contains(i)); const outside = ['name', 'phone', 'eventType', 'date', 'dateUnknown', 'city'].every(id => !d.contains(document.getElementById(id))); const next = d.nextElementSibling; const visibleBefore = [...document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea')].filter(e => e.offsetParent && !e.closest('details') && !e.closest('.form-alt')).length; return { closed: !d.open, inside, outside, submitNext: !!next && next.classList.contains('form-submit'), visibleBefore, one: document.querySelectorAll('#orderForm details').length === 1 }; });
    check('טופס קצר: שם, טלפון, סוג אירוע, תאריך ועיר גלויים; כל פרטי הרשות ב-disclosure אחד וסגור, וכפתור וואטסאפ מיד אחריו', fold.closed && fold.inside && fold.outside && fold.submitNext && fold.one && fold.visibleBefore <= 6, fold);
    await p.click('.form-options summary');
    await p.click('.check:has(input[name="access"][value="יש מעלית"])'); await p.click('.check:has(input[name="access"][value="אירוע בחוץ"])');
    await p.fill('#venue', 'אולם בדיקה'); await p.fill('#time', '19:30'); await p.click('.check:has(input[name="needs"][value="הקלטה"])');
    await p.fill('#notes', 'א'.repeat(450));
    await p.click('.form-options summary');
    urls.length = 0; await p.click('.form-submit');
    const msg = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    check('ההודעה נבנית ונשלחת למספר העסק בלבד', (urls[0] || '').startsWith('https://wa.me/' + WA + '?text='), urls[0]);
    check('יום שבת מוצג במילים בהודעה', msg.includes('תאריך: יום שבת, ' + sat.shown), (msg.match(/תאריך: .*/) || [''])[0]);
    check('הערות נחתכות ב-400 תווים', ((msg.match(/הערות: (א+)/) || ['', ''])[1].length) === 400);
    check('סוג האירוע בהודעה', msg.includes('סוג האירוע: פדיון הבן'));
    check('פרטי רשות שהוזנו נכנסים להודעה גם כשה-disclosure סגור (גישה, אולם, שעה, ציוד, הערות)', (await p.evaluate(() => !document.getElementById('formMore').open)) && msg.includes('גישה למקום: יש מעלית, אירוע בחוץ') && msg.includes('אולם / כתובת: אולם בדיקה') && msg.includes('שעת התחלה: 19:30') && msg.includes('צריך: הקלטה'), msg.split(/\r?\n/).slice(2));
    const alt = await p.evaluate(() => { const box = document.querySelector('.form-alt'); const vis = e => !!e && !!e.offsetParent && !e.closest('details:not([open])'); return { box: vis(box), tel: vis(box && box.querySelector('a[href="tel:0527675138"]')), copy: vis(document.getElementById('copyInquiry')) }; });
    check('בלי וואטסאפ: חיוג והעתקת הפנייה גלויים מתחת לכפתור השליחה, בלי לפתוח אקורדיון', alt.box && alt.tel && alt.copy, alt);
    await p.click('#copyInquiry'); await p.waitForTimeout(100);
    check('ההעתקה זהה להודעה', (await p.evaluate(() => navigator.clipboard.readText())) === msg);
    /* עיר "אחר" */
    const hiddenBefore = await p.evaluate(() => document.getElementById('cityOtherField').hidden);
    await p.selectOption('#city', 'אחר');
    const shown = await p.evaluate(() => !document.getElementById('cityOtherField').hidden);
    await p.evaluate(() => { document.querySelector('.form-options').open = false; });
    urls.length = 0; await p.click('.form-submit');
    const cityErr = await p.evaluate(() => ({ err: document.getElementById('cityOtherError').textContent, focus: document.activeElement.id, visible: !!document.getElementById('cityOther').offsetParent }));
    check('עיר "אחר": נפתח שדה, ושליחה בלי שם עיר נעצרת עם שגיאה ומיקוד', hiddenBefore && shown && cityErr.err.includes('שם העיר') && cityErr.focus === 'cityOther' && cityErr.visible && urls.length === 0, { hiddenBefore, shown, cityErr, urls });
    await p.fill('#cityOther', 'קריית ספר');
    urls.length = 0; await p.click('.form-submit');
    const msg2 = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    check('עיר "אחר": שם העיר נכנס להודעה', msg2.includes('עיר: קריית ספר') && !msg2.includes('עיר: אחר'), (msg2.match(/עיר: .*/) || [''])[0]);
    check('"תאריך טרם נקבע": בלי כוכבית חובה, והודעה עם "תאריך: טרם נקבע"', await (async () => { await p.check('#dateUnknown'); urls.length = 0; await p.click('.form-submit'); const m = decodeURIComponent((urls[0] || '').split('text=')[1] || ''); const star = await p.evaluate(() => getComputedStyle(document.getElementById('dateReq')).display); await p.uncheck('#dateUnknown'); await p.fill('#date', sat.iso); return m.includes('תאריך: טרם נקבע') && star === 'none'; })());
    check('הודעת הסטטוס מבהירה שההודעה לא נשלחה', (await p.textContent('#formStatus')).startsWith('ההודעה מוכנה בוואטסאפ. בדקו ולחצו שם על שליחה.'));
    /* סוג אירוע "אחר": שדה חובה לתיאור, והתיאור נכנס להודעה */
    await p.selectOption('#eventType', 'אחר');
    const eo0 = await p.evaluate(() => !document.getElementById('eventOtherField').hidden);
    urls.length = 0; await p.click('.form-submit');
    const eo1 = await p.evaluate(() => ({ err: document.getElementById('eventOtherError').textContent, focus: document.activeElement.id }));
    await p.fill('#eventOther', 'הכנסת כלה'); urls.length = 0; await p.click('.form-submit');
    const msg3 = decodeURIComponent((urls[0] || '').split('text=')[1] || '');
    check('סוג אירוע "אחר": נפתח שדה, בלי תיאור השליחה נעצרת, והתיאור נכנס להודעה', eo0 && eo1.err.includes('איזה אירוע') && eo1.focus === 'eventOther' && msg3.includes('סוג האירוע: הכנסת כלה') && !msg3.includes('סוג האירוע: אחר'), { eo0, eo1, line: (msg3.match(/סוג האירוע: .*/) || [''])[0] });
    /* חתונות: כפתור הדגל בוחר "חתונה וחופה" ומסמן צרכים נפוצים בלי לבחור אותם */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#weddings a[data-event]');
    const wed = await p.evaluate(() => ({ v: document.getElementById('eventType').value, first: document.getElementById('eventType').children[1].label, sugg: [...document.querySelectorAll('.check.is-suggested input')].map(i => i.value), checked: [...document.querySelectorAll('input[name="needs"]:checked')].length, hint: !document.getElementById('needsHint').hidden }));
    const eoHidden = await p.evaluate(() => document.getElementById('eventOtherField').hidden);
    check('בחירה מכפתור החתונות מסתירה את שדה "אחר"', eoHidden);
    check('חתונות: הכפתור בוחר "חתונה וחופה", מקדם את הקבוצה ומציע צרכים בלי לסמן', wed.v === 'חתונה וחופה' && wed.first === 'חתונות וחופות' && wed.sugg.includes('רמקול לחופה') && wed.checked === 1 && wed.hint, wed);
    await p.evaluate(() => { document.querySelector('.form-options').open = true; });
    const sr = await p.evaluate(() => { const sugg = [...document.querySelectorAll('.check.is-suggested input')]; const plain = [...document.querySelectorAll('.check:not(.is-suggested) input[name="needs"]')]; const d = document.getElementById('needsSuggested'); return { visible: sugg.length > 0 && sugg.every(i => !!i.parentNode.offsetParent), unchecked: sugg.every(i => !i.checked || i.value === 'הקלטה'), city: !document.getElementById('city').closest('details') && !!document.getElementById('city').offsetParent, described: sugg.every(i => i.getAttribute('aria-describedby') === 'needsSuggested'), plain: plain.every(i => !i.hasAttribute('aria-describedby')), text: d.textContent }; });
    check('עיר גלויה מחוץ לפרטי הרשות; צרכים מוצעים מסומנים חזותית בלבד ומתוארים לקורא מסך', sr.visible && sr.unchecked && sr.city && sr.described && sr.plain && sr.text === 'נפוץ בחתונות וחופות', sr);
    /* תפריט מובייל: ESC סוגר ומחזיר את המיקוד לכפתור */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#menuToggle'); await p.keyboard.press('Escape');
    const esc = await p.evaluate(() => ({ open: document.getElementById('siteNav').classList.contains('is-open'), exp: document.getElementById('menuToggle').getAttribute('aria-expanded'), focus: document.activeElement.id }));
    check('תפריט המובייל: ESC סוגר, aria-expanded מתעדכן והמיקוד חוזר לכפתור', !esc.open && esc.exp === 'false' && esc.focus === 'menuToggle', esc);
    await c.close();
  }

  /* ---------- 6. תנועה ---------- */
  section('תנועה');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'no-preference' });
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.getElementById('areas').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(600);
    const its = await p.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity).length);
    check('אין אנימציה אינסופית (גם בלי הפחתת תנועה)', its === 0, its);
    await c.close();
    const c2 = await ctx({ viewport: { width: 390, height: 800 } });
    const p2 = await c2.newPage(); await p2.goto(BASE, { waitUntil: 'networkidle' });
    await p2.evaluate(() => document.getElementById('areas').scrollIntoView({ block: 'center', behavior: 'instant' })); await p2.waitForTimeout(500);
    check('בהפחתת תנועה אין אנימציה', (await p2.evaluate(() => document.getAnimations().length)) === 0);
    await c2.close();
  }

  /* ---------- 7. בלי JavaScript, ו-404 ---------- */
  section('בלי JavaScript ו-404');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false });
    const p = await c.newPage(); await p.goto(BASE);
    const r = await p.evaluate(() => ({ nav: !!document.querySelector('#siteNav a[href="#faq"]').offsetParent, bar: getComputedStyle(document.querySelector('.action-bar')).visibility, direct: [...document.querySelectorAll('.hero-actions .btn')].filter(a => a.offsetParent && a.getBoundingClientRect().height >= 44).length, maps: [...document.querySelectorAll('.navigation-link')].filter(a => a.offsetParent).map(a => a.dataset.app), pin: !!document.querySelector('.location-map iframe').offsetParent, addr: document.querySelector('.address-card strong').textContent, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    check('בלי JS: ניווט, שתי דרכי קשר ישירות, פס חיוג, המחסן עם מפה, Waze ו-Google Maps, כתובת, בלי גלילה אופקית', r.nav && r.direct === 2 && r.bar === 'visible' && r.maps.join() === 'waze,google-maps' && r.pin && r.addr === 'כהנמן 64, בני ברק' && r.ov === 0, r);
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
