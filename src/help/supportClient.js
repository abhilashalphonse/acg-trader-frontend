// Text-only integration with ACG Funded's existing support conversations.
// Trader federation tokens are NOT Funded customer auth tokens. Until a vetted
// cross-service identity handoff exists, use a random anonymous support session.
const DEFAULT_SUPPORT_API = 'https://funded-backend-production.up.railway.app';
const SESSION_KEY = 'acg-trader-support-session-v1';
const MAX_CHARS = 3000;

export const REPORT_CATEGORIES = Object.freeze([
  'Charts & Market Data', 'Orders & Execution', 'Positions & P&L',
  'Account & Risk', 'Interface & Display', 'Other',
]);

function clean(value, maximum = 500) {
  return String(value ?? '').replace(/[\\u0000-\\u001f\\u007f]/g, ' ').trim().slice(0, maximum);
}

export function makeReportText({ kind, category, description, expected = '', context = null }) {
  const heading = kind === 'bug' ? 'ACG TRADER BUG REPORT' : kind === 'feedback' ? 'ACG TRADER FEATURE FEEDBACK' : 'ACG TRADER SUPPORT';
  const parts = [heading, 'Category: ' + clean(category, 80), 'Details: ' + clean(description, 2200)];
  if (expected) parts.push('Expected: ' + clean(expected, 380));
  if (context) {
    if (context.symbol) parts.push('Symbol: ' + clean(context.symbol, 28));
    if (context.timeframe) parts.push('Timeframe: ' + clean(context.timeframe, 12));
    parts.push('Client UTC: ' + new Date().toISOString());
    if (context.browser) parts.push('Browser: ' + clean(context.browser, 140));
    if (context.build) parts.push('Build: ' + clean(context.build, 80));
  }
  const result = parts.join('\\n');
  if (result.length > MAX_CHARS) throw new Error('Report is too long. Please shorten the description.');
  return result;
}

function supportApiBase() {
  const configured = import.meta.env?.VITE_ACG_FUNDED_SUPPORT_BASE_URL || DEFAULT_SUPPORT_API;
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !(import.meta.env?.DEV && url.hostname === 'localhost')) {
    throw new Error('Support service must use HTTPS.');
  }
  return url.toString().replace(/\\/$/, '');
}

function anonymousSession() {
  let stored = null;
  try { stored = window.sessionStorage.getItem(SESSION_KEY); } catch { /* storage disabled */ }
  if (stored && /^[a-f0-9-]{36}$/.test(stored)) return stored;
  const id = crypto.randomUUID();
  try { window.sessionStorage.setItem(SESSION_KEY, id); } catch { /* one-page support only */ }
  return id;
}

async function request(path, body) {
  const response = await fetch(supportApiBase() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-acg-support-session': anonymousSession() },
    credentials: 'omit',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) throw new Error(data.message || 'Support did not accept this request. Please try later.');
  return data.data;
}

export async function submitHelpRequest({ kind, category, description, expected, context, humanReview = false }) {
  const message = makeReportText({ kind, category, description, expected, context });
  const pageContext = 'ACG_TRADER_HELP_CENTER';
  // Never automatically retry POST after an ambiguous network failure.
  const saved = await request('/api/support/message', { message, pageContext });
  if (!saved?.conversationId) throw new Error('Support did not return a reference. Do not resubmit before checking with support.');
  if (!humanReview) return { id: saved.conversationId, status: saved.status || 'OPEN', escalated: false, answer: saved.answer || null };
  try {
    const escalated = await request('/api/support/conversations/' + encodeURIComponent(saved.conversationId) + '/escalate', {
      reason: kind === 'bug' ? 'TRADER_BUG_REPORT' : 'TRADER_FEEDBACK',
    });
    return { id: saved.conversationId, status: escalated.status || 'ESCALATED', escalated: escalated.status === 'ESCALATED' };
  } catch {
    // User's message is persisted: do not discard the reference or POST again.
    return { id: saved.conversationId, status: saved.status || 'OPEN', escalated: false, followUpNeeded: true };
  }
}

export async function requestHumanSupport(conversationId) {
  if (!conversationId || !/^[a-f0-9-]{36}$/i.test(String(conversationId))) throw new Error('Invalid support reference.');
  return request('/api/support/conversations/' + encodeURIComponent(conversationId) + '/escalate', { reason: 'CUSTOMER_REQUESTED' });
}
