/* קליין הפקות – סקריפט משותף ומצומצם: תפריט מובייל, טופס הצעת מחיר ← וואטסאפ */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var WA_NUMBER = '972527675138';
  /* כתובת המייל של העסק. כשמוגדרת, מתחת לטופס מופיע גם "שליחה במייל" (לגולשים ממחשב מסונן בלי וואטסאפ) */
  var EMAIL = '';

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* הדפסה: פותחים את השאלות הנפוצות ואת רשימת הציוד, ומחזירים למצב הקודם בסיום */
  var printOpened = [];
  window.addEventListener('beforeprint', function () {
    printOpened = Array.prototype.filter.call(document.querySelectorAll('.faq details'), function (d) { return !d.open; });
    printOpened.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    printOpened.forEach(function (d) { d.open = false; });
    printOpened = [];
  });

  /* תפריט מובייל */
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('siteNav');
  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
    var heroActions = document.querySelector('.hero-actions');
    var obscureHero = open && window.matchMedia('(max-width: 860px)').matches;
    if (heroActions) {
      heroActions.classList.toggle('is-nav-obscured', obscureHero);
      heroActions.inert = obscureHero;
    }
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
    /* לחיצה מחוץ לתפריט הפתוח סוגרת אותו */
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });
  }

  /* פס החיוג במובייל: מוסתר כשכפתורי הפתיחה על המסך, וכשהמקלדת פתוחה */
  var form = document.getElementById('orderForm');
  var heroActions = document.querySelector('.hero-actions');
  if (heroActions && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('bar-off', entries[0].isIntersecting);
    }).observe(heroActions);
  }
  var vv = window.visualViewport;
  function syncKeyboard() {
    var el = document.activeElement;
    var typing = !!el && el.matches && el.matches('input:not([type="checkbox"]), select, textarea');
    var shrunk = vv ? vv.height < window.innerHeight * 0.8 : typing;
    document.body.classList.toggle('kb-open', typing && shrunk);
  }
  if (vv) vv.addEventListener('resize', syncKeyboard);
  document.addEventListener('focusin', syncKeyboard);
  document.addEventListener('focusout', function () { setTimeout(syncKeyboard, 50); });

  if (!form) return;

  var status = document.getElementById('formStatus');
  var eventType = form.elements.eventType;
  var eventContext = document.getElementById('eventContext');
  var eventGroups = Array.from(eventType.querySelectorAll('optgroup'));
  var dateUnknown = form.elements.dateUnknown;
  function groupOf(value) {
    var opt = Array.prototype.filter.call(eventType.options, function (o) { return o.value === value; })[0];
    return opt && opt.parentNode && opt.parentNode.tagName === 'OPTGROUP' ? opt.parentNode : null;
  }
  function showContext(text) { eventContext.textContent = text; eventContext.hidden = false; }
  function promote(group) { if (group) eventType.insertBefore(group, eventType.children[1]); }
  document.querySelectorAll('.entry-cta[data-event-group]').forEach(function (link) {
    link.addEventListener('click', function () {
      var selected = eventType.value;
      var group = eventGroups.find(function (item) { return item.dataset.eventGroup === link.dataset.eventGroup; });
      if (!group) return;
      promote(group);
      eventType.value = selected;
      var prev = selected ? groupOf(selected) : null;
      if (selected && prev && prev !== group) showContext('הבחירה הקודמת נשמרה: ' + selected + ' (' + prev.label + '). אפשר לבחור מ' + group.label + ' או מכל סוגי האירועים.');
      else if (selected) showContext('נבחר: ' + selected + ' (' + group.label + ').');
      else showContext('קטגוריה: ' + group.label + '. אפשר לבחור מכל סוגי האירועים.');
      requestAnimationFrame(function () { eventType.focus({ preventScroll: true }); });
    });
  });
  document.querySelectorAll('a[data-event]').forEach(function (link) {
    link.addEventListener('click', function () {
      var value = link.getAttribute('data-event');
      var group = groupOf(value);
      promote(group);
      eventType.value = value;
      setError('eventType', '');
      suggestNeeds();
      syncEventOther();
      showContext('נבחר: ' + value + (group ? ' (' + group.label + ')' : '') + '. אפשר לשנות בכל רגע.');
      requestAnimationFrame(function () { eventType.focus({ preventScroll: true }); });
    });
  });

  /* צרכים נפוצים לפי סוג האירוע: רק סימון עדין, בלי לבחור או לבטל בשביל הפונה */
  var SUGGEST = {
    weddings: ['פיזור לעזרת נשים', 'רמקול לחופה', 'קלידן או נגן', 'מוניטור לזמר'],
    family: ['קלידן או נגן', 'מיקרופון אלחוטי', 'פיזור לעזרת נשים'],
    shul: ['מיקרופון לדרשה', 'מיקרופונים למקהלה', 'קלידן או נגן'],
    institutions: ['מיקרופונים למקהלה', 'מיקרופון אלחוטי', 'הקלטה', 'מקרן ומסך'],
    holidays: ['קלידן או נגן', 'מיקרופון אלחוטי', 'תאורה']
  };
  var needsHint = document.getElementById('needsHint');
  var needsSuggested = document.getElementById('needsSuggested');
  function suggestNeeds() {
    var group = groupOf(eventType.value);
    var key = group ? group.getAttribute('data-event-group') : '';
    var list = SUGGEST[key] || [];
    /* הסימון החזותי מקבל גם תיאור לקורא מסך, על כל תיבה מוצעת בנפרד */
    if (needsSuggested) needsSuggested.textContent = list.length ? 'נפוץ ב' + group.label : '';
    form.querySelectorAll('input[name="needs"]').forEach(function (c) {
      var on = list.indexOf(c.value) !== -1;
      c.parentNode.classList.toggle('is-suggested', on);
      if (on) c.setAttribute('aria-describedby', 'needsSuggested'); else c.removeAttribute('aria-describedby');
    });
    if (needsHint) {
      needsHint.hidden = !list.length;
      needsHint.textContent = list.length ? 'מסומנים בנקודה: צרכים נפוצים ב' + group.label + '. אפשר לבחור כל צורך אחר.' : '';
    }
  }
  eventType.addEventListener('change', suggestNeeds);

  /* סוג אירוע "אחר" פותח שדה לתיאור האירוע, כדי שההודעה לא תגיע עם "אחר" בלבד */
  var eventOtherField = document.getElementById('eventOtherField');
  function syncEventOther() {
    var other = eventType.value === 'אחר';
    eventOtherField.hidden = !other;
    form.elements.eventOther.required = other;
    if (!other) setError('eventOther', '');
  }
  eventType.addEventListener('change', syncEventOther);

  /* עיר "אחר" פותחת שדה לשם העיר */
  var city = form.elements.city;
  var cityOtherField = document.getElementById('cityOtherField');
  function syncCity() {
    var other = city.value === 'אחר';
    cityOtherField.hidden = !other;
    form.elements.cityOther.required = other;
    if (!other) setError('cityOther', '');
  }
  city.addEventListener('change', syncCity);
  var messages = {
    name: 'נא לכתוב שם.',
    phone: 'נא לכתוב מספר טלפון תקין, למשל 050-1234567.',
    eventType: 'נא לבחור סוג אירוע.',
    date: 'בחרו תאריך, או סמנו שהתאריך טרם נקבע.',
    datePast: 'התאריך שנבחר כבר עבר.',
    cityOther: 'נא לכתוב את שם העיר.',
    eventOther: 'נא לכתוב איזה אירוע.'
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
  ['name', 'phone', 'eventType', 'eventOther', 'date', 'cityOther'].forEach(function (n) {
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
  var dateReq = document.getElementById('dateReq');
  var dateHint = document.getElementById('dateHint');
  var formHint = document.getElementById('formHint');
  /* מתחת לשדה: התאריך כפי שיופיע בהודעה (יום בשבוע ו-DD/MM/YYYY), גם כשהדפדפן מציג mm/dd/yyyy */
  function syncDateHint() {
    if (!dateHint) return;
    var v = val('date');
    var text = dateUnknown.checked ? 'טרם נקבע' : (v && v >= todayISO() ? formatDate(v) : '');
    dateHint.textContent = text ? 'בהודעה יופיע: ' + text : '';
    dateHint.hidden = !text;
  }
  function syncDate() {
    var unknown = dateUnknown.checked;
    dateEl.disabled = unknown;
    dateEl.required = !unknown;
    if (dateReq) dateReq.hidden = unknown;
    syncDateHint();
    if (formHint) formHint.textContent = unknown ? 'שדות חובה: שם, טלפון וסוג אירוע.' : 'שדות חובה: שם, טלפון, סוג אירוע ותאריך.';
    setError('date', '');
  }
  dateUnknown.addEventListener('change', syncDate);
  dateEl.addEventListener('input', syncDateHint);
  dateEl.addEventListener('change', syncDateHint);
  syncDate();
  syncCity();
  syncEventOther();
  suggestNeeds();

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
    else if (val('eventType') === 'אחר' && !val('eventOther')) errors.eventOther = messages.eventOther;
    if (!dateUnknown.checked) {
      if (!val('date')) errors.date = messages.date;
      else if (val('date') < todayISO()) errors.date = messages.datePast;
    }
    if (val('city') === 'אחר' && !val('cityOther')) errors.cityOther = messages.cityOther;
    return errors;
  }

  function buildMessage() {
    var checked = function (name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (c) { return c.value; }); };
    var needs = checked('needs');
    var access = checked('access');
    var lines = ['שלום, אשמח להצעת מחיר להגברה.', ''];
    lines.push('שם: ' + val('name'));
    lines.push('טלפון: ' + val('phone'));
    lines.push('סוג האירוע: ' + (val('eventType') === 'אחר' ? val('eventOther') : val('eventType')));
    lines.push('תאריך: ' + (dateUnknown.checked ? 'טרם נקבע' : formatDate(val('date'))));
    if (val('time')) lines.push('שעת התחלה: ' + val('time'));
    if (val('city')) lines.push('עיר: ' + (val('city') === 'אחר' ? val('cityOther') : val('city')));
    if (val('venue')) lines.push('אולם / כתובת: ' + val('venue'));
    if (access.length) lines.push('גישה למקום: ' + access.join(', '));
    if (needs.length) lines.push('צריך: ' + needs.join(', '));
    if (val('notes')) lines.push('הערות: ' + val('notes').slice(0, 400));
    // Use the platform-neutral message convention expected by WhatsApp and
    // Windows clipboard APIs, which normalize line breaks to CRLF.
    return lines.join('\r\n');
  }

  function checkForm() {
    var errors = validate();
    var order = ['name', 'phone', 'eventType', 'eventOther', 'date', 'cityOther'];
    var labels = { name: 'שם', phone: 'טלפון', eventType: 'סוג האירוע', eventOther: 'תיאור האירוע', date: 'תאריך', cityOther: 'שם העיר' };
    var first = null, missing = [];
    order.forEach(function (n) {
      setError(n, errors[n] || '');
      if (errors[n]) { missing.push(labels[n]); if (!first) first = field(n); }
    });
    if (first) {
      /* מה קרה ואיך מתקנים (פודמג'רסקי): וואטסאפ לא נפתח, אלה השדות, והסמן כבר בראשון שבהם */
      status.textContent = 'כדי לפתוח הודעה בוואטסאפ, יש להשלים או לתקן: ' + missing.join(', ') + '.';
      status.classList.add('is-error');
      var fold = first.closest('details');
      if (fold) fold.open = true;
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
    status.textContent = 'ההודעה מוכנה בוואטסאפ. בדקו ולחצו שם על שליחה. אם וואטסאפ לא נפתח, אפשר להעתיק את פרטי הפנייה.';
  });
  var preview = document.getElementById('inquiryPreview');
  /* שליחה במייל: נפתחת טיוטה עם הפרטים בתוכנת המייל, והכתובת מוצגת למי שמעדיף להעתיק */
  if (EMAIL) {
    var altActions = document.querySelector('.form-alt-actions');
    var mail = document.createElement('a');
    mail.className = 'btn btn-line btn-sm';
    mail.id = 'mailInquiry';
    mail.href = 'mailto:' + EMAIL;
    mail.textContent = 'שליחה במייל';
    altActions.appendChild(mail);
    var addr = document.createElement('p');
    addr.className = 'form-alt-mail';
    addr.innerHTML = 'או לכתובת <span class="ltr"></span>';
    addr.querySelector('span').textContent = EMAIL;
    altActions.parentNode.insertBefore(addr, altActions.nextSibling);
    mail.addEventListener('click', function (e) {
      if (!checkForm()) { e.preventDefault(); return; }
      mail.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('בקשת הצעת מחיר להגברה') + '&body=' + encodeURIComponent(buildMessage());
      status.textContent = 'נפתחה טיוטת מייל עם פרטי הפנייה. אם לא נפתחה, אפשר להעתיק את הפרטים ולשלוח לכתובת שמופיעה כאן.';
    });
  }
  document.getElementById('copyInquiry').addEventListener('click', async function () {
    if (!checkForm()) return;
    var message = buildMessage();
    try {
      await navigator.clipboard.writeText(message);
      preview.hidden = true;
      status.textContent = 'פרטי הפנייה הועתקו. אפשר להדביק אותם במייל או בהודעה.';
    } catch (error) {
      preview.value = message;
      preview.hidden = false;
      preview.focus();
      preview.select();
      status.textContent = 'אפשר להעתיק את הטקסט המסומן.';
    }
  });
})();
