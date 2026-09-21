import { normalizeCandle, normalizeCandleSeries } from './candleNormalization.js';

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegative(value) {
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

export function mergeLiveCandleIntoSeries(series = [], bar, outputsize = 500) {
  const normalized = normalizeCandle(bar);
  const bars = normalizeCandleSeries(series);
  if (!normalized) return bars.slice(-outputsize);

  const last = bars[bars.length - 1];
  if (last?.time === normalized.time) {
    const provider = mergeProviderVolume(last, normalized);
    const tickCount = Math.max(
      nonNegative(last.tickCount) ?? 0,
      nonNegative(normalized.tickCount) ?? 0,
    );
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
  } else if (!last || normalized.time > last.time) {
    const providerVolume = positive(normalized.providerVolume);
    bars.push({
      ...normalized,
      providerVolumeBaseline: providerVolume != null ? 0 : null,
      providerVolumeLiveAnchor: providerVolume != null ? 0 : null,
    });
  }

  return bars.slice(-outputsize);
}
