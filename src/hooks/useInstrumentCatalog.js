import { useEffect, useMemo, useState } from 'react';
import { marketApi } from '../api/market.js';

function normalizeInstrument(item) {
  if (!item?.symbol) return null;
  return {
    ...item,
    symbol: String(item.symbol).toUpperCase(),
    displaySymbol: item.displaySymbol || item.symbol,
    digits: Number.isFinite(Number(item.digits)) ? Number(item.digits) : 5,
    tickSize: item.tickSize == null ? null : Number(item.tickSize),
    pipSize: item.pipSize == null ? null : Number(item.pipSize),
    minVolume: item.minVolume == null ? null : Number(item.minVolume),
    maxVolume: item.maxVolume == null ? null : Number(item.maxVolume),
    volumeStep: item.volumeStep == null ? null : Number(item.volumeStep),
    sessionOpen: item.sessionOpen === true,
  };
}

export function useInstrumentCatalog() {
  const [state, setState] = useState({ instruments: [], loading: true, error: null, asOf: null });

  useEffect(() => {
    const controller = new AbortController();
    void marketApi.instruments(controller.signal).then(response => {
      if (controller.signal.aborted) return;
      const instruments = (response?.instruments || []).map(normalizeInstrument).filter(Boolean);
      setState({ instruments, loading: false, error: null, asOf: response?.asOf || null });
    }).catch(error => {
      if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error }));
    });
    return () => controller.abort();
  }, []);

  const bySymbol = useMemo(() => Object.fromEntries(state.instruments.map(item => [item.symbol, item])), [state.instruments]);
  return { ...state, bySymbol };
}
