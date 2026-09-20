import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pause, Play, RotateCcw, Search, Tag, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { formatInstrumentPrice, instrumentForSymbol } from '../../../utils/instrumentFormatting.js';

const META_KEY = 'acg-trader-trade-review-meta-v1';

function loadMeta() {
  if (typeof window === 'undefined') return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(META_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function money(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

function tradeKey(trade) {
  return String(trade?.positionId || trade?.id || `${trade?.symbol}-${trade?.executedAt || trade?.closedAt || ''}`);
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function DesktopTradeReview({
  open,
  onClose = () => {},
  positionHistory = [],
  journal = [],
  markets = [],
  onSelectSymbol = () => {},
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState(loadMeta);

  const trades = useMemo(() => {
    const rows = (Array.isArray(positionHistory) ? positionHistory : []).map(item => {
      const key = tradeKey(item);
      const related = (Array.isArray(journal) ? journal : []).filter(event =>
        String(event?.positionId || '') === String(item?.positionId || item?.id || '')
        || (event?.symbol === item?.symbol && event?.type === 'fill')
      );
      return { ...item, reviewKey: key, related };
    });
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(item => `${item.symbol} ${item.side} ${item.closeType || ''}`.toLowerCase().includes(needle));
  }, [journal, positionHistory, query]);

  const selected = trades.find(item => item.reviewKey === selectedId) || trades[0] || null;

  useEffect(() => {
    if (!selectedId && trades[0]) setSelectedId(trades[0].reviewKey);
    if (selectedId && !trades.some(item => item.reviewKey === selectedId)) setSelectedId(trades[0]?.reviewKey || null);
  }, [selectedId, trades]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setProgress(value => {
        if (value >= 100) {
          setPlaying(false);
          return 100;
        }
        return Math.min(100, value + 2);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [playing]);

  const updateMeta = patch => {
    if (!selected) return;
    const next = { ...meta, [selected.reviewKey]: { ...(meta[selected.reviewKey] || {}), ...patch } };
    setMeta(next);
    try { window.localStorage.setItem(META_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };

  if (!open) return null;

  const instrument = selected ? instrumentForSymbol(markets, selected.symbol) : null;
  const entry = numeric(selected?.entry);
  const exit = numeric(selected?.closePrice);
  const side = String(selected?.side || '').toUpperCase();
  const interpolated = entry != null && exit != null ? entry + (exit - entry) * (progress / 100) : null;
  const pnl = numeric(selected?.pnl);
  const replayPnl = pnl != null ? pnl * (progress / 100) : null;
  const selectedMeta = selected ? meta[selected.reviewKey] || {} : {};
  const tags = Array.isArray(selectedMeta.tags) ? selectedMeta.tags : [];

  return (
    <div className="absolute inset-0 z-[150] bg-black/70 backdrop-blur-[2px]">
      <div className="absolute bottom-3 left-[60px] right-3 top-[60px] grid min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.09] bg-[#080808] shadow-[0_24px_80px_rgba(0,0,0,.65)]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.08]">
          <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-3">
            <div><strong className="block text-[9px] font-black tracking-[0.08em] text-[#dce7ef]">TRADE REVIEW</strong><span className="mt-0.5 block text-[7px] text-[#5d7185]">{trades.length} closed trades</span></div>
            <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded text-[#71869a] hover:bg-white/[0.04] hover:text-white"><X size={13}/></button>
          </div>
          <div className="p-2">
            <div className="flex h-7 items-center gap-2 rounded border border-white/[0.07] bg-black px-2 text-[#60758a]"><Search size={11}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search history" className="min-w-0 flex-1 bg-transparent text-[8px] text-[#cbd5dd] outline-none"/></div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {trades.map(trade => {
              const positive = Number(trade.pnl) >= 0;
              const active = selected?.reviewKey === trade.reviewKey;
              const inst = instrumentForSymbol(markets, trade.symbol);
              return (
                <button key={trade.reviewKey} type="button" onClick={() => { setSelectedId(trade.reviewKey); setProgress(100); setPlaying(false); }} className={`grid w-full grid-cols-[1fr_auto] items-center border-b border-white/[0.05] px-2.5 py-2 text-left ${active ? 'border-l-2 border-[#53c7ff] bg-[#081118]' : 'hover:bg-white/[0.018]'}`}>
                  <span className="flex min-w-0 items-center gap-2"><InstrumentAvatar instrument={inst} size={22}/><span className="min-w-0"><b className="block truncate text-[9px] text-[#dce7ef]">{trade.symbol}</b><small className="mt-0.5 block text-[6.5px] text-[#60758a]">{trade.side} · {Number(trade.volume || 0).toFixed(2)} lots</small></span></span>
                  <span className="flex items-center gap-1"><b className={`font-mono text-[8px] ${positive ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{money(trade.pnl, trade.pnlCurrency)}</b><ChevronRight size={10} className="text-[#4d6072]"/></span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto">
          {!selected ? <div className="grid h-full place-items-center text-[9px] text-[#60758a]">No closed trades available.</div> : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-3">
                  <InstrumentAvatar instrument={instrument} size={32}/>
                  <div><div className="flex items-center gap-2"><strong className="text-[14px] font-black text-[#f0f4f7]">{selected.symbol}</strong><span className={`rounded px-1.5 py-1 text-[7px] font-black ${side === 'BUY' ? 'bg-[#0b3327] text-[#42dba6]' : 'bg-[#35151b] text-[#ff727d]'}`}>{side}</span></div><span className="mt-1 block text-[7px] text-[#60758a]">{selected.closeType || 'Closed'} · {selected.closedAt || selected.executedAt || '—'}</span></div>
                </div>
                <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#60758a]">Realized P&L</span><strong className={`mt-1 block font-mono text-[17px] ${Number(selected.pnl) >= 0 ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{money(selected.pnl, selected.pnlCurrency)}</strong></div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                {[['Entry', formatInstrumentPrice(selected.entry, instrument)], ['Exit', formatInstrumentPrice(selected.closePrice, instrument)], ['Size', `${Number(selected.volume || 0).toFixed(2)} lot`], ['Commission', money(selected.commission, selected.pnlCurrency)], ['Slippage', Number(selected.slippage || 0).toFixed(2)]].map(([label, value]) => <div key={label} className="rounded border border-white/[0.06] bg-black px-2 py-2"><span className="block text-[6px] uppercase tracking-[0.07em] text-[#566a7d]">{label}</span><b className="mt-1 block truncate font-mono text-[8.5px] text-[#d8e2ea]">{value}</b></div>)}
              </div>

              <div className="mt-4 rounded-lg border border-white/[0.08] bg-black p-3">
                <div className="flex items-center justify-between">
                  <div><strong className="text-[9px] text-[#dce6ee]">Execution replay</strong><span className="ml-2 text-[7px] text-[#60758a]">Entry → exit path</span></div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { setProgress(0); setPlaying(false); }} className="grid size-7 place-items-center rounded border border-white/[0.07] text-[#71869a] hover:text-white"><RotateCcw size={12}/></button>
                    <button type="button" onClick={() => setPlaying(value => !value)} className="grid size-7 place-items-center rounded border border-[#315b72] bg-[#0d1a22] text-[#63caff]">{playing ? <Pause size={12}/> : <Play size={12}/>}</button>
                  </div>
                </div>
                <div className="mt-4">
                  <input type="range" min="0" max="100" value={progress} onChange={event => { setPlaying(false); setProgress(Number(event.target.value)); }} className="w-full accent-sky-400"/>
                  <div className="mt-2 grid grid-cols-3 text-[7px]">
                    <span className="text-[#60758a]">Entry <b className="ml-1 font-mono text-[#cbd6df]">{formatInstrumentPrice(entry, instrument)}</b></span>
                    <span className="text-center text-[#60758a]">Replay <b className="ml-1 font-mono text-[#63caff]">{formatInstrumentPrice(interpolated, instrument)}</b></span>
                    <span className="text-right text-[#60758a]">Exit <b className="ml-1 font-mono text-[#cbd6df]">{formatInstrumentPrice(exit, instrument)}</b></span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded border border-white/[0.06] bg-[#080808] px-3 py-2">
                    <span className="text-[7px] text-[#60758a]">Replay progress <b className="ml-1 text-[#cbd6df]">{progress}%</b></span>
                    <span className="text-[7px] text-[#60758a]">Projected P&L <b className={`ml-1 font-mono ${Number(replayPnl) >= 0 ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{money(replayPnl, selected.pnlCurrency)}</b></span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_260px] gap-3">
                <div className="rounded-lg border border-white/[0.08] bg-black p-3">
                  <div className="flex items-center justify-between"><strong className="text-[9px] text-[#dce6ee]">Review notes</strong><button type="button" onClick={() => onSelectSymbol(selected.symbol)} className="text-[7px] font-bold text-[#63caff]">Open symbol</button></div>
                  <textarea value={selectedMeta.note || ''} onChange={event => updateMeta({ note: event.target.value })} placeholder="What went well? What would you change?" className="mt-2 min-h-[100px] w-full resize-none rounded border border-white/[0.07] bg-[#080808] p-2 text-[8px] leading-4 text-[#cbd6df] outline-none placeholder:text-[#4e6173]"/>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-black p-3">
                  <div className="flex items-center gap-1.5"><Tag size={11} className="text-[#63caff]"/><strong className="text-[9px] text-[#dce6ee]">Tags</strong></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['A+', 'FOMO', 'News', 'Scalp', 'Trend', 'Revenge'].map(tag => {
                      const active = tags.includes(tag);
                      return <button key={tag} type="button" onClick={() => updateMeta({ tags: active ? tags.filter(item => item !== tag) : [...tags, tag] })} className={`rounded border px-2 py-1 text-[7px] font-bold ${active ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#64788c]'}`}>{tag}</button>;
                    })}
                  </div>
                </div>
              </div>

              {selected.related?.length > 0 && (
                <div className="mt-4 rounded-lg border border-white/[0.08] bg-black p-3">
                  <strong className="text-[9px] text-[#dce6ee]">Trade timeline</strong>
                  <div className="mt-2 space-y-1">
                    {selected.related.slice(0, 8).map(event => <div key={event.id} className="grid grid-cols-[72px_1fr] border-t border-white/[0.05] pt-1.5 text-[7px]"><span className="font-mono text-[#60758a]">{event.time || '—'}</span><span className="text-[#9eafbd]">{event.message}</span></div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
