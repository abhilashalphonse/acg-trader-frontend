import React from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { primaryConversionLeg, previewIsExecutable } from '../../utils/serverOrderPreview.js';

function money(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${number.toFixed(2)} ${currency || ''}`.trim();
  }
}

function scalar(value, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

export default function OrderPreviewConfirm({
  state,
  account = {},
  instrument = null,
  onCancel = () => {},
  onConfirm = () => {},
}) {
  if (!state) return null;

  const loading = state.status === 'loading';
  const confirming = state.status === 'confirming';
  const preview = state.preview || null;
  const request = state.request || {};
  const side = String(request.side || preview?.side || '').toUpperCase();
  const currency = preview?.accountCurrency || account?.currency || 'USD';
  const fxLeg = primaryConversionLeg(preview);
  const canConfirm = !loading && !confirming && previewIsExecutable(preview);
  const corporateActionsUnsupported = String(
    instrument?.corporateActionPolicy || state.instrument?.corporateActionPolicy || ''
  ).toUpperCase() === 'UNSUPPORTED';

  return (
    <div
      className="fixed inset-0 z-[220] grid place-items-center bg-black/75 px-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Server order preview"
      data-acg-hotkeys-suspend="true"
    >
      <section className="w-full max-w-[430px] overflow-hidden rounded-xl border border-white/[0.10] bg-[#090b0e] shadow-[0_30px_100px_rgba(0,0,0,.72)]">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div>
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6f8294]">
              <ShieldCheck size={13} className="text-[#195be1]"/>
              Server preview
            </span>
            <strong className="mt-1 block text-[15px] font-bold text-[#eef3f7]">
              {side || 'MARKET'} {request.symbol || preview?.symbol || '—'}
            </strong>
          </div>
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="grid size-8 place-items-center rounded-md text-[#718393] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            aria-label="Cancel order preview"
          >
            <X size={15}/>
          </button>
        </header>

        {loading ? (
          <div className="grid min-h-[230px] place-items-center">
            <div className="text-center">
              <Loader2 size={22} className="mx-auto animate-spin text-[#195be1]"/>
              <strong className="mt-3 block text-[11px] text-[#d8e1e8]">Calculating exact order impact</strong>
              <span className="mt-1 block text-[8px] text-[#667989]">Live quote · FX conversion · margin · risk policy</span>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Size', `${scalar(preview?.volume)} ${String(instrument?.assetClass || state.instrument?.assetClass || '').toUpperCase() === 'EQUITY' ? 'shares' : 'lot'}`],
                ['Expected fill', scalar(preview?.fillPrice)],
                ['Effective leverage', preview?.leverage?.effective ? `1:${preview.leverage.effective}` : 'Margin rate'],
                ['Required margin', money(preview?.costs?.requiredMargin, currency)],
                ['Opening cost', money(preview?.costs?.immediateOpeningPnl, currency)],
                ['Opening commission', money(preview?.costs?.openingCommission, currency)],
                ['Projected equity', money(preview?.projectedAccount?.equity, currency)],
                ['Free margin after', money(preview?.projectedAccount?.freeMargin, currency)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.06] bg-black px-3 py-2.5">
                  <span className="block text-[7px] font-semibold uppercase tracking-[0.07em] text-[#617282]">{label}</span>
                  <b className="mt-1 block truncate font-mono text-[11px] font-semibold tabular-nums text-[#e4ebf0]">{value}</b>
                </div>
              ))}
            </div>

            {fxLeg && (
              <div className="mt-3 rounded-lg border border-[#24405a] bg-[#07101a] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#67849d]">FX conversion</span>
                    <strong className="mt-1 block font-mono text-[11px] text-[#d9e8f5]">
                      {fxLeg.symbol} · {fxLeg.selectedSide} {scalar(fxLeg.quoteRate)}
                    </strong>
                  </div>
                  <span className="text-right text-[7px] leading-3 text-[#61778b]">
                    {fxLeg.quoteSource || 'live source'}<br/>
                    seq {fxLeg.quoteSequence ?? '—'}
                  </span>
                </div>
              </div>
            )}

            {corporateActionsUnsupported && (
              <div className="mt-3 rounded-lg border border-[#4b3a20] bg-[#171106] px-3 py-2 text-[8px] leading-4 text-[#c9aa70]">
                Corporate actions are not supported in this pilot. The instrument is not being presented as a corporate-action-adjusted share product.
              </div>
            )}

            <p className="mt-3 text-[7.5px] leading-4 text-[#687887]">
              This preview does not place an order. Final execution is recalculated by the server from the latest executable quote and may differ from this preview.
            </p>
          </div>
        )}

        <footer className="grid grid-cols-2 gap-2 border-t border-white/[0.07] p-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="h-10 rounded-lg border border-white/[0.08] bg-black text-[10px] font-bold text-[#91a0ad] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${
              side === 'SELL'
                ? 'border-[#71313a] bg-[#230b10] text-[#ff6f7a]'
                : 'border-[#235b49] bg-[#07170f] text-[#42d7a2]'
            }`}
          >
            {confirming && <Loader2 size={13} className="animate-spin"/>}
            {confirming ? 'Executing…' : `Confirm ${side || 'order'}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
