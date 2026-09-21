import { normalizeCandle, normalizeCandleSeries } from './candleNormalization.js';

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function mergeProviderVolume(previous, live) {
  const previousProvider = positive(previous?.providerVolume);
  const liveProvider = positive(live?.providerVolume);
  const existingBaseline = nonNegative(previous?.providerVolumeBaseline);
  const existingAnchor = nonNegative(previous?.providerVolumeLiveAnchor);

  if (
    liveProvider != null
    && nonNegative(live?.providerVolumeBaseline) != null
    && nonNegative(live?.providerVolumeLiveAnchor) != null
  ) {
    return {
      providerVolume: liveProvider,
      providerVolumeBaseline: nonNegative(live.providerVolumeBaseline),
      providerVolumeLiveAnchor: nonNegative(live.providerVolumeLiveAnchor),
    };
  }

  if (existingBaseline != null && existingAnchor != null && liveProvider != null) {
    if (liveProvider < existingAnchor) {
      return {
        providerVolume: previousProvider,
        providerVolumeBaseline: previousProvider ?? existingBaseline,
        providerVolumeLiveAnchor: liveProvider,
      };
    }
    const providerVolume = existingBaseline + Math.max(0, liveProvider - existingAnchor);
    return {
      providerVolume,
      providerVolumeBaseline: existingBaseline,
      providerVolumeLiveAnchor: existingAnchor,
    };
  }

  if (previousProvider != null && liveProvider != null) {
    return {
      providerVolume: previousProvider,
      providerVolumeBaseline: previousProvider,
      providerVolumeLiveAnchor: liveProvider,
    };
  }

  if (liveProvider != null) {
    return {
      providerVolume: liveProvider,
      providerVolumeBaseline: 0,
      providerVolumeLiveAnchor: 0,
    };
  }

  return {
    providerVolume: previousProvider,
    providerVolumeBaseline: existingBaseline,
    providerVolumeLiveAnchor: existingAnchor,
  };
}

function authoritativeVolume(previous, live, tickCount) {
  const mode = live?.volumeMode || previous?.volumeMode || null;
  if (!mode) return null;

  if (mode === 'unavailable') {
    return { mode, volume: null, displayVolume: null, volumeSource: 'unavailable' };
  }

  // Trust displayVolume only when the live candle explicitly carries the same
  // backend-selected mode. A pre-history websocket fragment has no mode yet.
  if (live?.volumeMode === mode) {
    return {
      mode,
      volume: nonNegative(live.displayVolume),
      displayVolume: nonNegative(live.displayVolume),
      volumeSource: live.volumeSource || mode,
    };
  }

  if (mode === 'tick') {
    const volume = nonNegative(live?.tickCount) ?? tickCount ?? nonNegative(previous?.tickCount);
    return { mode, volume, displayVolume: volume, volumeSource: volume == null ? 'unavailable' : 'tick' };
  }

  // For provider mode, retain the REST/history baseline until the backend
  // starts emitting reconciled displayVolume for this candle.
  const volume = nonNegative(previous?.displayVolume) ?? nonNegative(previous?.volume);
  return { mode, volume, displayVolume: volume, volumeSource: volume == null ? 'unavailable' : 'provider' };
}

export function mergeLiveCandleIntoSeries(series = [], bar, outputsize = 500) {
  const normalized = normalizeCandle(bar);
  const bars = normalizeCandleSeries(series);
  if (!normalized) return bars.slice(-outputsize);

  const last = bars[bars.length - 1];
  if (last?.time === normalized.time) {
    const tickCount = Math.max(
      nonNegative(last.tickCount) ?? 0,
      nonNegative(normalized.tickCount) ?? 0,
    );
    const authoritative = authoritativeVolume(last, normalized, tickCount);

    if (authoritative) {
      bars[bars.length - 1] = {
        ...last,
        ...normalized,
        open: last.open,
        high: Math.max(last.high, normalized.high, normalized.open, normalized.close),
        low: Math.min(last.low, normalized.low, normalized.open, normalized.close),
        close: normalized.close,
        providerVolume: normalized.providerVolume ?? last.providerVolume,
        tickCount,
        displayVolume: authoritative.displayVolume,
        volumeMode: authoritative.mode,
        volume: authoritative.volume,
        volumeSource: authoritative.volumeSource,
        complete: false,
        synthetic: Boolean(last.synthetic && normalized.synthetic),
      };
    } else {
      // Compatibility path for an older backend during rollout/rollback.
      const provider = mergeProviderVolume(last, normalized);
      const providerVolume = positive(provider.providerVolume);
      const hasTicks = tickCount > 0;
      const volume = providerVolume ?? (hasTicks ? tickCount : 0);
      const volumeSource = providerVolume != null ? 'provider' : hasTicks ? 'tick' : null;

      bars[bars.length - 1] = {
        ...last,
        ...normalized,
        open: last.open,
        high: Math.max(last.high, normalized.high, normalized.open, normalized.close),
        low: Math.min(last.low, normalized.low, normalized.open, normalized.close),
        close: normalized.close,
        providerVolume: provider.providerVolume,
        providerVolumeBaseline: provider.providerVolumeBaseline,
        providerVolumeLiveAnchor: provider.providerVolumeLiveAnchor,
        tickCount,
        volume,
        volumeSource,
        complete: false,
        synthetic: Boolean(last.synthetic && normalized.synthetic),
      };
    }
  } else if (!last || normalized.time > last.time) {
    const inheritedMode = normalized.volumeMode || last?.volumeMode || null;
    if (inheritedMode && !normalized.volumeMode) {
      const volume = inheritedMode === 'tick'
        ? nonNegative(normalized.tickCount)
        : inheritedMode === 'provider'
          ? nonNegative(normalized.providerVolume)
          : null;
      bars.push({
        ...normalized,
        displayVolume: volume,
        volumeMode: inheritedMode,
        volume,
        volumeSource: volume == null ? 'unavailable' : inheritedMode,
      });
    } else if (inheritedMode) {
      bars.push(normalized);
    } else {
      const providerVolume = positive(normalized.providerVolume);
      bars.push({
        ...normalized,
        providerVolumeBaseline: providerVolume != null ? 0 : null,
        providerVolumeLiveAnchor: providerVolume != null ? 0 : null,
      });
    }
  }

  return bars.slice(-outputsize);
}
