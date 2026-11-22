// Production media is versioned in public/media, not downloaded from Supabase on each build.
// Vite copies public/ into dist/. Verify that the production payload matches the approved
// silent, fast-start MP4 assets byte-for-byte. MP4 codec checks run in landing-media-audit.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const filmNames = [
  'hero.mp4',
  'btc-swirl.mp4',
  'ai-prism.mp4',
  'terminal.mp4',
  'overnight-scan.mp4',
  'market-movers.mp4'
];

for (const name of filmNames) {
  const approved = readFileSync(resolve('public/media', name));
  const built = readFileSync(resolve('dist/media', name));
  assert.ok(approved.length > 1000 && approved.length < 25000000,
    name + ' approved source size outside expected bounds');
  assert.equal(built.length, approved.length, name + ' build file size changed');
  assert.ok(built.equals(approved), name + ' build bytes differ from versioned asset');
  process.stdout.write(name + ' verified in dist/media (' + built.length + ' bytes)\n');
}
