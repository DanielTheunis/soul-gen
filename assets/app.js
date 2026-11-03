/* ==========================================================================
   SOULGEN — interactions
   ========================================================================== */
(function () {
  'use strict';


  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- sticky nav + scroll progress ---------- */
  var nav = document.getElementById('nav');
  var bar = document.querySelector('.scroll-bar span');

  function onScroll() {
    var top = window.scrollY;
    nav.classList.toggle('is-stuck', top > window.innerHeight * 0.85);
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? top / h : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile drawer ---------- */
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        drawer.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- counters ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        countUp(e.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
  }

  function countUp(el) {
    var target = parseFloat(el.dataset.count) || 0;
    var suffix = el.dataset.suffix || '';
    if (reduced || target === 0) { el.textContent = target + suffix; return; }
    var dur = 1400, start = performance.now();
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- marquee: duplicate content for a seamless loop ---------- */
  document.querySelectorAll('[data-marquee] span').forEach(function (span) {
    span.innerHTML = span.innerHTML + span.innerHTML;
  });

  /* ---------- glass sheen follows the pointer ---------- */
  document.querySelectorAll('.glass').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
    });
  });

  /* ---------- heartbeat glow: lub-dub, random size each beat ---------- */
  var glows = document.querySelectorAll('.hero__glow');
  if (glows.length && !reduced && glows[0].animate) {
    var heroVisible = true, beating = false;

    function beat() {
      if (!heroVisible || document.hidden) { beating = false; return; } // pause off-screen
      beating = true;
      var big = 1.08 + Math.random() * 0.42;                       // 1.08–1.50: soft to huge
      var second = 1 + (big - 1) * (0.55 + Math.random() * 0.3);   // the "dub" is a bit smaller
      var peak = Math.min(1, 0.8 + (big - 1) * 0.6);
      var frames = [
        { transform: 'scale(1)',              opacity: 0.6,         offset: 0 },
        { transform: 'scale(' + big + ')',    opacity: peak,        offset: 0.14 }, // lub
        { transform: 'scale(1.02)',           opacity: 0.7,         offset: 0.30 },
        { transform: 'scale(' + second + ')', opacity: peak * 0.9,  offset: 0.44 }, // dub
        { transform: 'scale(1)',              opacity: 0.6,         offset: 1 }
      ];
      var anims = Array.prototype.map.call(glows, function (g) {      // both halves beat together
        return g.animate(frames, { duration: 1100, easing: 'cubic-bezier(.23,1,.32,1)' });
      });
      anims[0].onfinish = function () { setTimeout(beat, 250 + Math.random() * 900); }; // random rest
    }
    function resume() { if (!beating) beat(); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; resume(); })
        .observe(document.getElementById('hero'));
    }
    document.addEventListener('visibilitychange', resume);
    resume();
  }

  /* ---------- tiny spring engine (Apple-style: damping ratio + response) ----------
     Springs retarget from the live value and carry velocity, so every
     hover-in / hover-out is interruptible with no visible jump. */
  function Spring(values, damping, response, onUpdate) {
    var k = Math.pow(2 * Math.PI / response, 2), c = 4 * Math.PI * damping / response;
    var cur = {}, vel = {}, tgt = {}, raf = null, last = 0, keys = Object.keys(values);
    keys.forEach(function (key) { cur[key] = tgt[key] = values[key]; vel[key] = 0; });
    function step(now) {
      var dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60; last = now;
      var busy = false;
      keys.forEach(function (key) {
        vel[key] += (k * (tgt[key] - cur[key]) - c * vel[key]) * dt;
        cur[key] += vel[key] * dt;
        if (Math.abs(tgt[key] - cur[key]) > 0.001 || Math.abs(vel[key]) > 0.01) busy = true;
        else { cur[key] = tgt[key]; vel[key] = 0; }
      });
      onUpdate(cur);
      raf = busy ? requestAnimationFrame(step) : (last = 0, null);
    }
    return { set: function (t) {
      for (var key in t) tgt[key] = t[key];
      if (!raf) raf = requestAnimationFrame(step);
    } };
  }

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- magnetic buttons ---------- */
  if (!reduced && finePointer) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      // the spring owns transform; CSS keeps colour transitions only
      el.style.transition = 'background-color .2s ease, color .2s ease, border-color .2s ease, box-shadow .3s ease';
      // pull toward the pointer critically damped; release with a touch of bounce (momentum)
      var s = Spring({ x: 0, y: 0 }, 1, 0.35, function (v) {
        el.style.transform = 'translate3d(' + v.x.toFixed(2) + 'px,' + v.y.toFixed(2) + 'px,0)';
      });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        s.set({ x: (e.clientX - (r.left + r.width / 2)) * 0.2, y: (e.clientY - (r.top + r.height / 2)) * 0.3 });
      });
      el.addEventListener('pointerleave', function () { s.set({ x: 0, y: 0 }); });
    });

    /* ---------- 3D tilt on service cards ---------- */
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var s = Spring({ rx: 0, ry: 0, lift: 0 }, 1, 0.5, function (v) {
        el.style.transform = 'perspective(1000px) translate3d(0,' + (-v.lift).toFixed(2) + 'px,0) rotateX(' + v.rx.toFixed(3) + 'deg) rotateY(' + v.ry.toFixed(3) + 'deg)';
      });
      el.addEventListener('pointerenter', function () { el.style.transition = 'border-color .3s ease, box-shadow .4s ease'; });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        s.set({ rx: -py * 6, ry: px * 7, lift: 8 });
      });
      el.addEventListener('pointerleave', function () { s.set({ rx: 0, ry: 0, lift: 0 }); });
    });
  }

  /* ---------- neon scroll on headlines ---------- */
  var neon = Array.prototype.slice.call(document.querySelectorAll('.display, .quote p'));
  neon.forEach(function (el) {
    el.classList.add('neon');
    // wrap loose text so the outlined <em> words keep their own (hollow) fill
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        var sp = document.createElement('span'); sp.className = 'nt'; sp.textContent = n.textContent;
        el.replaceChild(sp, n);
      }
    });
    // once the reveal transition has finished, let the glow track scroll directly
    var mo = new MutationObserver(function () {
      if (el.classList.contains('is-in')) { mo.disconnect(); setTimeout(function () { el.classList.add('neon-live'); }, 850); }
    });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  if (!reduced && neon.length) {
    var neonTick = null;
    function updateNeon() {
      neonTick = null;
      var vh = window.innerHeight;
      neon.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;          // off-screen: skip
        var mid = r.top + r.height / 2;
        var c = 1 - Math.min(1, Math.abs(mid - vh / 2) / (vh / 2)); // 1 at centre
        el.style.setProperty('--nc', (c * c * (3 - 2 * c)).toFixed(4)); // smoothstep
      });
    }
    window.addEventListener('scroll', function () { if (!neonTick) neonTick = requestAnimationFrame(updateNeon); }, { passive: true });
    window.addEventListener('resize', updateNeon);
    updateNeon();
  }

  /* ---------- contact form -> WhatsApp ---------- */
  var form = document.getElementById('form');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();

      if (!name || !phone) {
        note.textContent = 'Please add your name and phone number so we can come back to you.';
        note.classList.add('is-error');
        return;
      }

      var lines = [
        'New enquiry via soul-gen.com',
        '',
        'Name: ' + name,
        'Phone: ' + phone,
        'Business: ' + (form.company.value.trim() || '—'),
        'Needs: ' + form.need.value,
        '',
        (form.msg.value.trim() || 'No extra details.')
      ];

      note.classList.remove('is-error');
      note.textContent = 'Opening WhatsApp…';
      window.open('https://wa.me/27761864696?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  }
})();
