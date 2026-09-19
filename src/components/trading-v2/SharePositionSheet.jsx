import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  buildPositionShareModel,
  downloadPositionShare,
  formatSharePips,
  formatSharePnl,
  renderPositionSharePng,
  sharePositionPnl,
} from '../../utils/positionShare.js';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { useTraderProfile } from '../../hooks/useTraderProfile.js';

export default function SharePositionSheet({ position, instrument, onClose = () => {} }) {
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const { profile, loading: profileLoading } = useTraderProfile();
  const model = useMemo(() => buildPositionShareModel(position, instrument), [instrument, position]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (profileLoading) return undefined;
    setBusy(true);
    setError('');
    renderPositionSharePng(model, profile)
      .then(nextBlob => {
        if (cancelled) return;
        setBlob(nextBlob);
        objectUrl = URL.createObjectURL(nextBlob);
        setPreviewUrl(objectUrl);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Unable to generate image.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [model, profile, profileLoading]);

  const handleShare = async () => {
    if (!blob) return;
    setError('');
    try {
      await sharePositionPnl(blob, model);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err?.message || 'Unable to share image.');
    }
  };

  const handleSave = () => {
    if (!blob) return;
    downloadPositionShare(blob, model);
  };

  const positive = Number(model.pnl) >= 0;

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/80 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Share position P&L">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close share preview" />
      <section className="relative z-10 w-full max-w-[430px] border border-white/[0.10] bg-black sm:rounded-lg">
        <header className="flex h-12 items-center justify-between border-b border-white/[0.08] px-4">
          <div>
            <b className="block text-[12px] text-[#f5f5f5]">ACG Trader</b>
            <span className="mt-0.5 block text-[8px] text-[#737373]">Share position P&amp;L · {profile.shareTemplate === 'PHOTO' && profile.sharePhotoDataUrl ? 'Photo' : 'Performance'} template</span>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md border border-white/[0.08] text-[#a3a3a3]" aria-label="Close"><X size={14}/></button>
        </header>

        <div className="p-3">
          <div className="overflow-hidden border border-white/[0.08] bg-[#080808]">
            {previewUrl ? (
              <img src={previewUrl} alt={model.symbol + ' ' + model.side + ' unrealized P&L share card'} className="block aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/5] place-items-center text-[10px] text-[#737373]">{busy || profileLoading ? 'Generating share image…' : 'Preview unavailable'}</div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-y border-white/[0.08] py-2 text-[9px]">
            <div><span className="block text-[#737373]">Position</span><b className="mt-1 block text-[#f5f5f5]">{model.symbol} · {model.side} · {model.volume.toFixed(2)} lots</b></div>
            <div className="text-right"><span className="block text-[#737373]">{model.roiPercent == null ? 'Unrealized P&L' : 'Trading ROI'}</span><b className={'mt-1 block ' + (positive ? 'text-[#2ddb9f]' : 'text-[#ff5f6d]')}>{model.roiPercent == null ? formatSharePnl(model.pnl, model.currency) : `${model.roiPercent >= 0 ? '+' : ''}${model.roiPercent.toFixed(2)}%`}</b></div>
            <div><span className="block text-[#737373]">Entry</span><b className="mt-1 block font-mono text-[#d4d4d4]">{formatInstrumentPrice(model.entryPrice, instrument)}</b></div>
            <div className="text-right"><span className="block text-[#737373]">Current · Distance</span><b className="mt-1 block font-mono text-[#d4d4d4]">{formatInstrumentPrice(model.currentPrice, instrument)} · {formatSharePips(model.pips)}</b></div>
          </div>

          {error && <div className="mt-2 border border-[#642832] bg-black px-3 py-2 text-[9px] text-[#ff7a86]">{error}</div>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={!blob || busy} onClick={handleSave} className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-black text-[10px] font-bold text-[#d4d4d4] disabled:opacity-40"><Download size={14}/>Save PNG</button>
            <button type="button" disabled={!blob || busy} onClick={handleShare} className="acg-execution-buy flex h-10 items-center justify-center gap-2 rounded-md border bg-black text-[10px] font-black text-[#2ddb9f] disabled:opacity-40"><Share2 size={14}/>Share</button>
          </div>
        </div>
      </section>
    </div>
  );
}
