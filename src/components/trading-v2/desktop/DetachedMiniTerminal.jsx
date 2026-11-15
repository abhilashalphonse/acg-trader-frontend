import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { formatInstrumentPrice } from '../../../utils/instrumentFormatting.js';
import {positionMargin,positionUnrealizedPnl,money} from '../../../utils/v4PositionsPresentation.js';
import './DetachedMiniTerminal.css';

const amount = (value, currency) => value == null || !Number.isFinite(Number(value)) ? '—'
  : `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function MiniTrade({ render, onDock }) {
  return render(onDock);
}

// A portal keeps the terminal's React context and callbacks in the opener.
// No credentials, commands or account snapshots are copied into another app.
export default function DetachedMiniTerminal({
  visible, account, market, markets, positions, pendingOrders, notice,
  positionsLoading, positionsError, onRetryPositions, readOnly,
  onSelectSymbol, renderTrade, renderPosition, renderPending,
}) {
  const host = useRef(null);
  const [container] = useState(() => document.createElement('div'));
  const windowRef = useRef(null);
  const opening = useRef(false);
  const mounted = useRef(false);
  const restoreRef = useRef(null);
  const [detached, setDetached] = useState(false);
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('trade');
  const [selection, setSelection] = useState(null);
  const [ownerAccountId, setOwnerAccountId] = useState(account?.id);
  // Drop management selection synchronously when the active account changes.
  if (ownerAccountId !== account?.id) {
    setOwnerAccountId(account?.id);
    setSelection(null);
  }
  const currency = account?.currency || 'USD';
  const selected = selection?.kind === 'position'
    ? positions.find(item => String(item.id) === selection.id)
    : selection?.kind === 'pending' ? pendingOrders.find(item => String(item.id) === selection.id) : null;

  useEffect(() => {
    mounted.current = true;
    host.current.appendChild(container);
    const close = () => windowRef.current?.close();
    window.addEventListener('pagehide', close);
    return () => {
      mounted.current = false;
      restoreRef.current?.();
      windowRef.current?.close();
      window.removeEventListener('pagehide', close);
      container.remove();
    };
  }, [container]);

  const openWindow = async () => {
    if (windowRef.current && !windowRef.current.closed) { windowRef.current.focus(); return; }
    if (opening.current) return;
    opening.current = true;
    setError('');
    let child;
    try {
      const pip = Boolean(window.documentPictureInPicture?.requestWindow);
      child = pip
        ? await window.documentPictureInPicture.requestWindow({ width: 390, height: 480 })
        : window.open('about:blank', '_blank', 'popup=yes,width=390,height=480');
      if (!child) throw new Error('Allow pop-ups for ACG Trader, then try again.');
      if (!mounted.current) { child.close(); return; }
      windowRef.current = child;
      child.document.title = 'ACG Trader · Mini terminal';
      child.document.documentElement.lang = document.documentElement.lang || 'en';
      const base = child.document.createElement('base');
      base.href = document.baseURI;
      child.document.head.appendChild(base);
      const copied = new Map();
      const syncStyles = () => {
        const sources = new Set(document.querySelectorAll('style, link[rel="stylesheet"]'));
        for (const [source, copy] of copied) {
          if (!sources.has(source)) { copy.remove(); copied.delete(source); }
        }
        for (const source of sources) {
          let copy = copied.get(source);
          if (!copy) {
            copy = source.cloneNode(true);
            if (source.tagName === 'LINK') copy.href = source.href;
            child.document.head.appendChild(copy);
            copied.set(source, copy);
          } else if (source.tagName === 'STYLE' && copy.textContent !== source.textContent) copy.textContent = source.textContent;
        }
      };
      syncStyles();
      const observer = new MutationObserver(syncStyles);
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
      child.document.body.className = `${document.body.className} acg-mini-window`;
      child.document.body.appendChild(container);
      const restore = () => {
        observer.disconnect();
        child.removeEventListener('pagehide', restore);
        if (host.current) host.current.appendChild(container);
        windowRef.current = null;
        restoreRef.current = null;
        if (mounted.current) setDetached(false);
      };
      restoreRef.current = restore;
      child.addEventListener('pagehide', restore, { once: true });
      setMode(pip ? 'Always on top' : 'Separate window');
      setDetached(true);
    } catch (failure) {
      restoreRef.current?.();
      child?.close();
      windowRef.current = null;
      if (mounted.current) setError(failure?.message || 'Unable to open the mini terminal. Try again.');
    } finally { opening.current = false; }
  };

  const dock = () => { const child = windowRef.current; restoreRef.current?.(); child?.close(); };
  const back = () => setSelection(null);
  const instrumentFor = item => markets.find(instrument => instrument.symbol === item.symbol) || null;
  const formatPrice = (value,instrument) => value==null?'—':formatInstrumentPrice(value,instrument);
  const renderRow = item => {
    const instrument=instrumentFor(item);
    const isPosition=tab==='positions';
    const pnl=isPosition?positionUnrealizedPnl(item,account):null;
    const margin=isPosition?positionMargin(item):null;
    return <button type="button" className="acg-mini-row" key={item.id}
      onClick={() => setSelection({kind:isPosition?'position':'pending',id:String(item.id)})}>
      <span className="acg-mini-row-head">
        <span className="acg-mini-row-identity">
          <strong>{instrument?.displaySymbol||item.symbol||'—'}</strong>
          <small>{String(item.side||'—').toUpperCase()} · {item.volume??item.lots??'—'} lots{!isPosition?' · '+String(item.orderType||'Pending').toUpperCase():''}</small>
        </span>
        <span className="acg-mini-manage">Manage ›</span>
      </span>
      <span className="acg-mini-facts">
        {isPosition ? <>
          <span><small>Entry</small><b>{formatPrice(item.entry,instrument)}</b></span>
          <span><small>Current</small><b>{formatPrice(item.closePrice,instrument)}</b></span>
          <span><small>SL / TP</small><b>{formatPrice(item.sl,instrument)} / {formatPrice(item.tp,instrument)}</b></span>
          <span><small>Margin</small><b>{money(margin,currency)}</b></span>
          <span className="acg-mini-pnl"><small>Unrealized P&L</small>
            <b className={pnl.value==null?'':pnl.value<0?'negative':pnl.value>0?'positive':''}>{money(pnl.value,pnl.currency,true)}</b>
          </span>
        </> : <>
          <span><small>Trigger</small><b>{formatPrice(item.stopPrice??item.entry,instrument)}</b></span>
          <span><small>Limit</small><b>{formatPrice(item.limitPrice,instrument)}</b></span>
          <span><small>SL / TP</small><b>{formatPrice(item.sl,instrument)} / {formatPrice(item.tp,instrument)}</b></span>
          <span><small>Status</small><b>{String(item.status||'pending').toUpperCase()}</b></span>
        </>}
      </span>
    </button>;
  };
  const rows = tab === 'positions' ? positions : pendingOrders;
  return <>
    <div ref={host} className="acg-mini-portal-host" aria-hidden={detached || !error} />
    {visible && <button type="button" className="acg-mini-rail-launcher mb-1 grid size-9 place-items-center rounded-md"
      data-acg-mini-launcher="true" aria-label="Pop out mini terminal"
      title={detached?'Focus mini terminal':'Open mini terminal'}
      aria-pressed={detached} onClick={openWindow}>
      <ExternalLink size={17} strokeWidth={1.8}/>
    </button>}
    {createPortal(detached ? (
      <section className="acg-mini-terminal acg-desktop-v3" aria-label="ACG mini terminal">
        <header className="acg-mini-titlebar" title="Keep the main ACG Trader tab open while using this window"><strong><span>ACG</span> TRADER</strong><small>{mode}</small>
          <button type="button" onClick={dock} aria-label="Close mini terminal" title="Close mini terminal"><X size={16}/></button>
        </header>
        {mode==='Separate window'&&<div className="acg-mini-fallback-note" role="status">
          Regular window: it will not stay on top.
        </div>}
        <div className="acg-mini-context">
          <label className="acg-mini-instrument">
            <span className="acg-mini-visually-hidden">Instrument</span>
            <select aria-label="Mini terminal instrument" value={market?.symbol || ''} onChange={event => onSelectSymbol(event.target.value)}>
              {markets.map(item => <option key={item.symbol} value={item.symbol}>{item.displaySymbol || item.symbol}</option>)}
            </select>
          </label>
          <div className="acg-mini-account" title={account?.accountCode || account?.id || 'Account unavailable'}>
            <span>{account?.accountCode || account?.id || 'Account unavailable'}</span>
            <b>{currency}</b>
          </div>
        </div>
        <nav className="acg-mini-tabs" aria-label="Mini terminal sections">{[
          ['trade', 'Trade'], ['orders', `Orders (${pendingOrders.length})`], ['positions', `Positions (${positions.length})`],
        ].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); back(); }}>{label}</button>)}</nav>
        {(readOnly || notice) && <div className="acg-mini-notice" role="status">{readOnly ? 'This account is read only.' : notice}</div>}
        <main className="acg-mini-content">
          {tab === 'trade' ? <MiniTrade render={renderTrade} onDock={dock}/> : <>
            {positionsLoading ? <p className="acg-mini-empty" role="status">Loading account activity…</p>
              : positionsError ? <div className="acg-mini-empty" role="alert">Account activity is unavailable.<button type="button" onClick={onRetryPositions}>Retry</button></div>
                : selected ? <><button type="button" className="acg-mini-back" onClick={back}><ArrowLeft size={14}/> All {tab}</button>
                  {selection.kind === 'position' ? renderPosition(selected, instrumentFor(selected), back) : renderPending(selected, instrumentFor(selected), back)}</>
                  : rows.length ? <div className="acg-mini-rows">{rows.map(renderRow)}</div>
                  : <div className="acg-mini-empty" role="status">
                    <strong>{tab==='positions'?'No open positions':'No pending orders'}</strong>
                    <span>{tab==='positions'?'Your active positions will appear here.':'Orders awaiting execution will appear here.'}</span>
                  </div>}
          </>}
        </main>

      </section>
    ) : (error ? <div className="acg-mini-launcher-error" role="alert">
      <span>{error}</span>
      <button type="button" aria-label="Dismiss pop-out error" onClick={() => setError('')}><X size={12}/></button>
    </div> : null), container)}
  </>;
}
