/* קליין הפקות – סקריפט משותף ומצומצם: תפריט מובייל, טופס הצעת מחיר ← וואטסאפ */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var WA_NUMBER = '972527675138';

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* תפריט מובייל */
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('siteNav');
  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'סגירת התפריט' : 'פתיחת התפריט');
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
  }

  /* הסתרת פס הפעולות בזמן הקלדה בטופס (מובייל) */
  var form = document.getElementById('orderForm');
  if (form) {
    form.addEventListener('focusin', function (e) {
      if (e.target.matches('input:not([type="checkbox"]), select, textarea')) document.body.classList.add('is-typing');
    });
    form.addEventListener('focusout', function () { document.body.classList.remove('is-typing'); });
  }

  if (!form) return;

  var status = document.getElementById('formStatus');
  var messages = {
    name: 'נא לכתוב שם.',
    phone: 'נא לכתוב מספר טלפון תקין, למשל 050-1234567.',
    eventType: 'נא לבחור סוג אירוע.',
    date: 'נא לבחור תאריך.',
    datePast: 'התאריך שנבחר כבר עבר.'
  };

  function field(name) { return form.elements[name]; }
  function val(name) { var el = field(name); return el ? String(el.value || '').trim() : ''; }
  function setError(name, msg) {
    var el = field(name);
    var err = document.getElementById(name + 'Error');
    if (el) {
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    }
    if (err) err.textContent = msg || '';
  }
  ['name', 'phone', 'eventType', 'date'].forEach(function (n) {
    var el = field(n);
    if (!el) return;
    el.addEventListener('input', function () { setError(n, ''); });
    el.addEventListener('change', function () { setError(n, ''); });
  });

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var dateEl = field('date');
  if (dateEl) dateEl.min = todayISO();

  function formatDate(iso) {
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'מוצאי שבת'];
    return days[d.getDay()] + ', ' + p[2] + '/' + p[1] + '/' + p[0];
  }

  function validate() {
    var errors = {};
    if (!val('name')) errors.name = messages.name;
    var digits = val('phone').replace(/\D/g, '');
    if (!val('phone') || digits.length < 9 || digits.length > 12) errors.phone = messages.phone;
    if (!val('eventType')) errors.eventType = messages.eventType;
    if (!val('date')) errors.date = messages.date;
    else if (val('date') < todayISO()) errors.date = messages.datePast;
    return errors;
  }

  function buildMessage() {
    var needs = Array.prototype.map.call(form.querySelectorAll('input[name="needs"]:checked'), function (c) { return c.value; });
    var lines = ['שלום, אשמח להצעת מחיר להגברה.', ''];
    lines.push('שם: ' + val('name'));
    lines.push('טלפון: ' + val('phone'));
    lines.push('סוג האירוע: ' + val('eventType'));
    lines.push('תאריך: ' + formatDate(val('date')));
    if (val('time')) lines.push('שעת התחלה: ' + val('time'));
    if (val('city')) lines.push('עיר: ' + val('city'));
    if (val('venue')) lines.push('אולם / כתובת: ' + val('venue'));
    if (val('access')) lines.push('גישה למקום: ' + val('access'));
    if (needs.length) lines.push('צריך: ' + needs.join(', '));
    if (val('notes')) lines.push('הערות: ' + val('notes'));
    return lines.join('\n');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = validate();
    var order = ['name', 'phone', 'eventType', 'date'];
    var first = null;
    order.forEach(function (n) {
      setError(n, errors[n] || '');
      if (errors[n] && !first) first = field(n);
    });
    if (first) {
      status.textContent = 'יש לתקן את השדות המסומנים.';
      status.classList.add('is-error');
      first.focus();
      return;
    }
    status.classList.remove('is-error');
    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage());
    var win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (err) { /* ignore */ } } else { window.location.href = url; }
    status.textContent = 'נפתחה הודעה בוואטסאפ עם הפרטים. כדי לשלוח, לחצו "שליחה" בוואטסאפ.';
  });
})();
