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
    contractSize: item.contractSize == null ? null : Number(item.contractSize),
    minVolume: item.minVolume == null ? null : Number(item.minVolume),
    maxVolume: item.maxVolume == null ? null : Number(item.maxVolume),
    volumeStep: item.volumeStep == null ? null : Number(item.volumeStep),
    commissionPerLot: item.commissionPerLot == null ? null : Number(item.commissionPerLot),
    commissionPerLotPerSide: item.commissionPerLotPerSide == null
      ? (item.commissionPerLot == null ? null : Number(item.commissionPerLot))
      : Number(item.commissionPerLotPerSide),
    commissionRate: item.commissionRate == null ? 0 : Number(item.commissionRate),
    spread: item.spread ? {
      ...item.spread,
      fixedPoints: item.spread.fixedPoints == null ? null : Number(item.spread.fixedPoints),
      markupPoints: item.spread.markupPoints == null ? 0 : Number(item.spread.markupPoints),
      normalPoints: item.spread.normalPoints == null ? null : Number(item.spread.normalPoints),
      minimumPoints: item.spread.minimumPoints == null ? null : Number(item.spread.minimumPoints),
      maximumPoints: item.spread.maximumPoints == null ? null : Number(item.spread.maximumPoints),
      rolloverMultiplier: item.spread.rolloverMultiplier == null ? 1 : Number(item.spread.rolloverMultiplier),
      volumeBands: Array.isArray(item.spread.volumeBands)
        ? item.spread.volumeBands.map(band => ({
            upTo: band?.upTo == null ? null : Number(band.upTo),
            extraPoints: band?.extraPoints == null ? 0 : Number(band.extraPoints),
          }))
        : [],
    } : null,
    sessionOpen: item.sessionOpen === true,
  };
}

export function useInstrumentCatalog() {
  const [state, setState] = useState({ instruments: [], allInstruments: [], loading: true, error: null, asOf: null });

  useEffect(() => {
    let disposed = false;
    let controller = null;
    let timer = null;

    const schedule = delay => {
      if (disposed) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), delay);
    };

    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const [catalogResponse, statusResponse] = await Promise.all([
          marketApi.instruments(controller.signal),
          marketApi.status(controller.signal),
        ]);
        if (disposed || controller.signal.aborted) return;
        const allInstruments = (catalogResponse?.instruments || []).map(normalizeInstrument).filter(Boolean);
        const configured = new Set((statusResponse?.symbols || []).map(item => String(item?.symbol || '').toUpperCase()).filter(Boolean));
        const instruments = allInstruments.filter(item => configured.has(item.symbol));
        setState({ instruments, allInstruments, loading: false, error: null, asOf: catalogResponse?.asOf || null });
        schedule(60000);
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        setState(current => ({ ...current, loading: false, error }));
        schedule(state.instruments.length ? 30000 : 5000);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) window.clearTimeout(timer);
        void refresh();
      }
    };

    void refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const bySymbol = useMemo(() => Object.fromEntries(state.instruments.map(item => [item.symbol, item])), [state.instruments]);
  return { ...state, bySymbol };
}
