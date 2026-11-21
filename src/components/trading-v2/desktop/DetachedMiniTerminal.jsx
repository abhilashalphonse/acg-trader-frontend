import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronDown, ExternalLink, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { formatInstrumentPrice, instrumentDigits } from '../../../utils/instrumentFormatting.js';
import {positionUnrealizedPnl,money} from '../../../utils/v4PositionsPresentation.js';
import './DetachedMiniTerminal.css';

const amount = (value, currency) => value == null || !Number.isFinite(Number(value)) ? '—'
  : `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function MiniTrade({ render, onDock }) {
  return render(onDock);
}

// A portal keeps the terminal's React context and callbacks in the opener.
// No credentials, commands or account snapshots are copied into another app.
const DetachedMiniTerminal = React.forwardRef(function DetachedMiniTerminal({
  account, market, markets, positions, pendingOrders, notice,
  positionsLoading, positionsError, onRetryPositions, readOnly,
  onSelectSymbol, renderTrade, renderPosition, renderPending, onReadyChange,
}, ref) {
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
  const freshQuote = market?.isStale!==true && market?.sessionOpen!==false
    && !['STALE','CLOSED','WAITING','DISCONNECTED','ERROR','DISABLED'].includes(
      String(market?.marketState||'').toUpperCase());
  const numericPrice = Number(market?.price ?? market?.last ?? market?.close);
  const bid=Number(market?.bid), ask=Number(market?.ask);
  const displayedPrice = Number.isFinite(numericPrice) && numericPrice>0 ? numericPrice
    : Number.isFinite(bid) && Number.isFinite(ask) && bid>0 && ask>=bid
      ? (bid+ask)/2 : null;
  // Display a change percentage only when the provider explicitly supplies it.
  const changeSource = [market?.changePercent,market?.change24hPercent,
    market?.priceChangePercent,market?.percentChange24h].find(
      value=>value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value)));
  const change = changeSource===undefined ? null : Number(changeSource);
  const changeTone=change===null?'neutral':change>0?'positive':change<0?'negative':'neutral';
  const displayMarketPrice = value => {
    const raw=formatInstrumentPrice(value,market);
    const numeric=Number(raw);
    if(!Number.isFinite(numeric))return raw;
    const digits=instrumentDigits(market);
    return numeric.toLocaleString('en-US',{
      minimumFractionDigits:digits,maximumFractionDigits:digits,
    });
  };
  const marketType=String(market?.instrumentType||market?.type||'').toUpperCase();
  const showCfd=marketType==='CFD'||['METAL','ENERGY','INDEX'].includes(
    String(market?.assetClass||'').toUpperCase());
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
        ? await window.documentPictureInPicture.requestWindow({ width: 270, height: 560 })
        : window.open('about:blank', '_blank', 'popup=yes,width=270,height=560');
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

  // The header invokes this imperatively during the user's click, preserving
  // the browser's popup activation permission. Never open from an effect.
  React.useImperativeHandle(ref, () => ({ open: openWindow }));
  useEffect(() => {
    onReadyChange?.(true);
    return () => onReadyChange?.(false);
  }, [onReadyChange]);

  const dock = () => { const child = windowRef.current; restoreRef.current?.(); child?.close(); };
  const back = () => setSelection(null);
  const instrumentFor = item => markets.find(instrument => instrument.symbol === item.symbol) || null;
  const formatPrice = (value,instrument) => value==null?'—':formatInstrumentPrice(value,instrument);
  const renderRow = item => {
    const instrument=instrumentFor(item);
    const isPosition=tab==='positions';
    const pnl=isPosition?positionUnrealizedPnl(item,account):null;
    const pnlText=pnl ? money(pnl.value,pnl.currency,true):'—';
    return <button type="button" className="acg-mini-row" key={item.id}
      onClick={() => setSelection({kind:isPosition?'position':'pending',id:String(item.id)})}>
      <span className="acg-mini-row-head">
        <span className="acg-mini-row-identity">
          <strong>{instrument?.displaySymbol||item.symbol||'—'}</strong>
          <small className={String(item.side||'').toUpperCase()==='BUY'?'buy':'sell'}>
            {String(item.side||'—').toUpperCase()}
          </small>
        </span>
        <b className={pnl?.value>0?'positive':pnl?.value<0?'negative':''}>
          {isPosition?pnlText:String(item.status||'pending').toUpperCase()}
        </b>
      </span>
      <span className="acg-mini-row-volume">{item.volume??item.lots??'—'} Lots
        {!isPosition?' · '+String(item.orderType||'Pending').toUpperCase():''}</span>
      <span className="acg-mini-facts">
        {isPosition ? <>
          <span><small>Entry</small><b>{formatPrice(item.entry,instrument)}</b></span>
          <span><small>Current</small><b>{formatPrice(item.closePrice,instrument)}</b></span>
          <span><small>SL</small><b>{formatPrice(item.sl,instrument)}</b></span>
          <span><small>TP</small><b>{formatPrice(item.tp,instrument)}</b></span>
        </> : <>
          <span><small>Trigger</small><b>{formatPrice(item.stopPrice??item.entry,instrument)}</b></span>
          <span><small>Limit</small><b>{formatPrice(item.limitPrice,instrument)}</b></span>
          <span><small>SL</small><b>{formatPrice(item.sl,instrument)}</b></span>
          <span><small>TP</small><b>{formatPrice(item.tp,instrument)}</b></span>
        </>}
      </span>
    </button>;
  };
  const rows = tab === 'positions' ? positions : pendingOrders;
  return <>
    <div ref={host} className="acg-mini-portal-host" aria-hidden={detached || !error} />
    {createPortal(detached ? (
      <section className="acg-mini-terminal acg-desktop-v3" aria-label="ACG mini terminal" data-window-mode={mode}>
        <header className="acg-mini-titlebar" title={account?.accountCode||account?.id||'ACG Trader'}>
          <span className="acg-mini-brand">
            <img src="/acg-logo.png" alt="" />
            <strong>ACG Trader</strong>
          </span>
          <span className="acg-mini-titlebar-actions">
            <button type="button" onClick={()=>window.focus()}
              aria-label="Focus main trading terminal" title="Focus main trading terminal">
              <ExternalLink size={16}/>
            </button>
            <button type="button" onClick={dock}
              aria-label="Close mini terminal" title="Close mini terminal">
              <X size={17}/>
            </button>
          </span>
        </header>
        {mode==='Separate window'&&<span className="acg-mini-visually-hidden" role="status">
          Regular window: it will not stay on top.
        </span>}
        <div className="acg-mini-context">
          <span className="acg-mini-market-avatar" aria-hidden="true">
            <InstrumentAvatar instrument={market} size={27}/>
          </span>
          <div className="acg-mini-market-identity">
            <div className="acg-mini-symbol-line">
              <label className="acg-mini-instrument">
                <span className="acg-mini-visually-hidden">Instrument</span>
                <select aria-label="Mini terminal instrument"
                  value={market?.symbol || ''} onChange={event => onSelectSymbol(event.target.value)}>
                  {markets.map(item=><option key={item.symbol} value={item.symbol}>
                    {item.displaySymbol||item.symbol}
                  </option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true"/>
              </label>
              {showCfd&&<span className="acg-mini-cfd">CFD</span>}
            </div>
            <span className="acg-mini-market-name">
              {market?.name||market?.displayName||market?.symbol||'Instrument unavailable'}
            </span>
          </div>
          <div className="acg-mini-market-price" data-tone={changeTone}
            aria-label="Market price and reported price change">
            <strong>{displayedPrice!==null?displayMarketPrice(displayedPrice):'—'}</strong>
            {change!==null
              ? <small>{change>0?'+':''}{change.toFixed(2)}%</small>
              : !freshQuote?<small>Market unavailable</small>:null}
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
                  </div>}
          </>}
        </main>

      </section>
    ) : (error ? <div className="acg-mini-launcher-error" role="alert">
      <span>{error}</span>
      <button type="button" aria-label="Dismiss pop-out error" onClick={() => setError('')}><X size={12}/></button>
    </div> : null), container)}
  </>;
});

export default DetachedMiniTerminal;
