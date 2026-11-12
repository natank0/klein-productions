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
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link || !nav.classList.contains('is-open')) return;
      setMenu(false);
      var target = link.hash && document.getElementById(link.hash.slice(1));
      if (target && link.pathname === window.location.pathname) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
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
  var eventType = form.elements.eventType;
  var eventContext = document.getElementById('eventContext');
  var eventGroups = Array.from(eventType.querySelectorAll('optgroup'));
  var dateUnknown = form.elements.dateUnknown;
  document.querySelectorAll('.entry-cta[data-event-group]').forEach(function (link) {
    link.addEventListener('click', function () {
      var selected = eventType.value;
      var group = eventGroups.find(function (item) {
        return item.dataset.eventGroup === link.dataset.eventGroup;
      });
      if (!group) return;
      eventType.insertBefore(group, eventType.children[1]);
      eventType.value = selected;
      eventContext.textContent = 'קטגוריה: ' + group.label + '. אפשר לבחור מכל סוגי האירועים.';
      eventContext.hidden = false;
    });
  });
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
  dateEl.min = todayISO();
  function syncDate() {
    dateEl.disabled = dateUnknown.checked;
    dateEl.required = !dateUnknown.checked;
    setError('date', '');
  }
  dateUnknown.addEventListener('change', syncDate);
  syncDate();

  function formatDate(iso) {
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
    return days[d.getDay()] + ', ' + p[2] + '/' + p[1] + '/' + p[0];
  }

  function validate() {
    var errors = {};
    if (!val('name')) errors.name = messages.name;
    var phone = val('phone');
    var normalized = phone.replace(/[\s()-]/g, '');
    if (!/^(?:0[1-9]\d{7,8}|\+972[1-9]\d{7,8})$/.test(normalized)) errors.phone = messages.phone;
    if (!val('eventType')) errors.eventType = messages.eventType;
    if (!dateUnknown.checked) {
      if (!val('date')) errors.date = messages.date;
      else if (val('date') < todayISO()) errors.date = messages.datePast;
    }
    return errors;
  }

  function buildMessage() {
    var needs = Array.prototype.map.call(form.querySelectorAll('input[name="needs"]:checked'), function (c) { return c.value; });
    var lines = ['שלום, אשמח להצעת מחיר להגברה.', ''];
    lines.push('שם: ' + val('name'));
    lines.push('טלפון: ' + val('phone'));
    lines.push('סוג האירוע: ' + val('eventType'));
    lines.push('תאריך: ' + (dateUnknown.checked ? 'טרם נקבע' : formatDate(val('date'))));
    if (val('time')) lines.push('שעת התחלה: ' + val('time'));
    if (val('city')) lines.push('עיר: ' + val('city'));
    if (val('venue')) lines.push('אולם / כתובת: ' + val('venue'));
    if (val('access')) lines.push('גישה למקום: ' + val('access'));
    if (needs.length) lines.push('צריך: ' + needs.join(', '));
    if (val('notes')) lines.push('הערות: ' + val('notes').slice(0, 400));
    return lines.join('\n');
  }

  function checkForm() {
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
      return false;
    }
    status.classList.remove('is-error');
    return true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!checkForm()) return;
    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage());
    var win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (err) { /* ignore */ } } else { window.location.href = url; }
    status.textContent = 'אם וואטסאפ נפתח, לחצו שם על שליחה. אפשר גם להעתיק את פרטי הפנייה.';
  });
  var preview = document.getElementById('inquiryPreview');
  document.getElementById('copyInquiry').addEventListener('click', async function () {
    if (!checkForm()) return;
    var message = buildMessage();
    try {
      await navigator.clipboard.writeText(message);
      preview.hidden = true;
      status.textContent = 'פרטי הפנייה הועתקו.';
    } catch (error) {
      preview.value = message;
      preview.hidden = false;
      preview.focus();
      preview.select();
      status.textContent = 'אפשר להעתיק את הטקסט המסומן.';
    }
  });
})();
