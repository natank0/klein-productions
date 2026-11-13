/* מעדכן את ?v= בקישורים ל-site.css ול-site.js לפי תוכן הקבצים (8 תווי sha256).
 * כך דפדפן עם CSS ישן במטמון (GitHub Pages: max-age=600) מקבל קובץ שתואם ל-HTML החדש.
 * מריצים `npm run stamp` אחרי כל שינוי ב-CSS או ב-JS. הבדיקות נכשלות אם שוכחים. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
const assets = { 'assets/css/site.css': hash('assets/css/site.css'), 'assets/js/site.js': hash('assets/js/site.js') };
for (const page of ['index.html', '404.html']) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  for (const [asset, v] of Object.entries(assets)) {
    const re = new RegExp('(' + asset.replace(/[.]/g, '\\.') + ')(\\?v=[0-9a-f]+)?"', 'g');
    html = html.replace(re, `$1?v=${v}"`);
  }
  fs.writeFileSync(file, html);
}
console.log(assets);
