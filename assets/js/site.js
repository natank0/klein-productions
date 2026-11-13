/* קליין הפקות – סקריפט משותף ומצומצם: תפריט מובייל, טופס הצעת מחיר ← וואטסאפ */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var WA_NUMBER = '972527675138';

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* רדאר אולמות: פעימה אחת מהמחסן כשהרדאר נכנס למסך; מצב סופי יציב */
  var radar = document.querySelector('.radar');
  var motionOK = window.matchMedia && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  if (radar && motionOK && 'IntersectionObserver' in window) {
    var radarObserver = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      radar.classList.add('is-playing');
      radarObserver.disconnect();
    }, { threshold: 0.35 });
    radarObserver.observe(radar);
  }

  /* מקרא ↔ נקודה ברדאר, ומדיה לכל אולם (נתונים ב-#hallMedia) */
  if (radar) {
    var nodes = Array.prototype.slice.call(radar.querySelectorAll('.radar-node'));
    var nodeFor = function (id) { return nodes.filter(function (n) { return (' ' + n.getAttribute('data-hall') + ' ').indexOf(' ' + id + ' ') !== -1; })[0]; };
    var media = {};
    try { media = JSON.parse((document.getElementById('hallMedia') || {}).textContent || '{}'); } catch (err) { media = {}; }
    var dialog = document.getElementById('hallDialog');
    var dialogTitle = document.getElementById('hallDialogTitle');
    var dialogList = document.getElementById('hallMediaList');
    var lastTrigger = null;

    function hot(id, on) { var n = nodeFor(id); if (n) n.classList.toggle('is-hot', on); }
    /* מדיה רק מקבצי האתר עצמו: כתובת חיצונית, data: או javascript: נדחות */
    function local(u) {
      if (typeof u !== 'string' || !u.trim()) return '';
      try { var url = new URL(u, document.baseURI); return url.origin === window.location.origin ? url.href : ''; } catch (err) { return ''; }
    }
    function localSrcset(set) {
      if (typeof set !== 'string') return '';
      var parts = set.split(',').map(function (c) { var bits = c.trim().split(/\s+/); var u = local(bits[0]); return u ? [u].concat(bits.slice(1)).join(' ') : ''; });
      return parts.every(Boolean) ? parts.join(', ') : '';
    }
    function usable(m) { return m && (m.type === 'image' || m.type === 'video') && local(m.src); }
    function openHall(id, name, trigger) {
      var items = (media[id] || []).filter(usable);
      if (!items.length || !dialog || typeof dialog.showModal !== 'function') return;
      dialogTitle.textContent = name;
      dialogList.textContent = '';
      items.forEach(function (m) {
        var fig = document.createElement('figure');
        if (m.type === 'video') {
          var v = document.createElement('video');
          v.controls = true; v.preload = 'none'; v.playsInline = true;
          if (local(m.poster)) v.poster = local(m.poster);
          if (m.width) v.width = m.width;
          if (m.height) v.height = m.height;
          var src = document.createElement('source'); src.src = local(m.src); if (m.mime) src.type = m.mime;
          v.appendChild(src);
          if (local(m.captions)) { var t = document.createElement('track'); t.kind = 'captions'; t.srclang = 'he'; t.label = 'עברית'; t.src = local(m.captions); t.default = true; v.appendChild(t); }
          fig.appendChild(v);
        } else {
          var img = document.createElement('img');
          img.src = local(m.src); img.alt = m.alt || ''; img.loading = 'lazy'; img.decoding = 'async';
          if (localSrcset(m.srcset)) img.srcset = localSrcset(m.srcset);
          if (m.sizes) img.sizes = m.sizes;
          if (m.width) img.width = m.width;
          if (m.height) img.height = m.height;
          fig.appendChild(img);
        }
        if (m.caption) { var cap = document.createElement('figcaption'); cap.textContent = m.caption; fig.appendChild(cap); }
        dialogList.appendChild(fig);
      });
      lastTrigger = trigger || null;
      dialog.showModal();
    }
    if (dialog) {
      dialog.querySelector('.hall-dialog-close').addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener('close', function () {
        dialogList.querySelectorAll('video').forEach(function (v) { v.pause(); });
        if (lastTrigger) lastTrigger.focus();
      });
    }

    document.querySelectorAll('.radar-legend li[data-hall]').forEach(function (li) {
      var id = li.getAttribute('data-hall');
      var nameEl = li.querySelector('.legend-name');
      var name = nameEl.textContent;
      var target = nameEl;
      if ((media[id] || []).some(usable)) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '<span></span><span class="media-mark" aria-hidden="true">▶</span>';
        btn.firstChild.textContent = name;
        btn.setAttribute('aria-label', name + ' – צפייה בתמונות ובסרטונים מהאולם');
        btn.addEventListener('click', function () { openHall(id, name, btn); });
        li.replaceChild(btn, nameEl);
        target = btn;
        radar.querySelectorAll('.radar-label [data-hall="' + id + '"]').forEach(function (el) {
          el.classList.add('has-media');
          el.addEventListener('click', function () { openHall(id, name, btn); });
        });
      }
      ['mouseenter', 'focus'].forEach(function (ev) { target.addEventListener(ev, function () { hot(id, true); }); });
      ['mouseleave', 'blur'].forEach(function (ev) { target.addEventListener(ev, function () { hot(id, false); }); });
    });
  }

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
    });
  });
  document.querySelectorAll('.tag[data-event]').forEach(function (link) {
    link.addEventListener('click', function () {
      var value = link.getAttribute('data-event');
      var group = groupOf(value);
      promote(group);
      eventType.value = value;
      setError('eventType', '');
      showContext('נבחר: ' + value + (group ? ' (' + group.label + ')' : '') + '. אפשר לשנות בכל רגע.');
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
  var dateReq = document.getElementById('dateReq');
  var dateHint = document.getElementById('dateHint');
  var formHint = document.getElementById('formHint');
  function syncDate() {
    var unknown = dateUnknown.checked;
    dateEl.disabled = unknown;
    dateEl.required = !unknown;
    if (dateReq) dateReq.hidden = unknown;
    if (dateHint) dateHint.hidden = !unknown;
    if (formHint) formHint.textContent = unknown ? 'שדות חובה: שם, טלפון וסוג אירוע.' : 'שדות חובה: שם, טלפון, סוג אירוע ותאריך.';
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
    status.textContent = 'ההודעה מוכנה בוואטסאפ: בדקו אותה ולחצו שם על שליחה. אם וואטסאפ לא נפתח, אפשר להעתיק את פרטי הפנייה.';
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
