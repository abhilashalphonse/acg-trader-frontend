// Release gate for the *actual* public video objects served to mobile users.
// No credentials, private endpoints, or storage mutation.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
const urls = [...html.matchAll(/<source\\s+src="(https:\/\/[^"]+\\.mp4)"\\s+type="video\/mp4"/g)].map(m => m[1]);
assert.equal(urls.length, 6, 'Expected six public landing page films');
const dir = mkdtempSync(join(tmpdir(), 'acg-media-audit-'));
let failed = false;

try {
  for (const [i, url] of urls.entries()) {
    const label = decodeURIComponent(url.split('/').pop());
    try {
      const range = await fetch(url, { headers: { Range: 'bytes=0-15' }, signal: AbortSignal.timeout(20000) });
      const rangeBytes = new Uint8Array(await range.arrayBuffer());
      assert.equal(range.status, 206, 'HTTP Range response must be 206 for Safari seeking');
      assert.equal(rangeBytes.length, 16, 'Range response must contain exactly 16 bytes');
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, 'Public media fetch must return HTTP 200');
      assert.match(response.headers.get('content-type') || '', /^video\/mp4/i);
      const bytes = Buffer.from(await response.arrayBuffer());
      const file = join(dir, 'clip-' + i + '.mp4');
      writeFileSync(file, bytes);
      const probe = spawnSync('ffprobe', ['-v','error','-show_entries','stream=index,codec_name,profile,pix_fmt,width,height,level','-show_entries','format=duration,bit_rate,format_name','-of','json',file], { encoding: 'utf8' });
      assert.equal(probe.status, 0, 'ffprobe failed: ' + probe.stderr);
      const result = JSON.parse(probe.stdout);
      const video = result.streams.find(s => s.codec_name !== 'aac' && typeof s.width === 'number');
      assert.ok(video, 'Video stream missing');
      const moov = bytes.indexOf(Buffer.from('moov'));
      const mdat = bytes.indexOf(Buffer.from('mdat'));
      console.log(JSON.stringify({ label, bytes: bytes.length, rangeStatus: range.status, contentType: response.headers.get('content-type'), codec: video.codec_name, profile: video.profile, pixFmt: video.pix_fmt, level: video.level, dimensions: video.width + 'x' + video.height, duration: result.format?.duration, moovBeforeMdat: moov >= 0 && mdat >= 0 && moov < mdat, streams: result.streams.map(s => s.codec_name) }));
      assert.equal(video.codec_name, 'h264', 'Safari-safe MP4 must contain H.264 video');
      assert.equal(video.pix_fmt, 'yuv420p', 'Safari-safe MP4 should use 8-bit yuv420p');
      assert.ok(moov >= 0 && mdat >= 0 && moov < mdat, 'MP4 moov atom must precede mdat for fast start');
    } catch (err) {
      failed = true;
      console.error('MEDIA FAILURE ' + label + ': ' + err.message);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
