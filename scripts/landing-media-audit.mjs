// Validate the exact first-party video bytes packaged for production mobile users.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';

const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
const paths = [...html.matchAll(/<source\s+src="(\/media\/[^"]+\.mp4)"\s+type="video\/mp4"/g)].map(m => m[1]);
assert.equal(paths.length, 6, 'Expected six first-party films');
let failures = 0;
for (const path of paths) {
  try {
    const filename = resolve('dist', '.' + path);
    const bytes = readFileSync(filename);
    assert.ok(bytes.length > 1000, 'Missing video content');
    const probe = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,level',
      '-show_entries', 'format=duration,bit_rate,format_name',
      '-of', 'json', filename
    ], { encoding: 'utf8' });
    assert.equal(probe.status, 0, 'ffprobe failed: ' + (probe.stderr || probe.error?.message));
    const result = JSON.parse(probe.stdout);
    const video = result.streams.find(s => typeof s.width === 'number');
    assert.ok(video, 'Video stream missing');
    const moov = bytes.indexOf(Buffer.from('moov'));
    const mdat = bytes.indexOf(Buffer.from('mdat'));
    const faststart = moov >= 0 && mdat >= 0 && moov < mdat;
    console.log(JSON.stringify({
      path, bytes: bytes.length, codec: video.codec_name, profile: video.profile,
      pixFmt: video.pix_fmt, dimensions: video.width + 'x' + video.height,
      duration: result.format?.duration, faststart, streams: result.streams.map(s => s.codec_name)
    }));
    assert.equal(video.codec_name, 'h264', 'Safari-compatible video must use H.264');
    assert.equal(video.pix_fmt, 'yuv420p', 'Safari-compatible video should use 8-bit yuv420p');
    assert.equal(result.streams.length, 1, 'Autoplay films must have no audio track');
    assert.ok(faststart, 'MP4 index must precede the media data for fast start');
  } catch (error) {
    failures++;
    console.error(path + ': ' + error.message);
  }
}
if (failures) throw new Error(failures + ' cinematic media files failed the mobile release gate');
