import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  buildPositionShareModel,
  downloadPositionShare,
  renderPositionSharePng,
  sharePositionPnl,
} from '../../utils/positionShare.js';
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  const handleSave = () => {
    if (!blob) return;
    downloadPositionShare(blob, model);
  };

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

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden bg-black sm:grid sm:place-items-center sm:bg-black/85 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share position P&L"
    >
      <button type="button" className="absolute inset-0 hidden sm:block" onClick={onClose} aria-label="Close share preview" />

      <section className="relative z-10 flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-black sm:h-[min(92dvh,900px)] sm:max-w-[460px] sm:rounded-lg sm:border sm:border-white/[0.10]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <div className="min-w-0">
            <b className="block text-[12px] font-black text-[#f5f5f5]">Share position P&amp;L</b>
            <span className="mt-0.5 block truncate text-[8px] text-[#737373]">
              ACG Trader · {profile.shareTemplate === 'PHOTO' && profile.sharePhotoDataUrl ? 'Photo' : 'Performance'} template
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#a3a3a3]"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-3">
          <div className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-[#050505] shadow-[0_20px_60px_rgba(0,0,0,.55)]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={model.symbol + ' ' + model.side + ' unrealized P&L share card'}
                className="block h-auto max-h-full w-auto max-w-full object-contain"
              />
            ) : (
              <div className="grid h-full min-h-[300px] w-full place-items-center text-[10px] text-[#737373]">
                {busy || profileLoading ? 'Generating share image…' : 'Preview unavailable'}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-3 mb-2 shrink-0 rounded-md border border-[#642832] bg-black px-3 py-2 text-[9px] text-[#ff7a86]">
            {error}
          </div>
        )}

        <footer className="shrink-0 border-t border-white/[0.08] bg-black px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!blob || busy}
              onClick={handleSave}
              className="flex h-12 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-white/[0.10] bg-[#080808] px-3 text-[10px] font-bold text-[#f5f5f5] disabled:opacity-40"
            >
              <Download size={15} className="shrink-0" />
              <span className="truncate">Save PNG</span>
            </button>

            <button
              type="button"
              disabled={!blob || busy}
              onClick={handleShare}
              className="flex h-12 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-[#236b8b] bg-[#05090c] px-3 text-[10px] font-black text-[#53c7ff] disabled:opacity-40"
            >
              <Share2 size={15} className="shrink-0" />
              <span className="truncate">Share</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
