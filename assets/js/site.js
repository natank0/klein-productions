/* קליין הפקות – סקריפט משותף */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  var WA_NUMBER = document.body.getAttribute('data-wa') || '972527675138';

  // שנה בכותרת התחתונה
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ניווט: רקע בגלילה
  var navbar = document.getElementById('navbar');
  function onScroll() { if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();


  // פס התקדמות גלילה
  var prog = document.querySelector('.scroll-progress');
  function onProgress() {
    if (!prog) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.setProperty('--progress', h > 0 ? Math.min(1, window.scrollY / h) : 0);
  }
  window.addEventListener('scroll', onProgress, { passive: true });
  onProgress();

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // זרקור עוקב עכבר בכרטיסים
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.card, .pillar, .rig-item, .event-group, .step').forEach(function (el) {
      el.classList.add('spot');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // מונה מספרים עולה
  var counters = document.querySelectorAll('[data-count]');
  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (reduceMotion || !target) { el.textContent = target; return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCounter(en.target); co.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { co.observe(c); });
  }

  // תפריט מובייל
  var toggle = document.getElementById('menuToggle');
  var links = document.getElementById('navLinks');
  function closeMenu() {
    if (!links) return;
    links.classList.remove('open');
    document.body.classList.remove('menu-open');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'פתיחת תפריט'); }
  }
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
    });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  // חשיפה בגלילה
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  // טופס הזמנה ← הודעת וואטסאפ מוכנה
  var form = document.getElementById('orderForm');
  if (!form) return;

  var status = document.getElementById('formStatus');
  var required = {
    name: 'נא למלא שם.',
    phone: 'נא למלא מספר טלפון תקין.',
    eventType: 'נא לבחור סוג אירוע.',
    date: 'נא לבחור תאריך.'
  };

  function setError(field, msg) {
    var input = form.elements[field];
    var err = document.getElementById(field + 'Error');
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  }

  function formatDate(value) {
    if (!value) return '';
    var p = value.split('-');
    if (p.length !== 3) return value;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצאי שבת'];
    return (d.getDay() === 6 ? '' : 'יום ') + days[d.getDay()] + ', ' + p[2] + '/' + p[1] + '/' + p[0];
  }

  Object.keys(required).forEach(function (f) {
    var el = form.elements[f];
    if (el) el.addEventListener('input', function () { setError(f, ''); });
    if (el) el.addEventListener('change', function () { setError(f, ''); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };
    var firstBad = null;

    Object.keys(required).forEach(function (f) {
      var bad = !v(f);
      if (f === 'phone' && v(f) && !/^[0-9+\-\s()]{9,15}$/.test(v(f))) bad = true;
      setError(f, bad ? required[f] : '');
      if (bad && !firstBad) firstBad = form.elements[f];
    });
    if (firstBad) { firstBad.focus(); if (status) status.textContent = 'יש להשלים את השדות המסומנים.'; return; }

    var needs = Array.prototype.slice.call(form.querySelectorAll('input[name="needs"]:checked')).map(function (c) { return c.value; });

    var lines = ['שלום, אשמח להצעה להגברה 🙏', ''];
    lines.push('*שם:* ' + v('name'));
    lines.push('*טלפון:* ' + v('phone'));
    lines.push('*סוג אירוע:* ' + v('eventType'));
    lines.push('*תאריך:* ' + formatDate(v('date')));
    if (v('time')) lines.push('*שעת התחלה:* ' + v('time'));
    if (v('city')) lines.push('*עיר:* ' + v('city'));
    if (v('venue')) lines.push('*אולם / כתובת:* ' + v('venue'));
    if (v('access')) lines.push('*גישה:* ' + v('access'));
    if (needs.length) lines.push('*צריך:* ' + needs.join(', '));
    if (v('notes')) { lines.push(''); lines.push('*הערות:* ' + v('notes')); }
    lines.push(''); lines.push('(נשלח מהאתר)');

    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
    var win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (err) { /* ignore */ } } else { window.location.href = url; }
    if (status) status.textContent = 'נפתח וואטסאפ עם כל הפרטים – רק ללחוץ "שלח". לא נפתח? חייגו 052-7675138.';
  });
})();
