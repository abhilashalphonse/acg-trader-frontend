import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  buildDefaultWatchlists,
  normalizeWatchlistWorkspace,
} from '../src/hooks/useWatchlists.js';

const catalog = symbols => symbols.map(symbol => ({ symbol }));

test('default favorites use the intended launch watchlist when symbols exist', () => {
  const lists = buildDefaultWatchlists(catalog([...DEFAULT_WATCHLIST_SYMBOLS, 'AUDUSD', 'XAGUSD']));
  assert.deepEqual(lists[0].symbols, DEFAULT_WATCHLIST_SYMBOLS);
  assert.ok(lists.find(item => item.id === 'fx-majors').symbols.includes('AUDUSD'));
  assert.ok(lists.find(item => item.id === 'metals').symbols.includes('XAGUSD'));
});

test('workspace normalization removes unavailable and duplicate symbols', () => {
  const workspace = normalizeWatchlistWorkspace({
    activeListId: 'favorites',
    lists: [{ id: 'favorites', name: 'Favorites', symbols: ['EURUSD', 'EURUSD', 'BAD', 'XAUUSD'] }],
  }, catalog(['EURUSD', 'XAUUSD']));
  assert.deepEqual(workspace.lists[0].symbols, ['EURUSD', 'XAUUSD']);
  assert.equal(workspace.activeListId, 'favorites');
});

test('workspace normalization repairs an invalid active list id', () => {
  const workspace = normalizeWatchlistWorkspace({
    activeListId: 'missing',
    lists: [{ id: 'one', name: 'One', symbols: ['EURUSD'] }],
  }, catalog(['EURUSD']));
  assert.equal(workspace.activeListId, 'one');
});
