// The UI must never equate cached principal metadata with an authenticated
// session. Server validation is authoritative; local expiry is an extra guard.
export function canRenderTraderWorkspace(status, session, now = Date.now()) {
  if (status !== 'authenticated' || !session?.principal || !session?.accessToken) return false;
  if (typeof session.accessToken !== 'string') return false;
  const expires = new Date(session.expiresAt || '').getTime();
  return Number.isFinite(expires) && expires > now;
}
