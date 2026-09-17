const DEFAULT_API_BASE = 'http://localhost:4000';
const DEFAULT_WS_PATH = '/v1/ws';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeApiBase(value) {
  const candidate = trimTrailingSlash(value || DEFAULT_API_BASE);
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return trimTrailingSlash(url.toString());
  } catch {
    throw new Error(`Invalid VITE_ACG_TRADER_API_BASE: ${candidate}`);
  }
}

function deriveWebSocketUrl(apiBase, configured) {
  if (configured) {
    try {
      const url = new URL(configured);
      if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('unsupported protocol');
      return url.toString();
    } catch {
      throw new Error(`Invalid VITE_ACG_TRADER_WS_URL: ${configured}`);
    }
  }

  const url = new URL(apiBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = DEFAULT_WS_PATH;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export const traderConfig = Object.freeze({
  apiBase: normalizeApiBase(import.meta.env.VITE_ACG_TRADER_API_BASE),
  wsUrl: deriveWebSocketUrl(
    normalizeApiBase(import.meta.env.VITE_ACG_TRADER_API_BASE),
    import.meta.env.VITE_ACG_TRADER_WS_URL,
  ),
  requestTimeoutMs: Math.max(1000, Number(import.meta.env.VITE_ACG_TRADER_HTTP_TIMEOUT_MS) || 10000),
});

export const SESSION_STORAGE_KEY = 'acg-trader-session-v1';
