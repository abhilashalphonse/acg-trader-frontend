/**
 * ACG Trader public landing: silent, inline cinematic background films.
 * No overlays or play controls: if browser/device policy blocks autoplay,
 * retain the native first frame / existing static artwork instead.
 * No analytics, network requests, cookies or account state.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => navigator.connection?.saveData === true;
  const supportsObserver = typeof IntersectionObserver === 'function';

  const states = [...document.querySelectorAll('video.film-video')].map(video => ({
    video, visible: false, blocked: false, pending: false
  }));

  function attemptPlayback(state) {
    const { video } = state;
    if (state.pending || state.blocked || !video.paused) return;
    let promise;
    try { promise = video.play(); }
    catch (error) { promise = Promise.reject(error); }
    if (promise && typeof promise.then === 'function') {
      state.pending = true;
      promise.then(() => {
        state.pending = false;
        state.blocked = false;
        video.classList.remove('is-unavailable');
      }).catch(error => {
        state.pending = false;
        if (document.hidden || !state.visible || error?.name === 'AbortError') return;
        state.blocked = true;
        video.classList.add('is-unavailable');
      });
    }
  }

  function syncPlayback(state) {
    const { video } = state;
    if (document.hidden || !state.visible || reduceMotion.matches || saveData()) {
      video.pause();
      return;
    }
    video.autoplay = true;
    attemptPlayback(state);
  }

  for (const state of states) {
    const { video } = state;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    video.controls = false;
    video.removeAttribute('controls');
    video.preload = 'metadata';
    if (reduceMotion.matches || saveData()) {
      video.autoplay = false;
      video.removeAttribute('autoplay');
    }
    video.addEventListener('error', () => {
      state.blocked = true;
      video.classList.add('is-unavailable');
      video.pause();
    });
  }

  function checkVisibility() {
    for (const state of states) {
      const rect = state.video.getBoundingClientRect();
      state.visible = rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.top < window.innerHeight;
      syncPlayback(state);
    }
  }
  if (supportsObserver) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.find(item => item.video === entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        syncPlayback(state);
      }
    }, { threshold: 0.1 });
    states.forEach(state => visibility.observe(state.video));
  } else {
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    checkVisibility();
  }

  const revealTargets = [...document.querySelectorAll('[data-film-reveal]')];
  if (supportsObserver && !reduceMotion.matches) {
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in-view');
        reveal.unobserve(entry.target);
      }
    }, { threshold: 0.1, rootMargin: '0px 0px 16px 0px' });
    revealTargets.forEach(item => reveal.observe(item));
    document.documentElement.classList.add('motion-ready');
  } else {
    revealTargets.forEach(item => item.classList.add('in-view'));
  }

  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) {
      document.documentElement.classList.remove('motion-ready');
      revealTargets.forEach(item => item.classList.add('in-view'));
    }
    for (const state of states) {
      state.video.autoplay = !reduceMotion.matches && !saveData();
      if (reduceMotion.matches) state.video.removeAttribute('autoplay');
      if (!reduceMotion.matches) state.blocked = false;
      syncPlayback(state);
    }
  });
  document.addEventListener('visibilitychange', () => states.forEach(syncPlayback));

  // One-time hero film: if iOS or device power policy blocks autoplay,
  // use the existing art-directed static background (no overlay controls).
  const heroVideo = document.getElementById('acg-hero-reveal');
  if (heroVideo) {
    let completed = false;
    let blocked = false;
    function playHero() {
      if (document.hidden || completed || reduceMotion.matches || saveData()) {
        heroVideo.pause();
        return;
      }
      if (blocked || !heroVideo.paused) return;
      let promise;
      try { promise = heroVideo.play(); }
      catch (error) { promise = Promise.reject(error); }
      if (promise && typeof promise.then === 'function') {
        promise.catch(error => {
          if (document.hidden || error?.name === 'AbortError') return;
          blocked = true;
          heroVideo.classList.add('is-unavailable');
          heroVideo.pause();
        });
      }
    }
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute('webkit-playsinline', '');
    heroVideo.controls = false;
    if (reduceMotion.matches || saveData()) {
      heroVideo.autoplay = false;
      heroVideo.removeAttribute('autoplay');
    }
    heroVideo.addEventListener('ended', () => {
      completed = true;
      heroVideo.pause();
    });
    heroVideo.addEventListener('error', () => {
      blocked = true;
      heroVideo.classList.add('is-unavailable');
      heroVideo.pause();
    });
    document.addEventListener('visibilitychange', playHero);
    reduceMotion.addEventListener?.('change', () => {
      if (reduceMotion.matches) heroVideo.pause();
      else { blocked = false; playHero(); }
    });
    playHero();
  }
})();