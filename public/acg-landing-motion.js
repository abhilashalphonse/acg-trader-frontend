/**
 * First-party ACG Trader public landing interactions.
 * Motion is decorative, never account- or order-related.
 * No network calls, third-party scripts, cookies, storage or analytics.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = [...document.querySelectorAll('.film-video')];
  const revealItems = [...document.querySelectorAll('[data-film-reveal], .feature, .market-item')];
  const noAutoplay = () => reduceMotion.matches || navigator.connection?.saveData === true;

  function setVideoState(video, visible) {
    if (noAutoplay() || !visible) {
      video.pause();
      return;
    }
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  }

  const intersectionSupported = typeof IntersectionObserver === 'function';
  let videoObserver;
  let revealObserver;

  function configureVideos() {
    videoObserver?.disconnect();
    videos.forEach(video => {
      video.muted = true;
      video.playsInline = true;
      if (noAutoplay()) video.removeAttribute('autoplay');
      else video.setAttribute('autoplay', '');
      video.pause();
      video.addEventListener('loadeddata', () => video.setAttribute('data-video-ready', 'true'), { once: true });
    });
    if (noAutoplay()) {
      videos.forEach(video => {
        video.controls = true;
        video.setAttribute('aria-label', (video.getAttribute('aria-label') || 'Creative video') + '. Play manually if desired.');
      });
      return;
    }
    videos.forEach(video => { video.controls = false; });
    if (!intersectionSupported) {
      videos.forEach(video => setVideoState(video, true));
      return;
    }
    videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => setVideoState(entry.target, entry.isIntersecting));
    }, { threshold: 0.15 });
    videos.forEach(video => videoObserver.observe(video));
  }

  function configureReveals() {
    if (reduceMotion.matches || !intersectionSupported) {
      revealItems.forEach(item => item.classList.add('in-view'));
      return;
    }
    revealObserver?.disconnect();
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px 10px 0px', threshold: 0.1 });
    revealItems.forEach(item => revealObserver.observe(item));
  }

  configureVideos();
  configureReveals();
  reduceMotion.addEventListener?.('change', () => { configureVideos(); configureReveals(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
    else if (!noAutoplay()) videos.forEach(video => {
      if (video.getBoundingClientRect().bottom > 0 && video.getBoundingClientRect().top < innerHeight) setVideoState(video, true);
    });
  });
})();
