import React, { useState } from 'react';
import { X } from 'lucide-react';
import TradeSection from './TradeSection.jsx';
import HistorySection from './HistorySection.jsx';

function money(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: numeric > 0 ? 'always' : 'auto',
    }).format(numeric);
  } catch {
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

export default function MobileTradesSheet({
  onClose = () => {},
  account = {},
  positions = [],
  pendingOrders = [],
  positionHistory = [],
  journal = [],
  markets = [],
  onOpenChart = () => {},
  onClosePosition = () => {},
  onCloseAll = () => {},
  onCancelPending = () => {},
  onModifyPending = () => {},
  onUpdatePosition = async () => false,
  onBreakEven = async () => false,
  onNotice = () => {},
}) {
  const [tab, setTab] = useState('open');
  const pnl = Number(account?.floatingPnl);
  const pnlTone = pnl > 0 ? 'text-[#31d79b]' : pnl < 0 ? 'text-[#ff6975]' : 'text-[#a7b2bc]';

  const openChart = symbol => {
    onClose();
    onOpenChart(symbol);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onPointerDown={onClose}>
      <section
        onPointerDown={event => event.stopPropagation()}
        className="mb-[max(8px,env(safe-area-inset-bottom))] flex h-[84dvh] w-full max-w-[444px] min-h-0 flex-col overflow-hidden rounded-t-[18px] border border-white/[0.08] bg-black shadow-[0_30px_90px_rgba(0,0,0,.7)]"
      >
        <header className="shrink-0 border-b border-white/[0.06] bg-[#080808] px-3 pt-3">
          <div className="flex items-start justify-between gap-3 pb-2.5">
            <div>
              <h2 className="text-[17px] font-black tracking-[-0.035em] text-[#f3f7fb]">Trades</h2>
              <p className="mt-0.5 text-[9px] text-[#667b8e]">Positions, pending orders and executed history.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="block text-[7.5px] font-bold uppercase tracking-[0.09em] text-[#616f7b]">P&amp;L</span>
                <b className={`mt-1 block font-mono text-[10px] font-black tabular-nums ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</b>
              </div>
              <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md border border-white/[0.06] bg-[#101010] text-[#91a0ad]" aria-label="Close trades"><X size={15}/></button>
            </div>
          </div>

          <div className="grid grid-cols-3">
            {[
              ['open', `Open ${positions.length}`],
              ['pending', `Pending ${pendingOrders.length}`],
              ['history', 'History'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative h-10 text-[9px] font-black uppercase tracking-[0.07em] ${tab === id ? 'text-[#e8f2f8]' : 'text-[#62778a]'}`}
              >
                {label}
                {tab === id && <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#53c7ff]" />}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tab === 'open' && (
            <TradeSection
              embedded
              view="open"
              account={account}
              positions={positions}
              pendingOrders={pendingOrders}
              markets={markets}
              onOpenChart={openChart}
              onClosePosition={onClosePosition}
              onCloseAll={onCloseAll}
              onCancelPending={onCancelPending}
              onModifyPending={onModifyPending}
              onUpdatePosition={onUpdatePosition}
              onBreakEven={onBreakEven}
            />
          )}

          {tab === 'pending' && (
            <TradeSection
              embedded
              view="pending"
              account={account}
              positions={positions}
              pendingOrders={pendingOrders}
              markets={markets}
              onOpenChart={openChart}
              onClosePosition={onClosePosition}
              onCloseAll={onCloseAll}
              onCancelPending={onCancelPending}
              onModifyPending={onModifyPending}
              onUpdatePosition={onUpdatePosition}
              onBreakEven={onBreakEven}
            />
          )}

          {tab === 'history' && (
            <HistorySection
              embedded
              positionHistory={positionHistory}
              journal={journal}
              markets={markets}
              accountCurrency={account?.currency || 'USD'}
              onOpenChart={openChart}
              onNotice={onNotice}
            />
          )}
        </div>
      </section>
    </div>
  );
}
