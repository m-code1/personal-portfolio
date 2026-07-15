// Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  // Reveal (and un-reveal) each "frame" as it crosses the viewport, so the
  // blob->rectangle morph plays both scrolling down AND scrolling back up
  const frames = document.querySelectorAll('.frame');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.classList.toggle('in-view', entry.isIntersecting);
      });
    }, { threshold: 0.12 });
    frames.forEach(f => io.observe(f));
  } else {
    frames.forEach(f => f.classList.add('in-view'));
  }

  // Gallery: show a friendly placeholder instead of a broken image
  // icon until a real photo is dropped into img/gallery/
  document.querySelectorAll('.gallery-item img').forEach(img => {
    img.addEventListener('error', () => {
      img.closest('.gallery-item').classList.add('img-missing');
    }, { once: true });
  });

  // ---------- Scroll-linked morph: hero blobs + scroll cursor rail ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blobA = document.querySelector('.blob-a');
  const blobB = document.querySelector('.blob-b');
  const scrollThumb = document.getElementById('scrollThumb');
  const scrollPct = document.getElementById('scrollPct');
  const RAIL_HEIGHT = 200;
  const THUMB_SIZE = 22;

  const sectionAccents = [
    { id: 'top', color: 'var(--coral)' },
    { id: 'about', color: 'var(--yellow)' },
    { id: 'toolkit', color: 'var(--violet)' },
    { id: 'work', color: 'var(--sky)' },
    { id: 'gallery', color: 'var(--rose)' },
    { id: 'contact', color: 'var(--mint)' }
  ].map(s => ({ ...s, el: document.getElementById(s.id) })).filter(s => s.el);

  function morphBlob(el, t, phase) {
    const wob = Math.sin(t * 7.5 + phase) * 14;
    const r1 = 50 + wob, r2 = 50 - wob, r3 = 50 + wob * 0.55, r4 = 50 - wob * 0.55;
    el.style.borderRadius = `${r1}% ${r2}% ${r3}% ${r4}% / ${r2}% ${r4}% ${r1}% ${r3}%`;
    el.style.transform = `translateY(${t * -70}px) rotate(${t * 30}deg) scale(${1 + t * 0.12})`;
  }

  function currentAccent() {
    const probe = window.innerHeight * 0.4;
    let active = sectionAccents[0];
    for (const s of sectionAccents) {
      if (s.el.getBoundingClientRect().top <= probe) active = s;
    }
    return active ? active.color : 'var(--coral)';
  }

  let ticking = false;
  function updateScrollFX() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;

    if (scrollPct) scrollPct.textContent = `${Math.round(pct * 100)}%`;

    if (!reduceMotion) {
      if (scrollThumb) {
        scrollThumb.style.top = `${pct * (RAIL_HEIGHT - THUMB_SIZE)}px`;
        scrollThumb.style.transform = `translate(-50%,0) rotate(${pct * 35}deg)`;
      }
      if (blobA) morphBlob(blobA, pct, 0);
      if (blobB) morphBlob(blobB, pct, 2.4);
    }

    const rail = document.querySelector('.scroll-rail');
    if (rail && sectionAccents.length) {
      rail.style.setProperty('--rail-accent', currentAccent());
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScrollFX);
      ticking = true;
    }
  }, { passive: true });

  updateScrollFX();

  // ---------- Magnetic hover (CTAs, toolkit chips, contact links) ----------
  // Follows the cursor with an eased chase, then springs back with an
  // elastic release on mouseleave, mirroring the classic GSAP magnetic-button
  // pattern — reimplemented in plain JS so the site stays dependency-free.
  if (!reduceMotion) {
    const FOLLOW_EASE = 0.18;  // snappy tracking while the cursor is over the element
    const RELEASE_MS = 700;    // ~ GSAP's elastic.out(1, 0.3) at 0.7s

    // Standard easeOutElastic (easings.net) — overshoots past 1 before
    // settling, approximating elastic.out(1, 0.3)'s springy snap-back.
    function easeOutElastic(t) {
      const c4 = (2 * Math.PI) / 3;
      return t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    // ratio: how far `el` itself travels, relative to the cursor offset.
    // labelSelector/labelRatio: an inner child that travels at its own
    // (usually slower) ratio for a layered depth effect — omit for a
    // single-layer element like a chip or a plain link.
    function attachMagnetic(el, { ratio, labelSelector = null, labelRatio = 0, releaseMs = RELEASE_MS } = {}) {
      const label = labelSelector ? el.querySelector(labelSelector) : null;
      let targetX = 0, targetY = 0, curX = 0, curY = 0;
      let mode = 'idle'; // 'follow' | 'release'
      let releaseStart = 0, releaseFromX = 0, releaseFromY = 0;
      let rafId = null;

      function apply() {
        const atRest = curX === 0 && curY === 0;
        el.style.transform = atRest ? '' : `translate(${(curX * ratio).toFixed(2)}px, ${(curY * ratio).toFixed(2)}px)`;
        if (label) {
          label.style.transform = atRest ? '' : `translate(${(curX * labelRatio).toFixed(2)}px, ${(curY * labelRatio).toFixed(2)}px)`;
        }
      }

      function followTick() {
        curX += (targetX - curX) * FOLLOW_EASE;
        curY += (targetY - curY) * FOLLOW_EASE;
        apply();

        const settled = Math.abs(targetX - curX) < 0.05 && Math.abs(targetY - curY) < 0.05;
        if (settled) {
          curX = targetX;
          curY = targetY;
          apply();
          rafId = null;
        } else if (mode === 'follow') {
          rafId = requestAnimationFrame(followTick);
        }
      }

      function releaseTick(now) {
        const t = Math.min((now - releaseStart) / releaseMs, 1);
        const eased = easeOutElastic(t);
        curX = releaseFromX * (1 - eased);
        curY = releaseFromY * (1 - eased);
        apply();

        if (t < 1 && mode === 'release') {
          rafId = requestAnimationFrame(releaseTick);
        } else {
          curX = 0;
          curY = 0;
          apply();
          rafId = null;
        }
      }

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        targetX = e.clientX - rect.left - rect.width / 2;
        targetY = e.clientY - rect.top - rect.height / 2;
        mode = 'follow';
        if (rafId === null) rafId = requestAnimationFrame(followTick);
      });

      el.addEventListener('mouseleave', () => {
        mode = 'release';
        releaseFromX = curX;
        releaseFromY = curY;
        releaseStart = performance.now();
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(releaseTick);
      });
    }

    // Hero CTAs: dual-layer — button travels further than its label
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
      attachMagnetic(btn, { ratio: 0.35, labelSelector: 'span', labelRatio: 0.15 });
    });

    // Toolkit chips: small pills, single-layer, lighter pull
    document.querySelectorAll('.chip').forEach(chip => {
      attachMagnetic(chip, { ratio: 0.3, releaseMs: 600 });
    });

    // Contact links (email + socials): single-layer
    document.querySelectorAll('.contact-links a').forEach(link => {
      attachMagnetic(link, { ratio: 0.3 });
    });
  }

  // ---------- Mouse parallax, every frame (desktop / fine-pointer only) ----------
  // "hover: hover and pointer: fine" is true only for devices with both real
  // hover capability and a precise pointer — i.e. a mouse. Touchscreens
  // (including hybrid laptops) report pointer:coarse or lack hover, so this
  // single check satisfies both "desktop only" and "disable on touch".
  const supportsHoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Tracks the cursor's position within `triggerEl` (normalized -1..1 on each
  // axis) and eases every entry in `layers` toward `offset * its own max`,
  // each frame, via a single shared requestAnimationFrame loop per section.
  function attachSectionParallax(triggerEl, layers) {
    const EASE = 0.08; // gentle, slower than the button-follow effect for a calmer feel
    let targetX = 0, targetY = 0, curX = 0, curY = 0, rafId = null;

    function apply() {
      const atRest = curX === 0 && curY === 0;
      layers.forEach(({ el, max }) => {
        el.style.transform = atRest ? '' : `translate(${(curX * max).toFixed(2)}px, ${(curY * max).toFixed(2)}px)`;
      });
    }

    function tick() {
      curX += (targetX - curX) * EASE;
      curY += (targetY - curY) * EASE;

      const settled = Math.abs(targetX - curX) < 0.002 && Math.abs(targetY - curY) < 0.002;
      if (settled) {
        curX = targetX;
        curY = targetY;
        apply();
        rafId = null;
      } else {
        apply();
        rafId = requestAnimationFrame(tick);
      }
    }

    triggerEl.addEventListener('mousemove', (e) => {
      const rect = triggerEl.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (rafId === null) rafId = requestAnimationFrame(tick);
    });

    triggerEl.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      if (rafId === null) rafId = requestAnimationFrame(tick);
    });
  }

  if (!reduceMotion && supportsHoverFine) {
    const heroSection = document.getElementById('top');

    if (heroSection) {
      // The hero card's one-time load animation (heroFadeUp) holds its
      // final transform via fill-mode "both", which would silently block
      // any inline transform we set for parallax. Once it finishes, drop
      // the animation so plain inline styles can take over the property —
      // .in-view's CSS rule keeps it visually at rest in the meantime.
      heroSection.addEventListener('animationend', function onHeroLoadEnd(e) {
        if (e.animationName === 'heroFadeUp') {
          heroSection.style.animation = 'none';
        }
      }, { once: true });

      // Each layer's own max travel distance in px — all comfortably within
      // the "around 10px" ceiling, varied slightly for a sense of depth.
      const heroDepthMax = { 'blob-a': 10, 'blob-b': 9, 'cursor-1': 7, 'cursor-2': 6 };
      const heroLayers = [
        { el: heroSection, max: 8 },
        ...Array.from(heroSection.querySelectorAll('.parallax-layer')).map(el => ({
          el, max: heroDepthMax[el.dataset.parallax] || 8
        }))
      ];
      attachSectionParallax(heroSection, heroLayers);
    }

    // Every other frame: the card itself is a .frame-inner wrapper (so this
    // never touches the section's own scroll-reveal transform), plus that
    // frame's own decorative blobs/cursor.
    ['about', 'toolkit', 'work', 'gallery', 'contact'].forEach(id => {
      const section = document.getElementById(id);
      if (!section) return;

      const layers = [];
      const inner = section.querySelector('.frame-inner');
      if (inner) layers.push({ el: inner, max: 8 });

      section.querySelectorAll('.parallax-layer').forEach(el => {
        const key = el.dataset.parallax || '';
        const max = key.includes('blob') ? 9 : key.includes('cursor') ? 6 : 7;
        layers.push({ el, max });
      });

      attachSectionParallax(section, layers);
    });
  }