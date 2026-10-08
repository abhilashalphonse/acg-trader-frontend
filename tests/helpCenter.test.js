import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_ARTICLES, HELP_SECTIONS, findHelpArticles, getHelpArticle } from '../src/help/helpContent.js';
import { REPORT_CATEGORIES, makeReportText } from '../src/help/supportClient.js';

test('curated Help Center has unique IDs and agreed release counts', () => {
  assert.equal(HELP_ARTICLES.length, 45);
  assert.equal(new Set(HELP_ARTICLES.map(item => item.id)).size, 45);
  assert.deepEqual(HELP_SECTIONS.map(section => HELP_ARTICLES.filter(item => item.section === section.id).length), [5, 6, 25, 9]);
  assert.ok(HELP_ARTICLES.every(article => article.title && article.summary && Array.isArray(article.steps)));
});
test('FAQ search works with multiple terms and scoped sections', () => {
  assert.ok(findHelpArticles('stop loss').length > 0);
  assert.ok(findHelpArticles('margin', 'faq').every(item => item.section === 'faq'));
  assert.equal(findHelpArticles('this does not exist in help').length, 0);
  assert.equal(getHelpArticle('no-such-article'), null);
});
test('knowledge base does not claim unreleased India or policy features', () => {
  const articles = HELP_ARTICLES.filter(item => item.section !== 'faq');
  assert.ok(articles.every(item => !/fractional shares.*available now|news enforcement is active/i.test(item.summary)));
});
test('bug messages carry category and sanitized diagnostics', () => {
  assert.equal(REPORT_CATEGORIES.length, 6);
  const text = makeReportText({ kind: 'bug', category: 'Charts & Market Data',
    description: 'Candles freeze every minute', expected: 'Candles should advance',
    context: { symbol: 'XAUUSD', timeframe: '1m', browser: 'Test\nBrowser', build: 'abc' } });
  assert.match(text, /^ACG TRADER BUG REPORT/);
  assert.match(text, /Symbol: XAUUSD/);
  assert.match(text, /Expected: Candles should advance/);
  assert.doesNotMatch(text, /Test\nBrowser/);
});
test('feedback is distinguished from bug and remains below API limits', () => {
  const text = makeReportText({ kind: 'feedback', category: 'Feature Request', description: 'Please add keyboard hints' });
  assert.match(text, /FEATURE FEEDBACK/);
  assert.ok(text.length < 3000);
});
