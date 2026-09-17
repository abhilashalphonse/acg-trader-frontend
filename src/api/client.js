import { traderConfig } from './config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null, requestId = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function buildUrl(path, query) {
  const url = new URL(path.startsWith('/') ? `${traderConfig.apiBase}${path}` : `${traderConfig.apiBase}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) url.searchParams.set(key, value.join(','));
      else url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function combineAbortSignals(signal, timeoutMs) {
  const controller = new AbortController();
  let timeoutId = null;

  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener?.('abort', abort, { once: true });

  timeoutId = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId) window.clearTimeout(timeoutId);
      signal?.removeEventListener?.('abort', abort);
    },
  };
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text ? { message: text } : null;
}

export async function apiRequest(path, {
  method = 'GET',
  token = null,
  query = null,
  body = undefined,
  headers = {},
  signal = null,
  timeoutMs = traderConfig.requestTimeoutMs,
} = {}) {
  const abort = combineAbortSignals(signal, timeoutMs);
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
      credentials: 'include',
    });
  } catch (error) {
    abort.cleanup();
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    throw new ApiError(timedOut ? 'Request timed out' : 'Unable to reach ACG Trader backend', {
      code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      cause: error,
    });
  }

  let payload;
  try {
    payload = await parseBody(response);
  } catch (error) {
    abort.cleanup();
    throw new ApiError('Backend returned an unreadable response', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      requestId: response.headers.get('x-request-id'),
      cause: error,
    });
  }
  abort.cleanup();

  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.code || 'REQUEST_FAILED',
      details: payload?.details ?? null,
      requestId: response.headers.get('x-request-id'),
    });
  }

  return payload;
}
