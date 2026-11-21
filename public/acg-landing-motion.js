/**
 * ACG Trader public landing: first-party, privacy-preserving media controller.
 * Muted inline autoplay when allowed; visible, accessible tap-to-play fallback
 * when iOS power-saving, reduced-motion or browser policies block autoplay.
 * No analytics, account state, cookies, fetches or external player libraries.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => navigator.connection?.saveData === true;
  const supportsObserver = typeof IntersectionObserver === 'function';
  const manualFilmIds = new Set([
    'acg-three-markets-film',
    'acg-terminal-film',
    'acg-ai-connection-film',
    'acg-market-movers-film'
  ]);
  const states = [...document.querySelectorAll('video.film-video')].map(video => ({
    video,
    visible: false,
    requested: false,
    blocked: false,
    pending: false,
    button: null
  }));

  function setButton(state, visible, unavailable = false) {
    if (!state.button) return;
    state.button.hidden = !visible;
    state.button.disabled = unavailable;
    state.button.textContent = unavailable ? 'Video unavailable' : 'Play video';
  }

  function attemptPlayback(state, explicit = false) {
    const { video } = state;
    if (state.pending) return;
    let playback;
    try { playback = video.play(); }
    catch (error) { playback = Promise.reject(error); }
    if (playback && typeof playback.then === 'function') {
      state.pending = true;
      playback.then(() => {
        state.pending = false;
        state.blocked = false;
        setButton(state, false);
      }).catch(error => {
        state.pending = false;
        if (document.hidden || (!state.visible && !explicit)) return;
        video.pause();
        state.blocked = true;
        setButton(state, true, error?.name === 'NotSupportedError');
      });
    } else {
      state.blocked = false;
      setButton(state, false);
    }
  }

  function syncPlayback(state) {
    const { video } = state;
    if (document.hidden || !state.visible) {
      video.pause();
      return;
    }
    if ((reduceMotion.matches || saveData()) && !state.requested) {
      video.removeAttribute('autoplay');
      video.autoplay = false;
      video.pause();
      setButton(state, true);
      return;
    }
    if (state.blocked && !state.requested) {
      setButton(state, true);
      return;
    }
    if (!state.requested) video.autoplay = true;
    if (!video.paused) {
      setButton(state, false);
      return;
    }
    attemptPlayback(state);
  }

  for (const state of states) {
    const { video } = state;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    video.removeAttribute('controls');
    video.controls = false;
    video.preload = 'metadata';
    if (reduceMotion.matches || saveData()) {
      video.removeAttribute('autoplay');
      video.autoplay = false;
    }

    if (manualFilmIds.has(video.id)) {
      const host = video.parentElement;
      host.classList.add('film-playback-host');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'film-tap-to-play';
      button.setAttribute('aria-label', 'Play this ACG Trader video');
      button.setAttribute('aria-controls', video.id);
      button.textContent = 'Play video';
      button.hidden = true;
      host.appendChild(button);
      state.button = button;
      button.addEventListener('click', () => {
        state.requested = true;
        state.blocked = false;
        state.visible = true;
        video.dataset.userActivated = 'true';
        video.autoplay = false;
        video.preload = 'auto';
        // Call play synchronously from the user's tap; do not defer through an observer.
        attemptPlayback(state, true);
      });
    }

    video.addEventListener('error', () => {
      video.pause();
      state.blocked = true;
      setButton(state, true, true);
    });
    if ((reduceMotion.matches || saveData()) && state.button) setButton(state, true);
  }

  const onScrollVisibility = () => {
    for (const state of states) {
      const rect = state.video.getBoundingClientRect();
      state.visible = rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.top < window.innerHeight;
      syncPlayback(state);
    }
  };
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
    // Older embedded webviews: a manual tap remains available, but also
    // calculate visibility rather than permanently pausing all video clips.
    window.addEventListener('scroll', onScrollVisibility, { passive: true });
    window.addEventListener('resize', onScrollVisibility);
    onScrollVisibility();
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
    for (const state of states) {
      if ((reduceMotion.matches || saveData()) && !state.requested) {
        state.video.removeAttribute('autoplay');
        state.video.autoplay = false;
        setButton(state, true);
      }
      syncPlayback(state);
    }
  });

  document.addEventListener('visibilitychange', () => {
    states.forEach(syncPlayback);
  });

  // One-shot hero prism. Keep the art-directed static backdrop if playback
  // is blocked, but allow an explicit user tap to start it on mobile.
  const heroVideo = document.getElementById('acg-hero-reveal');
  if (heroVideo) {
    let completed = false;
    let requested = false;
    const heroCopy = document.querySelector('.acg-cinema-copy');
    const heroButton = document.createElement('button');
    heroButton.type = 'button';
    heroButton.className = 'acg-hero-tap-to-play';
    heroButton.textContent = 'Play intro animation';
    heroButton.setAttribute('aria-controls', heroVideo.id);
    heroButton.hidden = true;
    heroCopy?.appendChild(heroButton);
    const animationAllowed = () => !reduceMotion.matches && !saveData();

    function pauseHero() {
      if (!heroVideo.paused) heroVideo.pause();
    }
    function playHero(explicit = false) {
      if (document.hidden || completed) {
        pauseHero();
        return;
      }
      if (!animationAllowed() && !requested) {
        heroVideo.removeAttribute('autoplay');
        heroVideo.autoplay = false;
        pauseHero();
        heroButton.hidden = false;
        return;
      }
      let attempt;
      try { attempt = heroVideo.play(); }
      catch (error) { attempt = Promise.reject(error); }
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(() => {
          heroVideo.classList.remove('is-unavailable');
          heroButton.hidden = true;
        }).catch(() => {
          pauseHero();
          heroVideo.classList.add('is-unavailable');
          heroButton.hidden = false;
        });
      }
    }

    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute('webkit-playsinline', '');
    heroVideo.controls = false;
    if (!animationAllowed()) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.autoplay = false;
    }
    heroVideo.addEventListener('ended', () => {
      completed = true;
      pauseHero();
      heroButton.hidden = true;
    });
    heroVideo.addEventListener('error', () => {
      heroVideo.classList.add('is-unavailable');
      pauseHero();
      heroButton.hidden = true;
    });
    heroButton.addEventListener('click', () => {
      requested = true;
      heroVideo.dataset.userActivated = 'true';
      heroVideo.classList.remove('is-unavailable');
      heroVideo.autoplay = false;
      heroVideo.preload = 'auto';
      // iOS user gesture is preserved because playHero is called directly.
      playHero(true);
    });
    document.addEventListener('visibilitychange', () => playHero());
    reduceMotion.addEventListener?.('change', () => {
      if (reduceMotion.matches && !requested) pauseHero();
      playHero();
    });
    playHero();
  }
})();