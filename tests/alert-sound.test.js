import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAlertSound} from '../src/components/alerts/alertSound.js';

function browser({saved = null, unsupported = false, blocked = false} = {}) {
  const listeners = new Map(), contexts = [], preferences = new Map(saved ? [['acg.alerts.sound.v1', saved]] : []);
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 10; this.destination = {}; this.oscillators = []; contexts.push(this); }
    async resume() { if (blocked) throw new Error('Autoplay blocked'); this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { return {connect() {}, disconnect() {}, gain: {setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}}}; }
    createOscillator() {
      const voice = {frequency: {setValueAtTime(value) { voice.hz = value; }}, connect() {}, disconnect() {},
        start(at) { voice.started = at; }, stop(at) { voice.stopped = at; }};
      this.oscillators.push(voice); return voice;
    }
  }
  const host = {AudioContext: unsupported ? undefined : AudioContext,
    localStorage: {getItem: key => preferences.get(key), setItem: (key, value) => preferences.set(key, value)},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); }};
  return {host, contexts, preferences, listeners, gesture: () => listeners.get('pointerdown')?.()};
}

test('default-on audio waits for a gesture; later trigger plays two notes and coalesces bursts', async () => {
  const b = browser(), sound = createAlertSound(b.host); sound.start();
  assert.equal(sound.enabled, true);
  assert.equal(await sound.play(), false); assert.equal(b.contexts.length, 0);
  b.gesture(); await Promise.resolve();
  assert.equal(await sound.play(), true);
  const audio = b.contexts[0];
  assert.deepEqual(audio.oscillators.map(v => v.hz), [880, 1174.66]);
  assert.ok(audio.oscillators.every(v => v.stopped > v.started));
  await sound.play(); assert.equal(audio.oscillators.length, 2);
  audio.currentTime += 2; await sound.play(); assert.equal(audio.oscillators.length, 4);
  sound.stop();
});

test('mute persists, silences active voices and does not play from subsequent gestures', async () => {
  const b = browser(), sound = createAlertSound(b.host); sound.start();
  await sound.preview(); const audio = b.contexts[0];
  sound.setEnabled(false);
  assert.equal(b.preferences.get('acg.alerts.sound.v1'), 'off');
  assert.ok(audio.oscillators.every(v => v.stopped === undefined));
  b.gesture(); assert.equal(await sound.play(), false);
  assert.equal(createAlertSound(b.host).enabled, false);
  sound.setEnabled(true); audio.currentTime += 2;
  assert.equal(await sound.preview(), true);
  assert.equal(b.preferences.get('acg.alerts.sound.v1'), 'on'); sound.stop();
});

test('saved mute never allocates audio, including Test sound', async () => {
  const b = browser({saved: 'off'}), sound = createAlertSound(b.host); sound.start();
  b.gesture(); assert.equal(await sound.preview(), false); assert.equal(b.contexts.length, 0); sound.stop();
});

test('unsupported and autoplay-blocked audio fail without breaking alert presentation', async () => {
  for (const options of [{unsupported: true}, {blocked: true}]) {
    const b = browser(options), sound = createAlertSound(b.host); sound.start();
    assert.equal(await sound.preview(), false); sound.stop();
  }
});

test('session cleanup removes listeners, closes audio and supports remount', async () => {
  const b = browser(), sound = createAlertSound(b.host); sound.start(); await sound.preview();
  sound.stop(); assert.equal(b.contexts[0].state, 'closed'); assert.equal(b.listeners.size, 0);
  assert.equal(await sound.play(), false);
  sound.start(); b.gesture(); await Promise.resolve(); assert.equal(await sound.play(), true);
  assert.equal(b.contexts.length, 2); sound.stop();
});

test('logout or mute while audio resumes cancels pending playback', async () => {
  for (const mode of ['stop', 'mute']) {
    const b = browser(), sound = createAlertSound(b.host); sound.start(); await sound.preview();
    const audio = b.contexts[0]; audio.currentTime += 2; audio.state = 'suspended';
    let release;
    audio.resume = () => new Promise(resolve => { release = () => { audio.state = 'running'; resolve(); }; });
    const pending = sound.play();
    if (mode === 'stop') sound.stop(); else sound.setEnabled(false);
    release(); assert.equal(await pending, false); assert.equal(audio.oscillators.length, 2); sound.stop();
  }
});
