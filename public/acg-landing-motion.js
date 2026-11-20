/**
 * ACG Trader public landing — progressive, non-tracking panoramic motion.
 *
 * No account/session access, network requests, persistence or third-party code.
 * Without this script the gallery remains a horizontally scrollable product tour.
 */
(() => {
  'use strict';

  const gallery = document.querySelector('.motion-gallery');
  const viewport = gallery?.querySelector('.gallery-window');
  const track = gallery?.querySelector('.gallery-track');
  const progressFill = gallery?.querySelector('.gallery-progress span');
  if (!gallery || !viewport || !track) return;

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopLayout = window.matchMedia('(min-width: 900px) and (min-height: 660px)');
  let active = false;
  let queued = false;
  let revealObserver;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function renderPanorama() {
    queued = false;
    if (!active) return;
    const stickyTop = 74;
    const start = gallery.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, gallery.offsetHeight - (window.innerHeight - stickyTop));
    const progress = clamp((window.scrollY - start) / travel, 0, 1);
    const width = Math.max(0, track.scrollWidth - viewport.clientWidth);
    track.style.transform = 'translate3d(' + (-width * progress).toFixed(1) + 'px,0,0)';
    if (progressFill) progressFill.style.transform = 'scaleX(' + progress.toFixed(3) + ')';
    root.classList.toggle('motion-scrolled', window.scrollY > 30);
  }

  function requestRender() {
    if (!active || queued) return;
    queued = true;
    window.requestAnimationFrame(renderPanorama);
  }

  function setUpReveals() {
    const items = document.querySelectorAll('.feature, .market-item');
    if (!('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('in-view'));
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px 25px 0px', threshold: 0.09 });
    items.forEach(item => revealObserver.observe(item));
  }

  function configureMotion() {
    const shouldAnimate = !reduceMotion.matches && desktopLayout.matches &&
      typeof window.requestAnimationFrame === 'function';
    if (shouldAnimate === active) {
      requestRender();
      return;
    }
    active = shouldAnimate;
    root.classList.toggle('motion-ready', active);
    if (active) {
      setUpReveals();
      requestRender();
      return;
    }
    track.style.transform = '';
    if (progressFill) progressFill.style.transform = '';
    root.classList.remove('motion-scrolled');
    revealObserver?.disconnect();
    revealObserver = null;
    document.querySelectorAll('.in-view').forEach(item => item.classList.remove('in-view'));
  }

  viewport.addEventListener('keydown', event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const jump = Math.max(220, gallery.offsetHeight / 3);
    window.scrollBy({ top: event.key === 'ArrowRight' ? jump : -jump, behavior: 'auto' });
  });

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => { configureMotion(); requestRender(); }, { passive: true });
  window.addEventListener('pageshow', requestRender);
  reduceMotion.addEventListener?.('change', configureMotion);
  desktopLayout.addEventListener?.('change', configureMotion);

  // Layout is stable before enabling the sticky scroll variant.
  configureMotion();
})();
