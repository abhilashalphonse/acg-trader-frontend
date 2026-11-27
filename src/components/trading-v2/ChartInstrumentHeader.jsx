import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock3, X } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import {
  chartMarketSession, chartSessionClock, chartSessionDuration,
} from '../../utils/chartMarketSession.js';

const CRYPTO_NAMES = Object.freeze({
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', BNB: 'BNB',
  ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche', LTC: 'Litecoin',
});
const CURRENCY_NAMES = Object.freeze({
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  AUD: 'Australian Dollar', CAD: 'Canadian Dollar', NZD: 'New Zealand Dollar',
  CHF: 'Swiss Franc',
});

export function chartInstrumentDisplayName(instrument, symbol) {
  const name = String(instrument?.name || '').trim();
  const category = String(instrument?.assetClass || '').toUpperCase();
  const base = String(instrument?.baseCurrency || '').toUpperCase();
  const quote = String(instrument?.quoteCurrency || '').toUpperCase();
  if (category === 'CRYPTO' && CRYPTO_NAMES[base] && CURRENCY_NAMES[quote]) {
    return `${CRYPTO_NAMES[base]} / ${CURRENCY_NAMES[quote]}`;
  }
  if (category === 'FOREX' && CURRENCY_NAMES[base] && CURRENCY_NAMES[quote]) {
    return `${CURRENCY_NAMES[base]} / ${CURRENCY_NAMES[quote]}`;
  }
  return name || String(instrument?.displaySymbol || symbol || 'Market');
}

const timeframeLabel = value => ({
  M1: '1', M5: '5', M15: '15', M30: '30',
  H1: '1H', H4: '4H', D1: '1D', W1: '1W',
}[String(value || '').toUpperCase()] || String(value || ''));

export default function ChartInstrumentHeader({
  instrument, symbol, timeframe, light = false, compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [position, setPosition] = useState({ top: 42, left: 12 });
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const session = useMemo(() => chartMarketSession(instrument, now), [instrument, now]);
  const name = chartInstrumentDisplayName(instrument, symbol);
  const isOpen = session.status === 'open';
  const isClosed = session.status === 'closed';
  const statusLabel = isOpen ? 'Open' : isClosed ? 'Closed'
    : session.status === 'unavailable' ? 'Unavailable' : 'Hours unavailable';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setOpen(false); }, [symbol]);

  const reposition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.min(330, Math.max(240, window.innerWidth - 16));
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8)),
      top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 315)),
    });
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    reposition();
    const onOutside = event => {
      if (!buttonRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false);
    };
    const onEscape = event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onEscape, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  const muted = light ? 'text-[#76828D]' : 'text-[#83919F]';
  const text = light ? 'text-[#141A21]' : 'text-[#E9EDF1]';
  const statusClass = isOpen
    ? (light ? 'bg-[#E1F5EE] text-[#117B61]' : 'bg-[#13382F] text-[#69D6B3]')
    : isClosed
      ? (light ? 'bg-[#ECEEF0] text-[#747C86]' : 'bg-[#2D3035] text-[#A3ABB4]')
      : (light ? 'bg-[#F0F1F2] text-[#818A94]' : 'bg-[#272B30] text-[#96A3AD]');
  const quoteNote = instrument?.isStale === true ? 'Quotes stale'
    : instrument?.marketDataAvailable === false ? 'Quotes unavailable' : null;

  return <>
    <div data-testid="chart-symbol-row" data-acg-chart-instrument-header
      className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 leading-[18px]">
      <span className="inline-flex shrink-0 items-center" aria-hidden="true">
        <InstrumentAvatar instrument={instrument || { symbol }} size={18} singleAsset/>
      </span>
      <span data-testid="chart-symbol" title={name}
        className={`min-w-0 max-w-[min(50vw,290px)] truncate text-[12px] font-semibold tracking-[-0.015em] ${text}`}>
        {name}
      </span>
      <span className={`shrink-0 text-[10px] ${muted}`}>·</span>
      <span data-testid="chart-timeframe" className={`shrink-0 text-[10px] font-medium ${muted}`}>{timeframeLabel(timeframe)}</span>
      <span className={`hidden shrink-0 text-[10px] font-medium sm:inline ${muted}`}>· ACG</span>
      {!compact && <button ref={buttonRef} type="button"
        data-acg-chart-session-button
        aria-label={`Market session: ${statusLabel}`}
        aria-haspopup="dialog" aria-expanded={open}
        onPointerDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); setNow(Date.now()); setOpen(value => !value); }}
        className={`pointer-events-auto ml-1 inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-[2px] text-[9px] font-semibold transition-colors hover:brightness-110 ${statusClass}`}>
        <span className={`size-1.5 rounded-full ${isOpen ? 'bg-[#28C59B]' : isClosed ? 'bg-[#959DA5]' : 'bg-[#6F8293]'}`}/>
        {statusLabel}
        <ChevronDown size={10} aria-hidden="true"/>
      </button>}
    </div>
    {open && typeof document !== 'undefined' && createPortal(
      <section ref={popoverRef} role="dialog" aria-label="Market session details"
        data-acg-chart-session-popover
        style={{ top: position.top, left: position.left }}
        onPointerDown={event => event.stopPropagation()}
        onMouseDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
        className="fixed z-[10060] w-[min(330px,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-[9px] border border-[#45494F] bg-[#17191D] px-4 py-3.5 text-[#E8EDF1] shadow-[0_18px_50px_rgba(0,0,0,.56)]">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${isOpen ? 'bg-[#22BE97]' : isClosed ? 'bg-[#A9B1B9]' : 'bg-[#8A96A2]'}`}/>
          <strong className="text-[12px] font-semibold">Market {statusLabel.toLowerCase()}</strong>
          <button type="button" aria-label="Close session details" onClick={() => setOpen(false)}
            className="ml-auto grid size-6 place-items-center rounded text-[#8994A1] hover:bg-white/10 hover:text-white">
            <X size={13}/>
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#C0C9D1]">
          {!session.hasPublishedHours
            ? 'Trading hours are not published for this instrument.'
            : session.isContinuous
              ? 'This market is scheduled to trade 24 hours a day, 7 days a week.'
              : isOpen
                ? session.nextAt != null
                  ? `Session scheduled to close in ${chartSessionDuration(session.nextAt - now)}.`
                  : 'This market is currently in a scheduled session.'
                : isClosed
                  ? session.nextAt != null
                    ? `Next scheduled session opens in ${chartSessionDuration(session.nextAt - now)}.`
                    : 'No upcoming session is available from the published calendar.'
                  : 'Scheduled trading hours are available below; live status is unavailable.'}
        </p>
        {session.hasPublishedHours && <div className="mt-3">
          <div className="relative h-[6px] overflow-visible rounded-full bg-[#3D4248]" aria-label="Today's scheduled trading hours">
            {session.daySegments.map((segment, index) => <span key={index} aria-hidden="true"
              className="absolute inset-y-0 rounded-full bg-[#42BDA3]"
              style={{ left: `${segment.from}%`, width: `${segment.width}%` }}/>)}
            <span aria-hidden="true" className="absolute -top-[3px] size-3 rounded-full border-2 border-[#17191D] bg-[#E8F0F5]"
              style={{ left: `calc(${session.position}% - 6px)` }}/>
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-[#8B98A5]"><span>00:00</span><span>24:00</span></div>
        </div>}
        <div className="mt-3 border-t border-white/[0.09] pt-3 text-[10px]">
          <div className="flex items-center gap-1.5 font-semibold text-[#C4D0DA]"><Clock3 size={12}/> Trading schedule</div>
          <div className="mt-2 flex justify-between gap-2 text-[#8C9BA9]">
            <span>Today</span>
            <span className="text-right text-[#D2DCE5]">
              {session.isContinuous ? '24 hours'
                : session.todayWindows?.length ? session.todayWindows.map(w =>
                  `${chartSessionClock(w.openAt, session.timeZone)}–${chartSessionClock(w.closeAt, session.timeZone)}`).join(', ')
                  : session.hasPublishedHours ? 'Closed' : 'Not available'}
            </span>
          </div>
          {!session.isContinuous && session.nextAt != null && <div className="mt-1.5 flex justify-between gap-3 text-[#8C9BA9]">
            <span>{isOpen ? 'Closes' : 'Opens'}</span>
            <span className="text-right text-[#D2DCE5]">{chartSessionClock(session.nextAt, session.timeZone)} ({chartSessionDuration(session.nextAt - now)})</span>
          </div>}
          <div className="mt-2 flex justify-between gap-2 text-[#8C9BA9]">
            <span>Session timezone</span><span className="text-right text-[#D2DCE5]">{session.timeZone}</span>
          </div>
        </div>
        {quoteNote && <p className="mt-3 border-t border-white/10 pt-2 text-[10px] text-[#E5B477]">{quoteNote}. Trading hours do not confirm quote availability.</p>}
        <p className="mt-3 text-[9px] leading-[15px] text-[#778796]">
          Published session schedule; holidays, broker restrictions and live quote availability may differ.
        </p>
      </section>, document.body)}
  </>;
}
