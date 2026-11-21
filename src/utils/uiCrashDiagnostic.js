// Local-only crash diagnostics: never transmit or persist exception details.
// React component names and sanitized JS messages are enough to locate
// a desktop render failure without exposing account, token or URL contents.
function sanitize(value, maximum = 220) {
  return String(value == null ? '' : value)
    .replace(/\b(?:https?|wss?):\/\/[^\s'")]+/gi, '[url]')
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,2}\b/g, '[token]')
    .replace(/\b(bearer|token|password|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[id]')
    .replace(/\b\d{10,}\b/g, '[number]')
    .slice(0, maximum);
}

export function uiCrashSummary(error, info) {
  const type = sanitize(error?.name || 'Error', 40).replace(/[^\w .-]/g, '');
  const message = sanitize(error?.message || error || 'Unspecified React render failure');
  const components = String(info?.componentStack || '')
    .split('\n')
    .map(line => line.match(/^\s*at\s+([A-Za-z_$][\w.$-]*)\b/)?.[1] || '')
    .filter(Boolean)
    .slice(0, 7);
  return { type, message, components };
}

export function formatUiCrashSummary(summary = {}, width = null) {
  const lines = [
    'ACG Trader client render diagnostic (no account/session data)',
    (summary.type || 'Error') + ': ' + (summary.message || 'Unknown'),
  ];
  if (Array.isArray(summary.components) && summary.components.length) {
    lines.push('Components: ' + summary.components.join(' > '));
  }
  const w = Number(width);
  if (Number.isInteger(w) && w > 0 && w < 10000) {
    lines.push('Viewport: ' + w + 'px');
  }
  return lines.join('\n');
}
