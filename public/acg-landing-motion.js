/**
 * ACG Trader public landing: deliberately small, first-party motion controller.
 * No analytics, cookies, fetches, account state or trading API usage.
 * Videos never autoplay for reduced-motion or data-saver visitors.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => navigator.connection?.saveData === true;
  const supportsObserver = typeof IntersectionObserver === 'function';
  // Non-interactive supporting films share one established playback policy:
  // muted loop when visible, pause offscreen, and no motion when reduced/data-saving.
  // The one-time hero reveal has its own explicitly approved Replay control below.
  const states = [...document.querySelectorAll('video.film-video')].map(video => ({
    video,
    visible: false
  }));

  function syncPlayback(state) {
    const { video } = state;
    if (document.hidden || !state.visible || reduceMotion.matches || saveData()) {
      video.pause();
      return;
    }
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => video.pause());
    }
  }

  for (const state of states) {
    const { video } = state;
    video.muted = true;
    video.playsInline = true;
    video.removeAttribute('controls');
    video.removeAttribute('autoplay');
    video.controls = false;
    video.preload = 'metadata';
  }

  if (supportsObserver) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.find(item => item.video === entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        syncPlayback(state);
      }
    }, { threshold: 0.2 });
    states.forEach(state => visibility.observe(state.video));
  } else {
    // Without IntersectionObserver, posters remain visible and clips stay paused.
    states.forEach(state => state.video.pause());
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
  } else revealTargets.forEach(item => item.classList.add('in-view'));

  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) {
      document.documentElement.classList.remove('motion-ready');
      revealTargets.forEach(item => item.classList.add('in-view'));
    }
    states.forEach(syncPlayback);
  });

  document.addEventListener('visibilitychange', () => {
    states.forEach(syncPlayback);
  });
  // Logo-free prism: one silent playback, hold on the last decoded frame.
  // No replay UI, source swapping, resize resets or extra manual controls.
  const heroVideo = document.getElementById('acg-hero-reveal');
  if (heroVideo) {
    let completed = false;
    const animationAllowed = () => !reduceMotion.matches && !saveData();

    function pauseHero() {
      if (!heroVideo.paused) heroVideo.pause();
    }

    function playHero() {
      if (document.hidden || !animationAllowed() || completed) {
        pauseHero();
        return;
      }
      const attempt = heroVideo.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          pauseHero();
          heroVideo.classList.add('is-unavailable');
        });
      }
    }

    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.controls = false;
    heroVideo.removeAttribute('autoplay');
    heroVideo.addEventListener('ended', () => {
      completed = true;
      pauseHero();
    });
    heroVideo.addEventListener('error', () => {
      heroVideo.classList.add('is-unavailable');
      pauseHero();
    });
    document.addEventListener('visibilitychange', playHero);
    reduceMotion.addEventListener?.('change', () => {
      if (reduceMotion.matches) pauseHero();
      else playHero();
    });
    playHero();
  }

})();
