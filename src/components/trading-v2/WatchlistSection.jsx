import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GripVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import InstrumentAvatar from './InstrumentAvatar.jsx';

function displaySymbol(item) {
  const symbol = item?.displaySymbol || item?.symbol || '';
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol || '—';
}

function spreadLabel(item) {
  const bid = Number(item?.bid);
  const ask = Number(item?.ask);
  if (!item?.subscribed || !Number.isFinite(bid) || !Number.isFinite(ask)) return '—';
  return formatInstrumentPrice(Math.abs(ask - bid), item);
}

function marketStatus(item) {
  if (item?.sessionOpen === false) return { label: 'CLOSED', className: 'text-[#8a9bab]', dot: 'bg-[#101010]' };
  if (item?.live === true) return { label: 'LIVE', className: 'text-[#42d9a5]', dot: 'bg-[#42d9a5]' };
  if (item?.isStale === true) return { label: 'STALE', className: 'text-[#e8c35f]', dot: 'bg-[#101010]' };

  const state = String(item?.marketState || 'WAITING').toUpperCase();
  if (state === 'SUBSCRIPTION_ERROR' || state === 'ERROR') return { label: 'ERROR', className: 'text-[#ff7882]', dot: 'bg-[#ff7882]' };
  if (state === 'DISCONNECTED') return { label: 'OFFLINE', className: 'text-[#ff7882]', dot: 'bg-[#ff7882]' };
  return { label: state === 'WAITING' ? 'WAITING' : state, className: 'text-[#71869a]', dot: 'bg-[#101010]' };
}

export default function WatchlistSection({
  markets = [],
  activeSymbol,
  onOpenTrade = () => {},
  onAddInstrument = () => {},
  watchlists = null,
}) {
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draggedSymbol, setDraggedSymbol] = useState(null);

  const workspace = watchlists?.workspace || { activeListId: 'favorites', lists: [] };
  const activeList = watchlists?.activeList || { id: 'favorites', name: 'Favorites', symbols: [] };

  const marketBySymbol = useMemo(
    () => new Map(markets.map(item => [item.symbol, item])),
    [markets],
  );

  const rows = useMemo(
    () => (activeList.symbols || []).map(symbol => marketBySymbol.get(symbol)).filter(Boolean),
    [activeList.symbols, marketBySymbol],
  );

  const createList = () => {
    const name = window.prompt('Watchlist name', 'New Watchlist')?.trim();
    if (!name) return;
    watchlists?.createList?.(name);
    setEditing(false);
    setListOpen(false);
  };

  const dropOn = targetSymbol => {
    if (!draggedSymbol || draggedSymbol === targetSymbol) return;
    watchlists?.moveSymbol?.(draggedSymbol, targetSymbol);
    setDraggedSymbol(null);
  };

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-5 pt-3">
      <header className="flex items-start justify-between gap-3 pb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5e7489]">Markets</p>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Watchlist</h1>
          <p className="mt-1 text-[10px] text-[#6f8296]">Fast access to the markets you actually trade.</p>
        </div>
        <button
          type="button"
          onClick={onAddInstrument}
          className="mt-1 flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#101010] px-3 text-[10px] font-extrabold text-[#64c9ff] shadow-[inset_0_1px_rgba(255,255,255,.03)]"
        >
          <Plus size={15} /> Add
        </button>
      </header>

      <div className="relative mb-3">
        <button
          type="button"
          onClick={() => setListOpen(value => !value)}
          className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-left text-[#d5e0e9] hover:bg-white/[0.025]"
        >
          <Star size={13} className="text-[#f6c85c]" fill="currentColor" />
          <span className="text-[10px] font-bold">{activeList.name}</span>
          <span className="text-[8px] text-[#60758a]">{activeList.symbols.length}</span>
          <ChevronDown size={11} className="text-[#60758a]" />
        </button>

        {listOpen && (
          <div className="absolute left-0 top-10 z-40 min-w-[210px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#080808] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.5)]">
            {workspace.lists.map(list => (
              <button
                key={list.id}
                type="button"
                onClick={() => {
                  watchlists?.setActiveListId?.(list.id);
                  setEditing(false);
                  setListOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${activeList.id === list.id ? 'bg-[#101010] text-[#61caff]' : 'text-[#b3c0cc] hover:bg-white/[0.04]'}`}
              >
                <span>{list.name}</span>
                <span className="text-[7px] text-[#62778b]">{list.symbols.length}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={createList}
              className="mt-1 flex w-full items-center gap-2 border-t border-white/[0.08] px-2.5 py-2.5 text-left text-[9px] font-bold text-[#62caff]"
            >
              <Plus size={12} /> New watchlist
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#080808] shadow-[0_16px_45px_rgba(0,0,0,.22)]">
        {!editing && (
          <div className="grid grid-cols-[minmax(0,1fr)_70px_70px_52px] gap-1 border-b border-white/[0.08] px-3 py-2.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#52677b]">
            <span>Instrument</span>
            <span className="text-right">Bid</span>
            <span className="text-right">Ask</span>
            <span className="text-right">Spread</span>
          </div>
        )}

        {editing && (
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
            <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#52677b]">Arrange watchlist</span>
            <span className="text-[8px] text-[#5f7488]">Drag or use arrows</span>
          </div>
        )}

        {rows.length ? rows.map((item, index) => {
          const selected = item.symbol === activeSymbol;
          const status = marketStatus(item);

          if (editing) {
            return (
              <div
                key={item.symbol}
                draggable
                onDragStart={() => setDraggedSymbol(item.symbol)}
                onDragEnd={() => setDraggedSymbol(null)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => dropOn(item.symbol)}
                className={`flex items-center gap-2 border-b border-white/[0.08] px-3 py-2.5 last:border-b-0 ${draggedSymbol === item.symbol ? 'opacity-50' : ''}`}
              >
                <GripVertical size={15} className="shrink-0 cursor-grab text-[#53687b]" />
                <InstrumentAvatar instrument={item} size={28} />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[11px] font-black text-[#eaf1f6]">{displaySymbol(item)}</strong>
                  <span className={`mt-1 flex items-center gap-1.5 text-[7px] font-bold ${status.className}`}>
                    <span className={`size-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => watchlists?.moveSymbolBy?.(item.symbol, -1)}
                  disabled={index === 0}
                  className="grid size-8 place-items-center rounded-lg text-[#7e92a5] hover:bg-white/[0.04] hover:text-white disabled:opacity-20"
                  aria-label={`Move ${item.symbol} up`}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => watchlists?.moveSymbolBy?.(item.symbol, 1)}
                  disabled={index === rows.length - 1}
                  className="grid size-8 place-items-center rounded-lg text-[#7e92a5] hover:bg-white/[0.04] hover:text-white disabled:opacity-20"
                  aria-label={`Move ${item.symbol} down`}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => watchlists?.removeSymbol?.(item.symbol)}
                  className="grid size-8 place-items-center rounded-lg text-[#8a6670] hover:bg-[#31151c] hover:text-[#ff7882]"
                  aria-label={`Remove ${item.symbol} from watchlist`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={item.symbol}
              type="button"
              onClick={() => onOpenTrade(item.symbol)}
              className={`relative grid w-full grid-cols-[minmax(0,1fr)_70px_70px_52px] items-center gap-1 border-b border-white/[0.08] px-3 py-3 text-left last:border-b-0 ${selected ? 'bg-[#101010]' : 'hover:bg-white/[0.018]'}`}
            >
              {selected && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-[#101010]" />}
              <span className="flex min-w-0 items-center gap-2">
                <InstrumentAvatar instrument={item} size={30} />
                <span className="min-w-0">
                  <strong className="block truncate text-[11px] font-black tracking-[-0.015em] text-[#edf3f7]">{displaySymbol(item)}</strong>
                  <span className={`mt-1 flex items-center gap-1.5 text-[7px] font-bold ${status.className}`}>
                    <span className={`size-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </span>
              </span>
              <strong className="text-right font-mono text-[10px] font-semibold text-[#cbd7df]">{formatInstrumentPrice(item.bid, item)}</strong>
              <strong className="text-right font-mono text-[10px] font-semibold text-[#9fb2c2]">{formatInstrumentPrice(item.ask, item)}</strong>
              <strong className="text-right font-mono text-[9px] font-bold text-[#8397aa]">{spreadLabel(item)}</strong>
            </button>
          );
        }) : (
          <div className="grid min-h-[220px] place-items-center px-8 text-center">
            <div>
              <Star size={25} className="mx-auto text-[#466075]" />
              <strong className="mt-3 block text-[12px] text-[#aebdca]">{activeList.name} is empty</strong>
              <p className="mt-1 text-[9px] leading-4 text-[#62778b]">Add the markets you trade most. The full 300-market universe stays in Add markets.</p>
              <button
                type="button"
                onClick={onAddInstrument}
                className="mt-3 rounded-xl border border-white/[0.08] bg-[#101010] px-4 py-2.5 text-[10px] font-bold text-[#61caff]"
              >
                Add markets
              </button>
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <button
          type="button"
          onClick={() => setEditing(value => !value)}
          className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-[10px] font-bold transition ${editing ? 'border-white/[0.13] bg-[#101010] text-[#68ccff]' : 'border-white/[0.08] bg-[#080808] text-[#74899d] hover:text-[#b9c8d5]'}`}
        >
          {editing ? <Check size={14} /> : <Pencil size={13} />}
          {editing ? 'Done editing' : 'Edit watchlist'}
        </button>
      )}
    </section>
  );
}
