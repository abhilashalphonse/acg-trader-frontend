import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { formatMobileFloatingPnl, mobilePnlTone } from '../../utils/mobileHeaderPresentation.js';

function metric(value, currency) {
  return formatMobileFloatingPnl(value, currency, false);
}

export default function MobilePnlSheet({ account = {}, onClose = () => {} }) {
  const closeRef = useRef(null);
  const currency = account?.currency || 'USD';
  const tone = mobilePnlTone(account?.floatingPnl);
  const toneClass = tone === 'profit' ? 'text-[#32ddb0]' : tone === 'loss' ? 'text-[#ff6675]' : 'text-white';

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    return () => { if (previouslyFocused?.isConnected) previouslyFocused.focus?.(); };
  }, []);

  const onKeyDown = event => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key === 'Tab') {
      // Only interactive control in this read-only breakdown is Close.
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Account profit and loss" onKeyDown={onKeyDown}
        className="w-full max-w-[460px] rounded-t-[22px] border border-b-0 border-white/[0.10] bg-[#080808] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 text-white shadow-[0_-20px_50px_rgba(0,0,0,.7)]">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#343434]" aria-hidden="true"/>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Account P&amp;L</h2>
            <p className="mt-1 text-[10px] text-[#828282]">Live account values · {currency}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close P&L breakdown" className="grid size-11 place-items-center rounded-xl text-[#aaa] active:bg-white/[0.06]">
            <X size={18}/>
          </button>
        </div>
        <div className="border-b border-white/[0.08] pb-5">
          <p className="text-[10px] font-medium text-[#8a8a8a]">Floating P&amp;L</p>
          <strong className={`mt-2 block font-mono text-[28px] font-semibold tabular-nums tracking-[-0.045em] ${toneClass}`}>{metric(account?.floatingPnl, currency)}</strong>
        </div>
        <dl className="divide-y divide-white/[0.065]">
          {[['Balance', account?.balance], ['Equity', account?.equity]].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-4">
              <dt className="text-[12px] text-[#999]">{label}</dt>
              <dd className="min-w-0 break-all text-right font-mono text-[13px] font-medium tabular-nums text-[#eee]">{metric(value, currency)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
