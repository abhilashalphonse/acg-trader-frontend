import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { SESSION_STORAGE_KEY } from '../api/config.js';

export const AuthContext = createContext(null);

const REFRESH_EARLY_MS = 2 * 60 * 1000;
const WAKE_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const NETWORK_RETRY_MS = 15 * 1000;

function sessionFromAuthResponse(response) {
  if (!response?.accessToken || !response?.expiresAt || !response?.session) {
    throw new ApiError('Authentication response is missing session data', { code: 'INVALID_AUTH_RESPONSE' });
  }
  return {
    accessToken: response.accessToken,
    expiresAt: response.expiresAt,
    refreshExpiresAt: response.refreshExpiresAt || null,
    principal: {
      sessionId: response.session.id,
      tenantId: response.session.tenantId,
      ownerExternalRef: response.session.ownerExternalRef ?? null,
      accountIds: Array.isArray(response.session.accountIds) ? response.session.accountIds.map(String) : [],
      authMethod: response.session.authMethod,
      expiresAt: response.expiresAt,
      refreshExpiresAt: response.refreshExpiresAt || null,
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

function readLegacyStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearLegacyStoredSession() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* storage unavailable */ }
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('bootstrapping');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const sessionRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const retryTimerRef = useRef(null);

  const commitSession = useCallback(next => {
    sessionRef.current = next;
    setSession(next);
    setStatus(next ? 'authenticated' : 'anonymous');
    setError(null);
    if (next) clearLegacyStoredSession();
  }, []);

  const hardClearSession = useCallback((reason = null) => {
    sessionRef.current = null;
    setSession(null);
    setStatus('anonymous');
    setError(reason ? (reason instanceof Error ? reason : new Error(String(reason))) : null);
    clearLegacyStoredSession();
  }, []);

  const markReauthRequired = useCallback(reason => {
    const current = sessionRef.current;
    if (current?.principal) {
      const next = { ...current, accessToken: null, expiresAt: null };
      sessionRef.current = next;
      setSession(next);
      setStatus('reauth-required');
      setError(reason ? (reason instanceof Error ? reason : new Error(String(reason))) : null);
      return;
    }
    hardClearSession(reason);
  }, [hardClearSession]);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const scheduleRetry = () => {
      if (typeof window === 'undefined' || retryTimerRef.current) return;
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void refreshSession().catch(() => {});
      }, NETWORK_RETRY_MS);
    };

    const task = (async () => {
      setRefreshing(true);
      const legacyAccessToken = sessionRef.current?.accessToken || readLegacyStoredSession()?.accessToken || null;

      let response;
      try {
        response = await authApi.refresh(legacyAccessToken);
      } catch (firstError) {
        if (firstError?.status === 401) {
          // A second tab may have rotated the shared refresh cookie a moment
          // earlier. Retry once so the browser can apply that Set-Cookie first.
          await sleep(220);
          try {
            response = await authApi.refresh(legacyAccessToken);
          } catch (secondError) {
            if (secondError?.status === 401) {
              markReauthRequired(secondError);
              throw secondError;
            }
            setError(secondError);
            scheduleRetry();
            throw secondError;
          }
        } else {
          setError(firstError);
          scheduleRetry();
          throw firstError;
        }
      }

      const next = sessionFromAuthResponse(response);
      commitSession(next);
      return next;
    })().finally(() => {
      setRefreshing(false);
      refreshPromiseRef.current = null;
    });

    refreshPromiseRef.current = task;
    return task;
  }, [commitSession, markReauthRequired]);

  const exchangeTicket = useCallback(async ticket => {
    setStatus('authenticating');
    setError(null);
    try {
      const response = await authApi.exchangeFederationTicket(ticket);
      const next = sessionFromAuthResponse(response);
      commitSession(next);
      return next;
    } catch (nextError) {
      hardClearSession(nextError);
      throw nextError;
    }
  }, [commitSession, hardClearSession]);

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
    const token = sessionRef.current?.accessToken || null;
    hardClearSession(null);
    try {
      await authApi.logout(token);
    } catch {
      // Local logout is immediate. Server-side revocation will normally
      // succeed, but the UI should not trap a user when the network is down.
    }
  }, [hardClearSession]);

  const refreshPrincipal = useCallback(async () => {
    let token = sessionRef.current?.accessToken || null;
    if (!token) {
      const renewed = await refreshSession();
      token = renewed?.accessToken || null;
    }
    if (!token) return null;

    try {
      const response = await authApi.me(token);
      const principal = response?.principal;
      if (!principal) throw new ApiError('Session response is missing principal data', { code: 'INVALID_AUTH_RESPONSE' });
      const current = sessionRef.current;
      const next = {
        ...current,
        expiresAt: principal.expiresAt || current?.expiresAt || null,
        refreshExpiresAt: principal.refreshExpiresAt || current?.refreshExpiresAt || null,
        principal,
      };
      commitSession(next);
      return principal;
    } catch (nextError) {
      if (nextError?.status === 401) {
        const renewed = await refreshSession();
        return renewed?.principal || null;
      }
      setError(nextError);
      throw nextError;
    }
  }, [commitSession, refreshSession]);

  const invalidateSession = useCallback((reason = null) => {
    markReauthRequired(reason || new Error('Trading session needs authentication'));
  }, [markReauthRequired]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        const ticket = federationTicketFromUrl();
        if (ticket) {
          clearFederationTicketFromUrl();
          try {
            const response = await authApi.exchangeFederationTicket(ticket, controller.signal);
            if (controller.signal.aborted) return;
            commitSession(sessionFromAuthResponse(response));
          } catch (nextError) {
            if (controller.signal.aborted) return;
            hardClearSession(nextError);
          }
          return;
        }

        const legacy = readLegacyStoredSession();
        try {
          const response = await authApi.refresh(legacy?.accessToken || null, controller.signal);
          if (controller.signal.aborted) return;
          commitSession(sessionFromAuthResponse(response));
        } catch (nextError) {
          if (controller.signal.aborted) return;
          if (nextError?.status === 401) {
            clearLegacyStoredSession();
            setStatus('anonymous');
            setError(null);
          } else if (legacy?.accessToken && new Date(legacy.expiresAt).getTime() > Date.now()) {
            // One-time deployment compatibility: if the API is temporarily
            // unreachable, keep the still-valid legacy access session in memory.
            sessionRef.current = legacy;
            setSession(legacy);
            setStatus('authenticated');
            setError(nextError);
          } else {
            setStatus('anonymous');
            setError(nextError);
          }
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [commitSession, hardClearSession]);

  useEffect(() => {
    if (!session?.accessToken || !session?.expiresAt || status !== 'authenticated') return undefined;
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const delay = Math.max(0, expiresAtMs - Date.now() - REFRESH_EARLY_MS);
    const timer = window.setTimeout(() => {
      void refreshSession().catch(() => {});
    }, delay);
    return () => window.clearTimeout(timer);
  }, [refreshSession, session?.accessToken, session?.expiresAt, status]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshAfterWake = () => {
      const current = sessionRef.current;
      if (!current?.principal) return;
      const remaining = current.expiresAt ? new Date(current.expiresAt).getTime() - Date.now() : 0;
      if (!current.accessToken || remaining <= WAKE_REFRESH_WINDOW_MS) {
        void refreshSession().catch(() => {});
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAfterWake();
    };

    window.addEventListener('online', refreshAfterWake);
    window.addEventListener('focus', refreshAfterWake);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('online', refreshAfterWake);
      window.removeEventListener('focus', refreshAfterWake);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshSession]);

  useEffect(() => () => {
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
  }, []);

  const value = useMemo(() => ({
    accessToken: session?.accessToken || null,
    principal: session?.principal || null,
    expiresAt: session?.expiresAt || null,
    refreshExpiresAt: session?.refreshExpiresAt || null,
    authenticated: Boolean(session?.principal) && status !== 'anonymous',
    accessReady: status === 'authenticated' && Boolean(session?.accessToken),
    status,
    error,
    refreshing,
    login,
    exchangeTicket,
    logout,
    refreshPrincipal,
    refreshSession,
    invalidateSession,
  }), [
    error,
    exchangeTicket,
    invalidateSession,
    login,
    logout,
    refreshPrincipal,
    refreshSession,
    refreshing,
    session,
    status,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
