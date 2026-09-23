const STORAGE_PREFIX = 'acg-trader-drawings-v3';
const LEGACY_STORAGE_PREFIX = 'acg-trader-drawings-v2';
const KNOWN_TIMEFRAMES = ['S1','S5','S15','S30','M1','M5','M15','M30','H1','H4','D1','W1','1s','5s','15s','30s','1m','5m','15m','30m','1H','4H','1D','1W'];

const DEFAULT_STYLE = {
  color: '#53c7ff',
  width: 1.4,
  dash: 'solid',
  fillOpacity: 0.07,
};

const TOOL_DEFAULTS = {
  hline: { color: '#f0c35c' },
  vline: { color: '#f0c35c' },
  fibonacci: { color: '#b78cff' },
  text: { color: '#d8e4ee', width: 1 },
  'long-position': { color: '#35d79d' },
  'short-position': { color: '#ff6673' },
};

const stores = new Map();
const listeners = new Map();

const symbolKey = symbol => String(symbol || '').toUpperCase();
const storageKey = symbol => `${STORAGE_PREFIX}:${symbolKey(symbol)}`;
const legacyStorageKey = (symbol, timeframe) => `${LEGACY_STORAGE_PREFIX}:${symbolKey(symbol)}:${timeframe}`;

export function normalizeDrawing(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.type || !raw.a) return null;
  return {
    ...raw,
    b: raw.b || raw.a,
    text: raw.text || '',
    locked: raw.locked === true,
    hidden: raw.hidden === true,
    timeframeVisibility: raw.timeframeVisibility || 'all',
    riskTarget: raw.riskTarget ? { ...raw.riskTarget } : null,
    riskPercent: Number.isFinite(Number(raw.riskPercent)) ? Number(raw.riskPercent) : null,
    style: {
      ...DEFAULT_STYLE,
      ...(TOOL_DEFAULTS[raw.type] || {}),
      ...(raw.style || {}),
    },
  };
}

export function cloneDrawings(items = []) {
  return items.map(item => ({
    ...item,
    a: item.a ? { ...item.a } : item.a,
    b: item.b ? { ...item.b } : item.b,
    style: { ...(item.style || {}) },
    timeframeVisibility: Array.isArray(item.timeframeVisibility) ? [...item.timeframeVisibility] : item.timeframeVisibility,
    riskTarget: item.riskTarget ? { ...item.riskTarget } : item.riskTarget,
  }));
}

function dedupeDrawings(items) {
  const byId = new Map();
  items.map(normalizeDrawing).filter(Boolean).forEach(item => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
}

function loadPersistentDrawings(symbol) {
  if (typeof window === 'undefined') return [];
  const currentKey = storageKey(symbol);
  let current = [];
  let changed = false;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(currentKey) || '[]');
    if (Array.isArray(parsed)) current = parsed.map(normalizeDrawing).filter(Boolean);
  } catch {
    current = [];
  }

  const legacy = [];
  for (const timeframe of KNOWN_TIMEFRAMES) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(legacyStorageKey(symbol, timeframe)) || '[]');
      if (Array.isArray(parsed) && parsed.length) legacy.push(...parsed);
    } catch {
      // Ignore one corrupt legacy timeframe and continue recovering the others.
    }
  }

  const merged = dedupeDrawings([...current, ...legacy]);
  if (merged.length !== current.length) changed = true;

  if (changed || (!current.length && merged.length)) {
    try { window.localStorage.setItem(currentKey, JSON.stringify(merged)); } catch { /* persistence is best effort */ }
  }

  return merged;
}

function persist(symbol, drawings) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(symbol), JSON.stringify(drawings)); } catch { /* persistence is best effort */ }
}

function ensure(symbol) {
  const key = symbolKey(symbol);
  if (!stores.has(key)) {
    stores.set(key, {
      past: [],
      present: loadPersistentDrawings(key),
      future: [],
      revision: 0,
    });
  }
  return stores.get(key);
}

function emit(symbol) {
  const key = symbolKey(symbol);
  listeners.get(key)?.forEach(listener => listener());
}

function replaceState(symbol, next, { persistPresent = true } = {}) {
  const key = symbolKey(symbol);
  stores.set(key, { ...next, revision: (next.revision || 0) + 1 });
  if (persistPresent) persist(key, next.present);
  emit(key);
}

export function getDrawingSnapshot(symbol) {
  return ensure(symbol);
}

export function subscribeDrawings(symbol, listener) {
  const key = symbolKey(symbol);
  ensure(key);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
  return () => {
    const set = listeners.get(key);
    set?.delete(listener);
    if (set?.size === 0) listeners.delete(key);
  };
}

export function commitDrawings(symbol, next) {
  const current = ensure(symbol);
  const present = typeof next === 'function' ? next(cloneDrawings(current.present)) : next;
  const normalized = dedupeDrawings(Array.isArray(present) ? present : []);
  replaceState(symbol, {
    past: [...current.past.slice(-99), cloneDrawings(current.present)],
    present: normalized,
    future: [],
    revision: current.revision,
  });
}

export function replaceDrawingsLive(symbol, nextPresent) {
  const current = ensure(symbol);
  const normalized = dedupeDrawings(Array.isArray(nextPresent) ? nextPresent : []);
  replaceState(symbol, {
    ...current,
    present: normalized,
  }, { persistPresent: false });
}

export function commitLiveDrawingTransaction(symbol, before) {
  const current = ensure(symbol);
  replaceState(symbol, {
    past: [...current.past.slice(-99), cloneDrawings(before || [])],
    present: cloneDrawings(current.present),
    future: [],
    revision: current.revision,
  });
}

export function undoDrawings(symbol) {
  const current = ensure(symbol);
  if (!current.past.length) return false;
  const previous = current.past[current.past.length - 1];
  replaceState(symbol, {
    past: current.past.slice(0, -1),
    present: cloneDrawings(previous),
    future: [cloneDrawings(current.present), ...current.future.slice(0, 99)],
    revision: current.revision,
  });
  return true;
}

export function redoDrawings(symbol) {
  const current = ensure(symbol);
  if (!current.future.length) return false;
  const next = current.future[0];
  replaceState(symbol, {
    past: [...current.past.slice(-99), cloneDrawings(current.present)],
    present: cloneDrawings(next),
    future: current.future.slice(1),
    revision: current.revision,
  });
  return true;
}

export function patchDrawing(symbol, id, patch) {
  commitDrawings(symbol, current => current.map(item => item.id === id ? {
    ...item,
    ...patch,
    style: patch?.style ? { ...item.style, ...patch.style } : item.style,
  } : item));
}

export function removeDrawing(symbol, id) {
  commitDrawings(symbol, current => current.filter(item => item.id !== id));
}

export function visibleDrawingOnTimeframe(drawing, timeframe) {
  if (!drawing || drawing.hidden) return false;
  const visibility = drawing.timeframeVisibility || 'all';
  if (visibility === 'all') return true;
  if (Array.isArray(visibility)) return visibility.includes(timeframe);
  return visibility === timeframe;
}
