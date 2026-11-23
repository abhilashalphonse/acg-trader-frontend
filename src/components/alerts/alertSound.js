const SOUND_KEY = 'acg.alerts.sound.v1';

// A browser needs a user gesture before it can play alert audio.
// Keep the context open after that gesture so a later polling result can chime.
export function createAlertSound(host = globalThis.window) {
  let enabled = true;
  try { enabled = host?.localStorage?.getItem(SOUND_KEY) !== 'off'; } catch { /* Private browsing. */ }
  let context = null;
  let listening = false;
  let revision = 0;
  let lastPlayedAt = -Infinity;
  const voices = new Set();

  async function unlock() {
    if (!enabled) return false;
    try {
      const Audio = host?.AudioContext || host?.webkitAudioContext;
      if (!Audio) return false;
      if (!context || context.state === 'closed') context = new Audio();
      const audio = context;
      if (audio.state !== 'running') await audio.resume();
      return enabled && context === audio && audio.state === 'running';
    } catch { return false; }
  }
  const gesture = () => { void unlock(); };

  function silence() {
    for (const voice of voices) {
      try { voice.stop(); } catch { /* Already stopped. */ }
      try { voice.disconnect(); } catch { /* Already disconnected. */ }
    }
    voices.clear();
  }

  async function play() {
    // Never create a context from a timer: unlock it from a click or key first.
    if (!enabled || !context) return false;
    const generation = revision;
    if (!await unlock() || generation !== revision) return false;
    const audio = context;
    if (audio.currentTime - lastPlayedAt < 1) return true; // Coalesce a burst into one chime.
    try {
      const start = audio.currentTime + 0.01;
      const gain = audio.createGain();
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      for (const [frequency, delay] of [[880, 0], [1174.66, 0.18]]) {
        const oscillator = audio.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start + delay);
        oscillator.connect(gain);
        voices.add(oscillator);
        oscillator.onended = () => {
          voices.delete(oscillator);
          oscillator.disconnect();
          if (!voices.size) gain.disconnect();
        };
        oscillator.start(start + delay);
        oscillator.stop(start + 0.52);
      }
      lastPlayedAt = audio.currentTime;
      return true;
    } catch {
      silence();
      return false;
    }
  }

  return {
    get enabled() { return enabled; },
    start() {
      if (listening) return;
      listening = true;
      host?.addEventListener('pointerdown', gesture, true);
      host?.addEventListener('keydown', gesture, true);
    },
    stop() {
      listening = false;
      revision++;
      host?.removeEventListener('pointerdown', gesture, true);
      host?.removeEventListener('keydown', gesture, true);
      silence();
      const audio = context;
      context = null;
      lastPlayedAt = -Infinity;
      if (audio) void audio.close().catch(() => {});
    },
    setEnabled(value) {
      enabled = Boolean(value);
      revision++;
      if (!enabled) silence();
      try { host?.localStorage?.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
    },
    play,
    async preview() {
      if (!await unlock()) return false;
      return play();
    },
  };
}
