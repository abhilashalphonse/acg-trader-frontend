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
  const states = [...document.querySelectorAll('video.film-video')].map(video => ({
    video,
    button: document.querySelector('[data-video-control="' + video.id + '"]'),
    visible: false,
    userPaused: false,
    manualPlay: false
  }));

  function label(state) {
    const playing = !state.video.paused;
    const name = state.video.id.includes('shield') ? 'ACG Shield' : 'Three Markets';
    if (!state.button) return;
    state.button.textContent = playing ? 'Pause' : 'Play';
    state.button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + name + ' animation');
  }

  function pause(state) {
    if (!state.video.paused) state.video.pause();
    label(state);
  }

  function syncPlayback(state) {
    if (document.hidden || !state.visible || state.userPaused) {
      pause(state);
      return;
    }
    if ((reduceMotion.matches || saveData()) && !state.manualPlay) {
      pause(state);
      return;
    }
    const playback = state.video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => { pause(state); });
    }
    label(state);
  }

  for (const state of states) {
    state.video.muted = true;
    state.video.playsInline = true;
    state.video.removeAttribute('autoplay');
    state.video.controls = false;
    state.video.preload = 'metadata';
    if (state.button) {
      state.button.hidden = false;
      state.button.addEventListener('click', () => {
        if (state.video.paused) {
          state.userPaused = false;
          state.manualPlay = true;
          state.visible = true;
          syncPlayback(state);
        } else {
          state.userPaused = true;
          state.manualPlay = false;
          pause(state);
        }
      });
    }
    state.video.addEventListener('play', () => label(state));
    state.video.addEventListener('pause', () => label(state));
    label(state);
  }

  if (supportsObserver) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.find(item => item.video === entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        if (!state.visible) state.manualPlay = false;
        syncPlayback(state);
      }
    }, { threshold: 0.2 });
    states.forEach(state => visibility.observe(state.video));
  } else {
    // No invisible background playback in browsers without observers.
    states.forEach(state => { state.video.controls = true; if (state.button) state.button.hidden = true; });
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
    states.forEach(state => { state.manualPlay = false; syncPlayback(state); });
  });

  document.addEventListener('visibilitychange', () => {
    states.forEach(state => syncPlayback(state));
  });
  // One-time ACG Trader prism reveal. The source files end at the user-approved
  // 2.04 s frame; show a matching still once playback ends or fails.
  const heroFilm = document.getElementById('acg-hero-film');
  const heroVideo = document.getElementById('acg-hero-reveal');
  const heroReplay = document.getElementById('acg-hero-replay');
  if (heroFilm && heroVideo && heroReplay) {
    let completed = false;

    function holdHero() {
      heroVideo.pause();
      heroFilm.classList.remove('is-playing', 'user-requested');
      heroReplay.hidden = false;
      completed = true;
    }

    function startHero(manual = false) {
      if ((reduceMotion.matches || saveData()) && !manual) {
        holdHero();
        return;
      }
      if (document.hidden) return;
      completed = false;
      heroReplay.hidden = true;
      heroFilm.classList.toggle('user-requested', manual);
      heroFilm.classList.add('is-playing');
      try {
        heroVideo.currentTime = 0;
        const attempt = heroVideo.play();
        if (attempt && typeof attempt.catch === 'function') attempt.catch(holdHero);
      } catch {
        holdHero();
      }
    }

    heroVideo.addEventListener('ended', holdHero);
    heroVideo.addEventListener('error', holdHero);
    heroReplay.addEventListener('click', () => startHero(true));
    reduceMotion.addEventListener?.('change', () => {
      if (reduceMotion.matches) holdHero();
    });
    const breakpoint = window.matchMedia('(max-width: 600px)');
    breakpoint.addEventListener?.('change', () => {
      heroVideo.pause();
      heroFilm.classList.remove('is-playing', 'user-requested');
      heroVideo.load();
      completed = true;
      heroReplay.hidden = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        heroVideo.pause();
      } else if (!completed && !reduceMotion.matches && !saveData()) {
        const attempt = heroVideo.play();
        if (attempt && typeof attempt.catch === 'function') attempt.catch(holdHero);
      }
    });
    startHero();
  }

})();
