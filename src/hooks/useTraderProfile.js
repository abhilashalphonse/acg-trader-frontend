import { useCallback, useEffect, useState } from 'react';
import { profileApi } from '../api/profile.js';
import { useTraderAuth } from './useTraderAuth.js';

const DEFAULT_PROFILE = Object.freeze({
  displayName: 'Trader',
  sharePhotoDataUrl: null,
  shareTemplate: 'PERFORMANCE',
  updatedAt: null,
});

export function useTraderProfile() {
  const auth = useTraderAuth();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(Boolean(auth.accessToken));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async signal => {
    if (!auth.accessToken) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return DEFAULT_PROFILE;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await profileApi.get(auth.accessToken, signal);
      const next = { ...DEFAULT_PROFILE, ...(response?.profile || {}) };
      setProfile(next);
      return next;
    } catch (nextError) {
      if (nextError?.name !== 'AbortError') setError(nextError);
      throw nextError;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [auth.accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [reload]);

  const save = useCallback(async nextProfile => {
    if (!auth.accessToken) throw new Error('Trading session is not authenticated');
    setSaving(true);
    setError(null);
    try {
      const response = await profileApi.update(auth.accessToken, nextProfile);
      const next = { ...DEFAULT_PROFILE, ...(response?.profile || {}) };
      setProfile(next);
      return next;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setSaving(false);
    }
  }, [auth.accessToken]);

  return { profile, loading, saving, error, reload, save };
}
