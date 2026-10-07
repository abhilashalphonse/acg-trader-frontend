import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production hosting revalidates the app shell after each deploy', async () => {
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
  const globalHeaders = (config.hosting?.headers || []).find(entry => entry.source === '**');
  const cacheControl = (globalHeaders?.headers || []).find(
    header => String(header.key || '').toLowerCase() === 'cache-control',
  );

  assert.ok(cacheControl, 'Firebase hosting must define Cache-Control for the app shell');
  assert.match(String(cacheControl.value || ''), /no-cache/i);
  assert.match(String(cacheControl.value || ''), /must-revalidate/i);
});

test('instant boot shell matches the React ACG loader instead of legacy copy', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /\/acg-logo\.png/);
  assert.doesNotMatch(html, /Preparing your trading session/);
  assert.doesNotMatch(html, /acg-boot-mark/);
});
