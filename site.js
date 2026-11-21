(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });

  // Scroll progress + hide nav on scroll down
  const bar = $('.progress span');
  const nav = $('#nav');
  let lastY = 0, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('hide', y > lastY && y > 400);
    lastY = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });

  // Active nav link
  const links = $$('.nav nav a');
  const sio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['features', 'looks', 'faq', 'support'].forEach((id) => { const s = document.getElementById(id); if (s) sio.observe(s); });

  // Hero phone tilt follows the pointer
  const tilt = $('[data-tilt]');
  const stage = $('.hero-stage');
  if (tilt && stage && !reduce && matchMedia('(pointer: fine)').matches) {
    $('.hero').addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${-14 + x * 22}deg) rotateX(${6 - y * 14}deg) rotateZ(2deg)`;
    });
    $('.hero').addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  // Count-up stats
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const end = +e.target.dataset.count;
      if (reduce) return;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 1200);
        e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  // Sticky phone story
  const shots = $$('.story-phone .shot');
  const dots = $$('.story-dots li');
  const chapters = $$('.chapter');
  const chio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = +e.target.dataset.step;
      chapters.forEach((c) => c.classList.toggle('is-on', c === e.target));
      shots.forEach((s) => s.classList.toggle('is-on', +s.dataset.shot === n));
      dots.forEach((d, i) => d.classList.toggle('is-on', i === n));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach((c) => chio.observe(c));

  // Verse demo (World English Bible, public domain)
  const verses = [
    ['For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.', 'John 3:16'],
    ['Rejoicing in hope; enduring in troubles; continuing steadfastly in prayer.', 'Romans 12:12'],
    ['Yahweh is my shepherd; I shall lack nothing.', 'Psalm 23:1'],
    ['I can do all things through Christ, who strengthens me.', 'Philippians 4:13'],
  ];
  const vout = $('.verse-out');
  $$('.verse-chips button').forEach((b) => b.addEventListener('click', () => {
    $$('.verse-chips button').forEach((x) => x.setAttribute('aria-selected', x === b));
    const [text, ref] = verses[+b.dataset.ref];
    const p = $('p', vout);
    p.style.opacity = 0;
    setTimeout(() => { p.textContent = text; $('cite', vout).textContent = `${ref} · World English Bible`; p.style.opacity = 1; }, reduce ? 0 : 200);
  }));

  // Student / parent demo
  const roleLists = {
    student: ['Keep your 5-day streak: read John 4 today', 'Next up: Friday night gathering in 2 days', 'Latest from your leaders'],
    parent: ['Next up: Friday night gathering in 2 days', 'Also coming up: every event this month', 'Latest from your leaders'],
  };
  const rout = $('.role-out');
  $$('.role-toggle button').forEach((b) => b.addEventListener('click', () => {
    $$('.role-toggle button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    rout.innerHTML = roleLists[b.dataset.role].map((t) => `<li>${t}</li>`).join('');
  }));

  // Looks: recolor the whole page
  const themeColors = { classic: '#000000', clean: '#f2f3f5', bold: '#2443ff', moody: '#050505', glass: '#f4d8c8' };
  const setLook = (look, save = true) => {
    root.dataset.look = look;
    $$('.look-picker button').forEach((b) => b.setAttribute('aria-checked', b.dataset.look === look));
    $$('.look-shot').forEach((i) => i.classList.toggle('is-on', i.dataset.for === look));
    $('meta[name="theme-color"]').content = themeColors[look];
    if (save) try { localStorage.setItem('h4m-look', look); } catch (e) {}
  };
  setLook(root.dataset.look in themeColors ? root.dataset.look : 'classic', false);
  $$('.look-picker button').forEach((b) => {
    b.addEventListener('click', () => setLook(b.dataset.look));
  });
  $('.look-picker').addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const btns = $$('.look-picker button');
    const i = btns.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const n = btns[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
    n.focus(); n.click();
  });

  // Icon picker
  const hs = $('#hsIcon');
  $$('.icon-row button').forEach((b) => b.addEventListener('click', () => {
    $$('.icon-row button').forEach((x) => x.setAttribute('aria-checked', x === b));
    hs.classList.add('swap');
    setTimeout(() => { hs.src = `assets/icons/${b.dataset.icon}.webp`; hs.classList.remove('swap'); }, reduce ? 0 : 160);
  }));

  // Copy email
  const toast = $('.toast');
  const say = (msg) => { toast.textContent = msg; toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 2200); };
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say('Email copied'); } catch (e) { say(b.dataset.copy); }
  }));
})();
