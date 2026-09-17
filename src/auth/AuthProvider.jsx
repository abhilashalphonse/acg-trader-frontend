import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { SESSION_STORAGE_KEY } from '../api/config.js';

export const AuthContext = createContext(null);

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function storeSession(session) {
  if (typeof window === 'undefined') return;
  if (!session) window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  else window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function sessionFromAuthResponse(response) {
  if (!response?.accessToken || !response?.expiresAt || !response?.session) {
    throw new ApiError('Authentication response is missing session data', { code: 'INVALID_AUTH_RESPONSE' });
  }
  return {
    accessToken: response.accessToken,
    expiresAt: response.expiresAt,
    principal: {
      sessionId: response.session.id,
      tenantId: response.session.tenantId,
      ownerExternalRef: response.session.ownerExternalRef ?? null,
      accountIds: Array.isArray(response.session.accountIds) ? response.session.accountIds.map(String) : [],
      authMethod: response.session.authMethod,
      expiresAt: response.expiresAt,
    },
  };
}

function federationTicketFromUrl() {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return url.searchParams.get('ticket') || url.searchParams.get('acg_ticket');
}

function clearFederationTicketFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const hadTicket = url.searchParams.has('ticket') || url.searchParams.has('acg_ticket');
  if (!hadTicket) return;
  url.searchParams.delete('ticket');
  url.searchParams.delete('acg_ticket');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('bootstrapping');
  const [error, setError] = useState(null);
  const bootstrapAbortRef = useRef(null);

  const commitSession = useCallback(next => {
    setSession(next);
    storeSession(next);
    setStatus(next ? 'authenticated' : 'anonymous');
    setError(null);
  }, []);

  const invalidateSession = useCallback((reason = null) => {
    setSession(null);
    storeSession(null);
    setStatus('anonymous');
    if (reason) setError(reason instanceof Error ? reason : new Error(String(reason)));
  }, []);

  const exchangeTicket = useCallback(async ticket => {
    setStatus('authenticating');
    setError(null);
    try {
      const response = await authApi.exchangeFederationTicket(ticket);
      const next = sessionFromAuthResponse(response);
      commitSession(next);
      return next;
    } catch (nextError) {
      invalidateSession(nextError);
      throw nextError;
    }
  }, [commitSession, invalidateSession]);

  const login = useCallback(async credentials => {
    setStatus('authenticating');
    setError(null);
    try {
      const response = await authApi.login(credentials);
      const next = sessionFromAuthResponse(response);
      commitSession(next);
      return next;
    } catch (nextError) {
      setStatus('anonymous');
      setError(nextError);
      throw nextError;
    }
  }, [commitSession]);

  const logout = useCallback(async () => {
    const token = session?.accessToken;
    commitSession(null);
    if (!token) return;
    try {
      await authApi.logout(token);
    } catch {
      // Local session revocation is authoritative for this browser even if the network is unavailable.
    }
  }, [commitSession, session?.accessToken]);

  const refreshPrincipal = useCallback(async () => {
    const token = session?.accessToken;
    if (!token) return null;
    try {
      const response = await authApi.me(token);
      const principal = response?.principal;
      if (!principal) throw new ApiError('Session response is missing principal data', { code: 'INVALID_AUTH_RESPONSE' });
      const next = { ...session, expiresAt: principal.expiresAt || session.expiresAt, principal };
      commitSession(next);
      return principal;
    } catch (nextError) {
      if (nextError?.status === 401) invalidateSession(nextError);
      else setError(nextError);
      throw nextError;
    }
  }, [commitSession, invalidateSession, session]);

  useEffect(() => {
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;

    void (async () => {
      const ticket = federationTicketFromUrl();
      if (ticket) {
        try {
          const response = await authApi.exchangeFederationTicket(ticket, controller.signal);
          if (controller.signal.aborted) return;
          commitSession(sessionFromAuthResponse(response));
        } catch (nextError) {
          if (controller.signal.aborted) return;
          invalidateSession(nextError);
        } finally {
          clearFederationTicketFromUrl();
        }
        return;
      }

      const stored = readStoredSession();
      if (!stored) {
        setStatus('anonymous');
        return;
      }

      try {
        const response = await authApi.me(stored.accessToken, controller.signal);
        if (controller.signal.aborted) return;
        const principal = response?.principal;
        if (!principal) throw new ApiError('Session response is missing principal data', { code: 'INVALID_AUTH_RESPONSE' });
        commitSession({ ...stored, expiresAt: principal.expiresAt || stored.expiresAt, principal });
      } catch (nextError) {
        if (controller.signal.aborted) return;
        invalidateSession(nextError?.status === 401 ? null : nextError);
      }
    })();

    return () => controller.abort();
  }, [commitSession, invalidateSession]);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      invalidateSession(new Error('Trading session expired'));
      return undefined;
    }
    const timer = window.setTimeout(() => invalidateSession(new Error('Trading session expired')), remaining);
    return () => window.clearTimeout(timer);
  }, [invalidateSession, session?.expiresAt]);

  const value = useMemo(() => ({
    accessToken: session?.accessToken || null,
    principal: session?.principal || null,
    expiresAt: session?.expiresAt || null,
    authenticated: status === 'authenticated' && Boolean(session?.accessToken),
    status,
    error,
    login,
    exchangeTicket,
    logout,
    refreshPrincipal,
    invalidateSession,
  }), [error, exchangeTicket, invalidateSession, login, logout, refreshPrincipal, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
