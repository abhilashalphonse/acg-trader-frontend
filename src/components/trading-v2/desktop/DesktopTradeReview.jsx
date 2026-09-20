import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, Tag, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { formatInstrumentPrice, instrumentForSymbol } from '../../../utils/instrumentFormatting.js';

const META_KEY = 'acg-trader-trade-review-meta-v1';
const FILTERS = [
  ['all', 'All'],
  ['wins', 'Wins'],
  ['losses', 'Losses'],
  ['long', 'Long'],
  ['short', 'Short'],
];

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

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function durationText(openedAt, closedAt) {
  const start = new Date(openedAt || 0).getTime();
  const end = new Date(closedAt || 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) return '—';
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function eventTimestamp(event) {
  const value = event?.executedAt || event?.timestamp || event?.raw?.executedAt || null;
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventTime(event) {
  const value = event?.executedAt || event?.timestamp || event?.raw?.executedAt || null;
  if (!value) return event?.closedAt || event?.time || '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return event?.time || '—';
  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function directionLabel(side) {
  return String(side || '').toUpperCase() === 'SELL' ? 'SHORT' : 'LONG';
}

function buildTimeline(selected, journal) {
  if (!selected) return [];
  const id = String(selected.id || '');
  const serverEvents = (selected.executionEvents || []).map(event => {
    const type = String(event.closeType || event.raw?.type || '').toUpperCase();
    const opening = type === 'OPEN';
    return {
      key: `deal-${event.id}`,
      timestamp: event.executedAt,
      time: eventTime(event),
      source: 'server',
      message: `${opening ? 'Opened' : type === 'PARTIAL_CLOSE' ? 'Partial close' : 'Closed'} · ${event.side} ${Number(event.volume || 0).toFixed(2)} ${event.symbol} @ ${event.closePrice || event.entry}`,
    };
  });

  const journalEvents = (Array.isArray(journal) ? journal : [])
    .filter(event => String(event?.positionId || '') === id)
    .map(event => ({
      key: `journal-${event.id}`,
      timestamp: event.timestamp,
      time: eventTime(event),
      source: 'journal',
      message: event.message,
    }));

  return [...serverEvents, ...journalEvents]
    .sort((a, b) => eventTimestamp(a) - eventTimestamp(b))
    .filter((event, index, array) => index === 0 || event.message !== array[index - 1].message || event.time !== array[index - 1].time);
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
  const [filter, setFilter] = useState('all');
  const [meta, setMeta] = useState(loadMeta);

  const trades = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (Array.isArray(positionHistory) ? positionHistory : [])
      .filter(item => {
        if (filter === 'wins' && !(Number(item.pnl) > 0)) return false;
        if (filter === 'losses' && !(Number(item.pnl) < 0)) return false;
        if (filter === 'long' && String(item.side).toUpperCase() !== 'BUY') return false;
        if (filter === 'short' && String(item.side).toUpperCase() !== 'SELL') return false;
        if (!needle) return true;
        return `${item.symbol} ${item.side} ${item.closeType || ''}`.toLowerCase().includes(needle);
      });
  }, [filter, positionHistory, query]);

  const selected = trades.find(item => String(item.id) === String(selectedId)) || trades[0] || null;

  useEffect(() => {
    if (!selectedId && trades[0]) setSelectedId(String(trades[0].id));
    if (selectedId && !trades.some(item => String(item.id) === String(selectedId))) setSelectedId(trades[0] ? String(trades[0].id) : null);
  }, [selectedId, trades]);

  const updateMeta = patch => {
    if (!selected) return;
    const key = String(selected.id);
    const next = { ...meta, [key]: { ...(meta[key] || {}), ...patch } };
    setMeta(next);
    try { window.localStorage.setItem(META_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };

  if (!open) return null;

  const instrument = selected ? instrumentForSymbol(markets, selected.symbol) : null;
  const side = String(selected?.side || '').toUpperCase();
  const selectedMeta = selected ? meta[String(selected.id)] || {} : {};
  const tags = Array.isArray(selectedMeta.tags) ? selectedMeta.tags : [];
  const timeline = buildTimeline(selected, journal);
  const journalContext = selected
    ? (Array.isArray(journal) ? journal : []).find(event => String(event?.positionId || '') === String(selected.id) && Number.isFinite(Number(event?.plannedRisk)))
    : null;
  const plannedRisk = numeric(journalContext?.plannedRisk);
  const realizedR = plannedRisk && plannedRisk > 0 && Number.isFinite(Number(selected?.pnl)) ? Number(selected.pnl) / plannedRisk : null;
  const duration = selected ? durationText(selected.openedAtIso, selected.closedAtIso) : '—';
  const totalCosts = selected ? (Number(selected.commission || 0) + Number(selected.swap || 0)) : 0;

  return (
    <div className="absolute inset-0 z-[150] bg-black/70 backdrop-blur-[2px]">
      <div className="absolute bottom-3 left-[60px] right-3 top-[60px] grid min-h-0 grid-cols-[310px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.09] bg-[#080808] shadow-[0_24px_80px_rgba(0,0,0,.65)]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.08]">
          <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-3">
            <div><strong className="block text-[9px] font-black tracking-[0.08em] text-[#dce7ef]">TRADE REVIEW</strong><span className="mt-0.5 block text-[7px] text-[#5d7185]">{positionHistory.length} closed positions</span></div>
            <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded text-[#71869a] hover:bg-white/[0.04] hover:text-white"><X size={13}/></button>
          </div>

          <div className="p-2 pb-1">
            <div className="flex h-7 items-center gap-2 rounded border border-white/[0.07] bg-black px-2 text-[#60758a]"><Search size={11}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search closed positions" className="min-w-0 flex-1 bg-transparent text-[8px] text-[#cbd5dd] outline-none"/></div>
          </div>

          <div className="flex shrink-0 gap-1 overflow-x-auto px-2 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`h-6 shrink-0 rounded border px-2 text-[6.5px] font-bold ${filter === id ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.055] text-[#60758a]'}`}>{label}</button>)}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!trades.length && <div className="grid h-28 place-items-center px-4 text-center text-[8px] text-[#5f7388]">No closed positions match this filter.</div>}
            {trades.map(trade => {
              const positive = Number(trade.pnl) >= 0;
              const active = String(selected?.id) === String(trade.id);
              const inst = instrumentForSymbol(markets, trade.symbol);
              const riskEvent = (Array.isArray(journal) ? journal : []).find(event => String(event?.positionId || '') === String(trade.id) && Number.isFinite(Number(event?.plannedRisk)));
              const risk = numeric(riskEvent?.plannedRisk);
              const rValue = risk && risk > 0 ? Number(trade.pnl) / risk : null;
              return (
                <button key={trade.id} type="button" onClick={() => setSelectedId(String(trade.id))} className={`grid w-full grid-cols-[1fr_auto] items-center border-b border-white/[0.05] px-2.5 py-2 text-left ${active ? 'border-l-[3px] border-[#53c7ff] bg-[#081118]' : 'border-l-[3px] border-transparent hover:bg-white/[0.018]'}`}>
                  <span className="flex min-w-0 items-center gap-2"><InstrumentAvatar instrument={inst} size={22}/><span className="min-w-0"><span className="flex items-center gap-1.5"><b className="truncate text-[9px] text-[#dce7ef]">{trade.symbol}</b><small className={`text-[6px] font-black ${trade.side === 'BUY' ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{directionLabel(trade.side)}</small></span><small className="mt-0.5 block truncate text-[6.5px] text-[#60758a]">{Number(trade.volume || 0).toFixed(2)} lots · {rValue == null ? durationText(trade.openedAtIso, trade.closedAtIso) : `${rValue >= 0 ? '+' : ''}${rValue.toFixed(2)}R · ${durationText(trade.openedAtIso, trade.closedAtIso)}`}</small></span></span>
                  <span className="flex items-center gap-1"><b className={`font-mono text-[8px] ${positive ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{money(trade.pnl, trade.pnlCurrency)}</b><ChevronRight size={10} className="text-[#4d6072]"/></span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto">
          {!selected ? <div className="grid h-full place-items-center text-[9px] text-[#60758a]">No closed positions available.</div> : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-3">
                  <InstrumentAvatar instrument={instrument} size={32}/>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-[14px] font-black text-[#f0f4f7]">{selected.symbol}</strong>
                      <span className={`rounded px-1.5 py-1 text-[7px] font-black ${side === 'BUY' ? 'bg-[#0b3327] text-[#42dba6]' : 'bg-[#35151b] text-[#ff727d]'}`}>{directionLabel(side)}</span>
                    </div>
                    <span className="mt-1 block text-[7px] text-[#60758a]">{selected.closeType || 'CLOSED'} · {selected.closedAt || '—'} · {duration}</span>
                  </div>
                </div>
                <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#60758a]">Realized P&amp;L</span><strong className={`mt-1 block font-mono text-[17px] ${Number(selected.pnl) >= 0 ? 'text-[#42dba6]' : 'text-[#ff727d]'}`}>{money(selected.pnl, selected.pnlCurrency)}</strong></div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  ['Entry', formatInstrumentPrice(selected.entry, instrument)],
                  ['Exit', formatInstrumentPrice(selected.closePrice, instrument)],
                  ['Size', `${Number(selected.volume || 0).toFixed(2)} lot`],
                  ['Duration', duration],
                  ['Initial risk', plannedRisk == null ? '—' : money(plannedRisk, selected.pnlCurrency)],
                  ['Result', realizedR == null ? '—' : `${realizedR >= 0 ? '+' : ''}${realizedR.toFixed(2)}R`],
                  ['Costs', money(totalCosts, selected.pnlCurrency)],
                  ['Exit reason', selected.closeType || 'CLOSED'],
                ].map(([label, value]) => <div key={label} className="rounded border border-white/[0.06] bg-black px-2 py-2"><span className="block text-[6px] uppercase tracking-[0.07em] text-[#566a7d]">{label}</span><b className="mt-1 block truncate font-mono text-[8.5px] text-[#d8e2ea]">{value}</b></div>)}
              </div>

              <div className="mt-4 rounded-lg border border-white/[0.08] bg-black p-3">
                <div className="flex items-center justify-between">
                  <div><strong className="text-[9px] text-[#dce6ee]">Execution path</strong><span className="ml-2 text-[7px] text-[#60758a]">Server-recorded entry and final exit</span></div>
                  <span className="rounded border border-white/[0.06] px-2 py-1 text-[6px] font-bold uppercase text-[#687c90]">Not market replay</span>
                </div>
                <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div><span className="block text-[6px] uppercase text-[#53677a]">Entry</span><b className="mt-1 block font-mono text-[9px] text-[#d6e0e8]">{formatInstrumentPrice(selected.entry, instrument)}</b></div>
                  <div className="relative h-px bg-white/[0.12]"><span className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#63caff]"/><span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#dfe8ef]"/></div>
                  <div className="text-right"><span className="block text-[6px] uppercase text-[#53677a]">Exit</span><b className="mt-1 block font-mono text-[9px] text-[#d6e0e8]">{formatInstrumentPrice(selected.closePrice, instrument)}</b></div>
                </div>
                <div className="mt-3 rounded border border-white/[0.05] bg-[#080808] px-3 py-2 text-[6.5px] leading-3 text-[#5f7388]">Historical candle playback is not fabricated here. This view only shows executions recorded by the server; full candle replay can be added once historical candles are wired to the review window.</div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_260px] gap-3">
                <div className="rounded-lg border border-white/[0.08] bg-black p-3">
                  <div className="flex items-center justify-between"><strong className="text-[9px] text-[#dce6ee]">Review notes</strong><button type="button" onClick={() => onSelectSymbol(selected.symbol)} className="text-[7px] font-bold text-[#63caff]">Open symbol</button></div>
                  <textarea value={selectedMeta.note || ''} onChange={event => updateMeta({ note: event.target.value })} placeholder="What went well? What would you change?" className="mt-2 min-h-[100px] w-full resize-none rounded border border-white/[0.07] bg-[#080808] p-2 text-[8px] leading-4 text-[#cbd6df] outline-none placeholder:text-[#4e6173]"/>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-black p-3">
                  <div className="flex items-center gap-1.5"><Tag size={11} className="text-[#63caff]"/><strong className="text-[9px] text-[#dce6ee]">Review tags</strong></div>
                  <div className="mt-2 text-[6px] font-black uppercase tracking-[0.07em] text-[#53677a]">Setup</div>
                  <div className="mt-1 flex flex-wrap gap-1">{['A+', 'Scalp', 'Trend', 'News'].map(tag => { const active = tags.includes(tag); return <button key={tag} type="button" onClick={() => updateMeta({ tags: active ? tags.filter(item => item !== tag) : [...tags, tag] })} className={`rounded border px-2 py-1 text-[7px] font-bold ${active ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#64788c]'}`}>{tag}</button>; })}</div>
                  <div className="mt-2 text-[6px] font-black uppercase tracking-[0.07em] text-[#53677a]">Behavior</div>
                  <div className="mt-1 flex flex-wrap gap-1">{['FOMO', 'Revenge', 'Overtrade'].map(tag => { const active = tags.includes(tag); return <button key={tag} type="button" onClick={() => updateMeta({ tags: active ? tags.filter(item => item !== tag) : [...tags, tag] })} className={`rounded border px-2 py-1 text-[7px] font-bold ${active ? 'border-[#6d2d37] bg-[#210b10] text-[#ff8b94]' : 'border-white/[0.06] text-[#64788c]'}`}>{tag}</button>; })}</div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-white/[0.08] bg-black p-3">
                <div className="flex items-center justify-between"><strong className="text-[9px] text-[#dce6ee]">Position timeline</strong><span className="text-[6.5px] text-[#5f7388]">{timeline.length} events</span></div>
                <div className="mt-2">
                  {!timeline.length ? <div className="py-5 text-center text-[7px] text-[#5f7388]">No execution events were recorded for this position.</div> : timeline.map(event => <div key={event.key} className="grid grid-cols-[72px_60px_1fr] border-t border-white/[0.05] py-1.5 text-[7px]"><span className="font-mono text-[#60758a]">{event.time}</span><span className={event.source === 'server' ? 'font-bold text-[#63caff]' : 'font-bold text-[#7e91a3]'}>{event.source === 'server' ? 'SERVER' : 'JOURNAL'}</span><span className="text-[#9eafbd]">{event.message}</span></div>)}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
