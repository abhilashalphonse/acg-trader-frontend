import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Firebase Hosting protects the login and public pages against common phishing vectors', () => {
  const config = JSON.parse(source('firebase.json'));
  const headers = new Map(config.hosting.headers.flatMap(rule => rule.headers.map(h => [h.key, h.value])));
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.match(headers.get('Content-Security-Policy'), /form-action 'self'/);
  assert.match(headers.get('Content-Security-Policy'), /object-src 'none'/);
  assert.match(headers.get('Content-Security-Policy'), /base-uri 'self'/);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
});

test('account security explanation is public and has no password collector or foreign scripts', () => {
  const page = source('public/account-security.html');
  assert.match(page, /ACG-MANAGEMENT, UNIPESSOAL LDA/);
  assert.match(page, /ACG Funded/);
  assert.match(page, /Supabase authentication/);
  assert.match(page, /acg-trader\.web\.app/);
  assert.doesNotMatch(page, /<form\b|<script\b|type=["']password["']|<iframe\b/i);
});

test('each sign-in mode states the correct credentials and offers a security explanation', () => {
  const provider = source('src/components/SessionGate.jsx');
  const personal = source('src/components/StandaloneAuthPage.jsx');
  assert.match(provider, /Never enter a Google, email or banking password here/);
  assert.match(personal, /Google sign-in redirects to Google/);
  assert.match(provider, /href="\/account-security\.html"/);
  assert.match(personal, /href="\/account-security\.html"/);
});

test('public marketing does not imply demo registration is already enabled', () => {
  const landing = source('public/acg-landing-v6.html');
  assert.match(landing, /Demo \(coming soon\)/);
  assert.match(landing, /href="\/account-security\.html"/);
  assert.match(landing, /ACG-MANAGEMENT, UNIPESSOAL LDA/);
});

test('unused Firebase browser package is absent from production dependencies', () => {
  const pkg = JSON.parse(source('package.json'));
  const lock = JSON.parse(source('package-lock.json'));
  assert.ok(!Object.hasOwn(pkg.dependencies, 'firebase'));
  assert.ok(!Object.hasOwn(lock.packages[''].dependencies, 'firebase'));
  assert.ok(!Object.hasOwn(lock.packages, 'node_modules/firebase'));
});
