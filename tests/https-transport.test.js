import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');

test('production web server protects HTTPS and keeps the custom domain canonical', () => {
  assert.match(source, /'Strict-Transport-Security': 'max-age=31536000'/);
  assert.match(source, /hostname === 'acgtrader\.com' && forwardedProto === 'http'/);
  assert.match(source, /Location: 'https:\/\/acgtrader\.com' \+ safePath/);
  assert.match(source, /'Cache-Control': 'no-store'/);
  assert.match(source, /upgrade-insecure-requests/);
  assert.doesNotMatch(source, /includeSubDomains|preload/, 'unverified subdomains must not be included');
});

test('real HTTP listener redirects custom-domain HTTP while preserving healthy HTTPS traffic', { timeout: 15000 }, async () => {
  // Reserve an ephemeral local port, then launch the actual Docker entry point.
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(err => err ? reject(err) : resolve()));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  try {
    const probe = (path, headers = {}) => new Promise((resolve, reject) => {
      const req = request({
        hostname: '127.0.0.1', port, path,
        headers: { Host: 'acgtrader.com', ...headers }
      }, res => {
        res.resume();
        res.once('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.setTimeout(1800, () => req.destroy(new Error('local listener timeout')));
      req.on('error', reject);
      req.end();
    });
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error('web server terminated during startup');
      try {
        const res = await probe('/health', { 'X-Forwarded-Proto': 'https' });
        ready = res.status === 200;
        if (ready) break;
      } catch { /* retry until ready */ }
      await delay(100);
    }
    assert.ok(ready, 'production listener starts and remains healthy behind Railway HTTPS');

    const secure = await probe('/health', { 'X-Forwarded-Proto': 'https' });
    assert.equal(secure.status, 200);
    assert.equal(secure.headers['strict-transport-security'], 'max-age=31536000');
    assert.ok(secure.headers['content-security-policy'].includes('upgrade-insecure-requests'));

    const insecure = await probe('/acg-landing-v6.html?view=landing', { 'X-Forwarded-Proto': 'http' });
    assert.equal(insecure.status, 308);
    assert.equal(insecure.headers.location, 'https://acgtrader.com/acg-landing-v6.html?view=landing');
    assert.equal(insecure.headers['cache-control'], 'no-store');

    const untrustedHost = await probe('/health', {
      Host: 'external.invalid',
      'X-Forwarded-Proto': 'http'
    });
    assert.equal(untrustedHost.status, 200, 'untrusted Host never controls HTTPS redirect Location');
    assert.equal(untrustedHost.headers.location, undefined);
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), delay(1500)]);
  }
});
