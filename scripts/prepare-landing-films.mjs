// Build-first media preparation: self-host clean, silent, seekable MP4 films.
// The original media stays unchanged in the public ACG Trader storage bucket.
// No credentials or private storage operations are involved.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';

const ROOT = 'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/';
const films = [
  ['hero', 'a7112847-cd7c-4d7b-9f91-540af4da8234.mp4'],
  ['btc-swirl', 'ACG%20logo%20BTC%20swirl.mp4'],
  ['ai-prism', 'ACG%20Prism%20Background.mp4'],
  ['terminal', 'ACG%20Trader%20Terminal.mp4'],
  ['overnight-scan', 'ACG%20Trader%20-%20Overnight%20Scan.mp4'],
  ['market-movers', 'ACG%20Market%20Movers%20-%20Take%20the%20Lead.mp4']
];
const output = resolve('dist/media');
mkdirSync(output, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'acg-films-'));
try {
  for (const [name, remote] of films) {
    const res = await fetch(ROOT + remote, { signal: AbortSignal.timeout(45000) });
    assert.equal(res.status, 200, name + ' source download failed');
    assert.match(res.headers.get('content-type') || '', /^video\/mp4/i, name + ' content type');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.ok(bytes.length > 1000 && bytes.length < 25000000, name + ' implausible file size');
    const source = join(temp, name + '-source.mp4');
    const dest = join(output, name + '.mp4');
    writeFileSync(source, bytes);
    // Stream copy: preserve every original video frame; remove all audio tracks
    // for iOS silent autoplay and move moov to the file head for fast start.
    const ff = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source,
      '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', dest
    ], { encoding: 'utf8' });
    assert.equal(ff.status, 0, name + ' remux failed: ' + (ff.stderr || ff.error?.message));
    assert.ok(statSync(dest).size > 1000, name + ' output is empty');
    process.stdout.write(name + ' -> /media/' + name + '.mp4 (' + statSync(dest).size + ' bytes)\n');

  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
