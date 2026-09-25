import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
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
  initialTab = 'open',
  readOnly = false,
}) {
  const [tab, setTab] = useState(initialTab);
  const pnl = Number(account?.floatingPnl);
  const pnlTone = pnl > 0 ? 'text-[#31d79b]' : pnl < 0 ? 'text-[#ff6975]' : 'text-[#c7ced5]';

  const openChart = symbol => {
    onClose();
    onOpenChart(symbol);
  };

  return (
    <section className="fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]">
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-16 items-center gap-2 px-3">
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-[#c4ccd4] active:bg-white/[0.06]" aria-label="Back to chart">
            <ChevronLeft size={22} strokeWidth={2}/>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-black tracking-[-0.035em] text-white">{readOnly ? 'Trade history' : 'Trades'}</h2>
              {readOnly && <span className="rounded-md border border-rose-400/20 bg-rose-400/[0.08] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-rose-300">Read-only</span>}
            </div>
            <p className="mt-0.5 truncate text-[9px] font-medium text-[#727d87]">{account?.accountCode || 'Trading account'}</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#0d0f12] px-3 py-2 text-right">
            <span className="block text-[7px] font-black uppercase tracking-[0.10em] text-[#68737e]">Floating P&amp;L</span>
            <b className={`mt-1 block font-mono text-[11px] font-black tabular-nums ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</b>
          </div>
        </div>

        <div className={readOnly ? 'grid grid-cols-1 px-3' : 'grid grid-cols-3 px-3'}>
          {(readOnly ? [['history', 'History']] : [
            ['open', `Open ${positions.length}`],
            ['pending', `Pending ${pendingOrders.length}`],
            ['history', 'History'],
          ]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative h-11 text-[10px] font-black uppercase tracking-[0.07em] ${tab === id ? 'text-white' : 'text-[#68747f]'}`}
            >
              {label}
              {tab === id && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-[#195be1]" />}
            </button>
          ))}
        </div>
      </header>

      {readOnly && (
        <div className="shrink-0 border-b border-rose-400/[0.10] bg-rose-400/[0.045] px-4 py-2.5 text-[9px] font-medium leading-4 text-[#b88f94]">
          This account is breached. Execution is disabled, but completed trading records remain available.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab === 'open' && (
          <TradeSection
            embedded
            mobilePositionLayout
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
            accountId={account?.id || null}
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
  );
}
